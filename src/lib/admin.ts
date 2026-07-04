import "server-only";
import { getSupabaseAdmin } from "./supabase";
import { hashPassword, generateReadablePassword } from "./password";
import { sendWelcomeEmail } from "./email";
import { BookingError } from "./booking";
import type { RoundId, TipoPiano, Motivo, Participant, Room, BlockedSlot } from "./types";

// ---------- Aulas ----------

export async function getAllRoomsWithRounds(): Promise<(Room & { round_ids: RoundId[] })[]> {
  const supabase = getSupabaseAdmin();
  const { data: rooms } = await supabase.from("rooms").select("*").order("numero");
  const { data: links } = await supabase.from("round_rooms").select("room_id, round_id");

  const roundsByRoom = new Map<string, RoundId[]>();
  for (const link of links ?? []) {
    const arr = roundsByRoom.get(link.room_id) ?? [];
    arr.push(link.round_id);
    roundsByRoom.set(link.room_id, arr);
  }

  return ((rooms ?? []) as Room[])
    .map((r) => ({ ...r, round_ids: roundsByRoom.get(r.id) ?? [] }))
    .sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true }));
}

export async function getBlockedSlotsForRound(roundId: RoundId): Promise<
  (BlockedSlot & { room_numero: string })[]
> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("blocked_slots")
    .select("*, rooms(numero)")
    .eq("round_id", roundId)
    .order("dia")
    .order("hora");

  return ((data ?? []) as unknown as (BlockedSlot & { rooms: { numero: string } })[]).map((b) => ({
    ...b,
    room_numero: b.rooms.numero,
  }));
}

export async function updateRoomTipoPiano(roomId: string, tipo: TipoPiano) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("rooms").update({ tipo_piano: tipo }).eq("id", roomId);
  if (error) throw new Error(error.message);
}

export async function createRoom(numero: string, tipo: TipoPiano, roundIds: RoundId[]) {
  const supabase = getSupabaseAdmin();
  const { data: room, error } = await supabase
    .from("rooms")
    .insert({ numero, tipo_piano: tipo })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  if (roundIds.length > 0) {
    await supabase
      .from("round_rooms")
      .insert(roundIds.map((round_id) => ({ round_id, room_id: room.id })));
  }
  return room;
}

export async function updateMaxHorasDia(roundId: RoundId, maxHoras: number) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("rounds")
    .update({ max_horas_dia: maxHoras })
    .eq("id", roundId);
  if (error) throw new Error(error.message);
}

export async function blockSlot(roundId: RoundId, dia: string, roomId: string, hora: string, motivo: Motivo) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("blocked_slots")
    .insert({ round_id: roundId, dia, room_id: roomId, hora, motivo });
  if (error) throw new Error(error.message);
}

export async function unblockSlot(blockedSlotId: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("blocked_slots").delete().eq("id", blockedSlotId);
  if (error) throw new Error(error.message);
}

// ---------- Rondas ----------

export async function setRoundUnlocked(roundId: RoundId, unlocked: boolean) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("rounds").update({ unlocked }).eq("id", roundId);
  if (error) throw new Error(error.message);
}

// ---------- Participantes ----------

export async function searchParticipants(query: string): Promise<Participant[]> {
  const supabase = getSupabaseAdmin();
  let q = supabase.from("participants").select("*").order("nombre");
  if (query.trim()) {
    const term = query.trim();
    q = q.or(`nombre.ilike.%${term}%,email.ilike.%${term}%,codigo.ilike.%${term}%`);
  }
  const { data } = await q.limit(200);
  return (data ?? []) as Participant[];
}

export async function updateParticipantRounds(participantId: string, rondas: RoundId[]) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("participants")
    .update({ rondas_clasificado: rondas })
    .eq("id", participantId);
  if (error) throw new Error(error.message);
}

export async function deleteParticipant(participantId: string) {
  const supabase = getSupabaseAdmin();
  // Las reservas, actuaciones y el historial de emails de este participante
  // se eliminan en cascada (ON DELETE CASCADE / SET NULL en el esquema).
  const { error } = await supabase.from("participants").delete().eq("id", participantId);
  if (error) throw new Error(error.message);
}

