import { getAllRounds } from "@/lib/booking";
import { formatDia } from "@/lib/schedule";
import { RoundToggle } from "./RoundToggle";

export default async function RondasPage() {
  const rounds = await getAllRounds();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-serif text-2xl font-semibold text-ink">Rondas</h1>
      <div className="flex flex-col gap-3">
        {rounds.map((round) => (
          <div
            key={round.id}
            className="flex flex-col gap-2 rounded-lg border border-ink/10 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <h2 className="font-medium text-ink">{round.nombre}</h2>
              <p className="text-sm text-ink/60">
                {round.dias.map(formatDia).join(" · ")}
              </p>
              <p className="text-xs text-ink/40">
                {round.hora_inicio.slice(0, 5)}–{round.hora_fin.slice(0, 5)} · máx.{" "}
                {round.max_horas_dia}h/día
              </p>
            </div>
            <RoundToggle roundId={round.id} unlocked={round.unlocked} />
          </div>
        ))}
      </div>
    </div>
  );
}
