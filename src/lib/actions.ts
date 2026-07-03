"use server";

import { redirect } from "next/navigation";
import { deleteSession, getSession } from "./session";

export async function logout() {
  const session = await getSession();
  await deleteSession();
  redirect(session?.role === "admin" ? "/admin/login" : "/login");
}
