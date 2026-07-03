"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { formatDia, formatHora, listHourSlots } from "@/lib/schedule";
import type { Participant, Round, RoundId, Room } from "@/lib/types";
import type { ParticipantBookingRow } from "@/lib/admin";
import {
  actionUpdateRounds,
  actionRegeneratePassword,
  actionAdminAssignSlot,
  actionAdminRemoveBooking,
} from "../actions";

export function ParticipantDetailClient({
  participant,
  rounds,
  bookings,
  roomsByRound,
  qrDataUrl,
  loginUrl,
}: {
  participant: Participant;
  rounds: Round[];
  bookings: ParticipantBookingRow[];
  roomsByRound: Record<string, Room[]>;
  qrDataUrl: string;
  loginUrl: string;
}) {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-ink">{participant.nombre}</h1>
        <p className="text-ink/60">
          {participant.email} {participant.codigo && `· código ${participant.codigo}`}
        </p>
      </div>

      <RoundsSection participant={participant} rounds={rounds} />
      <PasswordSection participantId={participant.id} />
      <QrSection qrDataUrl={qrDataUrl} loginUrl={loginUrl} />
      <BookingsSection participantId={participant.id} bookings={bookings} rounds={rounds} />
      <AssignSection participantId={participant.id} rounds={rounds} roomsByRound={roomsByRound} />
    </div>
  );
}

function RoundsSection({ participant, rounds }: { participant: Participant; rounds: Round[] }) {
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<RoundId>>(new Set(participant.rondas_clasificado));

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-medium text-ink">Clasificación por ronda</h2>
      <div className="flex flex-wrap gap-3">
        {rounds.map((r) => (
          <label key={r.id} className="flex items-center gap-2 text-sm text-ink/80">
            <input
              type="checkbox"
              checked={selected.has(r.id)}
              onChange={(e) => {
                const next = new Set(selected);
                if (e.target.checked) next.add(r.id);
                else next.delete(r.id);
                setSelected(next);
              }}
            />
            {r.nombre}
          </label>
        ))}
      </div>
      <button
        disabled={pending}
        onClick={() => startTransition(() => actionUpdateRounds(participant.id, [...selected]))}
        className="w-fit rounded bg-ink px-3 py-1.5 text-sm text-gold-light disabled:opacity-50"
      >
        Guardar clasificación
      </button>
    </section>
  );
}

function PasswordSection({ participantId }: { participantId: string }) {
  const [password, setPassword] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-medium text-ink">Contraseña</h2>
      <button
        disabled={pending}
        onClick={() => startTransition(async () => setPassword(await actionRegeneratePassword(participantId)))}
        className="w-fit rounded bg-ink px-3 py-1.5 text-sm text-gold-light disabled:opacity-50"
      >
        Regenerar contraseña
      </button>
      {password && (
        <p className="rounded-md bg-slot-free/10 px-3 py-2 text-sm text-ink">
          Nueva contraseña: <strong>{password}</strong> — reenvíasela manualmente por correo.
        </p>
      )}
    </section>
  );
}

function QrSection({ qrDataUrl, loginUrl }: { qrDataUrl: string; loginUrl: string }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-medium text-ink">Código QR de acceso</h2>
      <div className="flex items-center gap-4">
        <Image src={qrDataUrl} alt="Código QR de acceso" width={140} height={140} unoptimized />
        <div className="text-sm text-ink/60">
          <p>Escanear enlaza directamente a su login con el correo prerellenado.</p>
          <p className="break-all text-ink/40">{loginUrl}</p>
        </div>
      </div>
    </section>
  );
}

function BookingsSection({
  participantId,
  bookings,
  rounds,
}: {
  participantId: string;
  bookings: ParticipantBookingRow[];
  rounds: Round[];
}) {
  const [pending, startTransition] = useTransition();
  const roundName = (id: RoundId) => rounds.find((r) => r.id === id)?.nombre ?? id;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-medium text-ink">Reservas actuales</h2>
      <div className="overflow-x-auto rounded-lg border border-ink/10">
        <table className="w-full text-sm">
          <thead className="bg-ink/5 text-left text-ink/60">
            <tr>
              <th className="px-3 py-2">Ronda</th>
              <th className="px-3 py-2">Día</th>
              <th className="px-3 py-2">Hora</th>
              <th className="px-3 py-2">Aula</th>
              <th className="px-3 py-2">Origen</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={`${b.round_id}-${b.dia}-${b.room_id}-${b.hora}`} className="border-t border-ink/5">
                <td className="px-3 py-2">{roundName(b.round_id)}</td>
                <td className="px-3 py-2 capitalize">{formatDia(b.dia)}</td>
                <td className="px-3 py-2">{formatHora(b.hora)}</td>
                <td className="px-3 py-2">{b.room_numero}</td>
                <td className="px-3 py-2 text-ink/50">{b.source}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    disabled={pending}
                    onClick={() =>
                      startTransition(() =>
                        actionAdminRemoveBooking(participantId, b.round_id, b.dia, b.room_id, b.hora)
                      )
                    }
                    className="text-red-600 hover:underline"
                  >
                    Quitar
                  </button>
                </td>
              </tr>
            ))}
            {bookings.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-ink/40">
                  Sin reservas todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AssignSection({
  participantId,
  rounds,
  roomsByRound,
}: {
  participantId: string;
  rounds: Round[];
  roomsByRound: Record<string, Room[]>;
}) {
  const [roundId, setRoundId] = useState<RoundId | "">(rounds[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, startTransition] = useTransition();

  const round = rounds.find((r) => r.id === roundId);
  const rooms = roundId ? roomsByRound[roundId] ?? [] : [];
  const horas = useMemo(() => (round ? listHourSlots(round.hora_inicio, round.hora_fin) : []), [round]);

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-medium text-ink">Asignar horario manualmente</h2>
      <form
        action={(fd) => {
          setError(null);
          setOk(false);
          const dia = String(fd.get("dia"));
          const room_id = String(fd.get("room_id"));
          const hora = String(fd.get("hora"));
          if (!roundId) return;
          startTransition(async () => {
            const res = await actionAdminAssignSlot(participantId, roundId, dia, room_id, hora);
            if (res.ok) setOk(true);
            else setError(res.error ?? "No se pudo asignar.");
          });
        }}
        className="flex flex-wrap items-end gap-3 rounded-md border border-ink/10 bg-ink/[0.02] p-3"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink/60">Ronda</label>
          <select
            value={roundId}
            onChange={(e) => setRoundId(e.target.value as RoundId)}
            className="rounded border border-ink/20 px-2 py-1 text-sm"
          >
            {rounds.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink/60">Día</label>
          <select name="dia" className="rounded border border-ink/20 px-2 py-1 text-sm">
            {round?.dias.map((d) => (
              <option key={d} value={d}>
                {formatDia(d)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink/60">Aula</label>
          <select name="room_id" className="rounded border border-ink/20 px-2 py-1 text-sm">
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.numero}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink/60">Hora</label>
          <select name="hora" className="rounded border border-ink/20 px-2 py-1 text-sm">
            {horas.map((h) => (
              <option key={h} value={h}>
                {formatHora(h)}
              </option>
            ))}
          </select>
        </div>
        <button disabled={pending} className="rounded bg-ink px-3 py-1.5 text-sm text-gold-light disabled:opacity-50">
          Asignar
        </button>
      </form>
      {ok && <p className="text-sm text-slot-free">Asignado correctamente.</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </section>
  );
}
