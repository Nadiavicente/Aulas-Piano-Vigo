import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/apiAuth";
import { getReportByParticipant, rowsToXlsx } from "@/lib/reports";

export async function GET(req: NextRequest) {
  const { response } = await requireAdminApi();
  if (response) return response;

  const participantId = req.nextUrl.searchParams.get("id");
  if (!participantId) return NextResponse.json({ error: "Falta el parámetro id" }, { status: 400 });

  const rows = await getReportByParticipant(participantId);
  const xlsx = await rowsToXlsx(rows, "Participante");

  return new NextResponse(new Uint8Array(xlsx), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="informe-participante.xlsx"`,
    },
  });
}
