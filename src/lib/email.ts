import "server-only";
import { Resend } from "resend";
import { getSupabaseAdmin } from "./supabase";
import { formatDia, formatHora } from "./schedule";
import { generateLoginQrDataUrl, getLoginUrl } from "./qrcode";
import type { Booking, Room, Round, Participant } from "./types";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("Falta RESEND_API_KEY en las variables de entorno");
  return new Resend(key);
}

function getFromAddress() {
  // Cambiar a un remitente del dominio propio del concurso en cuanto esté
  // verificado en Resend (Dashboard → Domains). Hasta entonces usamos el de pruebas.
  return process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
}

interface SendResult {
  ok: boolean;
  error?: string;
}

async function sendAndLog(params: {
  participantId: string | null;
  to: string;
  subject: string;
  html: string;
  type: "booking_confirmation" | "pdf_assignment" | "credentials";
  payload?: unknown;
}): Promise<SendResult> {
  const supabase = getSupabaseAdmin();

  try {
    const resend = getResend();
    const { error } = await resend.emails.send({
      from: getFromAddress(),
      to: params.to,
      subject: params.subject,
      html: params.html,
    });

    if (error) {
      await supabase.from("email_log").insert({
        participant_id: params.participantId,
        email_to: params.to,
        subject: params.subject,
        type: params.type,
        status: "failed",
        error: error.message,
        payload: params.payload ?? null,
      });
      return { ok: false, error: error.message };
    }

    await supabase.from("email_log").insert({
      participant_id: params.participantId,
      email_to: params.to,
      subject: params.subject,
      type: params.type,
      status: "sent",
      payload: params.payload ?? null,
    });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido al enviar el email";
    await supabase.from("email_log").insert({
      participant_id: params.participantId,
      email_to: params.to,
      subject: params.subject,
      type: params.type,
      status: "failed",
      error: message,
      payload: params.payload ?? null,
    });
    return { ok: false, error: message };
  }
}

function bookingsToHtml(bookings: Booking[], rooms: Room[]) {
  const roomsById = new Map(rooms.map((r) => [r.id, r]));
  const byDia = new Map<string, Booking[]>();
  for (const b of bookings) {
    if (!byDia.has(b.dia)) byDia.set(b.dia, []);
    byDia.get(b.dia)!.push(b);
  }

  const dias = [...byDia.keys()].sort();

  return dias
    .map((dia) => {
      const rows = byDia
        .get(dia)!
        .sort((a, b) => a.hora.localeCompare(b.hora))
        .map(
          (b) =>
            `<li>${formatHora(b.hora)} — Aula ${roomsById.get(b.room_id)?.numero ?? "?"}</li>`
        )
        .join("");
      return `<p><strong>${formatDia(dia)}</strong></p><ul>${rows}</ul>`;
    })
    .join("");
}

export async function sendBookingConfirmationEmail(
  participant: Participant,
  round: Round,
  bookings: Booking[],
  rooms: Room[]
): Promise<SendResult> {
  const html = `
    <div style="font-family: sans-serif; color: #1b1310;">
      <h2>Reserva confirmada — ${round.nombre}</h2>
      <p>Hola ${participant.nombre},</p>
      <p>Tu reserva de aulas de estudio para <strong>${round.nombre}</strong> ha sido confirmada:</p>
      ${bookingsToHtml(bookings, rooms)}
      <p>X Concurso Internacional de Piano Ciudad de Vigo</p>
    </div>
  `;

  return sendAndLog({
    participantId: participant.id,
    to: participant.email,
    subject: `Reserva confirmada — ${round.nombre}`,
    html,
    type: "booking_confirmation",
    payload: { round_id: round.id, booking_ids: bookings.map((b) => b.id) },
  });
}

export async function sendWelcomeEmail(participant: Participant, password: string): Promise<SendResult> {
  const loginUrl = getLoginUrl(participant.email);
  const qrDataUrl = await generateLoginQrDataUrl(participant.email);

  const html = `
    <div style="font-family: sans-serif; color: #1b1310;">
      <h2>Acceso al X Concurso Internacional de Piano Ciudad de Vigo</h2>
      <p>Hola ${participant.nombre},</p>
      <p>Ya puedes acceder a la plataforma de reserva de aulas de estudio con estos datos:</p>
      <p>
        Correo: <strong>${participant.email}</strong><br/>
        Contraseña: <strong>${password}</strong>
      </p>
      <p><a href="${loginUrl}" style="color:#c8a24a;">Entrar a la plataforma</a></p>
      <p>O escanea este código QR desde el móvil para entrar directamente:</p>
      <img src="${qrDataUrl}" alt="Código QR de acceso" width="180" height="180" />
      <p>X Concurso Internacional de Piano Ciudad de Vigo</p>
    </div>
  `;

  return sendAndLog({
    participantId: participant.id,
    to: participant.email,
    subject: "Acceso a la plataforma de reservas — X Concurso Internacional de Piano Ciudad de Vigo",
    html,
    type: "credentials",
    payload: { reason: "participant_created" },
  });
}
