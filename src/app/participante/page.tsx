import { getCurrentParticipant } from "@/lib/dal";
import { getAllRounds, getRoundRooms, getRoundDaysState } from "@/lib/booking";
import { getSupabaseAdmin } from "@/lib/supabase";
import { SiteHeader } from "@/components/SiteHeader";
import { LogoutButton } from "@/components/LogoutButton";
import { RoundBooking } from "./RoundBooking";
import type { ParticipantPerformance } from "@/lib/types";

export default async function ParticipantePage() {
  const participant = await getCurrentParticipant();
  if (!participant) return null;

  const allRounds = await getAllRounds();
  const misRondas = allRounds.filter(
    (r) => participant.rondas_clasificado.includes(r.id) && r.unlocked
  );

  const supabase = getSupabaseAdmin();
  const { data: performances } = await supabase
    .from("participant_performances")
    .select("*")
    .eq("participant_id", participant.id);

  const performancesByRound = new Map(
    ((performances ?? []) as ParticipantPerformance[]).map((p) => [p.round_id, p])
  );

  const rondasData = await Promise.all(
    misRondas.map(async (round) => {
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

  const rondasFuturas = allRounds.filter(
    (r) => participant.rondas_clasificado.includes(r.id) && !r.unlocked
  );

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteHeader
        title={`Hola, ${participant.nombre}`}
        right={<LogoutButton className="text-white/80 hover:text-gold-light" />}
      />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-4 py-8">
        {rondasData.length === 0 && rondasFuturas.length === 0 && (
          <p className="text-ink/60">
            Todavía no tienes ninguna ronda disponible para reservar horas de estudio.
          </p>
        )}

        {rondasData.map(({ round, rooms, days, performance }) => (
          <RoundBooking
            key={round.id}
            round={round}
            rooms={rooms}
            days={days}
            performance={performance}
          />
        ))}

        {rondasFuturas.length > 0 && (
          <div className="rounded-lg border border-ink/10 bg-ink/[0.02] p-4 text-sm text-ink/60">
            Estás clasificado/a para{" "}
            {rondasFuturas.map((r) => r.nombre).join(", ")}, pero la organización
            todavía no ha abierto la reserva de horas para esa ronda.
          </div>
        )}
      </main>
    </div>
  );
}
