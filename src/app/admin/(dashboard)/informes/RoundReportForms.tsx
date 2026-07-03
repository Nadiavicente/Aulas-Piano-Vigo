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

  function selectRound(id: RoundId) {
    setRoundId(id);
    setDia("");
    setRoomId("");
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-medium text-ink">Informes por ronda</h2>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink/60">Ronda</label>
        <div className="flex flex-wrap gap-2">
          {rounds.map((r) => (
            <button
              key={r.id}
              onClick={() => selectRound(r.id)}
              className={`rounded-md px-3 py-1.5 text-sm ${
                roundId === r.id ? "bg-ink text-gold-light" : "bg-ink/5 text-ink/70 hover:bg-ink/10"
              }`}
            >
              {r.nombre}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink/60">Día</label>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setDia("")}
            className={`rounded-full px-3 py-1 text-sm ${
              dia === "" ? "bg-gold text-ink" : "bg-ink/5 text-ink/70 hover:bg-ink/10"
            }`}
          >
            Todos los días
          </button>
          {round?.dias.map((d) => (
            <button
              key={d}
              onClick={() => setDia(d)}
              className={`rounded-full px-3 py-1 text-sm capitalize ${
                dia === d ? "bg-gold text-ink" : "bg-ink/5 text-ink/70 hover:bg-ink/10"
              }`}
            >
              {formatDia(d)}
            </button>
          ))}
        </div>
      </div>

      <a
        href={`/api/admin/informes/ronda?round=${roundId}${dia ? `&dia=${dia}` : ""}`}
        className="w-fit rounded bg-ink px-3 py-1.5 text-sm text-gold-light"
      >
        Descargar Excel por día
      </a>

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
          Descargar Excel por aula
        </a>
      </div>
    </section>
  );
}
