"use client";

import { useState } from "react";
import type { Round, Room, ParticipantPerformance, RoundId } from "@/lib/types";
import type { DayState } from "@/lib/booking";
import { RoundBooking } from "./RoundBooking";

export interface RondaData {
  round: Round;
  rooms: Room[];
  days: DayState[];
  performance: ParticipantPerformance | null;
}

export function ParticipanteApp({
  nombre,
  rondas,
  rondasData,
}: {
  nombre: string;
  rondas: Round[];
  rondasData: RondaData[];
}) {
  const primeraDisponible = rondas.find((r) => r.unlocked) ?? rondas[0];
  const [roundId, setRoundId] = useState<RoundId>(primeraDisponible.id);

  const activa = rondas.find((r) => r.id === roundId)!;
  const data = rondasData.find((d) => d.round.id === roundId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-ink/40">Bienvenido/a</p>
        <h1 className="font-serif text-2xl font-semibold text-ink sm:text-3xl">{nombre}</h1>
      </div>

      <div className="flex flex-wrap gap-2">
        {rondas.map((r) => (
          <button
            key={r.id}
            onClick={() => r.unlocked && setRoundId(r.id)}
            disabled={!r.unlocked}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
              roundId === r.id
                ? "border-gold bg-gold/10 text-ink"
                : r.unlocked
                ? "border-ink/15 text-ink/70 hover:border-ink/30"
                : "cursor-not-allowed border-ink/10 text-ink/30"
            }`}
          >
            {r.nombre} {!r.unlocked && <span className="ml-1">🔒 aún no abierta</span>}
          </button>
        ))}
      </div>

      {data ? (
        <RoundBooking data={data} />
      ) : (
        <p className="rounded-lg border border-ink/10 bg-ink/[0.02] p-4 text-sm text-ink/60">
          La organización todavía no ha abierto la reserva de horas para {activa.nombre}.
        </p>
      )}
    </div>
  );
}
