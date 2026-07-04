import "server-only";
import ExcelJS from "exceljs";
import { getSupabaseAdmin, fetchAllRows } from "./supabase";
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
