"use server";

import { verifyAdminSession } from "@/lib/dal";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getRound } from "@/lib/booking";
import { createParticipant } from "@/lib/admin";
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
  creados?: number;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function confirmAssignment(
  batchId: string,
  roundId: RoundId,
  rows: PdfAssignmentRow[],
  crearNoCoincidencias = false,
  enviarCorreos = true
): Promise<ConfirmResult> {
  await verifyAdminSession();

  let creados = 0;
  // Contraseñas de las cuentas recién creadas en este lote: no se envían
  // aquí (createParticipant con enviarCorreo:false), sino en un único
  // correo de bienvenida ya con el horario y las aulas asignadas, una vez
  // que applyAutoAssignment termine el reparto.
  const passwordsNuevos = new Map<string, string>();

  // Filas sin participante emparejado pero con nombre y correo válidos: si
  // se ha pedido, se les crea la cuenta ahora (sin enviar todavía el correo
  // de bienvenida) antes de asignarles horas. Se hace con concurrencia
  // limitada para no tardar demasiado con lotes grandes (~100 filas).
  if (crearNoCoincidencias) {
    const pendientes = rows.filter(
      (r) => !r.participant_id && r.match_status !== "matched" && r.email && EMAIL_RE.test(r.email)
    );
    const CONCURRENCIA = 5;
    let idx = 0;
    async function crearSiguiente() {
      while (idx < pendientes.length) {
        const row = pendientes[idx++];
        try {
          const { participant, password } = await createParticipant(
            {
              nombre: row.nombre || row.email.split("@")[0],
              email: row.email,
              rondas: [roundId],
            },
            { enviarCorreo: false }
          );
          row.participant_id = participant.id;
          row.match_status = "matched";
          passwordsNuevos.set(participant.id, password);
          creados++;
        } catch {
          // Puede fallar si el correo ya existe por alguna condición de carrera;
          // dejamos la fila sin emparejar en vez de interrumpir todo el lote.
        }
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCIA, pendientes.length) }, crearSiguiente)
    );
  }

  const entries: AssignmentEntry[] = rows
    .filter((r) => r.participant_id && r.dia)
    .map((r) => ({ participant_id: r.participant_id as string, dia: r.dia as string, hora: r.hora }));

  if (entries.length === 0) {
    return { ok: false, error: "No hay ninguna fila válida (con participante y día) para asignar." };
  }

  try {
    const summaries = await applyAutoAssignment(roundId, entries, { enviarCorreos, passwordsNuevos });

    const supabase = getSupabaseAdmin();
    await supabase
      .from("pdf_assignment_batches")
      .update({ status: "confirmed", confirmed_at: new Date().toISOString(), parsed_rows: rows })
      .eq("id", batchId);

    revalidatePath("/admin");
    revalidatePath("/admin/asignacion");
    revalidatePath("/admin/participantes");
    return { ok: true, summaries, creados };
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
