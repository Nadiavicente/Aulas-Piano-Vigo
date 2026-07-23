import "server-only";
import { Resend } from "resend";
import { getSupabaseAdmin } from "./supabase";
import { formatDia, formatHora } from "./schedule";
import { generateLoginQrPngBuffer, getLoginUrl } from "./qrcode";
import { nombreCompeticion, esRondaInicial } from "./competition";
import type { Booking, Room, Round, Participant, RoundId } from "./types";

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

// Resend limita a 10 peticiones/segundo. Al ejecutar una asignación por PDF
// se pueden disparar ~200 envíos (bienvenida + confirmación) casi a la vez,
// así que serializamos todos los envíos con un hueco mínimo entre ellos,
// sin importar cuánta concurrencia use quien llama a sendAndLog.
const MIN_INTERVALO_MS = 150; // ~6-7 envíos/segundo, con margen de sobra
let ultimoEnvio = 0;
let colaEnvios: Promise<void> = Promise.resolve();

function conLimiteDeVelocidad<T>(fn: () => Promise<T>): Promise<T> {
  const resultado = colaEnvios.then(async () => {
    const espera = Math.max(0, ultimoEnvio + MIN_INTERVALO_MS - Date.now());
    if (espera > 0) await new Promise((r) => setTimeout(r, espera));
    ultimoEnvio = Date.now();
    return fn();
  });
  colaEnvios = resultado.then(
    () => undefined,
    () => undefined
  );
  return resultado;
}

async function sendAndLog(params: {
  participantId: string | null;
  to: string;
  subject: string;
  html: string;
  type: "booking_confirmation" | "pdf_assignment" | "credentials";
  payload?: unknown;
  attachments?: { content: Buffer; filename: string; contentType?: string; contentId?: string }[];
}): Promise<SendResult> {
  const supabase = getSupabaseAdmin();

  try {
    const resend = getResend();
    const { error } = await conLimiteDeVelocidad(() =>
      resend.emails.send({
        from: getFromAddress(),
        to: params.to,
        subject: params.subject,
        html: params.html,
        attachments: params.attachments,
      })
    );

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

function actuacionHtml(performanceDia: string | null | undefined, performanceHora: string | null | undefined): string {
  if (!performanceDia || !performanceHora) return "";
  return `<p>Actuarás en el concurso el <strong>${formatDia(performanceDia)}</strong> a las <strong>${formatHora(
    performanceHora
  )}</strong>.</p>`;
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
  rooms: Room[],
  performance?: { dia: string | null; hora: string | null }
): Promise<SendResult> {
  // Si no es la ronda por la que empieza su concurso (principal o junior),
  // es que ha avanzado de fase, así que añadimos una felicitación antes del
  // detalle de la reserva.
  const felicitacion = !esRondaInicial(round.id)
    ? `<p>¡Enhorabuena por tu paso a la <strong>${round.nombre}</strong> del concurso!</p>`
    : "";
  const actuacion = actuacionHtml(performance?.dia, performance?.hora);

  const html = `
    <div style="font-family: sans-serif; color: #1b1310;">
      <h2>Reserva confirmada — ${round.nombre}</h2>
      <p>Hola ${participant.nombre},</p>
      ${felicitacion}
      ${actuacion}
      <p>Tu reserva de aulas de estudio para <strong>${round.nombre}</strong> ha sido confirmada:</p>
      ${bookingsToHtml(bookings, rooms)}
      <p>${nombreCompeticion(round.id)}</p>
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

export interface WelcomeScheduleInfo {
  round: Round;
  bookings: Booking[];
  rooms: Room[];
  performanceDia: string | null;
  performanceHora: string | null;
}

/**
 * Correo de bienvenida. Cuando se crea la cuenta como parte de una
 * asignación por PDF, `schedule` trae ya las aulas asignadas y la hora de
 * actuación, para mandar un único correo con todo (credenciales + horario +
 * aulas) en vez de uno de acceso y otro aparte de confirmación. Si se crea
 * la cuenta a mano desde el panel (sin ronda ni horas todavía), `schedule`
 * se omite y el correo es solo de acceso, como antes; `roundId` decide en
 * ese caso si el nombre del concurso mostrado es el principal o el Junior.
 */
export async function sendWelcomeEmail(
  participant: Participant,
  password: string,
  schedule?: WelcomeScheduleInfo,
  roundId?: RoundId
): Promise<SendResult> {
  const loginUrl = getLoginUrl(participant.email);
  const qrBuffer = await generateLoginQrPngBuffer(participant.email);
  const nombre = nombreCompeticion(schedule?.round.id ?? roundId ?? "primera");

  const actuacion = schedule ? actuacionHtml(schedule.performanceDia, schedule.performanceHora) : "";
  const horarios = schedule
    ? `
      <p>Estas son tus aulas de estudio asignadas para la <strong>${schedule.round.nombre}</strong>:</p>
      ${bookingsToHtml(schedule.bookings, schedule.rooms)}
      <p>Tu acceso a la plataforma solo tiene validez para esta ronda. Si avanzas de fase en el concurso, se te
      asignarán nuevas aulas de estudio (considerando de nuevo tu horario de actuación) y te avisaremos por
      correo cuando estén listas.</p>
      <p>Revisa también tu carpeta de spam o correo no deseado, por si este aviso con tus aulas y horarios no
      aparece directamente en tu bandeja de entrada.</p>
    `
    : "";

  const html = `
    <div style="font-family: sans-serif; color: #1b1310;">
      <h2>Acceso al ${nombre}</h2>
      <p>Hola ${participant.nombre},</p>
      <p>Ya puedes acceder a la plataforma de reserva de aulas de estudio con estos datos:</p>
      <p>
        Correo: <strong>${participant.email}</strong><br/>
        Contraseña: <strong>${password}</strong>
      </p>
      <p><a href="${loginUrl}" style="color:#c8a24a;">Entrar a la plataforma</a></p>
      <p>O escanea este código QR desde el móvil para entrar directamente:</p>
      <img src="cid:qrcode" alt="Código QR de acceso" width="180" height="180" />
      ${actuacion}
      ${horarios}
      <p>${nombre}</p>
    </div>
  `;

  return sendAndLog({
    participantId: participant.id,
    to: participant.email,
    subject: `Acceso a la plataforma de reservas — ${nombre}`,
    html,
    type: "credentials",
    payload: { reason: "participant_created" },
    attachments: [
      { content: qrBuffer, filename: "qr-acceso.png", contentType: "image/png", contentId: "qrcode" },
    ],
  });
}
