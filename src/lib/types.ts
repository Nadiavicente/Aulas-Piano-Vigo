export type RoundId = 'primera' | 'semifinal' | 'final'

export type TipoPiano = 'cola' | 'pared'
export type Motivo = 'jurado' | 'admin'
export type BookingSource = 'participant' | 'admin_auto' | 'admin_manual'

export interface Round {
  id: RoundId
  nombre: string
  orden: number
  dias: string[] // 'YYYY-MM-DD'
  hora_inicio: string // 'HH:MM:SS'
  hora_fin: string // 'HH:MM:SS' - inicio de la última franja
  max_horas_dia: number
  unlocked: boolean
}

export interface Room {
  id: string
  numero: string
  tipo_piano: TipoPiano
}

export interface Participant {
  id: string
  codigo: string | null
  nombre: string
  email: string
  password_hash: string
  rondas_clasificado: RoundId[]
  created_at: string
}

export interface ParticipantPublic {
  id: string
  codigo: string | null
  nombre: string
  email: string
  rondas_clasificado: RoundId[]
}

export interface ParticipantPerformance {
  participant_id: string
  round_id: RoundId
  performance_day: string | null
  performance_hour: string | null
}

export interface BlockedSlot {
  id: string
  round_id: RoundId
  dia: string
  room_id: string
  hora: string
  motivo: Motivo
}

export interface Booking {
  id: string
  participant_id: string
  round_id: RoundId
  dia: string
  room_id: string
  hora: string
  source: BookingSource
  created_at: string
}

export interface Admin {
  id: string
  email: string
  password_hash: string
}

export interface EmailLogEntry {
  id: string
  participant_id: string | null
  email_to: string
  subject: string
  type: 'booking_confirmation' | 'pdf_assignment' | 'credentials'
  status: 'sent' | 'failed'
  error: string | null
  payload: unknown
  retry_count: number
  created_at: string
}

export interface PdfAssignmentRow {
  nombre: string
  email: string
  dia: string | null
  hora: string | null
  participant_id: string | null
  match_status: 'matched' | 'no_match' | 'ambiguous'
}

export interface PdfAssignmentBatch {
  id: string
  uploaded_by: string | null
  round_id: RoundId | null
  original_filename: string | null
  raw_text: string | null
  parsed_rows: PdfAssignmentRow[]
  status: 'pending_review' | 'confirmed' | 'discarded'
  created_at: string
  confirmed_at: string | null
}

// Franja horaria dentro de una grid de reservas
export interface SlotState {
  dia: string
  hora: string
  room_id: string
  status: 'libre' | 'mia' | 'ocupada' | 'bloqueada'
  ocupante?: string // nombre, solo visible para admin
}
