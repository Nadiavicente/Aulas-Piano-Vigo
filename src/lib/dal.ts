import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getSession } from "./session";
import { getSupabaseAdmin } from "./supabase";
import type { Participant, Admin } from "./types";

export const verifyParticipantSession = cache(async () => {
  const session = await getSession();
  if (!session || session.role !== "participant") {
    redirect("/login");
  }
  return session;
});

export const verifyAdminSession = cache(async () => {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    redirect("/admin/login");
  }
  return session;
});

export const getCurrentParticipant = cache(async (): Promise<Participant | null> => {
  const session = await getSession();
  if (!session || session.role !== "participant") return null;

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("participants")
    .select("*")
    .eq("id", session.id)
    .maybeSingle();

  return data as Participant | null;
});

export const getCurrentAdmin = cache(async (): Promise<Admin | null> => {
  const session = await getSession();
  if (!session || session.role !== "admin") return null;

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("admins")
    .select("*")
    .eq("id", session.id)
    .maybeSingle();

  return data as Admin | null;
});
