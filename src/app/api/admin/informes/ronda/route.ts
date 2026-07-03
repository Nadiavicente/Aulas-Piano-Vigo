import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/apiAuth";
import { getReportByRound, rowsToCsv } from "@/lib/reports";
import type { RoundId } from "@/lib/types";

export async function GET(req: NextRequest) {
  const { response } = await requireAdminApi();
  if (response) return response;

  const roundId = req.nextUrl.searchParams.get("round") as RoundId | null;
  const dia = req.nextUrl.searchParams.get("dia") ?? undefined;
  if (!roundId) return NextResponse.json({ error: "Falta el parámetro round" }, { status: 400 });

  const rows = await getReportByRound(roundId, dia);
  const csv = rowsToCsv(rows);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="informe-${roundId}${dia ? `-${dia}` : ""}.csv"`,
    },
  });
}
