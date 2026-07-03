"use server";

import { verifyAdminSession } from "@/lib/dal";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getRound } from "@/lib/booking";
import { extractPdfText, parseAssignmentText } from "@/lib/pdfParse";
import { applyAutoAssignment, type AssignmentEntry, type AssignmentSummary } from "@/lib/autoAssign";
import type { RoundId, PdfAssignmentRow } from "@/lib/types";
import { revalidatePath } from "next/cache";

export interface ParseResult {
  ok: boolean;
  error?: string;
  batchId?: string;
  rows?: PdfAssignmentRow[];
}

export async function uploadAndParsePdf(formData: FormData): Promise<ParseResult> {
  const session = await verifyAdminSession();
  const roundId = String(formData.get("round_id") ?? "") as RoundId;
  const file = formData.get("file") as File | null;

  if (!roundId || !file) {
    return { ok: false, error: "Falta la ronda o el archivo PDF." };
  }

  const round = await getRound(roundId);
  if (!round) return { ok: false, error: "La ronda no existe." };

  let text: string;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    text = await extractPdfText(buffer);
  } catch {
    return { ok: false, error: "No se pudo leer el PDF. Comprueba que el archivo no esté dañado." };
  }

  const parsed = parseAssignmentText(text, round.dias);

  const supabase = getSupabaseAdmin();
  const { data: participants } = await supabase.from("participants").select("id, email");
  const byEmail = new Map((participants ?? []).map((p) => [p.email.toLowerCase(), p.id as string]));

  const rows: PdfAssignmentRow[] = parsed.map((row) => {
    const participant_id = byEmail.get(row.email) ?? null;
    return {
      nombre: row.nombre,
      email: row.email,
      dia: row.dia,
      hora: row.hora,
      participant_id,
      match_status: participant_id ? "matched" : "no_match",
    };
  });

  const { data: batch, error } = await supabase
    .from("pdf_assignment_batches")
    .insert({
      uploaded_by: session.id,
      round_id: roundId,
      original_filename: file.name,
      raw_text: text,
      parsed_rows: rows,
      status: "pending_review",
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  return { ok: true, batchId: batch.id, rows };
}

export interface ConfirmResult {
  ok: boolean;
  error?: string;
  summaries?: AssignmentSummary[];
}

export async function confirmAssignment(
  batchId: string,
  roundId: RoundId,
  rows: PdfAssignmentRow[]
): Promise<ConfirmResult> {
  await verifyAdminSession();

  const entries: AssignmentEntry[] = rows
    .filter((r) => r.participant_id && r.dia)
    .map((r) => ({ participant_id: r.participant_id as string, dia: r.dia as string, hora: r.hora }));

  if (entries.length === 0) {
    return { ok: false, error: "No hay ninguna fila válida (con participante y día) para asignar." };
  }

  try {
    const summaries = await applyAutoAssignment(roundId, entries);

    const supabase = getSupabaseAdmin();
    await supabase
      .from("pdf_assignment_batches")
      .update({ status: "confirmed", confirmed_at: new Date().toISOString(), parsed_rows: rows })
      .eq("id", batchId);

    revalidatePath("/admin");
    revalidatePath("/admin/asignacion");
    return { ok: true, summaries };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

export async function discardBatch(batchId: string) {
  await verifyAdminSession();
  const supabase = getSupabaseAdmin();
  await supabase.from("pdf_assignment_batches").update({ status: "discarded" }).eq("id", batchId);
  revalidatePath("/admin/asignacion");
}
