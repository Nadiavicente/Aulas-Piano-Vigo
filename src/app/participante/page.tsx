import { getCurrentParticipant } from "@/lib/dal";
import { getAllRounds, getRoundRooms, getRoundDaysState } from "@/lib/booking";
import { getSupabaseAdmin } from "@/lib/supabase";
import { SiteHeader } from "@/components/SiteHeader";
import { LogoutButton } from "@/components/LogoutButton";
import { ParticipanteApp } from "./ParticipanteApp";
import type { ParticipantPerformance } from "@/lib/types";

export default async function ParticipantePage() {
  const participant = await getCurrentParticipant();
  if (!participant) return null;

  const allRounds = await getAllRounds();
  const misRondas = allRounds.filter((r) => participant.rondas_clasificado.includes(r.id));
  const misRondasUnlocked = misRondas.filter((r) => r.unlocked);

  const supabase = getSupabaseAdmin();
  const { data: performances } = await supabase
    .from("participant_performances")
    .select("*")
    .eq("participant_id", participant.id);

  const performancesByRound = new Map(
    ((performances ?? []) as ParticipantPerformance[]).map((p) => [p.round_id, p])
  );

  const rondasData = await Promise.all(
    misRondasUnlocked.map(async (round) => {
      const rooms = await getRoundRooms(round.id);
      const days = await getRoundDaysState(round, rooms, {
        viewerParticipantId: participant.id,
      });
      return {
        round,
        rooms,
        days,
        performance: performancesByRound.get(round.id) ?? null,
      };
    })
  );

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteHeader right={<LogoutButton className="text-white/80 hover:text-gold-light" />} />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
        {misRondas.length === 0 ? (
          <p className="text-ink/60">
            Todavía no tienes ninguna ronda disponible para reservar horas de estudio.
          </p>
        ) : (
          <ParticipanteApp nombre={participant.nombre} rondas={misRondas} rondasData={rondasData} />
        )}
      </main>
    </div>
  );
}
