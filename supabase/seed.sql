-- Datos reales de la 1ª edición (X Concurso Internacional de Piano Ciudad de Vigo, 2026)
-- Punto de partida editable desde el panel de administración.

-- ============================================================
-- ROUNDS
-- ============================================================
insert into rounds (id, nombre, orden, dias, hora_inicio, hora_fin, max_horas_dia, unlocked) values
  ('primera',   '1ª Ronda',  1, array['2026-08-08','2026-08-09','2026-08-10']::date[], '09:00', '22:00', 4, true),
  ('semifinal', 'Semifinal', 2, array['2026-08-11']::date[],                            '09:00', '22:00', 4, false),
  ('final',     'Final',     3, array['2026-08-12']::date[],                            '08:00', '23:00', 4, false);

-- ============================================================
-- ROOMS (unión de todas las aulas usadas en cualquier ronda)
-- Tipo de piano por defecto 'cola' — ajustar desde el panel de administración.
-- ============================================================
insert into rooms (numero, tipo_piano)
select unnest(array[
  '0','1','2','4','5','6','7','9','10','11','12','13','14','17','18','19','20','21','23',
  '25','26','27','29','30','31','32','33','34','35','36','38','39','43'
]), 'cola';

-- ============================================================
-- ROUND_ROOMS
-- ============================================================
insert into round_rooms (round_id, room_id)
select 'primera', id from rooms where numero in (
  '0','1','2','4','5','6','7','9','10','11','12','13','14','17','18','19','20','21','23',
  '29','30','31','32','33','34','35','36','38','39','43'
);

insert into round_rooms (round_id, room_id)
select 'semifinal', id from rooms where numero in (
  '14','17','18','19','20','21','23','25','26','27','29','30','31','32','33','34','35','36','38','39','43'
);

insert into round_rooms (round_id, room_id)
select 'final', id from rooms where numero in (
  '31','32','33','34','35','36','38','39','43'
);

-- ============================================================
-- BLOCKED_SLOTS — bloqueo para jurado en 1ª ronda: aulas 0,1,2,4,5,43
-- de 14:00 a 16:00 (franjas 14:00 y 15:00) los tres días
-- ============================================================
insert into blocked_slots (round_id, dia, room_id, hora, motivo)
select 'primera', dia, room.id, hora, 'jurado'
from rooms room
cross join unnest(array['2026-08-08','2026-08-09','2026-08-10']::date[]) as dia
cross join unnest(array['14:00','15:00']::time[]) as hora
where room.numero in ('0','1','2','4','5','43');
