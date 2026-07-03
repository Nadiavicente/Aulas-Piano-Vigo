// Utilidades de horario: las rondas definen hora_inicio/hora_fin como el
// inicio de la primera y de la última franja (cada franja dura 1 hora).

export function timeToMinutes(hhmmss: string): number {
  const [h, m] = hhmmss.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

// Lista de franjas ('HH:MM:SS') entre hora_inicio y hora_fin (ambas inclusive), cada 60 min.
export function listHourSlots(horaInicio: string, horaFin: string): string[] {
  const start = timeToMinutes(horaInicio);
  const end = timeToMinutes(horaFin);
  const slots: string[] = [];
  for (let t = start; t <= end; t += 60) {
    slots.push(minutesToTime(t));
  }
  return slots;
}

export function formatHora(hhmmss: string): string {
  return hhmmss.slice(0, 5);
}

export function formatDia(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}
