import "server-only";
import { getSupabaseAdmin, fetchAllRows } from "./supabase";
import { getRound, getRoundRooms } from "./booking";
import { listHourSlots } from "./schedule";
import { sendBookingConfirmationEmail } from "./email";
import { MinCostFlow } from "./minCostFlow";
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

/**
 * Coste (menor = más preferido) de cada hora candidata para un participante
 * en un día concreto: el día de su actuación prioriza lo más cercano
 * posible a esa hora (antes primero, luego después); los otros días usan
 * igualmente su hora de actuación como referencia, para no concentrar a
 * todo el mundo en la misma franja. Estos costes solo influyen en CUÁL de
 * varias soluciones igual de completas se elige; el reparto en sí lo
 * garantiza el flujo de coste mínimo (ver `resolverHorasDelDia`).
 */
function rankHoras(candidatas: string[], performanceHoraHoy: string | null, horaAncla: string | null): Map<string, number> {
  let ordenadas: string[];
  if (performanceHoraHoy) {
    const antes = candidatas.filter((h) => h < performanceHoraHoy).sort((a, b) => b.localeCompare(a));
    const despues = candidatas.filter((h) => h >= performanceHoraHoy).sort((a, b) => a.localeCompare(b));
    ordenadas = [...antes, ...despues];
  } else if (horaAncla) {
    const anclaMin = timeToMinutes(horaAncla);
    ordenadas = [...candidatas].sort(
      (a, b) => Math.abs(timeToMinutes(a) - anclaMin) - Math.abs(timeToMinutes(b) - anclaMin)
    );
  } else {
    ordenadas = [...candidatas].sort((a, b) => a.localeCompare(b));
  }
  const rank = new Map<string, number>();
  ordenadas.forEach((h, i) => rank.set(h, i));
  return rank;
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

function contarOcupadasPorHora(
  dia: string,
  allHoras: string[],
  rooms: Room[],
  ocupadas: ReadonlySet<string>,
  bloqueadas: ReadonlySet<string>
): Map<string, number> {
  const conteo = new Map<string, number>();
  for (const hora of allHoras) {
    let count = 0;
    for (const r of rooms) {
      if (ocupadas.has(`${dia}|${r.id}|${hora}`) || bloqueadas.has(`${dia}|${r.id}|${hora}`)) count++;
    }
    conteo.set(hora, count);
  }
  return conteo;
}

/**
 * Calcula, para un día concreto, qué HORAS (todavía sin aula concreta) le
 * corresponden a cada participante, mediante flujo de coste mínimo:
 * participante -> horas candidatas -> aforo disponible por hora. Como el
 * aforo total (aulas × horas) suele sobrar frente a la demanda (98
 * participantes × 4h en 30 aulas × 14h), esto encuentra el reparto que
 * maximiza cuántas horas se cubren en total (no una aproximación greedy que
 * puede dejar huecos sin usar), y entre los repartos igual de completos
 * prefiere el de menor coste (más cercano a la hora de actuación de cada
 * uno).
 */
function resolverHorasDelDia(
  dia: string,
  round: { max_horas_dia: number },
  rooms: Room[],
  allHoras: string[],
  entries: AssignmentEntry[],
  horasYaAsignadasPorParticipante: ReadonlyMap<string, ReadonlySet<string>>,
  ocupadasPorHora: ReadonlyMap<string, number>
): Map<string, string[]> {
  const N = entries.length;
  const H = allHoras.length;
  const SOURCE = 0;
  const SINK = N + H + 1;
  const mcf = new MinCostFlow(N + H + 2);
  const horaIndex = new Map(allHoras.map((h, i) => [h, i]));

  let edgeCounter = 0;
  const participantHoraEdges: { participantId: string; hora: string; edgeIndex: number }[] = [];

  entries.forEach((entry, i) => {
    const horasYaMias = horasYaAsignadasPorParticipante.get(entry.participant_id) ?? new Set<string>();
    const necesarias = Math.max(0, round.max_horas_dia - horasYaMias.size);
    mcf.addEdge(SOURCE, i + 1, necesarias, 0);
    edgeCounter++;

    if (necesarias === 0) return;

    const candidatas = allHoras.filter((h) => !horasYaMias.has(h));
    const performanceHoraHoy = dia === entry.dia ? entry.hora : null;
    const rank = rankHoras(candidatas, performanceHoraHoy, entry.hora);

    for (const h of candidatas) {
      const hi = horaIndex.get(h)!;
      mcf.addEdge(i + 1, N + 1 + hi, 1, rank.get(h) ?? candidatas.length);
      participantHoraEdges.push({ participantId: entry.participant_id, hora: h, edgeIndex: edgeCounter });
      edgeCounter++;
    }
  });

  allHoras.forEach((hora, hi) => {
    const ocupadasYa = ocupadasPorHora.get(hora) ?? 0;
    const capacidad = Math.max(0, rooms.length - ocupadasYa);
    mcf.addEdge(N + 1 + hi, SINK, capacidad, 0);
    edgeCounter++;
  });

  mcf.run(SOURCE, SINK);

  const resultado = new Map<string, string[]>();
  for (const { participantId, hora, edgeIndex } of participantHoraEdges) {
    if (mcf.flowOfEdge(edgeIndex) > 0) {
      if (!resultado.has(participantId)) resultado.set(participantId, []);
      resultado.get(participantId)!.push(hora);
    }
  }
  return resultado;
}

/**
 * Reparte aulas concretas para las horas ya decididas por
 * `resolverHorasDelDia`. Como el flujo garantiza que, para cada hora, el
 * número de personas que la necesitan no supera el aforo de aulas libres en
 * esa hora, cualquier asignación 1-a-1 dentro de esa hora es válida; solo
 * intentamos reutilizar la misma aula del participante en horas
 * consecutivas para que tenga que moverse de aula lo menos posible.
 */
function asignarAulasParaHoras(
  dia: string,
  roundId: RoundId,
  rooms: Room[],
  allHoras: string[],
  bloqueadas: ReadonlySet<string>,
  ocupadas: Set<string>,
  horasPorParticipante: ReadonlyMap<string, string[]>
): { participant_id: string; round_id: RoundId; dia: string; room_id: string; hora: string; source: "admin_auto" }[] {
  const nuevas: {
    participant_id: string;
    round_id: RoundId;
    dia: string;
    room_id: string;
    hora: string;
    source: "admin_auto";
  }[] = [];
  const ultimaAulaPorParticipante = new Map<string, string>();

  for (const hora of allHoras) {
    for (const [participantId, horas] of horasPorParticipante) {
      if (!horas.includes(hora)) continue;

      const preferidaId = ultimaAulaPorParticipante.get(participantId);
      const preferida = preferidaId
        ? rooms.find(
            (r) => r.id === preferidaId && !ocupadas.has(`${dia}|${r.id}|${hora}`) && !bloqueadas.has(`${dia}|${r.id}|${hora}`)
          )
        : undefined;
      const libre =
        preferida ?? rooms.find((r) => !ocupadas.has(`${dia}|${r.id}|${hora}`) && !bloqueadas.has(`${dia}|${r.id}|${hora}`));

      if (!libre) continue; // no debería ocurrir: el flujo ya calculó el aforo disponible en esta hora

      ocupadas.add(`${dia}|${libre.id}|${hora}`);
      ultimaAulaPorParticipante.set(participantId, libre.id);
      nuevas.push({ participant_id: participantId, round_id: roundId, dia, room_id: libre.id, hora, source: "admin_auto" });
    }
  }

  return nuevas;
}

/**
 * Asigna automáticamente las horas de estudio de cada participante en los
 * TRES días de la ronda. Para cada día se resuelve un flujo de coste
 * mínimo (participante -> horas candidatas -> aforo por hora) que
 * garantiza el máximo de horas cubiertas posible dado el aforo real de
 * aulas, no solo una heurística de mejor esfuerzo; el coste de cada hora
 * para cada participante prioriza la cercanía a su hora de actuación.
 * Respeta en todo momento aulas ya ocupadas, bloqueos, y las horas que el
 * participante ya se hubiera reservado por su cuenta. Procesa todo en
 * memoria y hace una única escritura en bloque para poder manejar de golpe
 * los ~98 participantes de una ronda sin agotar el tiempo de una función
 * serverless.
 */
export async function applyAutoAssignment(
  roundId: RoundId,
  entries: AssignmentEntry[],
  opts: { enviarCorreos?: boolean } = {}
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

  for (const b of bookingsData ?? []) {
    ocupadas.add(`${b.dia}|${b.room_id}|${b.hora}`);
    const key = `${b.participant_id}|${b.dia}`;
    if (!misHorasPorDia.has(key)) misHorasPorDia.set(key, new Set());
    misHorasPorDia.get(key)!.add(b.hora);
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

  const nuevasReservas: {
    participant_id: string;
    round_id: RoundId;
    dia: string;
    room_id: string;
    hora: string;
    source: "admin_auto";
  }[] = [];
  const acumulado = new Map<string, { totalHorasRonda: number; faltaronAulas: boolean }>();
  for (const entry of entries) {
    acumulado.set(entry.participant_id, { totalHorasRonda: 0, faltaronAulas: false });
  }

  for (const dia of round.dias) {
    const ocupadasPorHora = contarOcupadasPorHora(dia, allHoras, rooms, ocupadas, bloqueadas);
    const horasYaAsignadasPorParticipante = new Map<string, ReadonlySet<string>>(
      entries.map((e) => [e.participant_id, misHorasPorDia.get(`${e.participant_id}|${dia}`) ?? new Set<string>()])
    );

    const horasPorParticipante = resolverHorasDelDia(
      dia,
      round,
      rooms,
      allHoras,
      entries,
      horasYaAsignadasPorParticipante,
      ocupadasPorHora
    );

    const nuevasDelDia = asignarAulasParaHoras(dia, roundId, rooms, allHoras, bloqueadas, ocupadas, horasPorParticipante);
    nuevasReservas.push(...nuevasDelDia);

    for (const entry of entries) {
      const key = `${entry.participant_id}|${dia}`;
      const yaMias = misHorasPorDia.get(key) ?? new Set<string>();
      for (const h of horasPorParticipante.get(entry.participant_id) ?? []) yaMias.add(h);
      misHorasPorDia.set(key, yaMias);

      const acc = acumulado.get(entry.participant_id)!;
      acc.totalHorasRonda += yaMias.size;
      if (yaMias.size < round.max_horas_dia) acc.faltaronAulas = true;
    }
  }

  const summaries: AssignmentSummary[] = [];
  for (const entry of entries) {
    const participant = participantsById.get(entry.participant_id);
    if (!participant) continue;
    const acc = acumulado.get(entry.participant_id)!;
    summaries.push({
      participant_id: participant.id,
      nombre: participant.nombre,
      horas_asignadas: acc.totalHorasRonda,
      horas_totales_ronda: round.dias.length * round.max_horas_dia,
      email_enviado: false,
      aviso: acc.faltaronAulas
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

  if (opts.enviarCorreos === false) {
    return summaries;
  }

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
