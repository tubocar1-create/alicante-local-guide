import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { getOpeningStatus } from "@/lib/opening-hours";

function formatMadridTime(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const h = parts.find((p) => p.type === "hour")?.value ?? "00";
  const m = parts.find((p) => p.type === "minute")?.value ?? "00";
  return { h, m };
}

function useLiveMadridTime() {
  const [now, setNow] = useState(() => formatMadridTime(new Date()));
  useEffect(() => {
    const tick = () => setNow(formatMadridTime(new Date()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

type Props = {
  openingHoursText?: string | null;
  openNow?: boolean | null;
  rawOpeningHours?: string | null;
};

const SPANISH_DAYS = [
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
  "domingo",
];

function todayIndexMadrid(date = new Date()): number {
  // Intl weekday short, en-GB → Mon..Sun. Convert to Mon=0..Sun=6
  const wk = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    weekday: "short",
  }).format(date).toLowerCase();
  const map: Record<string, number> = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 };
  return map[wk.slice(0, 3)] ?? 0;
}

function parseLines(text: string): { day: string; hours: string; idx: number }[] {
  return text
    .split(" · ")
    .map((line) => {
      const m = line.match(/^([^:]+):\s*(.+)$/);
      if (!m) return null;
      const dayLower = m[1].trim().toLowerCase();
      const idx = SPANISH_DAYS.findIndex((d) => dayLower.startsWith(d));
      return {
        day: m[1].trim(),
        hours: m[2].replace(/\s+/g, " ").trim(),
        idx: idx === -1 ? 0 : idx,
      };
    })
    .filter((x): x is { day: string; hours: string; idx: number } => x !== null);
}

export default function OpeningHoursCard({
  openingHoursText,
  openNow,
  rawOpeningHours,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const { h: liveH, m: liveM } = useLiveMadridTime();

  const status = useMemo(
    () => getOpeningStatus(rawOpeningHours ?? undefined),
    [rawOpeningHours],
  );

  const lines = useMemo(
    () => (openingHoursText ? parseLines(openingHoursText) : []),
    [openingHoursText],
  );

  const today = todayIndexMadrid();

  // Determine effective open state
  const isOpen =
    status.status === "open" ? true : status.status === "closed" ? false : openNow ?? null;

  // Derive "closes at" from today's hours when status parser doesn't know
  const closesAt = useMemo(() => {
    if (status.status === "open") return status.closesAt;
    if (isOpen !== true) return null;
    const todayHours = lines[today]?.hours;
    if (!todayHours) return null;
    const nowDate = new Date();
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Madrid",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(nowDate);
    const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
    const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
    const nowMin = h * 60 + m;
    const ranges = [...todayHours.matchAll(/(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/g)];
    for (const r of ranges) {
      const start = Number(r[1]) * 60 + Number(r[2]);
      let end = Number(r[3]) * 60 + Number(r[4]);
      if (end <= start) end += 1440;
      if (nowMin >= start && nowMin < end) {
        const safe = end % 1440;
        return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
      }
    }
    return null;
  }, [status, isOpen, lines, today]);

  const stateLabel =
    isOpen === true ? "Abierto ahora" : isOpen === false ? "Cerrado" : "Horario no confirmado";

  const subtitle =
    closesAt
      ? `Cierra a las ${closesAt}`
      : isOpen === false
      ? lines[today]?.hours
        ? `Hoy: ${lines[today].hours}`
        : "Consulta horarios"
      : "Consulta horarios";

  const dotColor =
    isOpen === true
      ? "bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.85)]"
      : isOpen === false
      ? "bg-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.6)]"
      : "bg-slate-400";

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[#020817] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        isOpen === true
          ? "shadow-[0_0_0_1px_rgba(16,185,129,0.08),0_8px_40px_-12px_rgba(16,185,129,0.25)]"
          : "shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)]"
      }`}
    >
      {/* Soft glow background */}
      {isOpen === true && (
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 -left-10 h-40 w-40 rounded-full bg-emerald-500/15 blur-3xl"
        />
      )}

      <button
        type="button"
        onClick={() => lines.length > 0 && setExpanded((v) => !v)}
        disabled={lines.length === 0}
        className="relative flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.015] disabled:cursor-default"
      >
        {/* Clock icon */}
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.02]">
          <Clock className="h-4 w-4 text-slate-300" strokeWidth={1.5} />
        </div>

        {/* Texts */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotColor}`}
              aria-hidden
            />
            <span className="truncate text-[14px] font-semibold tracking-tight text-white">
              {stateLabel}
            </span>
          </div>
          <p className="mt-0.5 truncate text-[12px] font-normal text-slate-400">
            {subtitle}
          </p>
        </div>

        {/* CTA */}
        {lines.length > 0 && (
          <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium text-slate-300 transition-all duration-300 group-hover:border-emerald-400/30 group-hover:text-emerald-300 group-hover:shadow-[0_0_18px_rgba(16,185,129,0.25)]">
            <span className="tracking-tight">{expanded ? "Ocultar" : "Ver horarios"}</span>
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                expanded ? "rotate-180" : ""
              }`}
              strokeWidth={2}
            />
          </div>
        )}
      </button>

      {/* Expandable schedule */}
      <div
        className={`grid transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="mx-4 mb-4 mt-1 rounded-xl border border-white/[0.05] bg-white/[0.015] p-2">
            <ul className="divide-y divide-white/[0.04]">
              {lines.map((line, i) => {
                const isToday = line.idx === today;
                return (
                  <li
                    key={`${line.day}-${i}`}
                    className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                      isToday
                        ? "bg-emerald-500/[0.06] shadow-[inset_0_0_0_1px_rgba(16,185,129,0.18)]"
                        : ""
                    }`}
                    style={{
                      animation: expanded
                        ? `oh-fade-in 360ms cubic-bezier(0.22,1,0.36,1) ${i * 35}ms both`
                        : undefined,
                    }}
                  >
                    <span
                      className={`text-[12.5px] capitalize tracking-tight ${
                        isToday ? "font-semibold text-emerald-300" : "font-medium text-slate-300"
                      }`}
                    >
                      {line.day}
                    </span>
                    <span
                      className={`text-right font-mono text-[11.5px] tabular-nums ${
                        isToday ? "text-emerald-200" : "text-slate-400"
                      }`}
                    >
                      {line.hours}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes oh-fade-in {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
