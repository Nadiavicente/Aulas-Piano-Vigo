"use server";

import { revalidatePath } from "next/cache";
import { verifyAdminSession } from "@/lib/dal";
import {
  updateParticipantRounds,
  regenerateParticipantPassword,
  createParticipant,
  adminAssignSlot,
  adminRemoveBooking,
} from "@/lib/admin";
import { BookingError } from "@/lib/booking";
import type { RoundId } from "@/lib/types";

export async function actionUpdateRounds(participantId: string, rondas: RoundId[]) {
  await verifyAdminSession();
  await updateParticipantRounds(participantId, rondas);
  revalidatePath(`/admin/participantes/${participantId}`);
  revalidatePath("/admin/participantes");
}

export async function actionRegeneratePassword(participantId: string): Promise<string> {
  await verifyAdminSession();
  const password = await regenerateParticipantPassword(participantId);
  revalidatePath(`/admin/participantes/${participantId}`);
  return password;
}

export async function actionCreateParticipant(
  nombre: string,
  email: string,
  codigo: string,
  rondas: RoundId[]
): Promise<{ ok: boolean; error?: string; password?: string; id?: string }> {
  await verifyAdminSession();
  try {
    const { participant, password } = await createParticipant({ nombre, email, codigo, rondas });
    revalidatePath("/admin/participantes");
    return { ok: true, password, id: participant.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

export async function actionAdminAssignSlot(
  participantId: string,
  roundId: RoundId,
  dia: string,
  roomId: string,
  hora: string
): Promise<{ ok: boolean; error?: string }> {
  await verifyAdminSession();
  try {
    await adminAssignSlot(roundId, dia, roomId, hora, participantId);
    revalidatePath(`/admin/participantes/${participantId}`);
    revalidatePath("/admin");
    return { ok: true };
  } catch (err) {
    if (err instanceof BookingError) return { ok: false, error: err.message };
    return { ok: false, error: "Error desconocido" };
  }
}

export async function actionAdminRemoveBooking(
  participantId: string,
  roundId: RoundId,
  dia: string,
  roomId: string,
  hora: string
) {
  await verifyAdminSession();
  await adminRemoveBooking(roundId, dia, roomId, hora);
  revalidatePath(`/admin/participantes/${participantId}`);
  revalidatePath("/admin");
}
