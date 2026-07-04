import "server-only";
import ExcelJS from "exceljs";
import { getSupabaseAdmin, fetchAllRows } from "./supabase";
import { getRound } from "./booking";
import { formatDia, formatHora } from "./schedule";
import type { RoundId, Booking, Room, Participant } from "./types";

export interface ReportRow {
  dia: string;
  hora: string;
  aula: string;
  participante: string;
  correo: string;
  codigo: string;
}

async function joinRows(bookings: Booking[], rooms: Room[], participants: Participant[]): Promise<ReportRow[]> {
  const roomsById = new Map(rooms.map((r) => [r.id, r]));
  const participantsById = new Map(participants.map((p) => [p.id, p]));

  return bookings
    .map((b) => {
      const participant = participantsById.get(b.participant_id);
      return {
        dia: b.dia,
        hora: b.hora,
        aula: roomsById.get(b.room_id)?.numero ?? "?",
        participante: participant?.nombre ?? "?",
        correo: participant?.email ?? "",
        codigo: participant?.codigo ?? "",
      };
    })
    .sort((a, b) => (a.dia + a.hora + a.aula).localeCompare(b.dia + b.hora + b.aula));
}

export async function getReportByRound(roundId: RoundId, dia?: string): Promise<ReportRow[]> {
  const supabase = getSupabaseAdmin();
  const bookings = await fetchAllRows<Booking>((from, to) => {
    let query = supabase.from("bookings").select("*").eq("round_id", roundId);
    if (dia) query = query.eq("dia", dia);
    return query.range(from, to);
  });

  const { data: rooms } = await supabase.from("rooms").select("*");
  const { data: participants } = await supabase.from("participants").select("*");

  return joinRows(bookings, (rooms ?? []) as Room[], (participants ?? []) as Participant[]);
}

export interface DailySummaryCell {
  horas: number;
  aulas: number;
  aulasNumeros: string[];
}

export interface DailySummaryRow {
  participant_id: string;
  nombre: string;
  correo: string;
  porDia: Record<string, DailySummaryCell>;
  totalHoras: number;
}

export interface DailySummary {
  dias: string[];
  maxHorasDia: number;
  horasObjetivoTotal: number;
  rows: DailySummaryRow[];
}

/**
 * Resumen compacto de horas/aulas asignadas por participante y día de una
 * ronda, pensado para revisar de un vistazo si el reparto está siendo
 * equilibrado (en vez de tener que abrir el informe fila-a-fila).
 */
export async function getDailySummary(roundId: RoundId): Promise<DailySummary> {
  const supabase = getSupabaseAdmin();
  const round = await getRound(roundId);
  if (!round) throw new Error("La ronda no existe.");

  const { data: allParticipants } = await supabase.from("participants").select("*");
  const participants = ((allParticipants ?? []) as Participant[]).filter((p) =>
    p.rondas_clasificado.includes(roundId)
  );

  const bookings = await fetchAllRows<{ participant_id: string; dia: string; room_id: string }>((from, to) =>
    supabase.from("bookings").select("participant_id, dia, room_id").eq("round_id", roundId).range(from, to)
  );
  const { data: roomsData } = await supabase.from("rooms").select("id, numero");
  const numeroPorRoomId = new Map(((roomsData ?? []) as { id: string; numero: string }[]).map((r) => [r.id, r.numero]));

  const porParticipante = new Map<string, Record<string, { horas: number; aulas: Set<string> }>>();
  for (const b of bookings) {
    if (!porParticipante.has(b.participant_id)) porParticipante.set(b.participant_id, {});
    const dias = porParticipante.get(b.participant_id)!;
    if (!dias[b.dia]) dias[b.dia] = { horas: 0, aulas: new Set() };
    dias[b.dia].horas += 1;
    dias[b.dia].aulas.add(b.room_id);
  }

  const rows: DailySummaryRow[] = participants
    .map((p) => {
      const dias = porParticipante.get(p.id) ?? {};
      const porDia: Record<string, DailySummaryCell> = {};
      let totalHoras = 0;
      for (const dia of round.dias) {
        const horas = dias[dia]?.horas ?? 0;
        const aulaIds = dias[dia]?.aulas ?? new Set<string>();
        const aulasNumeros = [...aulaIds]
          .map((id) => numeroPorRoomId.get(id) ?? "?")
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        porDia[dia] = { horas, aulas: aulaIds.size, aulasNumeros };
        totalHoras += horas;
      }
      return { participant_id: p.id, nombre: p.nombre, correo: p.email, porDia, totalHoras };
    })
    .sort((a, b) => a.totalHoras - b.totalHoras || a.nombre.localeCompare(b.nombre));

  return {
    dias: round.dias,
    maxHorasDia: round.max_horas_dia,
    horasObjetivoTotal: round.dias.length * round.max_horas_dia,
    rows,
  };
}

export async function getReportByRoom(roundId: RoundId, roomId: string): Promise<ReportRow[]> {
  const supabase = getSupabaseAdmin();
  const { data: bookings } = await supabase
    .from("bookings")
    .select("*")
    .eq("round_id", roundId)
    .eq("room_id", roomId);

  const { data: rooms } = await supabase.from("rooms").select("*");
  const { data: participants } = await supabase.from("participants").select("*");

  return joinRows((bookings ?? []) as Booking[], (rooms ?? []) as Room[], (participants ?? []) as Participant[]);
}

export async function getReportByParticipant(participantId: string): Promise<ReportRow[]> {
  const supabase = getSupabaseAdmin();
  const { data: bookings } = await supabase.from("bookings").select("*").eq("participant_id", participantId);
  const { data: rooms } = await supabase.from("rooms").select("*");
  const { data: participants } = await supabase.from("participants").select("*");

  return joinRows((bookings ?? []) as Booking[], (rooms ?? []) as Room[], (participants ?? []) as Participant[]);
}

export async function rowsToXlsx(rows: ReportRow[], sheetName = "Informe"): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);

  sheet.columns = [
    { header: "Día", key: "dia", width: 22 },
    { header: "Hora", key: "hora", width: 10 },
    { header: "Aula", key: "aula", width: 10 },
    { header: "Participante", key: "participante", width: 28 },
    { header: "Correo", key: "correo", width: 32 },
    { header: "Código", key: "codigo", width: 14 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const r of rows) {
    sheet.addRow({
      dia: formatDia(r.dia),
      hora: formatHora(r.hora),
      aula: r.aula,
      participante: r.participante,
      correo: r.correo,
      codigo: r.codigo,
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
