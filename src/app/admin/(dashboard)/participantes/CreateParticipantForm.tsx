"use client";

import { useState, useTransition } from "react";
import type { Round, RoundId } from "@/lib/types";
import { actionCreateParticipant } from "./actions";

export function CreateParticipantForm({ rounds }: { rounds: Round[] }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<{ password?: string; error?: string; emailEnviado?: boolean } | null>(
    null
  );
  const [pending, startTransition] = useTransition();

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-md bg-ink/5 px-3 py-1.5 text-sm text-ink hover:bg-ink/10"
      >
        {open ? "Cancelar" : "+ Añadir participante"}
      </button>

      {open && (
        <form
          action={(fd) => {
            const nombre = String(fd.get("nombre") ?? "").trim();
            const email = String(fd.get("email") ?? "").trim();
            const codigo = String(fd.get("codigo") ?? "").trim();
            const rondas = rounds.filter((r) => fd.get(`round-${r.id}`)).map((r) => r.id) as RoundId[];
            if (!nombre || !email) return;
            startTransition(async () => {
              const res = await actionCreateParticipant(nombre, email, codigo, rondas);
              setResult(
                res.ok ? { password: res.password, emailEnviado: res.emailEnviado } : { error: res.error }
              );
            });
          }}
          className="mt-3 flex flex-wrap items-end gap-3 rounded-md border border-ink/10 bg-ink/[0.02] p-3"
        >
          <div className="flex flex-col gap-1">
            <label className="text-xs text-ink/60">Nombre</label>
            <input name="nombre" required className="rounded border border-ink/20 px-2 py-1 text-sm" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-ink/60">Correo</label>
            <input name="email" type="email" required className="rounded border border-ink/20 px-2 py-1 text-sm" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-ink/60">Código</label>
            <input name="codigo" className="rounded border border-ink/20 px-2 py-1 text-sm" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-ink/60">Clasificado para</label>
            <div className="flex gap-2">
              {rounds.map((r) => (
                <label key={r.id} className="flex items-center gap-1 text-xs text-ink/70">
                  <input type="checkbox" name={`round-${r.id}`} defaultChecked={r.orden === 1} /> {r.nombre}
                </label>
              ))}
            </div>
          </div>
          <button disabled={pending} className="rounded bg-ink px-3 py-1.5 text-sm text-gold-light disabled:opacity-50">
            Crear
          </button>
        </form>
      )}

      {result?.password && (
        <p
          className={`mt-2 rounded-md px-3 py-2 text-sm text-ink ${
            result.emailEnviado ? "bg-slot-free/10" : "bg-amber-50"
          }`}
        >
          Participante creado. Contraseña generada: <strong>{result.password}</strong>
          {result.emailEnviado ? (
            " — se le ha enviado por correo con su acceso y código QR."
          ) : (
            <>
              {" "}— <strong>el envío del correo ha fallado</strong>, reenvíasela manualmente.
            </>
          )}
        </p>
      )}
      {result?.error && (
        <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{result.error}</p>
      )}
    </div>
  );
}
