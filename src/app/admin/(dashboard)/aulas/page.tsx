import { getAllRounds } from "@/lib/booking";
import { getAllRoomsWithRounds, getBlockedSlotsForRound } from "@/lib/admin";
import { AulasClient } from "./AulasClient";

export default async function AulasPage() {
  const rounds = await getAllRounds();
  const rooms = await getAllRoomsWithRounds();

  const blockedByRound: Record<string, Awaited<ReturnType<typeof getBlockedSlotsForRound>>> = {};
  for (const round of rounds) {
    blockedByRound[round.id] = await getBlockedSlotsForRound(round.id);
  }

  return (
    <div className="flex flex-col gap-10">
      <h1 className="font-serif text-2xl font-semibold text-ink">Aulas</h1>
      <AulasClient rounds={rounds} rooms={rooms} blockedByRound={blockedByRound} />
    </div>
  );
}