export async function regenerateParticipantPassword(participantId: string): Promise<string> {
  const supabase = getSupabaseAdmin();
  const newPassword = generateReadablePassword();
  const hash = await hashPassword(newPassword);
  const { error } = await supabase
    .from("participants")
    .update({ password_hash: hash })
    .eq("id", participantId);
  if (error) throw new Error(error.message);
  return newPassword;
}

export async function createParticipant(
  params: {
    nombre: string;
    email: string;
    codigo?: string;
    rondas: RoundId[];
  },
  opts: { enviarCorreo?: boolean } = {}
): Promise<{ participant: Participant; password: string; emailEnviado: boolean }> {
  const supabase = getSupabaseAdmin();
  const password = generateReadablePassword();
  const hash = await hashPassword(password);

  const { data, error } = await supabase
    .from("participants")
    .insert({
      nombre: params.nombre,
      email: params.email.toLowerCase().trim(),
      codigo: params.codigo || null,
      rondas_clasificado: params.rondas,
      password_hash: hash,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  const participant = data as Participant;
  // El envío del correo de bienvenida no debe hacer fallar el alta del
  // participante si falla; sendWelcomeEmail ya registra el fallo en email_log.
  // En modo prueba (opts.enviarCorreo === false) nos lo saltamos por
  // completo, para poder probar con datos reales sin avisar a nadie.
  const emailResult = opts.enviarCorreo === false ? { ok: false } : await sendWelcomeEmail(participant, password);

  return { participant, password, emailEnviado: emailResult.ok };
}

// Asignación manual de un nombre a un horario/aula concreto (sobrescribe si había otra reserva)
export async function adminAssignSlot(
  roundId: RoundId,
  dia: string,
  roomId: string,
  hora: string,
  participantId: string
) {
  const supabase = getSupabaseAdmin();

  const { data: blocked } = await supabase
    .from("blocked_slots")
    .select("id")
    .eq("round_id", roundId)
    .eq("dia", dia)
    .eq("room_id", roomId)
    .eq("hora", hora)
    .maybeSingle();

  if (blocked) {
    throw new BookingError("Esa franja está bloqueada. Desbloquéala primero si quieres asignarla.");
  }

  // Libera cualquier reserva previa de ese participante a esa misma hora ese día (no puede estar en dos sitios)
  await supabase
    .from("bookings")
    .delete()
    .eq("round_id", roundId)
    .eq("dia", dia)
    .eq("hora", hora)
    .eq("participant_id", participantId);

  // Libera la franja si ya la ocupaba otra persona
  await supabase.from("bookings").delete().eq("round_id", roundId).eq("dia", dia).eq("room_id", roomId).eq("hora", hora);

  const { error } = await supabase.from("bookings").insert({
    round_id: roundId,
    dia,
    room_id: roomId,
    hora,
    participant_id: participantId,
    source: "admin_manual",
  });
  if (error) throw new Error(error.message);
}

export async function getParticipantById(id: string): Promise<Participant | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from("participants").select("*").eq("id", id).maybeSingle();
  return data as Participant | null;
}

export interface ParticipantBookingRow {
  round_id: RoundId;
  dia: string;
  room_id: string;
  room_numero: string;
  hora: string;
  source: string;
}

export async function getParticipantBookings(participantId: string): Promise<ParticipantBookingRow[]> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("bookings")
    .select("round_id, dia, room_id, hora, source, rooms(numero)")
    .eq("participant_id", participantId)
    .order("dia")
    .order("hora");

  return ((data ?? []) as unknown as (ParticipantBookingRow & { rooms: { numero: string } })[]).map(
    (b) => ({ ...b, room_numero: b.rooms.numero })
  );
}

export async function adminRemoveBooking(roundId: RoundId, dia: string, roomId: string, hora: string) {
  const supabase = getSupabaseAdmin();
  await supabase
    .from("bookings")
    .delete()
    .eq("round_id", roundId)
    .eq("dia", dia)
    .eq("room_id", roomId)
    .eq("hora", hora);
}
