import "server-only";
import { NextResponse } from "next/server";
import { getSession } from "./session";

export async function requireAdminApi() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return { session: null, response: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };
  }
  return { session, response: null };
}

export async function requireParticipantApi() {
  const session = await getSession();
  if (!session || session.role !== "participant") {
    return { session: null, response: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };
  }
  return { session, response: null };
}
