import "server-only";
import { PDFParse } from "pdf-parse";

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const TIME_RE = /\b([01]?\d|2[0-3])[:.h]([0-5]\d)\b/i;
const DATE_SLASH_RE = /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/; // dd/mm/yyyy o dd-mm-yyyy
const DATE_ISO_RE = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/; // yyyy-mm-dd

const MESES: Record<string, string> = {
  enero: "01",
  febrero: "02",
  marzo: "03",
  abril: "04",
  mayo: "05",
  junio: "06",
  julio: "07",
  agosto: "08",
  septiembre: "09",
  setiembre: "09",
  octubre: "10",
  noviembre: "11",
  diciembre: "12",
};

function pad(n: string | number) {
  return String(n).padStart(2, "0");
}

function findDate(line: string, roundDias: string[]): string | null {
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
  // "8 de agosto" / "8 agosto"
  const lower = line.toLowerCase();
  for (const [mesNombre, mesNum] of Object.entries(MESES)) {
    if (lower.includes(mesNombre)) {
      const dayMatch = lower.match(/\b(\d{1,2})\b/);
      if (dayMatch) {
        const day = pad(dayMatch[1]);
        const candidate = roundDias.find((d) => d.endsWith(`-${mesNum}-${day}`) || d.slice(8, 10) === day);
        if (candidate) return candidate;
      }
    }
  }
  // Si la línea solo trae un número de día que coincide con uno de los días de la ronda
  if (roundDias.length > 0) {
    const dayOnly = line.match(/\b(\d{1,2})\b/);
    if (dayOnly) {
      const day = pad(dayOnly[1]);
      const candidate = roundDias.find((d) => d.slice(8, 10) === day);
      if (candidate) return candidate;
    }
  }
  return null;
}

function findTime(line: string): string | null {
  const m = line.match(TIME_RE);
  if (!m) return null;
  return `${pad(m[1])}:${m[2]}:00`;
}

export interface ParsedAssignmentRow {
  nombre: string;
  email: string;
  dia: string | null;
  hora: string | null;
}

export function parseAssignmentText(text: string, roundDias: string[]): ParsedAssignmentRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const rows: ParsedAssignmentRow[] = [];

  for (const line of lines) {
    const emailMatch = line.match(EMAIL_RE);
    if (!emailMatch) continue; // Solo nos interesan líneas con un correo (identifican a un participante)

    const email = emailMatch[0].toLowerCase();
    const dia = findDate(line, roundDias);
    const hora = findTime(line);

    // El nombre es lo que queda en la línea tras quitar correo, fecha y hora
    let nombre = line
      .replace(EMAIL_RE, "")
      .replace(DATE_SLASH_RE, "")
      .replace(DATE_ISO_RE, "")
      .replace(TIME_RE, "")
      .replace(/\s{2,}/g, " ")
      .replace(/[,;|]+/g, " ")
      .trim();

    if (!nombre) nombre = email.split("@")[0];

    rows.push({ nombre, email, dia, hora });
  }

  return rows;
}
