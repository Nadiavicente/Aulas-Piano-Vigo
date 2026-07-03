"use client";

import { useState, useTransition } from "react";
import { listHourSlots, formatDia, formatHora } from "@/lib/schedule";
import type { Round, Room, RoundId, TipoPiano, Motivo, BlockedSlot } from "@/lib/types";
import {
  actionUpdateTipoPiano,
  actionUpdateMaxHoras,
  actionBlockSlot,
  actionUnblockSlot,
  actionCreateRoom,
} from "./actions";

type RoomWithRounds = Room & { round_ids: RoundId[] };
type BlockedWithRoom = BlockedSlot & { room_numero: string };

export function AulasClient({
  rounds,
  rooms,
  blockedByRound,
}: {
  rounds: Round[];
  rooms: RoomWithRounds[];
  blockedByRound: Record<string, BlockedWithRoom[]>;
}) {
  return (
    <>
      <MaxHorasSection rounds={rounds} />
      <RoomsSection rooms={rooms} rounds={rounds} />
      <BlockedSlotsSection rounds={rounds} rooms={rooms} blockedByRound={blockedByRound} />
    </>
  );
}

function MaxHorasSection({ rounds }: { rounds: Round[] }) {
  const [pending, startTransition] = useTransition();
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-medium text-ink">Máximo de horas diarias por ronda</h2>
      <div className="flex flex-wrap gap-4">
        {rounds.map((round) => (
          <form
            key={round.id}
            action={(fd) =>
              startTransition(() =>
                actionUpdateMaxHoras(round.id, Number(fd.get("max")))
              )
            }
            className="flex items-center gap-2 rounded-md border border-ink/10 p-3"
          >
            <span className="text-sm font-medium text-ink">{round.nombre}</span>
            <input
              name="max"
              type="number"
              min={1}
              max={16}
              defaultValue={round.max_horas_dia}
              className="w-16 rounded border border-ink/20 px-2 py-1 text-sm"
            />
            <button
              disabled={pending}
              className="rounded bg-ink px-2 py-1 text-xs font-medium text-gold-light disabled:opacity-50"
            >
              Guardar
            </button>
          </form>
        ))}
      </div>
    </section>
  );
}

