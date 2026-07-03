"use server";

import { revalidatePath } from "next/cache";
import { verifyParticipantSession, getCurrentParticipant } from "@/lib/dal";
import {
  createParticipantBookings,
  getRound,
  getRoundRooms,
  BookingError,
  type BookingSelection,
} from "@/lib/booking";
import { sendBookingConfirmationEmail } from "@/lib/email";
import type { RoundId } from "@/lib/types";

export interface ReservarResult {
  ok: boolean;
  error?: string;
  added?: number;
}

export async function reservarFranjas(
  roundId: RoundId,
  dia: string,
  seleccion: BookingSelection[]
): Promise<ReservarResult> {
  await verifyParticipantSession();
  const participant = await getCurrentParticipant();
  if (!participant) {
    return { ok: false, error: "Tu sesión ha caducado. Vuelve a iniciar sesión." };
  }

  try {
    const bookings = await createParticipantBookings(participant, roundId, dia, seleccion);

    const round = await getRound(roundId);
    const rooms = await getRoundRooms(roundId);
    if (round) {
      // El envío de email no debe hacer fallar la reserva si falla; el propio
      // helper registra el fallo en email_log para que la administración lo vea.
      await sendBookingConfirmationEmail(participant, round, bookings, rooms);
    }

    revalidatePath("/participante");
    return { ok: true, added: bookings.length };
  } catch (err) {
    if (err instanceof BookingError) {
      return { ok: false, error: err.message };
    }
    console.error("Error al crear reserva", err);
    return { ok: false, error: "Ha ocurrido un error inesperado. Inténtalo de nuevo." };
  }
}
