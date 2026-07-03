"use server";

import { revalidatePath } from "next/cache";
import { verifyAdminSession } from "@/lib/dal";
import { setRoundUnlocked } from "@/lib/admin";
import type { RoundId } from "@/lib/types";

export async function toggleRoundUnlocked(roundId: RoundId, unlocked: boolean) {
  await verifyAdminSession();
  await setRoundUnlocked(roundId, unlocked);
  revalidatePath("/admin/rondas");
  revalidatePath("/admin");
}