function RoomsSection({ rooms, rounds }: { rooms: RoomWithRounds[]; rounds: Round[] }) {
  const [pending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-ink">Aulas</h2>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="rounded-md bg-ink/5 px-3 py-1.5 text-sm text-ink hover:bg-ink/10"
        >
          {showCreate ? "Cancelar" : "+ Añadir aula"}
        </button>
      </div>

      {showCreate && <CreateRoomForm rounds={rounds} onDone={() => setShowCreate(false)} />}

      <div className="overflow-x-auto rounded-lg border border-ink/10">
        <table className="w-full text-sm">
          <thead className="bg-ink/5 text-left text-ink/60">
            <tr>
              <th className="px-3 py-2">Aula</th>
              <th className="px-3 py-2">Tipo de piano</th>
              <th className="px-3 py-2">Rondas</th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((room) => (
              <tr key={room.id} className="border-t border-ink/5">
                <td className="px-3 py-2 font-medium text-ink">{room.numero}</td>
                <td className="px-3 py-2">
                  <select
                    defaultValue={room.tipo_piano}
                    disabled={pending}
                    onChange={(e) =>
                      startTransition(() =>
                        actionUpdateTipoPiano(room.id, e.target.value as TipoPiano)
                      )
                    }
                    className="rounded border border-ink/20 px-2 py-1"
                  >
                    <option value="cola">Cola</option>
                    <option value="pared">Pared</option>
                  </select>
                </td>
                <td className="px-3 py-2 text-ink/60">
                  {room.round_ids
                    .map((id) => rounds.find((r) => r.id === id)?.nombre ?? id)
                    .join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CreateRoomForm({ rounds, onDone }: { rounds: Round[]; onDone: () => void }) {
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(fd) => {
        const numero = String(fd.get("numero") ?? "").trim();
        const tipo = fd.get("tipo") as TipoPiano;
        const roundIds = rounds.filter((r) => fd.get(`round-${r.id}`)).map((r) => r.id);
        if (!numero) return;
        startTransition(async () => {
          await actionCreateRoom(numero, tipo, roundIds);
          onDone();
        });
      }}
      className="flex flex-wrap items-end gap-3 rounded-md border border-ink/10 bg-ink/[0.02] p-3"
    >
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink/60">Número de aula</label>
        <input name="numero" required className="rounded border border-ink/20 px-2 py-1 text-sm" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink/60">Tipo de piano</label>
        <select name="tipo" defaultValue="cola" className="rounded border border-ink/20 px-2 py-1 text-sm">
          <option value="cola">Cola</option>
          <option value="pared">Pared</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink/60">Rondas</label>
        <div className="flex gap-2">
          {rounds.map((r) => (
            <label key={r.id} className="flex items-center gap-1 text-xs text-ink/70">
              <input type="checkbox" name={`round-${r.id}`} /> {r.nombre}
            </label>
          ))}
        </div>
      </div>
      <button disabled={pending} className="rounded bg-ink px-3 py-1.5 text-sm text-gold-light disabled:opacity-50">
        Crear
      </button>
    </form>
  );
}

function BlockedSlotsSection({
  rounds,
  rooms,
  blockedByRound,
}: {
  rounds: Round[];
  rooms: RoomWithRounds[];
  blockedByRound: Record<string, BlockedWithRoom[]>;
}) {
  const [roundId, setRoundId] = useState<RoundId | undefined>(rounds[0]?.id);
  const [pending, startTransition] = useTransition();

  const round = rounds.find((r) => r.id === roundId);
  const roomsForRound = rooms.filter((r) => roundId && r.round_ids.includes(roundId));
  const horas = round ? listHourSlots(round.hora_inicio, round.hora_fin) : [];
  const blocked = (roundId && blockedByRound[roundId]) || [];

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-medium text-ink">Bloqueos de horario (jurado / administración)</h2>

      <div className="flex flex-wrap gap-2">
        {rounds.map((r) => (
          <button
            key={r.id}
            onClick={() => setRoundId(r.id)}
            className={`rounded-md px-3 py-1.5 text-sm ${
              roundId === r.id ? "bg-ink text-gold-light" : "bg-ink/5 text-ink/70"
            }`}
          >
            {r.nombre}
          </button>
        ))}
      </div>

      {round && (
        <form
          action={(fd) => {
            const dia = String(fd.get("dia"));
            const room_id = String(fd.get("room_id"));
            const hora = String(fd.get("hora"));
            const motivo = fd.get("motivo") as Motivo;
            startTransition(() => actionBlockSlot(round.id, dia, room_id, hora, motivo));
          }}
          className="flex flex-wrap items-end gap-3 rounded-md border border-ink/10 bg-ink/[0.02] p-3"
        >
          <Field label="Día">
            <select name="dia" className="rounded border border-ink/20 px-2 py-1 text-sm">
              {round.dias.map((d) => (
                <option key={d} value={d}>
                  {formatDia(d)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Aula">
            <select name="room_id" className="rounded border border-ink/20 px-2 py-1 text-sm">
              {roomsForRound.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.numero}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Hora">
            <select name="hora" className="rounded border border-ink/20 px-2 py-1 text-sm">
              {horas.map((h) => (
                <option key={h} value={h}>
                  {formatHora(h)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Motivo">
            <select name="motivo" className="rounded border border-ink/20 px-2 py-1 text-sm">
              <option value="jurado">Jurado</option>
              <option value="admin">Administración</option>
            </select>
          </Field>
          <button disabled={pending} className="rounded bg-ink px-3 py-1.5 text-sm text-gold-light disabled:opacity-50">
            Bloquear
          </button>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-ink/10">
        <table className="w-full text-sm">
          <thead className="bg-ink/5 text-left text-ink/60">
            <tr>
              <th className="px-3 py-2">Día</th>
              <th className="px-3 py-2">Aula</th>
              <th className="px-3 py-2">Hora</th>
              <th className="px-3 py-2">Motivo</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {blocked.map((b) => (
              <tr key={b.id} className="border-t border-ink/5">
                <td className="px-3 py-2 capitalize">{formatDia(b.dia)}</td>
                <td className="px-3 py-2">{b.room_numero}</td>
                <td className="px-3 py-2">{formatHora(b.hora)}</td>
                <td className="px-3 py-2 capitalize">{b.motivo}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    disabled={pending}
                    onClick={() => startTransition(() => actionUnblockSlot(b.id))}
                    className="text-red-600 hover:underline"
                  >
                    Desbloquear
                  </button>
                </td>
              </tr>
            ))}
            {blocked.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-ink/40">
                  No hay bloqueos en esta ronda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-ink/60">{label}</label>
      {children}
    </div>
  );
}
