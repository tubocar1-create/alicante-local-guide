// Sync diario GTFS Renfe → snapshot slim de trenes que tocan Alicante-Terminal.
// Vive en Edge Function (Deno) por límite de memoria del Worker de TanStack.
// Disparado por pg_cron 1x/día.

import { unzipSync, strFromU8 } from "https://esm.sh/fflate@0.8.2";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const NAP_URLS = [
  { id: "renfe-ld", url: "https://nap.transportes.gob.es/api/Fichero/download/1098" },
];
const DAYS_AHEAD = 30;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Stop = { stop_id: string; stop_name: string };
type Trip = { trip_id: string; route_id: string; service_id: string; trip_short_name?: string };
type Route = { route_id: string; route_short_name?: string; route_long_name?: string };
type StopTime = { trip_id: string; arrival_time: string; departure_time: string; stop_id: string; stop_sequence: string };
type Cal = {
  service_id: string;
  monday: string; tuesday: string; wednesday: string; thursday: string;
  friday: string; saturday: string; sunday: string;
  start_date: string; end_date: string;
};
type CalDate = { service_id: string; date: string; exception_type: string };

function parseCsv<T = Record<string, string>>(text: string): T[] {
  const lines = text.split(/\r?\n/);
  if (!lines.length) return [];
  const head = lines[0].replace(/^\uFEFF/, "").split(",").map((h) => h.trim());
  const out: T[] = [];
  for (let li = 1; li < lines.length; li++) {
    const l = lines[li];
    if (!l) continue;
    const cols: string[] = [];
    let cur = "", q = false;
    for (let i = 0; i < l.length; i++) {
      const c = l[i];
      if (q) {
        if (c === '"') {
          if (l[i + 1] === '"') { cur += '"'; i++; } else q = false;
        } else cur += c;
      } else {
        if (c === '"') q = true;
        else if (c === ",") { cols.push(cur); cur = ""; }
        else cur += c;
      }
    }
    cols.push(cur);
    const o: Record<string, string> = {};
    head.forEach((h, i) => (o[h] = cols[i] ?? ""));
    out.push(o as T);
  }
  return out;
}

