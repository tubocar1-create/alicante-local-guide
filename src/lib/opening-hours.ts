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
