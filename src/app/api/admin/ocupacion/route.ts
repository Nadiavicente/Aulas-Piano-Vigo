import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/apiAuth";
import { getRound, getRoundRooms, getRoundDaysState } from "@/lib/booking";

export async function GET(req: NextRequest) {
  const { response } = await requireAdminApi();
  if (response) return response;

  const roundId = req.nextUrl.searchParams.get("round");
  if (!roundId) {
    return NextResponse.json({ error: "Falta el parámetro round" }, { status: 400 });
  }

  const round = await getRound(roundId);
  if (!round) {
    return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });
  }

  const rooms = await getRoundRooms(roundId);
  const days = await getRoundDaysState(round, rooms, { includeNames: true });

  return NextResponse.json({ round, rooms, days });
}
