import Link from "next/link";
import { getAllRounds } from "@/lib/booking";
import { getDailySummary } from "@/lib/reports";
import { formatDiaCorto } from "@/lib/schedule";
import type { RoundId } from "@/lib/types";

function celda(horas: number, aulas: number, maxHorasDia: number) {
  if (horas === 0) {
    return { texto: "—", clase: "text-ink/25" };
  }
  const completa = horas >= maxHorasDia;
  return {
    texto: `${horas}h·${aulas}a`,
    clase: completa ? "text-ink/70" : "text-red-700 font-semibold",
  };
}

export default async function ResumenDiarioPage({
  searchParams,
}: {
  searchParams: Promise<{ round?: string }>;
}) {
  const { round: roundParam } = await searchParams;
  const rounds = await getAllRounds();
  const roundId = (roundParam as RoundId) || rounds[0]?.id;
  const summary = roundId ? await getDailySummary(roundId) : null;

  const incompletos = summary?.rows.filter((r) => r.totalHoras < summary.horasObjetivoTotal).length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl font-semibold text-ink">Resumen diario de asignación</h1>
        <Link href="/admin/informes" className="text-sm text-ink underline">
          Volver a informes
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {rounds.map((r) => (
          <Link
            key={r.id}
            href={`/admin/informes/resumen?round=${r.id}`}
            className={`rounded-md px-3 py-1.5 text-sm ${
              roundId === r.id ? "bg-ink text-gold-light" : "bg-ink/5 text-ink/70 hover:bg-ink/10"
            }`}
          >
            {r.nombre}
          </Link>
        ))}
      </div>

      {summary && (
        <>
          <p className="text-sm text-ink/60">
            {summary.rows.length} participantes clasificados · objetivo {summary.horasObjetivoTotal}h cada uno (
            {summary.maxHorasDia}h/día × {summary.dias.length} días) ·{" "}
            <span className={incompletos > 0 ? "font-semibold text-red-700" : ""}>
              {incompletos} sin completar
            </span>
          </p>

          <div className="overflow-x-auto rounded-lg border border-ink/10">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-ink/10 bg-ink/5 text-left">
                  <th className="sticky left-0 bg-ink/5 px-2 py-1.5 font-medium text-ink/70">Participante</th>
                  {summary.dias.map((dia) => (
                    <th key={dia} className="px-2 py-1.5 text-center font-medium text-ink/70 whitespace-nowrap">
                      {formatDiaCorto(dia)}
                    </th>
                  ))}
                  <th className="px-2 py-1.5 text-center font-medium text-ink/70">Total</th>
                </tr>
              </thead>
              <tbody>
                {summary.rows.map((row) => (
                  <tr key={row.participant_id} className="border-b border-ink/5 last:border-0 hover:bg-ink/[0.03]">
                    <td className="sticky left-0 whitespace-nowrap bg-white px-2 py-1 text-ink">
                      {row.nombre}
                    </td>
                    {summary.dias.map((dia) => {
                      const c = row.porDia[dia];
                      const { texto, clase } = celda(c.horas, c.aulas, summary.maxHorasDia);
                      return (
                        <td key={dia} className={`px-2 py-1 text-center tabular-nums ${clase}`}>
                          {texto}
                        </td>
                      );
                    })}
                    <td
                      className={`px-2 py-1 text-center font-semibold tabular-nums ${
                        row.totalHoras >= summary.horasObjetivoTotal ? "text-ink" : "text-red-700"
                      }`}
                    >
                      {row.totalHoras}/{summary.horasObjetivoTotal}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-ink/40">
            Cada celda muestra horas·aulas asignadas ese día (p. ej. &quot;3·2&quot; = 3 horas repartidas en 2
            aulas). En rojo, los días o el total por debajo del objetivo.
          </p>
        </>
      )}
    </div>
  );
}
