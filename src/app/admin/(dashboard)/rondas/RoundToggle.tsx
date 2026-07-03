"use client";

import { useTransition } from "react";
import { toggleRoundUnlocked } from "./actions";
import type { RoundId } from "@/lib/types";

export function RoundToggle({ roundId, unlocked }: { roundId: RoundId; unlocked: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      onClick={() => startTransition(() => toggleRoundUnlocked(roundId, !unlocked))}
      disabled={pending}
      className={`rounded-md px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${
        unlocked ? "bg-slot-free text-white hover:brightness-110" : "bg-ink text-gold-light hover:bg-ink-light"
      }`}
    >
      {unlocked ? "Desbloqueada — bloquear" : "Bloqueada — desbloquear"}
    </button>
  );
}