const DOW = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
const ymd = (d: Date) =>
  `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
const isoDate = (d: Date) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

function classify(route: Route | undefined): { product: string; operator: string } {
  const all = ((route?.route_long_name || "") + " " + (route?.route_short_name || "")).toUpperCase();
  let product = "Renfe";
  if (all.includes("AVLO")) product = "AVLO";
  else if (all.includes("AVE")) product = "AVE";
  else if (all.includes("ALVIA")) product = "Alvia";
  else if (all.includes("EUROMED")) product = "Euromed";
  else if (all.includes("INTERCITY")) product = "Intercity";
  else if (all.includes("ALTARIA") || all.includes("TALGO")) product = "Larga Distancia";
  else if (all.includes("MD") || all.includes("MEDIA")) product = "Media Distancia";
  else if (all.includes("REGIONAL")) product = "Regional";
  else if (all.includes("CERCAN")) product = "Cercanías";
  else product = route?.route_short_name || "Renfe";
  return { product, operator: "RENFE" };
}

async function buildSnapshot() {
  const apiKey = Deno.env.get("NAP_API_KEY");
  if (!apiKey) throw new Error("Falta NAP_API_KEY");

  const allTrips: any[] = [];
  const allStops: Record<string, string> = {};

  for (const src of NAP_URLS) {
    console.log(`[trenes-sync] descargando ${src.id}…`);
    const res = await fetch(src.url, { headers: { ApiKey: apiKey } });
    if (!res.ok) { console.error(`[trenes-sync] HTTP ${res.status} ${src.id}`); continue; }
    const buf = new Uint8Array(await res.arrayBuffer());
    console.log(`[trenes-sync] ${src.id}: ${(buf.byteLength / 1024 / 1024).toFixed(2)} MB`);
    const zip = unzipSync(buf);
    const get = (n: string) => (zip[n] ? strFromU8(zip[n]) : "");

    const stops = parseCsv<Stop>(get("stops.txt"));
    const routes = parseCsv<Route>(get("routes.txt"));
    const trips = parseCsv<Trip>(get("trips.txt"));
    const stopTimes = parseCsv<StopTime>(get("stop_times.txt"));
    const calendar = parseCsv<Cal>(get("calendar.txt"));
    const calDates = parseCsv<CalDate>(get("calendar_dates.txt"));
    console.log(`[trenes-sync] ${src.id}: stops=${stops.length} trips=${trips.length} stop_times=${stopTimes.length}`);

    const norm = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const terminal = stops.find(
      (s) => /terminal/i.test(s.stop_name) && (norm(s.stop_name).includes("alicante") || norm(s.stop_name).includes("alacant"))
    );
    if (!terminal) { console.warn(`[trenes-sync] ${src.id}: sin Alicante-Terminal`); continue; }
    const terminalId = terminal.stop_id;

    // Primera pasada: detectar trips que tocan terminal
    const tripsTouchTerminal = new Set<string>();
    for (const st of stopTimes) {
      if (st.stop_id === terminalId) tripsTouchTerminal.add(st.trip_id);
    }

    // Agrupar stop_times solo de trips relevantes
    const timesByTrip = new Map<string, StopTime[]>();
    for (const st of stopTimes) {
      if (!tripsTouchTerminal.has(st.trip_id)) continue;
      let arr = timesByTrip.get(st.trip_id);
      if (!arr) { arr = []; timesByTrip.set(st.trip_id, arr); }
      arr.push(st);
    }
    for (const arr of timesByTrip.values()) {
      arr.sort((a, b) => Number(a.stop_sequence) - Number(b.stop_sequence));
    }
    console.log(`[trenes-sync] ${src.id}: trips Alicante = ${timesByTrip.size}`);

    const tripById = new Map(trips.map((t) => [t.trip_id, t]));
    const routeById = new Map(routes.map((r) => [r.route_id, r]));
    const calById = new Map(calendar.map((c) => [c.service_id, c]));
    const calDatesBy = new Map<string, CalDate[]>();
    for (const c of calDates) {
      let arr = calDatesBy.get(c.service_id);
      if (!arr) { arr = []; calDatesBy.set(c.service_id, arr); }
      arr.push(c);
    }
    const serviceRunsOn = (service_id: string, date: Date): boolean => {
      const ymdStr = ymd(date);
      const cal = calById.get(service_id);
      let runs = false;
      if (cal && cal.start_date <= ymdStr && ymdStr <= cal.end_date) {
        runs = (cal as any)[DOW[date.getUTCDay()]] === "1";
      }
      const exc = calDatesBy.get(service_id)?.find((c) => c.date === ymdStr);
      if (exc) {
        if (exc.exception_type === "1") runs = true;
        else if (exc.exception_type === "2") runs = false;
      }
      return runs;
    };

    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    const dates: Date[] = [];
    for (let d = 0; d < DAYS_AHEAD; d++) {
      const x = new Date(today); x.setUTCDate(x.getUTCDate() + d); dates.push(x);
    }

    const stopNameById = new Map(stops.map((s) => [s.stop_id, s.stop_name]));

    for (const [trip_id, sts] of timesByTrip) {
      const trip = tripById.get(trip_id);
      if (!trip) continue;
      const route = routeById.get(trip.route_id);
      const cls = classify(route);
      const activeDates: string[] = [];
      for (const d of dates) if (serviceRunsOn(trip.service_id, d)) activeDates.push(isoDate(d));
      if (!activeDates.length) continue;

      const slimStops = sts.map((s) => ({
        id: s.stop_id, seq: Number(s.stop_sequence), arr: s.arrival_time, dep: s.departure_time,
      }));
      for (const s of sts) {
        if (!allStops[s.stop_id]) {
          const name = stopNameById.get(s.stop_id);
          if (name) allStops[s.stop_id] = name;
        }
      }

      allTrips.push({
        id: `RENFE-${trip_id}`,
        operator: cls.operator,
        product: cls.product,
        number: trip.trip_short_name || trip_id,
        dates: activeDates,
        stops: slimStops,
        terminalId,
      });
    }
  }

  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const end = new Date(today); end.setUTCDate(end.getUTCDate() + DAYS_AHEAD - 1);
  const payload = { generated_at: new Date().toISOString(), trips: allTrips, stops: allStops };

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { error } = await supabase.from("train_schedule_snapshot").upsert({
    id: "alicante-terminal",
    generated_at: new Date().toISOString(),
    date_start: isoDate(today),
    date_end: isoDate(end),
    payload: payload as any,
    source: "gtfs-renfe-nap",
    trips_count: allTrips.length,
  });
  if (error) throw new Error(`upsert: ${error.message}`);

  return { trips: allTrips.length, stops: Object.keys(allStops).length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const t0 = Date.now();
    const res = await buildSnapshot();
    return new Response(JSON.stringify({ ok: true, ...res, ms: Date.now() - t0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[trenes-sync] error", e);
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
