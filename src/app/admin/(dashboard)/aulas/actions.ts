"use server";

import { revalidatePath } from "next/cache";
import { verifyAdminSession } from "@/lib/dal";
import {
  updateRoomTipoPiano,
  updateMaxHorasDia,
  blockSlot,
  unblockSlot,
  createRoom,
} from "@/lib/admin";
import type { RoundId, TipoPiano, Motivo } from "@/lib/types";

export async function actionUpdateTipoPiano(roomId: string, tipo: TipoPiano) {
  await verifyAdminSession();
  await updateRoomTipoPiano(roomId, tipo);
  revalidatePath("/admin/aulas");
}

export async function actionUpdateMaxHoras(roundId: RoundId, maxHoras: number) {
  await verifyAdminSession();
  await updateMaxHorasDia(roundId, maxHoras);
  revalidatePath("/admin/aulas");
  revalidatePath("/admin/rondas");
}

export async function actionBlockSlot(
  roundId: RoundId,
  dia: string,
  roomId: string,
  hora: string,
  motivo: Motivo
) {
  await verifyAdminSession();
  await blockSlot(roundId, dia, roomId, hora, motivo);
  revalidatePath("/admin/aulas");
  revalidatePath("/admin");
}

export async function actionUnblockSlot(blockedSlotId: string) {
  await verifyAdminSession();
  await unblockSlot(blockedSlotId);
  revalidatePath("/admin/aulas");
  revalidatePath("/admin");
}

export async function actionCreateRoom(numero: string, tipo: TipoPiano, roundIds: RoundId[]) {
  await verifyAdminSession();
  await createRoom(numero, tipo, roundIds);
  revalidatePath("/admin/aulas");
}
