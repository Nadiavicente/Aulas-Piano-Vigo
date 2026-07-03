"use client";

import { useMemo, useState, useTransition } from "react";
import { formatHora } from "@/lib/schedule";
import type { Room, RoundId } from "@/lib/types";
import type { DayState } from "@/lib/booking";
import { reservarFranjas } from "./actions";

export function DayGrid({
  roundId,
  dia,
  rooms,
  day,
  maxHorasDia,
}: {
  roundId: RoundId;
  dia: string;
  rooms: Room[];
  day: DayState;
  maxHorasDia: number;
}) {
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const horas = useMemo(() => {
    const set = new Set(day.slots.map((s) => s.hora));
    return [...set].sort();
  }, [day.slots]);

  const statusByKey = useMemo(() => {
    const map = new Map<string, (typeof day.slots)[number]>();
    for (const s of day.slots) map.set(`${s.hora}|${s.room_id}`, s);
    return map;
  }, [day.slots]);

  const restantes = maxHorasDia - day.horas_reservadas_mias - Object.keys(selected).length;
  const aulasDistintas = new Set(Object.values(selected)).size;

  function toggle(hora: string, roomId: string, status: string) {
    setError(null);
    if (status !== "libre") return;

    setSelected((prev) => {
      if (prev[hora] === roomId) {
        const next = { ...prev };
        delete next[hora];
        return next;
      }

      const isNewHora = !prev[hora];
      if (isNewHora && Object.keys(prev).length >= maxHorasDia - day.horas_reservadas_mias) {
        setError(`Solo puedes reservar ${maxHorasDia} horas al día en esta ronda.`);
        return prev;
      }

      const next = { ...prev, [hora]: roomId };
      if (new Set(Object.values(next)).size > 4) {
        setError("Solo puedes usar hasta 4 aulas distintas por día.");
        return prev;
      }
      return next;
    });
  }

  function confirmar() {
    setError(null);
    const seleccion = Object.entries(selected).map(([hora, room_id]) => ({ hora, room_id }));
    startTransition(async () => {
      const res = await reservarFranjas(roundId, dia, seleccion);
      if (res.ok) {
        setSelected({});
      } else {
        setError(res.error ?? "No se pudo confirmar la reserva.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-4 text-xs text-ink/60">
        <Legend color="bg-slot-free" label="Libre" />
        <Legend color="bg-slot-mine" label="Tu selección" />
        <Legend color="bg-slot-taken" label="Ocupada" />
        <Legend color="slot-blocked" label="Bloqueada" />
      </div>

      <div className="overflow-x-auto rounded-lg border border-ink/10">
        <table className="border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-white px-3 py-2 text-left font-medium text-ink/70">
                Aula
              </th>
              {horas.map((h) => (
                <th key={h} className="px-2 py-2 text-center font-medium text-ink/70">
                  {formatHora(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rooms.map((room) => (
              <tr key={room.id} className="border-t border-ink/5">
                <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-3 py-1 font-medium text-ink">
                  {room.numero}
                  <span className="ml-1 text-xs font-normal text-ink/40">
                    {room.tipo_piano === "cola" ? "🎹 cola" : "🎹 pared"}
                  </span>
                </td>
                {horas.map((hora) => {
                  const slot = statusByKey.get(`${hora}|${room.id}`);
                  const status = slot?.status ?? "libre";
                  const isPending = selected[hora] === room.id;

                  let cellClass = "bg-slot-free/20 hover:bg-slot-free/40 cursor-pointer";
                  let content = "";
                  if (status === "mia") {
                    cellClass = "bg-slot-mine text-white";
                    content = "✓";
                  } else if (status === "ocupada") {
                    cellClass = "bg-slot-taken/70 text-white cursor-not-allowed";
                  } else if (status === "bloqueada") {
                    cellClass = "slot-blocked cursor-not-allowed";
                  } else if (isPending) {
                    cellClass = "bg-gold text-ink ring-2 ring-gold-light cursor-pointer";
                    content = "✓";
                  }

                  return (
                    <td
                      key={hora}
                      onClick={() => toggle(hora, room.id, status)}
                      className={`h-8 w-10 select-none text-center align-middle text-xs transition ${cellClass}`}
                    >
                      {content}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={confirmar}
          disabled={Object.keys(selected).length === 0 || pending}
          className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-gold-light transition hover:bg-ink-light disabled:opacity-40"
        >
          {pending ? "Confirmando…" : `Confirmar (${Object.keys(selected).length}h seleccionadas)`}
        </button>
        <span className="text-xs text-ink/50">
          Te quedan {Math.max(restantes, 0)} horas y {4 - aulasDistintas} aulas disponibles hoy.
        </span>
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`inline-block h-3 w-3 rounded-sm ${color}`} />
      {label}
    </span>
  );
}
