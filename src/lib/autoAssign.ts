import "server-only";
import { getSupabaseAdmin, fetchAllRows } from "./supabase";
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

function timeToMinutes(hhmmss: string): number {
  const [h, m] = hhmmss.split(":").map(Number);
  return h * 60 + m;
}

// El día de la actuación se prioriza lo más cercano posible a esa hora
// (antes primero, luego después). En los otros días no hay actuación que
// respetar, pero usamos igualmente la hora de actuación de cada persona
// como "ancla" de preferencia (en vez de empezar siempre por la mañana):
// si todo el mundo sin actuación ese día prefiriera arrancar a las 09:00,
// las primeras horas se saturan enseguida y quien se procese más tarde en
// el reparto se queda sin nada, aunque sobren huecos al final del día.
// Repartir la preferencia según la hora de actuación de cada uno evita ese
// atasco.
function priorityOrder(candidatas: string[], performanceHoraHoy: string | null, horaAncla: string | null): string[] {
  if (performanceHoraHoy) {
    const antes = candidatas.filter((h) => h < performanceHoraHoy).sort((a, b) => b.localeCompare(a));
    const despues = candidatas.filter((h) => h >= performanceHoraHoy).sort((a, b) => a.localeCompare(b));
    return [...antes, ...despues];
  }
  if (!horaAncla) {
    return [...candidatas].sort((a, b) => a.localeCompare(b));
  }
  const anclaMin = timeToMinutes(horaAncla);
  return [...candidatas].sort((a, b) => Math.abs(timeToMinutes(a) - anclaMin) - Math.abs(timeToMinutes(b) - anclaMin));
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

// Generador determinista (sin dependencias) para barajar el orden de
// participantes de cada día. Cada "intento" de reparto usa una semilla
// distinta; nos quedamos con el resultado que menos horas deja sin asignar.
function shuffleDeterminista<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed + 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface ResultadoReparto {
  nuevasReservas: {
    participant_id: string;
    round_id: RoundId;
    dia: string;
    room_id: string;
    hora: string;
    source: "admin_auto";
  }[];
  totalHorasPorParticipante: Map<string, number>;
  faltaronAulasPorParticipante: Set<string>;
  totalFaltante: number;
}

// Ejecuta una simulación completa (día por día) del reparto en memoria, sin
// tocar la base de datos, partiendo siempre de la misma ocupación ya
// existente. `ordenPorDia` decide en qué orden se atiende a los
// participantes cada día; probamos varios órdenes y nos quedamos con el que
// menos horas deja sin cubrir en total (ver `elegirMejorReparto`).
function simularReparto(
  round: { dias: string[]; max_horas_dia: number },
  rooms: Room[],
  allHoras: string[],
  entries: AssignmentEntry[],
  roundId: RoundId,
  ocupadasBase: ReadonlySet<string>,
  bloqueadas: ReadonlySet<string>,
  misHorasPorDiaBase: ReadonlyMap<string, ReadonlySet<string>>,
  misAulasPorDiaBase: ReadonlyMap<string, ReadonlySet<string>>,
  ordenPorDia: (dayIndex: number) => AssignmentEntry[]
): ResultadoReparto {
  const ocupadas = new Set(ocupadasBase);
  const misHorasPorDia = new Map<string, Set<string>>();
  const misAulasPorDia = new Map<string, Set<string>>();
  for (const [k, v] of misHorasPorDiaBase) misHorasPorDia.set(k, new Set(v));
  for (const [k, v] of misAulasPorDiaBase) misAulasPorDia.set(k, new Set(v));

  const nuevasReservas: ResultadoReparto["nuevasReservas"] = [];
  const totalHorasPorParticipante = new Map<string, number>();
  const faltaronAulasPorParticipante = new Set<string>();

  round.dias.forEach((dia, dayIndex) => {
    const ordenDelDia = ordenPorDia(dayIndex);

    for (const entry of ordenDelDia) {
      const performanceHoraHoy = dia === entry.dia ? entry.hora : null;
      const key = `${entry.participant_id}|${dia}`;
      const horasYaMias = misHorasPorDia.get(key) ?? new Set<string>();
      const aulasDelDia = misAulasPorDia.get(key) ?? new Set<string>();
      let restantes = round.max_horas_dia - horasYaMias.size;

      if (restantes > 0) {
        const candidatas = allHoras.filter((h) => !horasYaMias.has(h));
        const orden = priorityOrder(candidatas, performanceHoraHoy, entry.hora);

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
      }

      misHorasPorDia.set(key, horasYaMias);
      misAulasPorDia.set(key, aulasDelDia);
      if (restantes > 0) faltaronAulasPorParticipante.add(entry.participant_id);
    }
  });

  for (const entry of entries) {
    let total = 0;
    for (const dia of round.dias) {
      total += misHorasPorDia.get(`${entry.participant_id}|${dia}`)?.size ?? 0;
    }
    totalHorasPorParticipante.set(entry.participant_id, total);
  }

  const objetivo = round.dias.length * round.max_horas_dia;
  const totalFaltante = entries.reduce(
    (acc, e) => acc + (objetivo - (totalHorasPorParticipante.get(e.participant_id) ?? 0)),
    0
  );

  return { nuevasReservas, totalHorasPorParticipante, faltaronAulasPorParticipante, totalFaltante };
}

const INTENTOS_DE_REPARTO = 60;

// Prueba varias rotaciones distintas del orden de participantes por día (un
// "multi-start" barato) y se queda con la que menos horas deja sin cubrir
// en total. Con ~98 participantes cada intento tarda unos ms, así que 60
// intentos son ~1-2s: un margen muy cómodo dentro del tiempo disponible de
// la función serverless.
function elegirMejorReparto(
  round: { dias: string[]; max_horas_dia: number },
  rooms: Room[],
  allHoras: string[],
  entries: AssignmentEntry[],
  roundId: RoundId,
  ocupadasBase: ReadonlySet<string>,
  bloqueadas: ReadonlySet<string>,
  misHorasPorDiaBase: ReadonlyMap<string, ReadonlySet<string>>,
  misAulasPorDiaBase: ReadonlyMap<string, ReadonlySet<string>>
): ResultadoReparto {
  let mejor: ResultadoReparto | null = null;

  for (let intento = 0; intento < INTENTOS_DE_REPARTO; intento++) {
    const ordenPorDia = (dayIndex: number) => shuffleDeterminista(entries, intento * 1000 + dayIndex * 7919);
    const resultado = simularReparto(
      round,
      rooms,
      allHoras,
      entries,
      roundId,
      ocupadasBase,
      bloqueadas,
      misHorasPorDiaBase,
      misAulasPorDiaBase,
      ordenPorDia
    );
    if (!mejor || resultado.totalFaltante < mejor.totalFaltante) mejor = resultado;
    if (mejor.totalFaltante === 0) break;
  }

  return mejor!;
}

/**
 * Asigna automáticamente las horas de estudio de cada participante en los
 * TRES días de la ronda: el día de su actuación prioriza las franjas
 * anteriores a la hora de actuación y completa el resto después; los otros
 * días también usan la hora de actuación como referencia para no
 * concentrar a todo el mundo en las primeras horas del día. Respeta en todo
 * momento aulas ya ocupadas, bloqueos, y las horas que el participante ya
 * se hubiera reservado por su cuenta. Prueba varias rotaciones del orden de
 * atención (`elegirMejorReparto`) y se queda con la que mejor reparte el
 * aforo disponible. Procesa todo en memoria y hace una única escritura en
 * bloque para poder manejar de golpe los ~98 participantes de una ronda sin
 * agotar el tiempo de una función serverless.
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

  const [{ data: participantsData }, bookingsData, blockedData] = await Promise.all([
    supabase.from("participants").select("*").in("id", participantIds),
    fetchAllRows<{ participant_id: string; dia: string; room_id: string; hora: string }>((from, to) =>
      supabase
        .from("bookings")
        .select("participant_id, dia, room_id, hora")
        .eq("round_id", roundId)
        .range(from, to)
    ),
    fetchAllRows<{ dia: string; room_id: string; hora: string }>((from, to) =>
      supabase.from("blocked_slots").select("dia, room_id, hora").eq("round_id", roundId).range(from, to)
    ),
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

  const performanceRows = entries
    .filter((e) => participantsById.has(e.participant_id))
    .map((e) => ({
      participant_id: e.participant_id,
      round_id: roundId,
      performance_day: e.dia,
      performance_hour: e.hora,
    }));

  // Probamos varias rotaciones del orden de participantes por día y nos
  // quedamos con la que menos horas deja sin cubrir en total (ver
  // `elegirMejorReparto`), en vez de aplicar una única rotación fija.
  const mejorReparto = elegirMejorReparto(
    round,
    rooms,
    allHoras,
    entries,
    roundId,
    ocupadas,
    bloqueadas,
    misHorasPorDia,
    misAulasPorDia
  );

  const summaries: AssignmentSummary[] = [];
  for (const entry of entries) {
    const participant = participantsById.get(entry.participant_id);
    if (!participant) continue;
    summaries.push({
      participant_id: participant.id,
      nombre: participant.nombre,
      horas_asignadas: mejorReparto.totalHorasPorParticipante.get(entry.participant_id) ?? 0,
      horas_totales_ronda: round.dias.length * round.max_horas_dia,
      email_enviado: false,
      aviso: mejorReparto.faltaronAulasPorParticipante.has(entry.participant_id)
        ? "No se pudo completar el máximo de horas algún día: no quedaban aulas libres."
        : undefined,
    });
  }

  if (mejorReparto.nuevasReservas.length > 0) {
    const { error } = await supabase.from("bookings").insert(mejorReparto.nuevasReservas);
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
