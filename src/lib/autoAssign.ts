import "server-only";
import { getSupabaseAdmin } from "./supabase";
import { getRound, getRoundRooms } from "./booking";
import { listHourSlots } from "./schedule";
import { sendBookingConfirmationEmail } from "./email";
import type { RoundId, Room, Participant, Booking } from "./types";

export interface AssignmentEntry {
  participant_id: string;
  dia: string;
  hora: string | null; // hora de actuación (informativa); null si no se pudo determinar
}

export interface AssignmentSummary {
  participant_id: string;
  nombre: string;
  horas_asignadas: number;
  email_enviado: boolean;
  aviso?: string;
}

/**
 * Asigna automáticamente las horas de estudio de un participante para el día
 * de su actuación: prioriza las franjas anteriores a la hora de actuación y
 * completa el resto después, hasta el máximo diario, respetando aulas ya
 * ocupadas, bloqueos, y las horas que el participante ya se hubiera reservado.
 */
async function autoAssignDayForParticipant(
  roundId: RoundId,
  dia: string,
  rooms: Room[],
  allHoras: string[],
  maxHorasDia: number,
  participantId: string,
  performanceHora: string | null
): Promise<number> {
  const supabase = getSupabaseAdmin();

  const [{ data: misReservas }, { data: ocupadas }, { data: bloqueadas }] = await Promise.all([
    supabase
      .from("bookings")
      .select("hora, room_id")
      .eq("round_id", roundId)
      .eq("dia", dia)
      .eq("participant_id", participantId),
    supabase.from("bookings").select("hora, room_id").eq("round_id", roundId).eq("dia", dia),
    supabase.from("blocked_slots").select("hora, room_id").eq("round_id", roundId).eq("dia", dia),
  ]);

  const horasYaMias = new Set((misReservas ?? []).map((b) => b.hora as string));
  const ocupadasKeys = new Set((ocupadas ?? []).map((b) => `${b.room_id}|${b.hora}`));
  const bloqueadasKeys = new Set((bloqueadas ?? []).map((b) => `${b.room_id}|${b.hora}`));

  let restantes = maxHorasDia - horasYaMias.size;
  if (restantes <= 0) return horasYaMias.size;

  const candidatas = allHoras.filter((h) => !horasYaMias.has(h));

  const antes = performanceHora ? candidatas.filter((h) => h < performanceHora) : candidatas;
  const despues = performanceHora ? candidatas.filter((h) => h >= performanceHora) : [];
  // Más cercanas a la actuación primero
  antes.sort((a, b) => b.localeCompare(a));
  despues.sort((a, b) => a.localeCompare(b));
  const ordenPrioridad = [...antes, ...despues];

  const nuevas: { room_id: string; hora: string }[] = [];
  let roomsDistintas = new Set((misReservas ?? []).map((b) => b.room_id as string));

  for (const hora of ordenPrioridad) {
    if (restantes <= 0) break;

    // Preferimos reutilizar un aula ya asignada a este participante ese día
    const preferida = rooms.find(
      (r) => roomsDistintas.has(r.id) && !ocupadasKeys.has(`${r.id}|${hora}`) && !bloqueadasKeys.has(`${r.id}|${hora}`)
    );
    const libre =
      preferida ??
      rooms.find((r) => !ocupadasKeys.has(`${r.id}|${hora}`) && !bloqueadasKeys.has(`${r.id}|${hora}`));

    if (!libre) continue; // no queda ningún aula libre a esa hora

    if (!preferida && roomsDistintas.size >= 4) continue; // no exceder 4 aulas distintas

    nuevas.push({ room_id: libre.id, hora });
    ocupadasKeys.add(`${libre.id}|${hora}`);
    roomsDistintas = new Set([...roomsDistintas, libre.id]);
    restantes--;
  }

  if (nuevas.length > 0) {
    await supabase.from("bookings").insert(
      nuevas.map((n) => ({
        participant_id: participantId,
        round_id: roundId,
        dia,
        room_id: n.room_id,
        hora: n.hora,
        source: "admin_auto" as const,
      }))
    );
  }

  return horasYaMias.size + nuevas.length;
}

export async function applyAutoAssignment(
  roundId: RoundId,
  entries: AssignmentEntry[]
): Promise<AssignmentSummary[]> {
  const supabase = getSupabaseAdmin();
  const round = await getRound(roundId);
  if (!round) throw new Error("La ronda no existe.");

  const rooms = await getRoundRooms(roundId);
  const allHoras = listHourSlots(round.hora_inicio, round.hora_fin);

  const summaries: AssignmentSummary[] = [];

  for (const entry of entries) {
    const { data: participant } = await supabase
      .from("participants")
      .select("*")
      .eq("id", entry.participant_id)
      .maybeSingle<Participant>();

    if (!participant) continue;

    await supabase.from("participant_performances").upsert(
      {
        participant_id: entry.participant_id,
        round_id: roundId,
        performance_day: entry.dia,
        performance_hour: entry.hora,
      },
      { onConflict: "participant_id,round_id" }
    );

    const totalHoras = await autoAssignDayForParticipant(
      roundId,
      entry.dia,
      rooms,
      allHoras,
      round.max_horas_dia,
      entry.participant_id,
      entry.hora
    );

    const { data: bookingsDelDia } = await supabase
      .from("bookings")
      .select("*")
      .eq("round_id", roundId)
      .eq("participant_id", entry.participant_id);

    const emailResult = await sendBookingConfirmationEmail(
      participant,
      round,
      (bookingsDelDia ?? []) as Booking[],
      rooms
    );

    summaries.push({
      participant_id: participant.id,
      nombre: participant.nombre,
      horas_asignadas: totalHoras,
      email_enviado: emailResult.ok,
      aviso: totalHoras < round.max_horas_dia ? "No se pudo completar el máximo de horas: no quedaban aulas libres." : undefined,
    });
  }

  return summaries;
}
