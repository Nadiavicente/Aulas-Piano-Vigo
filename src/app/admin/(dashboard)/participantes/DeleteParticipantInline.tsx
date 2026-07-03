"use client";

import { useTransition } from "react";
import { actionDeleteParticipant } from "./actions";

export function DeleteParticipantInline({ participantId, nombre }: { participantId: string; nombre: string }) {
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    const confirmed = window.confirm(
      `¿Seguro que quieres eliminar a "${nombre}"? Se borrarán también todas sus reservas. Esta acción no se puede deshacer.`
    );
    if (!confirmed) return;
    startTransition(() => actionDeleteParticipant(participantId));
  }

  return (
    <button onClick={handleDelete} disabled={pending} className="text-red-600 hover:underline disabled:opacity-50">
      {pending ? "Eliminando…" : "Eliminar"}
    </button>
  );
}
