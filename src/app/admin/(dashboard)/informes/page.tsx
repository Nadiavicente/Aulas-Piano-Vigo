import Link from "next/link";
import { getAllRounds, getRoundRooms } from "@/lib/booking";
import { searchParticipants } from "@/lib/admin";
import { RoundReportForms } from "./RoundReportForms";

export default async function InformesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const rounds = await getAllRounds();
  const roomsByRound: Record<string, Awaited<ReturnType<typeof getRoundRooms>>> = {};
  for (const round of rounds) {
    roomsByRound[round.id] = await getRoundRooms(round.id);
  }
  const participants = q ? await searchParticipants(q) : [];

  return (
    <div className="flex flex-col gap-10">
      <h1 className="font-serif text-2xl font-semibold text-ink">Informes</h1>

      <RoundReportForms rounds={rounds} roomsByRound={roomsByRound} />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-ink">Informe individual de un participante</h2>
        <form className="flex gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar participante…"
            className="w-full max-w-sm rounded-md border border-ink/20 px-3 py-2 text-sm"
          />
          <button className="rounded-md bg-ink px-4 py-2 text-sm text-gold-light">Buscar</button>
        </form>

        {participants.length > 0 && (
          <ul className="flex flex-col divide-y divide-ink/5 rounded-lg border border-ink/10">
            {participants.map((p) => (
              <li key={p.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span>
                  {p.nombre} <span className="text-ink/40">({p.email})</span>
                </span>
                <div className="flex gap-3">
                  <Link href={`/admin/informes/participante/${p.id}`} className="text-ink underline" target="_blank">
                    Ver / imprimir
                  </Link>
                  <a
                    href={`/api/admin/informes/participante?id=${p.id}`}
                    className="text-ink underline"
                  >
                    CSV
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
