import "server-only";
import { getDocumentProxy, extractTextItems } from "unpdf";

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const data = new Uint8Array(buffer);
  const pdf = await getDocumentProxy(data);
  const { items } = await extractTextItems(pdf);

  // unpdf no separa el texto por líneas al fusionar páginas (usa espacios),
  // así que reconstruimos las líneas nosotros mismos a partir del indicador
  // hasEOL que trae cada fragmento de texto (fin de línea según PDF.js).
  const lines: string[] = [];
  for (const pageItems of items) {
    let current = "";
    for (const item of pageItems) {
      current += item.str;
      if (item.hasEOL) {
        lines.push(current);
        current = "";
      }
    }
    if (current) lines.push(current);
  }

  return lines.join("\n");
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const TIME_RE = /\b([01]?\d|2[0-3])[:.h]([0-5]\d)\b/i;
const TIME_RE_GLOBAL = /\b([01]?\d|2[0-3])[:.h]([0-5]\d)\b/gi;
const DATE_SLASH_RE = /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/; // dd/mm/yyyy o dd-mm-yyyy
const DATE_ISO_RE = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/; // yyyy-mm-dd

const MESES: Record<string, string> = {
  enero: "01",
  january: "01",
  febrero: "02",
  february: "02",
  marzo: "03",
  march: "03",
  abril: "04",
  april: "04",
  mayo: "05",
  may: "05",
  junio: "06",
  june: "06",
  julio: "07",
  july: "07",
  agosto: "08",
  august: "08",
  septiembre: "09",
  setiembre: "09",
  september: "09",
  octubre: "10",
  october: "10",
  noviembre: "11",
  november: "11",
  diciembre: "12",
  december: "12",
};

const MES_NOMBRES = Object.keys(MESES).join("|");
const HEADER_DATE_RE = new RegExp(
  `\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:de\\s+)?(${MES_NOMBRES})\\b|\\b(${MES_NOMBRES})\\s+(\\d{1,2})\\b`,
  "i"
);

function pad(n: string | number) {
  return String(n).padStart(2, "0");
}

function matchRoundDayByMonth(day: string, mesNombre: string, roundDias: string[]): string | null {
  const mesNum = MESES[mesNombre.toLowerCase()];
  if (!mesNum) return null;
  const dayPadded = pad(day);
  return roundDias.find((d) => d.slice(5, 7) === mesNum && d.slice(8, 10) === dayPadded) ?? null;
}

// Fecha explícita en la propia línea (poco habitual en listados de
// actuación, pero se soporta como formato alternativo): "8/8/2026",
// "2026-08-08" o "8 de agosto".
function findInlineDate(line: string, roundDias: string[]): string | null {
  const slash = line.match(DATE_SLASH_RE);
  if (slash) {
    const [, d, m, y] = slash;
    return `${y}-${pad(m)}-${pad(d)}`;
  }
  const iso = line.match(DATE_ISO_RE);
  if (iso) {
    const [, y, m, d] = iso;
    return `${y}-${pad(m)}-${pad(d)}`;
  }
  const m = line.match(HEADER_DATE_RE);
  if (!m) return null;
  if (m[1] && m[2]) return matchRoundDayByMonth(m[1], m[2], roundDias);
  if (m[3] && m[4]) return matchRoundDayByMonth(m[4], m[3], roundDias);
  return null;
}

function findTime(line: string): string | null {
  const m = line.match(TIME_RE);
  if (!m) return null;
  return `${pad(m[1])}:${m[2]}:00`;
}

// Todas las horas de la línea, en el orden en que aparecen (para las
// rondas con columna de "prueba de piano" además de la de actuación).
function findAllTimes(line: string): string[] {
  return [...line.matchAll(TIME_RE_GLOBAL)].map((m) => `${pad(m[1])}:${m[2]}:00`);
}

export interface ParsedAssignmentRow {
  nombre: string;
  email: string;
  dia: string | null;
  hora: string | null;
  pruebaPianoHora: string | null;
}

/**
 * `conPruebaDePiano` activa la detección de una segunda hora por fila (la
 * de la prueba de piano, antes de la hora de actuación) — solo aplica a la
 * ronda de entrada de cada concurso (1ª Ronda / Semifinal Junior); en el
 * resto de rondas cada fila solo trae una hora, como hasta ahora.
 */
export function parseAssignmentText(
  text: string,
  roundDias: string[],
  conPruebaDePiano = false
): ParsedAssignmentRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  interface RawRow {
    nombre: string;
    email: string;
    hora: string | null;
    pruebaPianoHora: string | null;
    inlineDia: string | null;
  }
  const rawRows: RawRow[] = [];

  for (const line of lines) {
    const emailMatch = line.match(EMAIL_RE);
    if (!emailMatch) continue; // Solo nos interesan líneas con un correo (identifican a un participante)

    const email = emailMatch[0].toLowerCase();
    const inlineDia = findInlineDate(line, roundDias);

    let hora: string | null;
    let pruebaPianoHora: string | null = null;
    if (conPruebaDePiano) {
      const todasLasHoras = findAllTimes(line);
      pruebaPianoHora = todasLasHoras[0] ?? null;
      hora = todasLasHoras[1] ?? null;
    } else {
      hora = findTime(line);
    }

    // El nombre es lo que queda en la línea tras quitar correo, fecha,
    // todas las horas, el número de orden ("Sec.") inicial y puntuación suelta.
    let nombre = line
      .replace(EMAIL_RE, "")
      .replace(DATE_SLASH_RE, "")
      .replace(DATE_ISO_RE, "")
      .replace(TIME_RE_GLOBAL, "")
      .replace(/[,;|]+/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim()
      .replace(/^\d+\s+/, "");

    if (!nombre) nombre = email.split("@")[0];

    rawRows.push({ nombre, email, hora, pruebaPianoHora, inlineDia });
  }

  // Muchos listados de actuación agrupan por día ordenando cronológicamente
  // dentro de cada uno (y las cabeceras de sección del PDF no siempre se
  // extraen en el mismo orden que las filas). La señal más fiable de cambio
  // de día es que la hora de actuación "retrocede" de una fila a la
  // siguiente — vuelve a empezar por la mañana.
  let segmentIndex = 0;
  let horaAnterior: string | null = null;

  return rawRows.map((r) => {
    if (r.hora && horaAnterior && r.hora < horaAnterior) {
      segmentIndex++;
    }
    if (r.hora) horaAnterior = r.hora;

    const dia = r.inlineDia ?? roundDias[segmentIndex] ?? null;
    return { nombre: r.nombre, email: r.email, dia, hora: r.hora, pruebaPianoHora: r.pruebaPianoHora };
  });
}
