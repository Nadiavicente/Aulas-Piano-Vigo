"use client";

import { useState } from "react";
import { formatDia } from "@/lib/schedule";
import type { Round, Room, RoundId } from "@/lib/types";

export function RoundReportForms({
  rounds,
  roomsByRound,
}: {
  rounds: Round[];
  roomsByRound: Record<string, Room[]>;
}) {
  const [roundId, setRoundId] = useState<RoundId | "">(rounds[0]?.id ?? "");
  const [dia, setDia] = useState<string>("");
  const [roomId, setRoomId] = useState<string>("");

  const round = rounds.find((r) => r.id === roundId);
  const rooms = roundId ? roomsByRound[roundId] ?? [] : [];

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-medium text-ink">Informes por ronda</h2>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink/60">Ronda</label>
        <select
          value={roundId}
          onChange={(e) => {
            setRoundId(e.target.value as RoundId);
            setDia("");
            setRoomId("");
          }}
          className="w-fit rounded border border-ink/20 px-2 py-1 text-sm"
        >
          {rounds.map((r) => (
            <option key={r.id} value={r.id}>
              {r.nombre}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink/60">Día (opcional)</label>
          <select value={dia} onChange={(e) => setDia(e.target.value)} className="rounded border border-ink/20 px-2 py-1 text-sm">
            <option value="">Todos los días</option>
            {round?.dias.map((d) => (
              <option key={d} value={d}>
                {formatDia(d)}
              </option>
            ))}
          </select>
        </div>
        <a
          href={`/api/admin/informes/ronda?round=${roundId}${dia ? `&dia=${dia}` : ""}`}
          className="rounded bg-ink px-3 py-1.5 text-sm text-gold-light"
        >
          Descargar CSV por día
        </a>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink/60">Aula</label>
          <select value={roomId} onChange={(e) => setRoomId(e.target.value)} className="rounded border border-ink/20 px-2 py-1 text-sm">
            <option value="">Selecciona un aula</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.numero}
              </option>
            ))}
          </select>
        </div>
        <a
          href={roomId ? `/api/admin/informes/aula?round=${roundId}&room=${roomId}` : "#"}
          aria-disabled={!roomId}
          className={`rounded px-3 py-1.5 text-sm ${
            roomId ? "bg-ink text-gold-light" : "pointer-events-none bg-ink/20 text-white/50"
          }`}
        >
          Descargar CSV por aula
        </a>
      </div>
    </section>
  );
}
