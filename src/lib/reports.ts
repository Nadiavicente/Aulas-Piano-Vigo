import "server-only";
import { getSupabaseAdmin } from "./supabase";
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
  let query = supabase.from("bookings").select("*").eq("round_id", roundId);
  if (dia) query = query.eq("dia", dia);
  const { data: bookings } = await query;

  const { data: rooms } = await supabase.from("rooms").select("*");
  const { data: participants } = await supabase.from("participants").select("*");

  return joinRows((bookings ?? []) as Booking[], (rooms ?? []) as Room[], (participants ?? []) as Participant[]);
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

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function rowsToCsv(rows: ReportRow[]): string {
  const header = ["Día", "Hora", "Aula", "Participante", "Correo", "Código"];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [formatDia(r.dia), formatHora(r.hora), r.aula, r.participante, r.correo, r.codigo]
        .map(csvEscape)
        .join(",")
    );
  }
  return "﻿" + lines.join("\n"); // BOM para que Excel detecte UTF-8
}
