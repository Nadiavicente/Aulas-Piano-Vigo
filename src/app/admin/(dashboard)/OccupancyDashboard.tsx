"use client";

import { useEffect, useState } from "react";
import { formatDia, formatHora } from "@/lib/schedule";
import type { Round, Room } from "@/lib/types";

interface Slot {
  room_id: string;
  hora: string;
  status: "libre" | "mia" | "ocupada" | "bloqueada";
  ocupante?: string;
}

interface DayState {
  dia: string;
  slots: Slot[];
}

interface OcupacionResponse {
  round: Round;
  rooms: Room[];
  days: DayState[];
}

const POLL_MS = 8000;

export function OccupancyDashboard({ rounds }: { rounds: Round[] }) {
  const [roundId, setRoundId] = useState(rounds[0]?.id ?? "");
  const [data, setData] = useState<OcupacionResponse | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!roundId) return;
    let cancelled = false;

    async function load() {
      const res = await fetch(`/api/admin/ocupacion?round=${roundId}`, { cache: "no-store" });
      if (!res.ok || cancelled) return;
      const json = (await res.json()) as OcupacionResponse;
      if (!cancelled) setData(json);
    }

    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [roundId]);

  if (rounds.length === 0) {
    return <p className="text-ink/60">Todavía no hay rondas configuradas.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2">
        {rounds.map((r) => (
          <button
            key={r.id}
            onClick={() => {
              setData(null);
              setRoundId(r.id);
            }}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              roundId === r.id
                ? "bg-ink text-gold-light"
                : "bg-ink/5 text-ink/70 hover:bg-ink/10"
            }`}
          >
            {r.nombre} {!r.unlocked && "🔒"}
          </button>
        ))}
      </div>

      {!data && <p className="text-ink/50">Cargando…</p>}

      {data &&
        data.days.map((day) => (
          <div key={day.dia} className="flex flex-col gap-2">
            <h3 className="text-lg font-medium capitalize text-ink">{formatDia(day.dia)}</h3>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
              {data.rooms.map((room) => {
                const slots = day.slots.filter((s) => s.room_id === room.id);
                const libres = slots.filter((s) => s.status === "libre").length;
                const hayLibres = libres > 0;
                const key = `${day.dia}|${room.id}`;
                const isExpanded = expanded === key;

                return (
                  <div key={room.id} className="flex flex-col">
                    <button
                      onClick={() => setExpanded(isExpanded ? null : key)}
                      className={`rounded-md px-2 py-2 text-center text-sm font-medium text-white transition ${
                        hayLibres ? "bg-slot-free hover:brightness-110" : "bg-slot-taken hover:brightness-110"
                      }`}
                    >
                      Aula {room.numero}
                      <div className="text-xs font-normal opacity-90">{libres} libres</div>
                    </button>
                    {isExpanded && (
                      <div className="mt-1 rounded-md border border-ink/10 bg-white p-2 text-xs">
                        {slots.map((s) => (
                          <div key={s.hora} className="flex justify-between gap-2 py-0.5">
                            <span>{formatHora(s.hora)}</span>
                            <span
                              className={
                                s.status === "libre"
                                  ? "text-slot-free"
                                  : s.status === "bloqueada"
                                  ? "text-ink/40"
                                  : "text-slot-taken"
                              }
                            >
                              {s.status === "libre"
                                ? "Libre"
                                : s.status === "bloqueada"
                                ? "Bloqueada"
                                : s.ocupante ?? "Ocupada"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
    </div>
  );
}
