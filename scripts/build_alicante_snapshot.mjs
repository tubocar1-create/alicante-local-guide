// Construye public/data/alicante_snapshot.json a partir del GTFS Renfe
// (NAP fichero 1098: AVE + LD + Media Distancia).
// Filtra corredores Alicante-Terminal en los próximos 30 días.
// Pensado para ejecutarse fuera del Worker (Node local / GitHub Action).

import { unzipSync, strFromU8 } from "fflate";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const NAP_URL = "https://nap.transportes.gob.es/api/Fichero/download/1098";
const KEY = process.env.NAP_API_KEY;
if (!KEY) { console.error("Falta NAP_API_KEY"); process.exit(1); }

const DAYS = 30;
const OUT = "public/data/alicante_snapshot.json";

const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

console.log("→ Descargando GTFS Renfe (1098)…");
const r = await fetch(NAP_URL, { headers: { ApiKey: KEY } });
if (!r.ok) { console.error("HTTP", r.status); process.exit(1); }
const buf = new Uint8Array(await r.arrayBuffer());
console.log(`  ${(buf.byteLength / 1024 / 1024).toFixed(2)} MB`);

console.log("→ Descomprimiendo…");
const zip = unzipSync(buf);

function csv(name) {
  const u8 = zip[name];
  if (!u8) return [];
  const txt = strFromU8(u8);
  const lines = txt.split(/\r?\n/);
  if (!lines.length) return [];
  const head = lines[0].replace(/^\uFEFF/, "").split(",").map((h) => h.trim());
  const out = [];
  for (let li = 1; li < lines.length; li++) {
    const l = lines[li];
    if (!l) continue;
    const cols = []; let cur = ""; let q = false;
    for (let i = 0; i < l.length; i++) {
      const c = l[i];
      if (q) { if (c === '"') { if (l[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
      else { if (c === '"') q = true; else if (c === ",") { cols.push(cur); cur = ""; } else cur += c; }
    }
    cols.push(cur);
    const o = {}; for (let i = 0; i < head.length; i++) o[head[i]] = cols[i] ?? "";
    out.push(o);
  }
  return out;
}

console.log("→ Parseando CSV…");
const stops = csv("stops.txt");
const routes = csv("routes.txt");
const trips = csv("trips.txt");
const stopTimes = csv("stop_times.txt");
const calendar = csv("calendar.txt");
const calDates = csv("calendar_dates.txt");
console.log(`  stops=${stops.length} routes=${routes.length} trips=${trips.length} stop_times=${stopTimes.length}`);

// 1) Estación Alicante-Terminal
const alicante = stops.filter((s) => {
  const n = norm(s.stop_name);
  return (n.includes("alicante") || n.includes("alacant")) && n.includes("terminal");
});
if (!alicante.length) { console.error("✗ Sin Alicante-Terminal"); process.exit(1); }
const terminalIds = new Set(alicante.map((s) => s.stop_id));
console.log(`✓ Alicante-Terminal: ${[...terminalIds].join(", ")}`);

// 2) Patrones para estaciones del corredor (códigos internos del front)
const STATION_PATTERNS = [
  // Madrid AV
  /villena/i, /albacete/i, /cuenca/i, /ciudad\s*real/i, /puertollano/i, /chamart/i,
  // Mediterráneo Norte
  /sorolla/i, /val[èe]ncia.*nord|valencia.*nord/i, /x[àa]tiva|j[áa]tiva/i,
  /castell[óo]/i, /camp\s*de\s*tarragona/i, /^tarragona$/i, /barcelona.*sants|^barcelona$/i,
  // Norte
  /zaragoza/i, /segovia/i, /valladolid/i, /palencia/i, /burgos/i, /^le[óo]n/i,
  /ourense/i, /coru[ñn]a/i, /vigo/i, /oviedo/i, /gij[óo]n/i,
  // Murcia / Cercanías C1
  /sant\s*gabriel|san\s*gabriel/i, /torrellano/i, /elx.*parc|elche.*parque/i,
  /elx.*carr[úu]s|elche.*carr[úu]s/i, /crevillent/i, /albatera|catral/i,
  /callosa.*segura|cox/i, /orihuela/i, /beniel/i, /murcia.*carmen|^murcia$/i,
  // Cartagena
  /balsicas|mar\s*menor/i, /torre.*pacheco/i, /cartagena/i,
  // Lorca
  /alcantarilla/i, /librilla/i, /alhama/i, /totana/i, /lorca/i,
  // Universidad C3
  /universidad.*alicante|universitat/i, /sant\s*vicent.*centre|san\s*vicente.*centro/i,
];

const relevantStops = new Map(); // stop_id -> name (estaciones que nos interesan)
for (const s of stops) {
  if (terminalIds.has(s.stop_id) || STATION_PATTERNS.some((re) => re.test(s.stop_name))) {
    relevantStops.set(s.stop_id, s.stop_name);
  }
}
console.log(`✓ Stops relevantes: ${relevantStops.size}`);

// 3) Índices
const tripsById = new Map(trips.map((t) => [t.trip_id, t]));
const routesById = new Map(routes.map((r) => [r.route_id, r]));

// stop_times agrupados por trip (ordenados)
console.log("→ Indexando stop_times…");
const timesByTrip = new Map();
for (const st of stopTimes) {
  let a = timesByTrip.get(st.trip_id);
  if (!a) { a = []; timesByTrip.set(st.trip_id, a); }
  a.push(st);
}
for (const arr of timesByTrip.values()) arr.sort((a, b) => Number(a.stop_sequence) - Number(b.stop_sequence));

// 4) Trips que tocan Alicante-Terminal
console.log("→ Filtrando trips que pasan por Alicante-Terminal…");
const keepTripIds = [];
for (const [tripId, sts] of timesByTrip) {
  if (sts.some((st) => terminalIds.has(st.stop_id))) keepTripIds.push(tripId);
}
console.log(`✓ Trips Alicante: ${keepTripIds.length}`);

// 5) Calendario → fechas activas dentro de los próximos 30 días
const calById = new Map(calendar.map((c) => [c.service_id, c]));
const calDatesByService = new Map();
for (const c of calDates) {
  let a = calDatesByService.get(c.service_id);
  if (!a) { a = []; calDatesByService.set(c.service_id, a); }
  a.push(c);
}

const today = new Date();
today.setUTCHours(0, 0, 0, 0);
const horizon = new Date(today); horizon.setUTCDate(horizon.getUTCDate() + DAYS);

function ymd(d) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
function ymdCompact(d) { return ymd(d).replace(/-/g, ""); }
function parseGtfsDate(s) {
  // YYYYMMDD
  return new Date(Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8)));
}

const datesCache = new Map(); // service_id -> [YYYY-MM-DD]
function datesFor(serviceId) {
  if (datesCache.has(serviceId)) return datesCache.get(serviceId);
  const cal = calById.get(serviceId);
  const exc = calDatesByService.get(serviceId) || [];
  const added = new Set(exc.filter((e) => e.exception_type === "1").map((e) => e.date));
  const removed = new Set(exc.filter((e) => e.exception_type === "2").map((e) => e.date));
  const out = [];
  if (cal) {
    const start = parseGtfsDate(cal.start_date);
    const end = parseGtfsDate(cal.end_date);
    const from = start > today ? start : today;
    const to = end < horizon ? end : horizon;
    const dows = [cal.sunday, cal.monday, cal.tuesday, cal.wednesday, cal.thursday, cal.friday, cal.saturday];
    for (let d = new Date(from); d <= to; d.setUTCDate(d.getUTCDate() + 1)) {
      const compact = ymdCompact(d);
      if (removed.has(compact)) continue;
      if (dows[d.getUTCDay()] === "1") out.push(ymd(d));
    }
  }
  // Añadidos exception_type=1 dentro de la ventana
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

// 6) Construir snapshot
console.log("→ Generando snapshot…");
const outTrips = [];
const usedStops = new Set();

for (const tripId of keepTripIds) {
  const t = tripsById.get(tripId);
  if (!t) continue;
  const dates = datesFor(t.service_id);
  if (!dates.length) continue;

  const route = routesById.get(t.route_id);
  const product = (route?.route_short_name || route?.route_long_name || "RENFE").toUpperCase();

  const sts = timesByTrip.get(tripId) || [];
  // Quedarnos solo con paradas relevantes (terminal + corredor)
  const filtered = sts.filter((st) => relevantStops.has(st.stop_id));
  if (filtered.length < 2) continue;

  // Identificar la parada terminal (la primera que coincide con Alicante-Terminal)
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

const stopsOut = {};
for (const sid of usedStops) stopsOut[sid] = relevantStops.get(sid);

const snapshot = {
  generatedAt: new Date().toISOString(),
  horizonDays: DAYS,
  source: "Renfe GTFS (NAP 1098)",
  stops: stopsOut,
  trips: outTrips,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(snapshot));
const sizeKb = (Buffer.byteLength(JSON.stringify(snapshot)) / 1024).toFixed(1);
console.log(`✓ ${OUT}  trips=${outTrips.length} stops=${Object.keys(stopsOut).length}  ${sizeKb} KB`);
