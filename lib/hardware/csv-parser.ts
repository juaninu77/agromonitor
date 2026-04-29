// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface ParsedItem {
  eid: string;
  vid: string | null;
  dateTime: Date | null;
  weight: number | null;
  lineNumber: number;
}

export interface ParsedSession {
  items: ParsedItem[];
  totalValid: number;
  totalSkipped: number;
  hasWeights: boolean;
  dateRange: {
    from: Date | null;
    to: Date | null;
  };
}

const EID_PATTERN = /^\d{15,16}$/;

// ─── Parser ──────────────────────────────────────────────────────────────────

export function parseTruTestCSV(csvContent: string): ParsedSession {
  const lines = csvContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return emptySession();
  }

  const hasHeader = /\beid\b/i.test(lines[0]);
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const items: ParsedItem[] = [];
  let totalSkipped = 0;
  let hasWeights = false;
  let minDate: Date | null = null;
  let maxDate: Date | null = null;

  for (let i = 0; i < dataLines.length; i++) {
    const lineNumber = hasHeader ? i + 2 : i + 1;
    const columns = dataLines[i].split(',').map((col) => col.trim());

    const eid = columns[0] ?? '';

    if (!EID_PATTERN.test(eid)) {
      totalSkipped++;
      continue;
    }

    const vid = columns[1] || null;
    const dateStr = columns[2] || null;
    const timeStr = columns[3] || null;
    const weightStr = columns[4] || null;

    const dateTime = parseDateAndTime(dateStr, timeStr);

    const weight = weightStr ? parseFloat(weightStr) : null;
    const validWeight = weight !== null && !isNaN(weight) ? weight : null;

    if (validWeight !== null) {
      hasWeights = true;
    }

    if (dateTime) {
      if (!minDate || dateTime < minDate) minDate = dateTime;
      if (!maxDate || dateTime > maxDate) maxDate = dateTime;
    }

    items.push({
      eid,
      vid,
      dateTime,
      weight: validWeight,
      lineNumber,
    });
  }

  return {
    items,
    totalValid: items.length,
    totalSkipped,
    hasWeights,
    dateRange: {
      from: minDate,
      to: maxDate,
    },
  };
}

// ─── Helpers internos ────────────────────────────────────────────────────────

function emptySession(): ParsedSession {
  return {
    items: [],
    totalValid: 0,
    totalSkipped: 0,
    hasWeights: false,
    dateRange: { from: null, to: null },
  };
}

/**
 * Intenta construir un Date a partir de las columnas de fecha y hora del CSV.
 * Data Link exporta fechas en formatos como "2024-03-15" o "15/03/2024",
 * y horas como "14:30:00" o "14:30". Retorna null si no se puede parsear.
 */
function parseDateAndTime(
  dateStr: string | null,
  timeStr: string | null
): Date | null {
  if (!dateStr) return null;

  // Normalizar separadores: "15/03/2024" -> "15-03-2024"
  const normalized = dateStr.replace(/\//g, '-');
  const parts = normalized.split('-');

  if (parts.length !== 3) return null;

  let year: number;
  let month: number;
  let day: number;

  // Detectar si es DD-MM-YYYY o YYYY-MM-DD por la longitud del primer segmento
  if (parts[0].length === 4) {
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
    day = parseInt(parts[2], 10);
  } else {
    day = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
    year = parseInt(parts[2], 10);
  }

  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  let hours = 0;
  let minutes = 0;
  let seconds = 0;

  if (timeStr) {
    const timeParts = timeStr.split(':');
    hours = parseInt(timeParts[0], 10) || 0;
    minutes = parseInt(timeParts[1], 10) || 0;
    seconds = parseInt(timeParts[2], 10) || 0;
  }

  const date = new Date(year, month - 1, day, hours, minutes, seconds);

  // Validar que el Date construido corresponde a los valores ingresados
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}
