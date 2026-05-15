type DayKey = "Mo" | "Tu" | "We" | "Th" | "Fr" | "Sa" | "Su";

export type OpeningStatus =
  | { status: "open"; raw: string; closesAt: string; closesInMinutes: number }
  | { status: "closed"; raw: string }
  | { status: "unknown"; raw?: string };

const DAYS: DayKey[] = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const WEEKDAY_TO_DAY: Record<string, DayKey> = {
  mon: "Mo",
  tue: "Tu",
  wed: "We",
  thu: "Th",
  fri: "Fr",
  sat: "Sa",
  sun: "Su",
};

const SPANISH_OPENING_DAY_RE =
  /\b(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\s*:/i;

function madridNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    day: WEEKDAY_TO_DAY[get("weekday").slice(0, 3).toLowerCase()] ?? "Mo",
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

function previousDay(day: DayKey): DayKey {
  return DAYS[(DAYS.indexOf(day) + 6) % 7];
}

function minutesToClock(minutes: number) {
  const safe = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function expandDayRange(start: DayKey, end: DayKey) {
  const out: DayKey[] = [];
  let i = DAYS.indexOf(start);
  const stop = DAYS.indexOf(end);
  for (let guard = 0; guard < 7; guard += 1) {
    out.push(DAYS[i]);
    if (i === stop) break;
    i = (i + 1) % 7;
  }
  return out;
}

function ruleDays(rule: string): DayKey[] | null {
  const expr = rule.match(
    /\b(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:\s*-\s*(?:Mo|Tu|We|Th|Fr|Sa|Su))?(?:\s*,\s*(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:\s*-\s*(?:Mo|Tu|We|Th|Fr|Sa|Su))?)*/,
  )?.[0];
  if (!expr) return null;
  return expr.split(/\s*,\s*/).flatMap((part) => {
    const [start, end] = part.split(/\s*-\s*/) as [DayKey, DayKey | undefined];
    return end ? expandDayRange(start, end) : [start];
  });
}

function appliesToDay(rule: string, day: DayKey) {
  const days = ruleDays(rule);
  return !days || days.includes(day);
}

function parseRanges(rule: string) {
  return [...rule.matchAll(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/g)].map((m) => ({
    start: Number(m[1]) * 60 + Number(m[2]),
    end: Number(m[3]) * 60 + Number(m[4]),
  }));
}

export function getOpeningStatus(raw?: string, date = new Date()): OpeningStatus {
  if (!raw?.trim()) return { status: "unknown" };
  const clean = raw.replace(/"[^"]*"/g, "").trim();
  if (SPANISH_OPENING_DAY_RE.test(clean)) return { status: "unknown", raw };
  if (/24\s*\/\s*7/.test(clean)) {
    return { status: "open", raw, closesAt: "24:00", closesInMinutes: 24 * 60 };
  }

  const { day, minutes } = madridNow(date);
  const yesterday = previousDay(day);
  let matchedAnyRule = false;
  let matchedClosedRule = false;

  for (const rule of clean
    .split(";")
    .map((r) => r.trim())
    .filter(Boolean)) {
    const ranges = parseRanges(rule);
    const isOff = /\boff\b|\bclosed\b/i.test(rule);

    if (appliesToDay(rule, day)) {
      matchedAnyRule = true;
      if (isOff && ranges.length === 0) matchedClosedRule = true;
      for (const range of ranges) {
        const end = range.end <= range.start ? range.end + 1440 : range.end;
        if (minutes >= range.start && minutes < end) {
          return {
            status: "open",
            raw,
            closesAt: minutesToClock(end),
            closesInMinutes: end - minutes,
          };
        }
      }
    }

    if (appliesToDay(rule, yesterday)) {
      for (const range of ranges) {
        if (range.end > range.start) continue;
        const start = range.start - 1440;
        const end = range.end;
        if (minutes >= start && minutes < end) {
          return {
            status: "open",
            raw,
            closesAt: minutesToClock(end),
            closesInMinutes: end - minutes,
          };
        }
      }
    }
  }

  if (matchedAnyRule || matchedClosedRule) return { status: "closed", raw };
  return { status: "unknown", raw };
}

/**
 * Parse Google Places-style Spanish opening hours text where days are
 * separated by " · ", e.g.
 *   "lunes: 13:30–16:00 · 20:00–23:00 · martes: 13:30–16:00 · ..."
 * Returns open/closed/unknown evaluated against current Madrid time.
 */
const SPANISH_DAY_TO_KEY: Record<string, DayKey> = {
  lunes: "Mo",
  martes: "Tu",
  miércoles: "We",
  miercoles: "We",
  jueves: "Th",
  viernes: "Fr",
  sábado: "Sa",
  sabado: "Sa",
  domingo: "Su",
};

export function getOpeningStatusFromSpanishText(
  raw?: string | null,
  date = new Date(),
): OpeningStatus {
  if (!raw?.trim()) return { status: "unknown" };
  const { day, minutes } = madridNow(date);
  const yesterday = previousDay(day);

  // Split by " · " and group ranges per labelled day.
  const segments = raw.split(/\s+·\s+/);
  const perDay: Partial<Record<DayKey, { start: number; end: number }[]>> = {};
  let currentDay: DayKey | null = null;

  for (const seg of segments) {
    const labelMatch = seg.match(/^([A-Za-zÁÉÍÓÚÑáéíóúñ]+)\s*:\s*(.*)$/);
    let body = seg;
    if (labelMatch) {
      const key = SPANISH_DAY_TO_KEY[labelMatch[1].toLowerCase()];
      if (key) {
        currentDay = key;
        body = labelMatch[2];
      }
    }
    if (!currentDay) continue;
    if (/cerrado|closed/i.test(body)) {
      perDay[currentDay] = perDay[currentDay] ?? [];
      continue;
    }
    const ranges = [...body.matchAll(/(\d{1,2}):(\d{1,2})\s*[–-]\s*(\d{1,2}):(\d{1,2})/g)];
    for (const r of ranges) {
      const start = Number(r[1]) * 60 + Number(r[2]);
      const end = Number(r[3]) * 60 + Number(r[4]);
      (perDay[currentDay] ??= []).push({ start, end });
    }
  }

  const todayRanges = perDay[day] ?? [];
  for (const r of todayRanges) {
    const end = r.end <= r.start ? r.end + 1440 : r.end;
    if (minutes >= r.start && minutes < end) {
      return {
        status: "open",
        raw,
        closesAt: minutesToClock(end),
        closesInMinutes: end - minutes,
      };
    }
  }

  // Overnight from yesterday (e.g. 20:00–02:00)
  const yRanges = perDay[yesterday] ?? [];
  for (const r of yRanges) {
    if (r.end > r.start) continue;
    const start = r.start - 1440;
    const end = r.end;
    if (minutes >= start && minutes < end) {
      return {
        status: "open",
        raw,
        closesAt: minutesToClock(end),
        closesInMinutes: end - minutes,
      };
    }
  }

  // We had structured info for today (or any day) → confidently closed
  if (Object.keys(perDay).length > 0) return { status: "closed", raw };
  return { status: "unknown", raw };
}

/**
 * Resolve opening status from any supported format: tries OSM `opening_hours`
 * first, then the Google Places Spanish " · "-separated text. Returns the most
 * confident result.
 */
export function resolveOpeningStatus(raw?: string | null, date = new Date()): OpeningStatus {
  if (raw && SPANISH_OPENING_DAY_RE.test(raw)) return getOpeningStatusFromSpanishText(raw, date);
  const osm = getOpeningStatus(raw ?? undefined, date);
  if (osm.status !== "unknown") return osm;
  return getOpeningStatusFromSpanishText(raw, date);
}

/**
 * Returns today's (Madrid TZ) closing time as "HH:mm" if the schedule has any
 * structured ranges for today — independent of whether the place is currently
 * open or closed. Picks the latest end time of today's ranges. Falls back to
 * an overnight range from yesterday that's still active.
 */
export function getTodayClosingTime(raw?: string | null, date = new Date()): string | null {
  if (!raw?.trim()) return null;
  const { day, minutes } = madridNow(date);
  const yesterday = previousDay(day);

  // Collect today's ranges from either format
  const todayEnds: number[] = [];

  if (SPANISH_OPENING_DAY_RE.test(raw)) {
    // Spanish " · " format
    const segments = raw.split(/\s+·\s+/);
    let currentDay: DayKey | null = null;
    const perDay: Partial<Record<DayKey, { start: number; end: number }[]>> = {};
    for (const seg of segments) {
      const labelMatch = seg.match(/^([A-Za-zÁÉÍÓÚÑáéíóúñ]+)\s*:\s*(.*)$/);
      let body = seg;
      if (labelMatch) {
        const key = SPANISH_DAY_TO_KEY[labelMatch[1].toLowerCase()];
        if (key) {
          currentDay = key;
          body = labelMatch[2];
        }
      }
      if (!currentDay) continue;
      const ranges = [...body.matchAll(/(\d{1,2}):(\d{1,2})\s*[–-]\s*(\d{1,2}):(\d{1,2})/g)];
      for (const r of ranges) {
        const start = Number(r[1]) * 60 + Number(r[2]);
        const end = Number(r[3]) * 60 + Number(r[4]);
        (perDay[currentDay] ??= []).push({ start, end });
      }
    }
    for (const r of perDay[day] ?? []) {
      todayEnds.push(r.end <= r.start ? r.end + 1440 : r.end);
    }
    for (const r of perDay[yesterday] ?? []) {
      if (r.end <= r.start && minutes < r.end) todayEnds.push(r.end);
    }
  } else {
    // OSM opening_hours
    const clean = raw.replace(/"[^"]*"/g, "").trim();
    if (/24\s*\/\s*7/.test(clean)) return "24:00";
    for (const rule of clean.split(";").map((r) => r.trim()).filter(Boolean)) {
      const ranges = parseRanges(rule);
      if (appliesToDay(rule, day)) {
        for (const range of ranges) {
          todayEnds.push(range.end <= range.start ? range.end + 1440 : range.end);
        }
      }
      if (appliesToDay(rule, yesterday)) {
        for (const range of ranges) {
          if (range.end <= range.start && minutes < range.end) todayEnds.push(range.end);
        }
      }
    }
  }

  if (todayEnds.length === 0) return null;
  return minutesToClock(Math.max(...todayEnds));
}

export function formatOpeningStatus(hours: OpeningStatus) {
  if (hours.status === "open") return `Abierto ahora · cierra a las ${hours.closesAt}`;
  if (hours.status === "closed") return "Cerrado ahora";
  return "Horario no confirmado";
}

export function isClosingSoon(hours: OpeningStatus) {
  return hours.status === "open" && hours.closesInMinutes <= 60;
}

export function isMercadoCentralClosedSunday(name: string, date = new Date()) {
  const { day } = madridNow(date);
  return (
    day === "Su" && /mercado\s+central/i.test(name.normalize("NFD").replace(/[\u0300-\u036f]/g, ""))
  );
}
