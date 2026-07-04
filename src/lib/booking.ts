import "server-only";
import { getSupabaseAdmin, fetchAllRows } from "./supabase";
import { listHourSlots } from "./schedule";
import type {
  Round,
  Room,
  BlockedSlot,
  Booking,
  RoundId,
  Participant,
} from "./types";

export class BookingError extends Error {}

export async function getRound(roundId: string): Promise<Round | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from("rounds").select("*").eq("id", roundId).maybeSingle();
  return data as Round | null;
}

export async function getAllRounds(): Promise<Round[]> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from("rounds").select("*").order("orden");
  return (data ?? []) as Round[];
}

export async function getRoundRooms(roundId: string): Promise<Room[]> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("round_rooms")
    .select("room_id, rooms(*)")
    .eq("round_id", roundId);

  return ((data ?? []) as unknown as { rooms: Room }[])
    .map((r) => r.rooms)
    .sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true }));
}

interface DaySlot {
  room_id: string;
  hora: string;
  status: "libre" | "mia" | "ocupada" | "bloqueada";
  ocupante?: string;
}

export interface DayState {
  dia: string;
  slots: DaySlot[];
  horas_reservadas_mias: number;
}

/**
 * Calcula el estado de cada franja (aula x hora) de una ronda para todos sus días.
 * `viewerParticipantId` marca sus propias reservas como 'mia'; si se omite,
 * se usa la vista de administración (incluye el nombre del ocupante).
 */
export async function getRoundDaysState(
  round: Round,
  rooms: Room[],
  opts: { viewerParticipantId?: string; includeNames?: boolean } = {}
): Promise<DayState[]> {
  const supabase = getSupabaseAdmin();
  const horas = listHourSlots(round.hora_inicio, round.hora_fin);

  const bookings = await fetchAllRows<{
    dia: string;
    room_id: string;
    hora: string;
    participant_id: string;
    participants: { nombre: string } | null;
  }>(
    (from, to) =>
      supabase
        .from("bookings")
        .select("dia, room_id, hora, participant_id, participants(nombre)")
        .eq("round_id", round.id)
        .range(from, to) as unknown as PromiseLike<{
        data:
          | {
              dia: string;
              room_id: string;
              hora: string;
              participant_id: string;
              participants: { nombre: string } | null;
            }[]
          | null;
        error: { message: string } | null;
      }>
  );

  const blocked = await fetchAllRows<{ dia: string; room_id: string; hora: string }>((from, to) =>
    supabase.from("blocked_slots").select("dia, room_id, hora").eq("round_id", round.id).range(from, to)
  );

  const bookingsByKey = new Map<
    string,
    { participant_id: string; nombre?: string }
  >();
  for (const b of bookings) {
    bookingsByKey.set(`${b.dia}|${b.room_id}|${b.hora}`, {
      participant_id: b.participant_id,
      nombre: b.participants?.nombre,
    });
  }

  const blockedKeys = new Set(blocked.map((b) => `${b.dia}|${b.room_id}|${b.hora}`));

  return round.dias.map((dia) => {
    let horasReservadasMias = 0;
    const slots: DaySlot[] = [];

    for (const room of rooms) {
      for (const hora of horas) {
        const key = `${dia}|${room.id}|${hora}`;
        const booking = bookingsByKey.get(key);
        const isBlocked = blockedKeys.has(key);

        let status: DaySlot["status"] = "libre";
        let ocupante: string | undefined;

        if (isBlocked) {
          status = "bloqueada";
        } else if (booking) {
          if (opts.viewerParticipantId && booking.participant_id === opts.viewerParticipantId) {
            status = "mia";
            horasReservadasMias++;
          } else {
            status = "ocupada";
            if (opts.includeNames) ocupante = booking.nombre;
          }
        }

        slots.push({ room_id: room.id, hora, status, ocupante });
      }
    }

    return { dia, slots, horas_reservadas_mias: horasReservadasMias };
  });
}

export interface BookingSelection {
  room_id: string;
  hora: string;
}

/**
 * Valida y aplica una selección de franjas para un participante en un día
 * concreto de una ronda. Lanza BookingError con un mensaje apto para el
 * usuario si alguna regla de negocio no se cumple. Todas las reglas se
 * validan aquí en el servidor, nunca solo en el cliente.
 */
