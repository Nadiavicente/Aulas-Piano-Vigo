import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/apiAuth";
import { getReportByRoom, rowsToCsv } from "@/lib/reports";
import type { RoundId } from "@/lib/types";

export async function GET(req: NextRequest) {
  const { response } = await requireAdminApi();
  if (response) return response;

  const roundId = req.nextUrl.searchParams.get("round") as RoundId | null;
  const roomId = req.nextUrl.searchParams.get("room");
  if (!roundId || !roomId) {
    return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
  }

  const rows = await getReportByRoom(roundId, roomId);
  const csv = rowsToCsv(rows);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="informe-aula.csv"`,
    },
  });
}
