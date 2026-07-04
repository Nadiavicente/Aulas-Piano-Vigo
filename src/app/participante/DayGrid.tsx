"use client";

import { useMemo, useState, useTransition } from "react";
import { formatDia, formatHora, timeToMinutes, minutesToTime } from "@/lib/schedule";
import type { Room, RoundId, ParticipantPerformance } from "@/lib/types";
import type { DayState } from "@/lib/booking";
import { reservarFranjas } from "./actions";

export function DayGrid({
  roundId,
  dia,
  rooms,
  day,
  maxHorasDia,
  performance,
}: {
  roundId: RoundId;
  dia: string;
  rooms: Room[];
  day: DayState;
  maxHorasDia: number;
  performance: ParticipantPerformance | null;
}) {
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [expandedRoomId, setExpandedRoomId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const slotsByRoom = useMemo(() => {
    const map = new Map<string, (typeof day.slots)[number][]>();
    for (const room of rooms) map.set(room.id, []);
    for (const s of day.slots) map.get(s.room_id)?.push(s);
    for (const list of map.values()) list.sort((a, b) => a.hora.localeCompare(b.hora));
    return map;
  }, [day.slots, rooms]);

  const restantes = maxHorasDia - day.horas_reservadas_mias - Object.keys(selected).length;
  const aulasDistintas = new Set(Object.values(selected)).size;
  const actuaEsteDia = performance?.performance_day === dia && performance?.performance_hour;

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

  const totalSeleccionadas = Object.keys(selected).length;
  const totalHoy = day.horas_reservadas_mias + totalSeleccionadas;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-ink/10 p-3 sm:p-6">
      <div>
        <h3 className="font-serif text-lg font-semibold capitalize text-ink sm:text-xl">
          Selecciona tus horas — {formatDia(dia)}
        </h3>
        <p className="text-sm text-ink/60">
          Hasta {maxHorasDia}h en 1-4 aulas. Ya tienes {totalHoy} de {maxHorasDia}.
        </p>
        <p className="mt-1 text-sm font-medium text-gold">
          ⚠️ Debes pulsar &quot;Confirmar reserva del día&quot; en cada día por separado — si no,
          esas horas no quedarán guardadas. Una vez confirmadas las aulas, no podrás cambiar esos
          horarios tú mismo/a — contacta con la organización si necesitas modificarlos.
        </p>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink/60">
        <Legend color="bg-slot-free/40 border border-slot-free" label="Libre" />
        <Legend color="bg-slot-mine border border-slot-mine" label="Tu selección ✓" />
        <Legend color="bg-slot-taken/40 border border-slot-taken" label="Ocupada" />
        <Legend color="slot-blocked" label="Bloqueada" />
      </div>

      {actuaEsteDia && (
        <p className="rounded-md bg-gold/10 px-3 py-2 text-sm text-ink/80">
          🎹 Tu horario de actuación esta ronda es{" "}
          <strong>
            {formatDia(dia)} a las {formatHora(performance!.performance_hour!)}
          </strong>
          . Tienes derecho a tus {maxHorasDia} horas de estudio ese día igualmente.
        </p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-col gap-2">
        {rooms.map((room) => {
          const slots = slotsByRoom.get(room.id) ?? [];
          const libres = slots.filter((s) => s.status === "libre").length;
          const misHoras = slots.filter(
            (s) => s.status === "mia" || selected[s.hora] === room.id
          ).length;
          const isExpanded = expandedRoomId === room.id;

          return (
            <div key={room.id} className="rounded-lg border border-ink/10">
              <button
                onClick={() => setExpandedRoomId(isExpanded ? null : room.id)}
                className="flex w-full items-center justify-between px-3 py-3 text-left"
              >
                <span className="flex items-center gap-2">
                  <span className="font-medium text-ink">Aula {room.numero}</span>
                  <span className="text-[10px] font-medium uppercase tracking-wide text-ink/40">
                    Piano de {room.tipo_piano}
                  </span>
                  {misHoras > 0 && (
                    <span className="rounded-full bg-slot-mine px-2 py-0.5 text-[10px] font-medium text-white">
                      {misHoras}h tuyas
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-2 text-xs text-ink/40">
                  {libres} libres
                  <span className={`transition ${isExpanded ? "rotate-180" : ""}`}>▾</span>
                </span>
              </button>

              {isExpanded && (
                <div className="flex flex-wrap gap-1.5 border-t border-ink/5 p-3">
                  {slots.map((slot) => {
                    const isPending = selected[slot.hora] === room.id;
                    const status = slot.status;

                    let cellClass =
                      "border-slot-free/50 bg-slot-free/10 text-ink hover:bg-slot-free/25 cursor-pointer";
                    let mark: string | null = null;
                    if (status === "mia") {
                      cellClass = "border-slot-mine bg-slot-mine text-white";
                      mark = "✓";
                    } else if (status === "ocupada") {
                      cellClass = "border-slot-taken/50 bg-slot-taken/20 text-ink/40 cursor-not-allowed";
                    } else if (status === "bloqueada") {
                      cellClass = "slot-blocked cursor-not-allowed border-transparent";
                    } else if (isPending) {
                      cellClass = "border-gold bg-gold text-ink ring-2 ring-gold-light cursor-pointer";
                      mark = "✓";
                    }

                    return (
                      <button
                        key={slot.hora}
                        onClick={() => toggle(slot.hora, room.id, status)}
                        disabled={status === "ocupada" || status === "bloqueada"}
                        className={`flex h-14 w-20 flex-none flex-col items-center justify-center gap-0.5 rounded-md border text-xs font-medium transition ${cellClass}`}
                      >
                        <span>
                          {formatHora(slot.hora)}–{formatHora(minutesToTime(timeToMinutes(slot.hora) + 60))}
                        </span>
                        {mark && <span>{mark}</span>}
                      </button>
                    );
                  })}
                  <button
                    onClick={confirmar}
                    disabled={totalSeleccionadas === 0 || pending}
                    className="mt-1 w-full rounded-md bg-ink px-4 py-3 text-sm font-medium text-gold-light transition hover:bg-ink-light disabled:cursor-not-allowed disabled:bg-ink/20 disabled:text-ink/40"
                  >
                    {pending
                      ? "Confirmando…"
                      : `Confirmar reserva del día${totalSeleccionadas > 0 ? ` (${totalSeleccionadas}h)` : ""}`}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <span className="text-xs text-ink/50">
        Te quedan {Math.max(restantes, 0)} horas y {Math.max(4 - aulasDistintas, 0)} aulas
        disponibles hoy.
      </span>
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
