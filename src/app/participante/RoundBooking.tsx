"use client";

import { useState } from "react";
import { formatDia } from "@/lib/schedule";
import { DayGrid } from "./DayGrid";
import type { RondaData } from "./ParticipanteApp";

export function RoundBooking({ data }: { data: RondaData }) {
  const { round, rooms, days, performance } = data;
  const [dia, setDia] = useState(days[0]?.dia);

  const day = days.find((d) => d.dia === dia);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {days.map((d) => (
          <button
            key={d.dia}
            onClick={() => setDia(d.dia)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium capitalize transition ${
              dia === d.dia ? "border-gold bg-gold/10 text-ink" : "border-ink/15 text-ink/70 hover:border-ink/30"
            }`}
          >
            {formatDia(d.dia)}
          </button>
        ))}
      </div>

      {day && (
        <DayGrid
          key={day.dia}
          roundId={round.id}
          dia={day.dia}
          rooms={rooms}
          day={day}
          maxHorasDia={round.max_horas_dia}
          performance={performance}
        />
      )}
    </section>
  );
}
