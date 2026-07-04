import "server-only";
import { getSupabaseAdmin } from "./supabase";
import { getRound, getRoundRooms } from "./booking";
import { listHourSlots } from "./schedule";
import { sendBookingConfirmationEmail } from "./email";
import type { RoundId, Room, Participant, Booking } from "./types";

export interface AssignmentEntry {
  participant_id: string;
  dia: string; // día de actuación
  hora: string | null; // hora de actuación (informativa); null si no se pudo determinar
}

export interface AssignmentSummary {
  participant_id: string;
  nombre: string;
  horas_asignadas: number;
  horas_totales_ronda: number;
  email_enviado: boolean;
  aviso?: string;
}

function priorityOrder(candidatas: string[], performanceHora: string | null): string[] {
  if (!performanceHora) {
    // Sin actuación ese día: sin preferencia horaria, de más temprano a más tarde.
    return [...candidatas].sort((a, b) => a.localeCompare(b));
  }
  const antes = candidatas.filter((h) => h < performanceHora).sort((a, b) => b.localeCompare(a));
  const despues = candidatas.filter((h) => h >= performanceHora).sort((a, b) => a.localeCompare(b));
  return [...antes, ...despues];
}

async function mapWithConcurrency<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const current = idx++;
      await fn(items[current]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

/**
 * Asigna automáticamente las horas de estudio de cada participante en los
 * TRES días de la ronda: el día de su actuación prioriza las franjas
 * anteriores a la hora de actuación y completa el resto después; los otros
 * días se rellenan sin preferencia horaria. Respeta en todo momento aulas
 * ya ocupadas, bloqueos, y las horas que el participante ya se hubiera
 * reservado por su cuenta. Procesa todo en memoria y hace una única
 * escritura en bloque para poder manejar de golpe los ~98 participantes de
 * una ronda sin agotar el tiempo de una función serverless.
 */
export async function applyAutoAssignment(
  roundId: RoundId,
  entries: AssignmentEntry[]
): Promise<AssignmentSummary[]> {
  const supabase = getSupabaseAdmin();
  const round = await getRound(roundId);
  if (!round) throw new Error("La ronda no existe.");

  const rooms = await getRoundRooms(roundId);
  const allHoras = listHourSlots(round.hora_inicio, round.hora_fin);
  const participantIds = entries.map((e) => e.participant_id);

  const [{ data: participantsData }, { data: bookingsData }, { data: blockedData }] = await Promise.all([
    supabase.from("participants").select("*").in("id", participantIds),
    supabase.from("bookings").select("participant_id, dia, room_id, hora").eq("round_id", roundId),
    supabase.from("blocked_slots").select("dia, room_id, hora").eq("round_id", roundId),
  ]);

  const participantsById = new Map(((participantsData ?? []) as Participant[]).map((p) => [p.id, p]));

  const ocupadas = new Set<string>(); // `${dia}|${room_id}|${hora}`
  const bloqueadas = new Set<string>(); // `${dia}|${room_id}|${hora}`
  const misHorasPorDia = new Map<string, Set<string>>(); // `${participant_id}|${dia}` -> horas
  const misAulasPorDia = new Map<string, Set<string>>(); // `${participant_id}|${dia}` -> room_ids

  for (const b of bookingsData ?? []) {
    ocupadas.add(`${b.dia}|${b.room_id}|${b.hora}`);
    const key = `${b.participant_id}|${b.dia}`;
    if (!misHorasPorDia.has(key)) misHorasPorDia.set(key, new Set());
    misHorasPorDia.get(key)!.add(b.hora);
    if (!misAulasPorDia.has(key)) misAulasPorDia.set(key, new Set());
    misAulasPorDia.get(key)!.add(b.room_id);
  }
  for (const b of blockedData ?? []) {
    bloqueadas.add(`${b.dia}|${b.room_id}|${b.hora}`);
  }

  const nuevasReservas: {
    participant_id: string;
    round_id: RoundId;
    dia: string;
    room_id: string;
    hora: string;
    source: "admin_auto";
  }[] = [];
  const performanceRows: {
    participant_id: string;
    round_id: RoundId;
    performance_day: string;
    performance_hour: string | null;
  }[] = [];
  const summaries: AssignmentSummary[] = [];

  for (const entry of entries) {
    const participant = participantsById.get(entry.participant_id);
    if (!participant) continue;

    performanceRows.push({
      participant_id: entry.participant_id,
      round_id: roundId,
      performance_day: entry.dia,
      performance_hour: entry.hora,
    });

    let totalHorasRonda = 0;
    let faltaronAulas = false;

    for (const dia of round.dias) {
      const performanceHora = dia === entry.dia ? entry.hora : null;
      const key = `${entry.participant_id}|${dia}`;
      const horasYaMias = misHorasPorDia.get(key) ?? new Set<string>();
      const aulasDelDia = misAulasPorDia.get(key) ?? new Set<string>();
      let restantes = round.max_horas_dia - horasYaMias.size;

      if (restantes > 0) {
        const candidatas = allHoras.filter((h) => !horasYaMias.has(h));
        const orden = priorityOrder(candidatas, performanceHora);

        for (const hora of orden) {
          if (restantes <= 0) break;

          const preferida = rooms.find(
            (r) =>
              aulasDelDia.has(r.id) &&
              !ocupadas.has(`${dia}|${r.id}|${hora}`) &&
              !bloqueadas.has(`${dia}|${r.id}|${hora}`)
          );
          const libre =
            preferida ??
            rooms.find((r) => !ocupadas.has(`${dia}|${r.id}|${hora}`) && !bloqueadas.has(`${dia}|${r.id}|${hora}`));

          if (!libre) continue;
          if (!preferida && aulasDelDia.size >= 4) continue;

          nuevasReservas.push({
            participant_id: entry.participant_id,
            round_id: roundId,
            dia,
            room_id: libre.id,
            hora,
            source: "admin_auto",
          });
          ocupadas.add(`${dia}|${libre.id}|${hora}`);
          aulasDelDia.add(libre.id);
          horasYaMias.add(hora);
          restantes--;
        }

        if (restantes > 0) faltaronAulas = true;
      }

      misHorasPorDia.set(key, horasYaMias);
      misAulasPorDia.set(key, aulasDelDia);
      totalHorasRonda += horasYaMias.size;
    }

    summaries.push({
      participant_id: participant.id,
      nombre: participant.nombre,
      horas_asignadas: totalHorasRonda,
      horas_totales_ronda: round.dias.length * round.max_horas_dia,
      email_enviado: false,
      aviso: faltaronAulas
        ? "No se pudo completar el máximo de horas algún día: no quedaban aulas libres."
        : undefined,
    });
  }

  if (nuevasReservas.length > 0) {
    const { error } = await supabase.from("bookings").insert(nuevasReservas);
    if (error) throw new Error("No se pudieron guardar las reservas: " + error.message);
  }

  if (performanceRows.length > 0) {
    const { error } = await supabase
      .from("participant_performances")
      .upsert(performanceRows, { onConflict: "participant_id,round_id" });
    if (error) throw new Error("No se pudo guardar la actuación: " + error.message);
  }

  const summaryById = new Map(summaries.map((s) => [s.participant_id, s]));

  await mapWithConcurrency(entries, 5, async (entry) => {
    const participant = participantsById.get(entry.participant_id);
    const summary = summaryById.get(entry.participant_id);
    if (!participant || !summary) return;

    const { data: bookingsDelParticipante } = await supabase
      .from("bookings")
      .select("*")
      .eq("round_id", roundId)
      .eq("participant_id", entry.participant_id);

    const result = await sendBookingConfirmationEmail(
      participant,
      round,
      (bookingsDelParticipante ?? []) as Booking[],
      rooms
    );
    summary.email_enviado = result.ok;
  });

  return summaries;
}
