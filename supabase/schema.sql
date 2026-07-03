-- Esquema de la base de datos para la app de reservas de aulas de estudio
-- X Concurso Internacional de Piano Ciudad de Vigo
--
-- Autenticación propia (no Supabase Auth): las contraseñas las genera/reparte
-- la administración. Todo el acceso se hace desde el servidor con la
-- service_role key, así que RLS queda activado pero sin políticas para
-- anon/authenticated (deniega todo salvo al backend).

create extension if not exists "pgcrypto";

-- ============================================================
-- ADMINS
-- ============================================================
create table admins (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- ROUNDS (rondas: primera / semifinal / final)
-- ============================================================
create table rounds (
  id text primary key,               -- 'primera' | 'semifinal' | 'final'
  nombre text not null,
  orden int not null,                -- orden de celebración: 1, 2, 3
  dias date[] not null,               -- días en los que se celebra la ronda
  hora_inicio time not null,          -- inicio de la primera franja
  hora_fin time not null,             -- inicio de la última franja (no el cierre)
  max_horas_dia int not null default 4,
  unlocked boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============================================================
-- ROOMS (aulas)
-- ============================================================
create table rooms (
  id uuid primary key default gen_random_uuid(),
  numero text unique not null,       -- '0', '1', ..., '37B'
  tipo_piano text not null default 'cola' check (tipo_piano in ('cola', 'pared')),
  created_at timestamptz not null default now()
);

-- Relación N:N — un aula puede aparecer en varias rondas
create table round_rooms (
  round_id text not null references rounds(id) on delete cascade,
  room_id uuid not null references rooms(id) on delete cascade,
  primary key (round_id, room_id)
);

-- ============================================================
-- PARTICIPANTS
-- ============================================================
create table participants (
  id uuid primary key default gen_random_uuid(),
  codigo text unique,                 -- código de participante (búsqueda rápida)
  nombre text not null,
  email text unique not null,
  password_hash text not null,
  rondas_clasificado text[] not null default '{}',  -- subset de rounds.id
  created_at timestamptz not null default now()
);

create index idx_participants_email on participants (email);
create index idx_participants_nombre on participants (lower(nombre));

-- Día/hora de actuación de cada participante, por ronda (informativo, no bloquea el estudio)
create table participant_performances (
  participant_id uuid not null references participants(id) on delete cascade,
  round_id text not null references rounds(id) on delete cascade,
  performance_day date,
  performance_hour time,
  primary key (participant_id, round_id)
);

-- ============================================================
-- BLOCKED_SLOTS (bloqueos de jurado / administración)
-- ============================================================
create table blocked_slots (
  id uuid primary key default gen_random_uuid(),
  round_id text not null references rounds(id) on delete cascade,
  dia date not null,
  room_id uuid not null references rooms(id) on delete cascade,
  hora time not null,
  motivo text not null check (motivo in ('jurado', 'admin')),
  created_at timestamptz not null default now(),
  unique (round_id, dia, room_id, hora)
);

-- ============================================================
-- BOOKINGS (reservas confirmadas)
-- ============================================================
create table bookings (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references participants(id) on delete cascade,
  round_id text not null references rounds(id) on delete cascade,
  dia date not null,
  room_id uuid not null references rooms(id) on delete cascade,
  hora time not null,
  source text not null default 'participant' check (source in ('participant', 'admin_auto', 'admin_manual')),
  created_at timestamptz not null default now(),
  -- un aula solo puede estar ocupada por una persona en una hora dada
  unique (round_id, dia, room_id, hora),
  -- un participante no puede estar en dos aulas a la misma hora
  unique (participant_id, round_id, dia, hora)
);

create index idx_bookings_participant on bookings (participant_id, round_id);
create index idx_bookings_round_dia on bookings (round_id, dia);

-- ============================================================
-- EMAIL_LOG (auditoría de envíos, para poder detectar y reintentar fallos)
-- ============================================================
create table email_log (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid references participants(id) on delete set null,
  email_to text not null,
  subject text not null,
  type text not null check (type in ('booking_confirmation', 'pdf_assignment')),
  status text not null check (status in ('sent', 'failed')),
  error text,
  payload jsonb,
  retry_count int not null default 0,
  created_at timestamptz not null default now()
);

create index idx_email_log_status on email_log (status);

-- ============================================================
-- PDF_ASSIGNMENT_BATCHES (revisión editable antes de ejecutar la asignación automática)
-- ============================================================
create table pdf_assignment_batches (
  id uuid primary key default gen_random_uuid(),
  uploaded_by uuid references admins(id) on delete set null,
  round_id text references rounds(id) on delete set null,
  original_filename text,
  raw_text text,
  parsed_rows jsonb not null default '[]',  -- [{nombre, email, dia, hora, participant_id, match_status}]
  status text not null default 'pending_review' check (status in ('pending_review', 'confirmed', 'discarded')),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

-- ============================================================
-- Row Level Security: todo el acceso pasa por el backend (service_role),
-- que ignora RLS. Se activa igualmente para que nada quede accesible
-- por accidente vía anon/authenticated key.
-- ============================================================
alter table admins enable row level security;
alter table rounds enable row level security;
alter table rooms enable row level security;
alter table round_rooms enable row level security;
alter table participants enable row level security;
alter table participant_performances enable row level security;
alter table blocked_slots enable row level security;
alter table bookings enable row level security;
alter table email_log enable row level security;
alter table pdf_assignment_batches enable row level security;
