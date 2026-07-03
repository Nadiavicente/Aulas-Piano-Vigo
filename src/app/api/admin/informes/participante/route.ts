import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/apiAuth";
import { getReportByParticipant, rowsToCsv } from "@/lib/reports";

export async function GET(req: NextRequest) {
  const { response } = await requireAdminApi();
  if (response) return response;

  const participantId = req.nextUrl.searchParams.get("id");
  if (!participantId) return NextResponse.json({ error: "Falta el parámetro id" }, { status: 400 });

  const rows = await getReportByParticipant(participantId);
  const csv = rowsToCsv(rows);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="informe-participante.csv"`,
    },
  });
}
