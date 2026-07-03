"use server";

import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase";
import { verifyPassword } from "@/lib/password";
import { createSession } from "@/lib/session";
import type { Admin } from "@/lib/types";
import type { LoginFormState } from "@/app/login/actions";

export async function loginAdmin(
  _state: LoginFormState | undefined,
  formData: FormData
): Promise<LoginFormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Introduce tu correo y tu contraseña." };
  }

  const supabase = getSupabaseAdmin();
  const { data: admin } = await supabase
    .from("admins")
    .select("*")
    .ilike("email", email)
    .maybeSingle<Admin>();

  if (!admin) {
    return { error: "No encontramos ninguna cuenta con ese correo." };
  }

  const valid = await verifyPassword(password, admin.password_hash);
  if (!valid) {
    return { error: "Contraseña incorrecta." };
  }

  await createSession({ role: "admin", id: admin.id });
  redirect("/admin");
}
