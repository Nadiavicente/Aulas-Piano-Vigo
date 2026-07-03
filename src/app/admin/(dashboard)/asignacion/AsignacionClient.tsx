"use client";

import { useState, useTransition } from "react";
import type { Round, RoundId, Participant, PdfAssignmentRow } from "@/lib/types";
import type { AssignmentSummary } from "@/lib/autoAssign";
import { uploadAndParsePdf, confirmAssignment, discardBatch } from "./actions";

export function AsignacionClient({
  rounds,
  participants,
}: {
  rounds: Round[];
  participants: Participant[];
}) {
  const [roundId, setRoundId] = useState<RoundId | "">(rounds[0]?.id ?? "");
  const [batchId, setBatchId] = useState<string | null>(null);
  const [rows, setRows] = useState<PdfAssignmentRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<AssignmentSummary[] | null>(null);
  const [pending, startTransition] = useTransition();

  function updateRow(index: number, patch: Partial<PdfAssignmentRow>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function handleUpload(fd: FormData) {
    setError(null);
    setSummaries(null);
    fd.set("round_id", roundId);
    startTransition(async () => {
      const res = await uploadAndParsePdf(fd);
      if (res.ok) {
        setBatchId(res.batchId!);
        setRows(res.rows!);
      } else {
        setError(res.error ?? "No se pudo procesar el PDF.");
      }
    });
  }

  function handleConfirm() {
    if (!batchId || !roundId) return;
    setError(null);
    startTransition(async () => {
      const res = await confirmAssignment(batchId, roundId, rows);
      if (res.ok) {
        setSummaries(res.summaries!);
        setRows([]);
        setBatchId(null);
      } else {
        setError(res.error ?? "No se pudo ejecutar la asignación.");
      }
    });
  }

  function handleDiscard() {
    if (!batchId) return;
    startTransition(async () => {
      await discardBatch(batchId);
      setBatchId(null);
      setRows([]);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-3 rounded-md border border-ink/10 bg-ink/[0.02] p-4">
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
        <form action={handleUpload} className="flex items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-ink/60">PDF de orden de actuación</label>
            <input type="file" name="file" accept="application/pdf" required className="text-sm" />
          </div>
          <button disabled={pending} className="rounded bg-ink px-3 py-1.5 text-sm text-gold-light disabled:opacity-50">
            {pending ? "Procesando…" : "Analizar PDF"}
          </button>
        </form>
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {rows.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-medium text-ink">Revisión antes de ejecutar</h2>
          <div className="overflow-x-auto rounded-lg border border-ink/10">
            <table className="w-full text-sm">
              <thead className="bg-ink/5 text-left text-ink/60">
                <tr>
                  <th className="px-3 py-2">Nombre (PDF)</th>
                  <th className="px-3 py-2">Correo</th>
                  <th className="px-3 py-2">Día</th>
                  <th className="px-3 py-2">Hora actuación</th>
                  <th className="px-3 py-2">Participante</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-t border-ink/5">
                    <td className="px-3 py-2 text-ink/70">{row.nombre}</td>
                    <td className="px-3 py-2">
                      <input
                        value={row.email}
                        onChange={(e) => updateRow(i, { email: e.target.value })}
                        className="w-48 rounded border border-ink/20 px-2 py-1"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="date"
                        value={row.dia ?? ""}
                        onChange={(e) => updateRow(i, { dia: e.target.value || null })}
                        className="rounded border border-ink/20 px-2 py-1"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="time"
                        value={row.hora?.slice(0, 5) ?? ""}
                        onChange={(e) =>
                          updateRow(i, { hora: e.target.value ? `${e.target.value}:00` : null })
                        }
                        className="rounded border border-ink/20 px-2 py-1"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={row.participant_id ?? ""}
                        onChange={(e) =>
                          updateRow(i, {
                            participant_id: e.target.value || null,
                            match_status: e.target.value ? "matched" : "no_match",
                          })
                        }
                        className={`rounded border px-2 py-1 ${
                          row.match_status === "matched" ? "border-ink/20" : "border-red-400"
                        }`}
                      >
                        <option value="">— sin coincidencia —</option>
                        {participants.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nombre} ({p.email})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => removeRow(i)} className="text-red-600 hover:underline">
                        Quitar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleConfirm}
              disabled={pending}
              className="rounded bg-ink px-4 py-2 text-sm font-medium text-gold-light disabled:opacity-50"
            >
              {pending ? "Ejecutando…" : "Ejecutar asignación"}
            </button>
            <button onClick={handleDiscard} disabled={pending} className="text-sm text-ink/50 underline">
              Descartar
            </button>
          </div>
        </div>
      )}

      {summaries && (
        <div className="flex flex-col gap-2 rounded-md border border-ink/10 p-4">
          <h2 className="text-lg font-medium text-ink">Resultado de la asignación</h2>
          <table className="w-full text-sm">
            <thead className="text-left text-ink/60">
              <tr>
                <th className="py-1">Participante</th>
                <th className="py-1">Horas asignadas</th>
                <th className="py-1">Email</th>
                <th className="py-1">Aviso</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((s) => (
                <tr key={s.participant_id} className="border-t border-ink/5">
                  <td className="py-1">{s.nombre}</td>
                  <td className="py-1">{s.horas_asignadas}</td>
                  <td className="py-1">{s.email_enviado ? "✓ enviado" : "⚠ falló"}</td>
                  <td className="py-1 text-ink/50">{s.aviso ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
