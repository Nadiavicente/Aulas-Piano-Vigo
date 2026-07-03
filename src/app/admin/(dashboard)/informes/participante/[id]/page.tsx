import { notFound } from "next/navigation";
import { getParticipantById } from "@/lib/admin";
import { getReportByParticipant } from "@/lib/reports";
import { formatDia, formatHora } from "@/lib/schedule";
import { CompetitionLogo } from "@/components/CompetitionLogo";
import { PrintButton } from "./PrintButton";

export default async function ParticipantReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const participant = await getParticipantById(id);
  if (!participant) notFound();

  const rows = await getReportByParticipant(id);

  return (
    <div className="mx-auto max-w-2xl bg-white p-6 text-ink">
      <div className="mb-6 flex items-center justify-between border-b border-ink/10 pb-4">
        <CompetitionLogo />
        <PrintButton />
      </div>

      <h1 className="font-serif text-2xl font-semibold">Informe de reservas</h1>
      <p className="mb-6 text-ink/70">
        {participant.nombre} · {participant.email}
        {participant.codigo && ` · código ${participant.codigo}`}
      </p>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-ink/20 text-left">
            <th className="py-2">Día</th>
            <th className="py-2">Hora</th>
            <th className="py-2">Aula</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-ink/5">
              <td className="py-1 capitalize">{formatDia(r.dia)}</td>
              <td className="py-1">{formatHora(r.hora)}</td>
              <td className="py-1">{r.aula}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={3} className="py-4 text-center text-ink/40">
                Sin reservas registradas.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
