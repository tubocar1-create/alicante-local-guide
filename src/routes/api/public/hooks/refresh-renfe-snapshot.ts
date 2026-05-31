// Descarga el GTFS oficial de Renfe (NAP fichero 1098), filtra el corredor
// Alicante-Terminal y construye un snapshot de 30 días (desde HOY) que se
// persiste en `train_schedule_snapshot`. Pensado para correr a diario por
// cron (04:00 Madrid) — cada ejecución reemplaza el snapshot completo, así
// que si un día falla, el siguiente recupera el horizonte.

import { createFileRoute } from "@tanstack/react-router";
import { unzipSync, strFromU8 } from "fflate";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const NAP_URL = "https://nap.transportes.gob.es/api/Fichero/download/1098";
const DAYS = 30;
const SNAPSHOT_ID = "alicante";

const norm = (s: string) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function csv(u8: Uint8Array | undefined): Record<string, string>[] {
  if (!u8) return [];
  const txt = strFromU8(u8);
  const lines = txt.split(/\r?\n/);
  if (!lines.length) return [];
  const head = lines[0].replace(/^\uFEFF/, "").split(",").map((h) => h.trim());
  const out: Record<string, string>[] = [];
  for (let li = 1; li < lines.length; li++) {
    const l = lines[li];
    if (!l) continue;
    const cols: string[] = [];
    let cur = "";
    let q = false;
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
    for (let i = 0; i < head.length; i++) o[head[i]] = cols[i] ?? "";
    out.push(o);
  }
  return out;
}

const STATION_PATTERNS: RegExp[] = [
  /villena/i, /albacete/i, /cuenca/i, /ciudad\s*real/i, /puertollano/i, /chamart/i,
  /sorolla/i, /val[èe]ncia.*nord|valencia.*nord/i, /x[àa]tiva|j[áa]tiva/i,
  /castell[óo]/i, /camp\s*de\s*tarragona/i, /^tarragona$/i, /barcelona.*sants|^barcelona$/i,
  /zaragoza/i, /segovia/i, /valladolid/i, /palencia/i, /burgos/i, /^le[óo]n/i,
  /ourense/i, /coru[ñn]a/i, /vigo/i, /oviedo/i, /gij[óo]n/i,
  /sant\s*gabriel|san\s*gabriel/i, /torrellano/i, /elx.*parc|elche.*parque/i,
  /elx.*carr[úu]s|elche.*carr[úu]s/i, /crevillent/i, /albatera|catral/i,
  /callosa.*segura|cox/i, /orihuela/i, /beniel/i, /murcia.*carmen|^murcia$/i,
  /balsicas|mar\s*menor/i, /torre.*pacheco/i, /cartagena/i,
  /alcantarilla/i, /librilla/i, /alhama/i, /totana/i, /lorca/i,
  /universidad.*alicante|universitat/i, /sant\s*vicent.*centre|san\s*vicente.*centro/i,
];

function ymd(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
function ymdCompact(d: Date) { return ymd(d).replace(/-/g, ""); }
function parseGtfsDate(s: string) {
  return new Date(Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8)));
}

