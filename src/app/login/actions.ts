"use server";

import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase";
import { verifyPassword } from "@/lib/password";
import { createSession } from "@/lib/session";
import type { Participant } from "@/lib/types";

export interface LoginFormState {
  error?: string;
}

export async function loginParticipant(
  _state: LoginFormState | undefined,
  formData: FormData
): Promise<LoginFormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Introduce tu correo y tu contraseña." };
  }

  const supabase = getSupabaseAdmin();
  const { data: participant } = await supabase
    .from("participants")
    .select("*")
    .ilike("email", email)
    .maybeSingle<Participant>();

  if (!participant) {
    return { error: "No encontramos ninguna cuenta con ese correo." };
  }

  const valid = await verifyPassword(password, participant.password_hash);
  if (!valid) {
    return { error: "Contraseña incorrecta." };
  }

  await createSession({ role: "participant", id: participant.id });
  redirect("/participante");
}
