// Lookup de paradas de una ruta concreta (snapshot Renfe + reglas fijas OUIGO/IRYO).
import { supabase } from "@/integrations/supabase/client";
import { FIXED_TRIPS, addMinutes, fmtDuration } from "./fixed-schedules";

export type RouteStop = {
  name: string;
  arr: string; // HH:MM
  dep: string; // HH:MM
};

export type TrainRoute = {
  number: string;
  product: string;
  operator: "RENFE" | "AVLO" | "OUIGO" | "IRYO";
  date: string; // YYYY-MM-DD
  fromName: string;
  toName: string;
  departure: string;
  arrival: string;
  durationLabel: string;
  stops: RouteStop[];
};

type Snapshot = {
  generatedAt: string;
  stops: Record<string, string>;
  trips: Array<{
    id: string;
    number: string;
    product: string;
    terminalId: string;
    dates: string[];
    stops: Array<{ id: string; seq: number; arr: string; dep: string }>;
  }>;
};

let snapshotCache: Promise<Snapshot | null> | null = null;
function loadSnapshot(): Promise<Snapshot | null> {
  if (!snapshotCache) {
    snapshotCache = (async () => {
      const { data, error } = await supabase
        .from("train_schedule_snapshot")
        .select("payload, generated_at")
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error || !data) return null;
      const snap = data.payload as Snapshot;
      if (!snap.generatedAt) snap.generatedAt = data.generated_at as string;
      return snap;
    })();
  }
  return snapshotCache;
}

function hhmm(t: string): string {
  if (!t) return "";
  const [h, m] = t.split(":");
  return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
}
function diffMin(a: string, b: string): number {
  const [ah, am] = a.split(":").map(Number);
  const [bh, bm] = b.split(":").map(Number);
  let d = bh * 60 + bm - (ah * 60 + am);
  if (d < 0) d += 1440;
  return d;
}

const STATION_LABEL: Record<string, string> = {
  "MAD-CHA": "Madrid Chamartín",
  "MAD-ALB": "Albacete Los Llanos",
  "MAD-CUE": "Cuenca Fernando Zóbel",
};

function normalize(n: string) {
  return n.replace(/\s+/g, " ").trim().toUpperCase();
}

export async function getTrainRoute(
  number: string,
  date: string,
): Promise<TrainRoute | null> {
  const num = normalize(number);

  // 1) Snapshot Renfe/AVLO
  const snap = await loadSnapshot();
  if (snap) {
    const candidates = snap.trips.filter(
      (t) => normalize(t.number) === num || normalize(t.number).endsWith(num),
    );
    const trip =
      candidates.find((t) => t.dates.includes(date)) ?? candidates[0];
    if (trip) {
      const stops: RouteStop[] = trip.stops
        .slice()
        .sort((a, b) => a.seq - b.seq)
        .map((s) => ({
          name: snap.stops[s.id] || s.id,
          arr: hhmm(s.arr || s.dep),
          dep: hhmm(s.dep || s.arr),
        }));
      const first = stops[0];
      const last = stops[stops.length - 1];
      const operator: "RENFE" | "AVLO" = trip.product === "AVLO" ? "AVLO" : "RENFE";
      return {
        number: trip.number,
        product: trip.product,
        operator,
        date,
        fromName: first.name,
        toName: last.name,
        departure: first.dep || first.arr,
        arrival: last.arr || last.dep,
        durationLabel: fmtDuration(diffMin(first.dep || first.arr, last.arr || last.dep)),
        stops,
      };
    }
  }

  // 2) Fijos OUIGO / IRYO
  const ft = FIXED_TRIPS.find((t) => normalize(t.number) === num);
  if (ft) {
    const isS = ft.direction === "S";
    const origin = isS ? "Alicante-Terminal" : "Madrid Chamartín";
    const dest = isS ? "Madrid Chamartín" : "Alicante-Terminal";
    const stops: RouteStop[] = [];
    stops.push({ name: origin, arr: ft.depart, dep: ft.depart });
    const inter = Object.entries(ft.intermediateOffsets).sort((a, b) => a[1] - b[1]);
    for (const [code, off] of inter) {
      const t = addMinutes(ft.depart, off);
      stops.push({ name: STATION_LABEL[code] ?? code, arr: t, dep: t });
    }
    const arr = addMinutes(ft.depart, ft.durationMin);
    stops.push({ name: dest, arr, dep: arr });
    return {
      number: ft.number,
      product: ft.product,
      operator: ft.operator,
      date,
      fromName: origin,
      toName: dest,
      departure: ft.depart,
      arrival: arr,
      durationLabel: fmtDuration(ft.durationMin),
      stops,
    };
  }

  return null;
}