async function buildSnapshot() {
  const KEY = process.env.NAP_API_KEY;
  if (!KEY) throw new Error("Falta NAP_API_KEY");

  console.log("[refresh-renfe] descargando GTFS…");
  const r = await fetch(NAP_URL, { headers: { ApiKey: KEY } });
  if (!r.ok) throw new Error(`NAP HTTP ${r.status}`);
  const buf = new Uint8Array(await r.arrayBuffer());
  console.log(`[refresh-renfe] ${(buf.byteLength / 1024 / 1024).toFixed(2)} MB`);

  const zip = unzipSync(buf);
  const stops = csv(zip["stops.txt"]);
  const routes = csv(zip["routes.txt"]);
  const trips = csv(zip["trips.txt"]);
  const stopTimes = csv(zip["stop_times.txt"]);
  const calendar = csv(zip["calendar.txt"]);
  const calDates = csv(zip["calendar_dates.txt"]);
  console.log(`[refresh-renfe] stops=${stops.length} trips=${trips.length} stop_times=${stopTimes.length}`);

  const alicante = stops.filter((s) => {
    const n = norm(s.stop_name);
    return (n.includes("alicante") || n.includes("alacant")) && n.includes("terminal");
  });
  if (!alicante.length) throw new Error("Sin Alicante-Terminal en GTFS");
  const terminalIds = new Set(alicante.map((s) => s.stop_id));

  const relevantStops = new Map<string, string>();
  for (const s of stops) {
    if (terminalIds.has(s.stop_id) || STATION_PATTERNS.some((re) => re.test(s.stop_name))) {
      relevantStops.set(s.stop_id, s.stop_name);
    }
  }

  const tripsById = new Map(trips.map((t) => [t.trip_id, t]));
  const routesById = new Map(routes.map((r2) => [r2.route_id, r2]));

  const timesByTrip = new Map<string, Record<string, string>[]>();
  for (const st of stopTimes) {
    let a = timesByTrip.get(st.trip_id);
    if (!a) { a = []; timesByTrip.set(st.trip_id, a); }
    a.push(st);
  }
  for (const arr of timesByTrip.values()) {
    arr.sort((a, b) => Number(a.stop_sequence) - Number(b.stop_sequence));
  }

  const keepTripIds: string[] = [];
  for (const [tripId, sts] of timesByTrip) {
    if (sts.some((st) => terminalIds.has(st.stop_id))) keepTripIds.push(tripId);
  }

  const calById = new Map(calendar.map((c) => [c.service_id, c]));
  const calDatesByService = new Map<string, Record<string, string>[]>();
  for (const c of calDates) {
    let a = calDatesByService.get(c.service_id);
    if (!a) { a = []; calDatesByService.set(c.service_id, a); }
    a.push(c);
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const horizon = new Date(today);
  horizon.setUTCDate(horizon.getUTCDate() + DAYS);

  const datesCache = new Map<string, string[]>();
  function datesFor(serviceId: string): string[] {
    const hit = datesCache.get(serviceId);
    if (hit) return hit;
    const cal = calById.get(serviceId);
    const exc = calDatesByService.get(serviceId) || [];
    const removed = new Set(exc.filter((e) => e.exception_type === "2").map((e) => e.date));
    const out: string[] = [];
    if (cal) {
      const start = parseGtfsDate(cal.start_date);
      const end = parseGtfsDate(cal.end_date);
      const from = start > today ? start : today;
      const to = end < horizon ? end : horizon;
      const dows = [cal.sunday, cal.monday, cal.tuesday, cal.wednesday, cal.thursday, cal.friday, cal.saturday];
      for (let d = new Date(from); d <= to; d.setUTCDate(d.getUTCDate() + 1)) {
        if (removed.has(ymdCompact(d))) continue;
        if (dows[d.getUTCDay()] === "1") out.push(ymd(d));
      }
    }
    for (const cd of exc) {
      if (cd.exception_type !== "1") continue;
      const d = parseGtfsDate(cd.date);
      if (d < today || d > horizon) continue;
      const iso = ymd(d);
      if (!out.includes(iso)) out.push(iso);
    }
    out.sort();
    datesCache.set(serviceId, out);
    return out;
  }

  const outTrips: any[] = [];
  const usedStops = new Set<string>();
  for (const tripId of keepTripIds) {
    const t = tripsById.get(tripId);
    if (!t) continue;
    const dates = datesFor(t.service_id);
    if (!dates.length) continue;
    const route = routesById.get(t.route_id);
    const product = (route?.route_short_name || route?.route_long_name || "RENFE").toUpperCase();
    const sts = timesByTrip.get(tripId) || [];
    const filtered = sts.filter((st) => relevantStops.has(st.stop_id));
    if (filtered.length < 2) continue;
    const terminalStop = filtered.find((st) => terminalIds.has(st.stop_id));
    if (!terminalStop) continue;
    for (const st of filtered) usedStops.add(st.stop_id);
    outTrips.push({
      id: tripId,
      number: t.trip_short_name || tripId,
      product,
      terminalId: terminalStop.stop_id,
      dates,
      stops: filtered.map((st) => ({
        id: st.stop_id,
        seq: Number(st.stop_sequence),
        arr: (st.arrival_time || "").trim(),
        dep: (st.departure_time || "").trim(),
      })),
    });
  }
  const stopsOut: Record<string, string> = {};
  for (const sid of usedStops) stopsOut[sid] = relevantStops.get(sid)!;

  const snapshot = {
    generatedAt: new Date().toISOString(),
    horizonDays: DAYS,
    source: "Renfe GTFS (NAP 1098)",
    stops: stopsOut,
    trips: outTrips,
  };

  const dateStart = ymd(today);
  const dateEnd = ymd(horizon);

  const { error } = await supabaseAdmin
    .from("train_schedule_snapshot")
    .upsert({
      id: SNAPSHOT_ID,
      generated_at: snapshot.generatedAt,
      date_start: dateStart,
      date_end: dateEnd,
      payload: snapshot,
      source: "gtfs-renfe-nap",
      trips_count: outTrips.length,
    });
  if (error) throw new Error(`Supabase upsert: ${error.message}`);

  console.log(`[refresh-renfe] OK trips=${outTrips.length} ${dateStart}→${dateEnd}`);
  return { trips: outTrips.length, dateStart, dateEnd };
}

export const Route = createFileRoute("/api/public/hooks/refresh-renfe-snapshot")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const result = await buildSnapshot();
          return Response.json({ ok: true, ...result });
        } catch (e: any) {
          console.error("[refresh-renfe] error", e);
          return Response.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
        }
      },
      GET: async () => {
        try {
          const result = await buildSnapshot();
          return Response.json({ ok: true, ...result });
        } catch (e: any) {
          return Response.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
        }
      },
    },
  },
});
