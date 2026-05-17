// Calcula si un negocio está abierto ahora a partir de su horario.
// Soporta dos formatos:
// 1) Google Places "periods" (precisos)
// 2) "weekdayDescriptions" en español (texto, p. ej. "Lunes: 09:00–14:00, 17:00–20:00")

export type OpeningHours = {
  periods?: Array<{
    open?: { day?: number; hour?: number; minute?: number };
    close?: { day?: number; hour?: number; minute?: number };
  }>;
  weekdayDescriptions?: string[];
  openNow?: boolean;
} | null;

export type OpenStatus = "open" | "closed" | "unknown";

// Día actual en Europa/Madrid (0=domingo … 6=sábado, como Google)
function nowInMadrid(): { day: number; minutes: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Madrid",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const wk = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const hh = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const mm = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  const map: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return { day: map[wk] ?? 1, minutes: (hh % 24) * 60 + mm };
}

function fromPeriods(periods: NonNullable<OpeningHours>["periods"]): OpenStatus {
  if (!periods || periods.length === 0) return "unknown";
  // 24/7: un solo periodo con open day=0 hour=0 y sin close
  if (
    periods.length === 1 &&
    !periods[0]?.close &&
    periods[0]?.open?.day === 0 &&
    (periods[0]?.open?.hour ?? 0) === 0
  )
    return "open";
  const { day, minutes } = nowInMadrid();
  for (const p of periods) {
    if (!p.open) continue;
    const oDay = p.open.day ?? 0;
    const oMin = (p.open.hour ?? 0) * 60 + (p.open.minute ?? 0);
    const cDay = p.close?.day ?? oDay;
    const cMin = (p.close?.hour ?? 0) * 60 + (p.close?.minute ?? 0);
    // Mismo día
    if (oDay === cDay && oDay === day) {
      if (minutes >= oMin && minutes < cMin) return "open";
      continue;
    }
    // Cruza medianoche (ej. abre sáb 22:00, cierra dom 02:00)
    if (oDay !== cDay) {
      if (day === oDay && minutes >= oMin) return "open";
      if (day === cDay && minutes < cMin) return "open";
    }
  }
  return "closed";
}

const ES_DAYS: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  "miércoles": 3,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  "sábado": 6,
  sabado: 6,
};

function rangeDays(a: string, b: string): number[] {
  const da = ES_DAYS[a];
  const db = ES_DAYS[b];
  if (da == null || db == null) return [];
  const out: number[] = [];
  let i = da;
  for (let k = 0; k < 7; k++) {
    out.push(i);
    if (i === db) break;
    i = (i + 1) % 7;
  }
  return out;
}

function parseDescriptionLine(line: string): { days: number[]; ranges: Array<[number, number]> } | null {
  const colon = line.indexOf(":");
  if (colon === -1) return null;
  const head = line.slice(0, colon).toLowerCase().trim();
  const tail = line.slice(colon + 1).toLowerCase().trim();
  if (/cerrado|closed/.test(tail)) return { days: daysFromHead(head), ranges: [] };

  // Rangos tipo "09:00–14:00", admitiendo – — - y "a"
  const ranges: Array<[number, number]> = [];
  const re = /(\d{1,2})[:.h]?(\d{2})?\s*[–—\-aA]\s*(\d{1,2})[:.h]?(\d{2})?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tail))) {
    const oh = Number(m[1]);
    const om = Number(m[2] ?? 0);
    const ch = Number(m[3]);
    const cm = Number(m[4] ?? 0);
    if (oh > 24 || ch > 24) continue;
    ranges.push([oh * 60 + om, ch * 60 + cm]);
  }
  if (/24\s*horas|24h|24\/7|abierto 24/.test(tail)) ranges.push([0, 24 * 60]);
  return { days: daysFromHead(head), ranges };
}

function daysFromHead(head: string): number[] {
  // "lunes a viernes", "lunes-viernes", "lunes, miércoles", "viernes"
  const norm = head
    .replace(/\./g, "")
    .replace(/-/g, " a ")
    .replace(/\s+/g, " ")
    .trim();
  const aMatch = norm.match(/^(\p{L}+)\s+a\s+(\p{L}+)$/u);
  if (aMatch) return rangeDays(aMatch[1], aMatch[2]);
  const parts = norm.split(/\s*[,/y]\s*/).map((s) => s.trim()).filter(Boolean);
  const days: number[] = [];
  for (const p of parts) {
    const d = ES_DAYS[p];
    if (d != null) days.push(d);
  }
  return days;
}

function fromDescriptions(lines: string[]): OpenStatus {
  if (!lines || lines.length === 0) return "unknown";
  const { day, minutes } = nowInMadrid();
  let anyParsed = false;
  for (const line of lines) {
    const parsed = parseDescriptionLine(line);
    if (!parsed || parsed.days.length === 0) continue;
    if (!parsed.days.includes(day)) continue;
    anyParsed = true;
    if (parsed.ranges.length === 0) return "closed";
    for (const [o, c] of parsed.ranges) {
      const cc = c <= o ? c + 24 * 60 : c; // cruza medianoche
      if (minutes >= o && minutes < cc) return "open";
    }
    return "closed";
  }
  return anyParsed ? "closed" : "unknown";
}

export function computeOpenStatus(oh: OpeningHours): OpenStatus {
  if (!oh) return "unknown";
  if (oh.periods && oh.periods.length > 0) return fromPeriods(oh.periods);
  if (oh.weekdayDescriptions && oh.weekdayDescriptions.length > 0)
    return fromDescriptions(oh.weekdayDescriptions);
  if (oh.openNow != null) return oh.openNow ? "open" : "closed";
  return "unknown";
}