export async function createParticipantBookings(
  participant: Participant,
  roundId: RoundId,
  dia: string,
  seleccion: BookingSelection[]
): Promise<Booking[]> {
  if (seleccion.length === 0) {
    throw new BookingError("No has seleccionado ninguna hora.");
  }

  const round = await getRound(roundId);
  if (!round) throw new BookingError("La ronda no existe.");

  if (!participant.rondas_clasificado.includes(roundId)) {
    throw new BookingError("No estás clasificado para esta ronda.");
  }
  if (!round.unlocked) {
    throw new BookingError("Esta ronda todavía no está abierta para reservas.");
  }
  if (!round.dias.includes(dia)) {
    throw new BookingError("Ese día no pertenece a esta ronda.");
  }

  const validHoras = new Set(listHourSlots(round.hora_inicio, round.hora_fin));
  const rooms = await getRoundRooms(roundId);
  const validRoomIds = new Set(rooms.map((r) => r.id));

  const horasEnSeleccion = new Set<string>();
  for (const s of seleccion) {
    if (!validRoomIds.has(s.room_id)) {
      throw new BookingError("Alguna de las aulas seleccionadas no pertenece a esta ronda.");
    }
    if (!validHoras.has(s.hora)) {
      throw new BookingError("Alguna de las horas seleccionadas no es válida.");
    }
    if (horasEnSeleccion.has(s.hora)) {
      throw new BookingError("No puedes reservar dos aulas a la misma hora.");
    }
    horasEnSeleccion.add(s.hora);
  }

  const supabase = getSupabaseAdmin();

  // Horas que ya tiene reservadas ese día (de cualquier selección previa)
  const { data: existing } = await supabase
    .from("bookings")
    .select("hora")
    .eq("participant_id", participant.id)
    .eq("round_id", roundId)
    .eq("dia", dia);

  const horasExistentes = new Set((existing ?? []).map((b) => b.hora as string));
  for (const hora of horasEnSeleccion) {
    if (horasExistentes.has(hora)) {
      throw new BookingError("Ya tienes una reserva a esa hora ese día.");
    }
  }

  const totalHoras = horasExistentes.size + horasEnSeleccion.size;
  if (totalHoras > round.max_horas_dia) {
    throw new BookingError(
      `Solo puedes reservar un máximo de ${round.max_horas_dia} horas al día en esta ronda.`
    );
  }

  const roomIdsEnSeleccion = [...new Set(seleccion.map((s) => s.room_id))];
  if (roomIdsEnSeleccion.length > 4) {
    throw new BookingError("Solo puedes usar hasta 4 aulas distintas en un mismo día.");
  }

  // Comprobar bloqueos y ocupación actual justo antes de insertar
  const { data: blockedNow } = await supabase
    .from("blocked_slots")
    .select("room_id, hora")
    .eq("round_id", roundId)
    .eq("dia", dia);
  const blockedKeys = new Set((blockedNow ?? []).map((b) => `${b.room_id}|${b.hora}`));

  const { data: bookedNow } = await supabase
    .from("bookings")
    .select("room_id, hora")
    .eq("round_id", roundId)
    .eq("dia", dia);
  const bookedKeys = new Set((bookedNow ?? []).map((b) => `${b.room_id}|${b.hora}`));

  for (const s of seleccion) {
    const key = `${s.room_id}|${s.hora}`;
    if (blockedKeys.has(key)) {
      throw new BookingError("Una de las franjas elegidas está bloqueada. Actualiza la página e inténtalo de nuevo.");
    }
    if (bookedKeys.has(key)) {
      throw new BookingError("Una de las franjas elegidas acaba de ser reservada por otra persona.");
    }
  }

  const rows = seleccion.map((s) => ({
    participant_id: participant.id,
    round_id: roundId,
    dia,
    room_id: s.room_id,
    hora: s.hora,
    source: "participant" as const,
  }));

  const { data: inserted, error } = await supabase.from("bookings").insert(rows).select("*");

  if (error) {
    // La constraint UNIQUE puede saltar por condición de carrera con otra petición simultánea
    throw new BookingError(
      "No se pudo guardar la reserva: alguna franja ya no está disponible. Actualiza la página e inténtalo de nuevo."
    );
  }

  return (inserted ?? []) as Booking[];
}
