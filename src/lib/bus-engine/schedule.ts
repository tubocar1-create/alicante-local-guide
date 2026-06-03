// Generador de buses virtuales a partir de salidas programadas reales.
// Regla dura: sin departure oficial no hay nacimiento de bus virtual.

import type { ScheduledDeparture, ServiceWindow, Direction } from "./types";

const DEFAULT_HEADWAY_MIN: Record<string, number> = {
  laborable: 15,
  sabado: 20,
  domingo: 25,
  festivo: 25,
};

export function parseHHMMtoMin(t: string): number {
  const [h, m] = t.split(":").map((n) => parseInt(n, 10));
  return h * 60 + (m || 0);
}

export function nowMinutes(d = new Date()): number {
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

export function formatClock(min: number): string {
  const n = ((min % 1440) + 1440) % 1440;
  const h = Math.floor(n / 60);
  const m = Math.floor(n % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Sintetiza departures cada N min entre first y last de la service window.
export function synthesizeDepartures(opts: {
  lineCode: string;
  direction: Direction;
  dayType: "laborable" | "sabado" | "domingo" | "festivo";
  windows: ServiceWindow[];
}): ScheduledDeparture[] {
  const matching = opts.windows.filter(
    (w) =>
      w.lineCode === opts.lineCode &&
      w.direction === opts.direction &&
      w.dayType === opts.dayType,
  );
  if (matching.length === 0) return [];
  const headway = DEFAULT_HEADWAY_MIN[opts.dayType] ?? 15;
  const out: ScheduledDeparture[] = [];
  for (const w of matching) {
    for (let t = w.firstDepartureMin; t <= w.lastDepartureMin; t += headway) {
      out.push({
        lineCode: opts.lineCode,
        direction: opts.direction,
        departureMin: t,
        dayType: opts.dayType,
      });
    }
  }
  return out;
}

export function getDeparturesForLine(opts: {
  lineCode: string;
  direction: Direction;
  dayType: "laborable" | "sabado" | "domingo" | "festivo";
  departures: ScheduledDeparture[];
  windows: ServiceWindow[];
}): ScheduledDeparture[] {
  const real = opts.departures.filter(
    (d) =>
      d.lineCode === opts.lineCode &&
      d.direction === opts.direction &&
      d.dayType === opts.dayType,
  );
  void opts.windows;
  return real.sort((a, b) => a.departureMin - b.departureMin);
}
