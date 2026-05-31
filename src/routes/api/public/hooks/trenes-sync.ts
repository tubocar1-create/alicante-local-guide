// Sync diario GTFS Renfe → snapshot slim de trenes que tocan Alicante-Terminal.
// Filtra agresivamente y solo guarda lo necesario para los próximos 30 días.
// Llamado por pg_cron 1x/día. Memoria liberada tras procesar.

import { createFileRoute } from "@tanstack/react-router";
import { unzipSync, strFromU8 } from "fflate";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const NAP_URLS = [
  // GTFS Renfe Media/LD/AVE (incluye AVLO)
  { id: "renfe-ld", url: "https://nap.transportes.gob.es/api/Fichero/download/1098" },
  // GTFS Renfe Cercanías (multiprovincia) - opcional, lo intentamos
  // { id: "renfe-cer", url: "https://nap.transportes.gob.es/api/Fichero/download/1067" },
];

const DAYS_AHEAD = 30;

type Stop = { stop_id: string; stop_name: string };
type Trip = {
  trip_id: string;
  route_id: string;
  service_id: string;
  trip_short_name?: string;
};
type Route = {
  route_id: string;
  route_short_name?: string;
  route_long_name?: string;
  agency_id?: string;
};
type StopTime = {
  trip_id: string;
  arrival_time: string;
  departure_time: string;
  stop_id: string;
  stop_sequence: string;
};
type Cal = {
  service_id: string;
  monday: string; tuesday: string; wednesday: string; thursday: string;
  friday: string; saturday: string; sunday: string;
  start_date: string; end_date: string;
};
type CalDate = { service_id: string; date: string; exception_type: string };

function parseCsv<T = Record<string, string>>(text: string): T[] {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const head = lines[0].replace(/^\uFEFF/, "").split(",").map((h) => h.trim());
  return lines.slice(1).map((l) => {
    const cols: string[] = [];
    let cur = "", q = false;
    for (let i = 0; i < l.length; i++) {
      const c = l[i];
      if (q) {
        if (c === '"') {
          if (l[i + 1] === '"') { cur += '"'; i++; }
          else q = false;
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
    return o as T;
  });
}

const DOW = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
function ymd(d: Date): string {
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
}
function isoDate(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function classify(route: Route | undefined): { product: string; operator: string } {
  const ln = (route?.route_long_name || "").toUpperCase();
  const sn = (route?.route_short_name || "").toUpperCase();
  const all = ln + " " + sn;
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
  const apiKey = process.env.NAP_API_KEY;
  if (!apiKey) throw new Error("Falta NAP_API_KEY");

  const allTrips: any[] = [];
  const allStops: Record<string, string> = {};

  for (const src of NAP_URLS) {
    console.log(`[trenes-sync] descargando ${src.id}…`);
    const res = await fetch(src.url, { headers: { ApiKey: apiKey } });
    if (!res.ok) {
      console.error(`[trenes-sync] HTTP ${res.status} en ${src.id}`);
      continue;
    }
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

    // 1) Localizar Alicante-Terminal
    const norm = (s: string) =>
      (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const terminal = stops.find(
      (s) => /terminal/i.test(s.stop_name) && (norm(s.stop_name).includes("alicante") || norm(s.stop_name).includes("alacant"))
    );
    if (!terminal) {
      console.warn(`[trenes-sync] ${src.id}: no se encontró Alicante-Terminal`);
      continue;
    }
    const terminalId = terminal.stop_id;

    // 2) Agrupar stop_times por trip
    const timesByTrip = new Map<string, StopTime[]>();
    for (const st of stopTimes) {
      let arr = timesByTrip.get(st.trip_id);
      if (!arr) { arr = []; timesByTrip.set(st.trip_id, arr); }
      arr.push(st);
    }
    for (const arr of timesByTrip.values()) {
      arr.sort((a, b) => Number(a.stop_sequence) - Number(b.stop_sequence));
    }

    // 3) Quedarnos solo con trips que tocan Alicante-Terminal
    const relevantTripIds: string[] = [];
    for (const [trip_id, sts] of timesByTrip) {
      if (sts.some((s) => s.stop_id === terminalId)) relevantTripIds.push(trip_id);
    }
    console.log(`[trenes-sync] ${src.id}: trips Alicante-Terminal = ${relevantTripIds.length}`);

    // 4) Calendarios
    const tripById = new Map(trips.map((t) => [t.trip_id, t]));
    const routeById = new Map(routes.map((r) => [r.route_id, r]));
    const calById = new Map(calendar.map((c) => [c.service_id, c]));
    const calDatesBy = new Map<string, CalDate[]>();
    for (const c of calDates) {
      let arr = calDatesBy.get(c.service_id);
      if (!arr) { arr = []; calDatesBy.set(c.service_id, arr); }
      arr.push(c);
    }
    function serviceRunsOn(service_id: string, date: Date): boolean {
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
    }

    // 5) Precalcular fechas activas para próximos 30 días
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const dates: Date[] = [];
    for (let d = 0; d < DAYS_AHEAD; d++) {
      const x = new Date(today);
      x.setUTCDate(x.getUTCDate() + d);
      dates.push(x);
    }

    // 6) Construir snapshot de trips relevantes
    for (const trip_id of relevantTripIds) {
      const trip = tripById.get(trip_id);
      if (!trip) continue;
      const route = routeById.get(trip.route_id);
      const cls = classify(route);
      const sts = timesByTrip.get(trip_id)!;
      const activeDates: string[] = [];
      for (const d of dates) {
        if (serviceRunsOn(trip.service_id, d)) activeDates.push(isoDate(d));
      }
      if (!activeDates.length) continue;

      // Stops compactos
      const slimStops = sts.map((s) => ({
        id: s.stop_id,
        seq: Number(s.stop_sequence),
        arr: s.arrival_time,
        dep: s.departure_time,
      }));
      // Registrar nombre de stops
      for (const s of sts) {
        if (!allStops[s.stop_id]) {
          const name = stops.find((x) => x.stop_id === s.stop_id)?.stop_name;
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

  const payload = {
    generated_at: new Date().toISOString(),
    trips: allTrips,
    stops: allStops,
  };

  await supabaseAdmin
    .from("train_schedule_snapshot")
    .upsert({
      id: "alicante-terminal",
      generated_at: new Date().toISOString(),
      date_start: isoDate(today),
      date_end: isoDate(end),
      payload: payload as any,
      source: "gtfs-renfe-nap",
      trips_count: allTrips.length,
    });

  return { trips: allTrips.length, stops: Object.keys(allStops).length };
}

export const Route = createFileRoute("/api/public/hooks/trenes-sync")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const t0 = Date.now();
          const res = await buildSnapshot();
          return new Response(
            JSON.stringify({ ok: true, ...res, ms: Date.now() - t0 }),
            { headers: { "Content-Type": "application/json" } }
          );
        } catch (e) {
          console.error("[trenes-sync] error", e);
          return new Response(
            JSON.stringify({ ok: false, error: (e as Error).message }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      },
      GET: async () => {
        // Permitimos GET para disparo manual sencillo desde navegador/admin.
        try {
          const t0 = Date.now();
          const res = await buildSnapshot();
          return new Response(
            JSON.stringify({ ok: true, ...res, ms: Date.now() - t0 }),
            { headers: { "Content-Type": "application/json" } }
          );
        } catch (e) {
          return new Response(
            JSON.stringify({ ok: false, error: (e as Error).message }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      },
    },
  },
});
