import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/apiAuth";
import { getReportByRound, rowsToXlsx } from "@/lib/reports";
import type { RoundId } from "@/lib/types";

export async function GET(req: NextRequest) {
  const { response } = await requireAdminApi();
  if (response) return response;

  const roundId = req.nextUrl.searchParams.get("round") as RoundId | null;
  const dia = req.nextUrl.searchParams.get("dia") ?? undefined;
  if (!roundId) return NextResponse.json({ error: "Falta el parámetro round" }, { status: 400 });

  const rows = await getReportByRound(roundId, dia);
  const xlsx = await rowsToXlsx(rows, roundId);

  return new NextResponse(new Uint8Array(xlsx), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="informe-${roundId}${dia ? `-${dia}` : ""}.xlsx"`,
    },
  });
}
