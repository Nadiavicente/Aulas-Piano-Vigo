import { formatDia, formatHora } from "@/lib/schedule";
import type { Round, Room, ParticipantPerformance } from "@/lib/types";
import type { DayState } from "@/lib/booking";
import { DayGrid } from "./DayGrid";

export function RoundBooking({
  round,
  rooms,
  days,
  performance,
}: {
  round: Round;
  rooms: Room[];
  days: DayState[];
  performance: ParticipantPerformance | null;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between border-b border-ink/10 pb-2">
        <h2 className="font-serif text-2xl font-semibold text-ink">{round.nombre}</h2>
        <span className="text-sm text-ink/50">
          Máximo {round.max_horas_dia}h/día · hasta 4 aulas distintas
        </span>
      </div>

      {days.map((day) => {
        const actuaEsteDia =
          performance?.performance_day === day.dia && performance?.performance_hour;

        return (
          <div key={day.dia} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-medium capitalize text-ink">{formatDia(day.dia)}</h3>
              <span className="text-sm text-ink/60">
                {day.horas_reservadas_mias} / {round.max_horas_dia} horas reservadas
              </span>
            </div>

            {actuaEsteDia && (
              <p className="rounded-md bg-gold/10 px-3 py-2 text-sm text-ink/80">
                Actúas este día a las {formatHora(performance!.performance_hour!)}. Esto es
                solo informativo: conservas tus horas de estudio completas ese día.
              </p>
            )}

            <DayGrid roundId={round.id} dia={day.dia} rooms={rooms} day={day} maxHorasDia={round.max_horas_dia} />
          </div>
        );
      })}
    </section>
  );
}
