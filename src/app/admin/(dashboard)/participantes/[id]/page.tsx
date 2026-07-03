import { notFound } from "next/navigation";
import { getParticipantById, getParticipantBookings } from "@/lib/admin";
import { getAllRounds, getRoundRooms } from "@/lib/booking";
import { generateLoginQrDataUrl, getLoginUrl } from "@/lib/qrcode";
import { ParticipantDetailClient } from "./ParticipantDetailClient";

export default async function ParticipantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const participant = await getParticipantById(id);
  if (!participant) notFound();

  const rounds = await getAllRounds();
  const bookings = await getParticipantBookings(id);
  const qrDataUrl = await generateLoginQrDataUrl(participant.email);
  const loginUrl = getLoginUrl(participant.email);

  const roomsByRound: Record<string, Awaited<ReturnType<typeof getRoundRooms>>> = {};
  for (const round of rounds) {
    roomsByRound[round.id] = await getRoundRooms(round.id);
  }

  return (
    <ParticipantDetailClient
      participant={participant}
      rounds={rounds}
      bookings={bookings}
      roomsByRound={roomsByRound}
      qrDataUrl={qrDataUrl}
      loginUrl={loginUrl}
    />
  );
}
