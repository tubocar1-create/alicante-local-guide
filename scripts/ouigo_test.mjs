// Prueba técnica OUIGO GTFS — sin persistencia, en memoria.
// FASE 1: validar Alicante-Terminal
// FASE 2: Alicante → Madrid mañana
// FASE 3: 30 días
// FASE 4: filosofía datos (filtrado early)
// FASE 5: validación final

import { unzipSync, strFromU8 } from "fflate";

const NAP_API_KEY = process.env.NAP_API_KEY;
if (!NAP_API_KEY) { console.error("Falta NAP_API_KEY"); process.exit(1); }

const FICHERO_ID = 1766; // OUIGO GTFS (conjuntoDatoId=1515, operadorId=1946)
const URL = `https://nap.transportes.gob.es/api/Fichero/download/${FICHERO_ID}`;

function parseCsv(text) {
  const rows = []; let cur = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i+1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") { cur.push(field); field = ""; }
      else if (c === "\n") { cur.push(field); rows.push(cur); cur = []; field = ""; }
      else if (c === "\r") {}
      else field += c;
    }
  }
  if (field.length || cur.length) { cur.push(field); rows.push(cur); }
  if (!rows.length) return [];
  const header = rows[0].map(h => h.trim().replace(/^\uFEFF/, ""));
  return rows.slice(1).filter(r => r.length > 1 || (r.length === 1 && r[0] !== ""))
    .map(r => { const o = {}; header.forEach((h, i) => o[h] = (r[i] ?? "").trim()); return o; });
}

const norm = s => (s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/g," ").replace(/\s+/g," ").trim();
const ymd = d => `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;
const iso = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

const memBefore = process.memoryUsage().heapUsed;

console.log("=== FASE 1: descargando OUIGO GTFS ===");
const t0 = Date.now();
const res = await fetch(URL, { headers: { ApiKey: NAP_API_KEY } });
if (!res.ok) { console.error("HTTP", res.status); process.exit(1); }
const buf = new Uint8Array(await res.arrayBuffer());
console.log(`  ZIP: ${buf.byteLength} bytes en ${Date.now()-t0}ms`);

const z = unzipSync(buf);
const file = n => z[n] ? parseCsv(strFromU8(z[n])) : [];
const stops = file("stops.txt");
const routes = file("routes.txt");
const trips = file("trips.txt");
const stopTimes = file("stop_times.txt");
const calendar = file("calendar.txt");
const calDates = file("calendar_dates.txt");
const agency = file("agency.txt");
console.log(`  agency=${agency.length} stops=${stops.length} routes=${routes.length} trips=${trips.length} stop_times=${stopTimes.length} calendar=${calendar.length} calendar_dates=${calDates.length}`);

// Validar Alicante
const alicanteStops = stops.filter(s => {
  const n = norm(s.stop_name);
  return n.includes("alicante") || n.includes("alacant");
});
console.log("\n--- Estaciones Alicante en OUIGO ---");
if (alicanteStops.length === 0) { console.error("❌ Alicante NO existe en OUIGO. STOP."); process.exit(1); }
alicanteStops.forEach(s => console.log(`  stop_id=${s.stop_id} | stop_name="${s.stop_name}" | stop_code=${s.stop_code ?? "-"}`));

// elegir terminal
const aliTerminal = alicanteStops.find(s => /terminal/i.test(s.stop_name)) ?? alicanteStops[0];
console.log(`\n✅ Seleccionado: ${aliTerminal.stop_name} (${aliTerminal.stop_id})`);

const madridStops = stops.filter(s => norm(s.stop_name).includes("madrid"));
console.log("\n--- Estaciones Madrid en OUIGO ---");
madridStops.forEach(s => console.log(`  stop_id=${s.stop_id} | stop_name="${s.stop_name}"`));
const madridIds = new Set(madridStops.map(s => s.stop_id));

// Indexar stop_times por trip_id (ordenado por stop_sequence)
const stByTrip = new Map();
for (const st of stopTimes) {
  let arr = stByTrip.get(st.trip_id);
  if (!arr) { arr = []; stByTrip.set(st.trip_id, arr); }
  arr.push(st);
}
for (const arr of stByTrip.values()) arr.sort((a,b)=>Number(a.stop_sequence)-Number(b.stop_sequence));

const tripById = new Map(trips.map(t => [t.trip_id, t]));
const routeById = new Map(routes.map(r => [r.route_id, r]));
const calById = new Map(calendar.map(c => [c.service_id, c]));
const exByServiceDate = new Map(); // key service_id|date → exception_type
for (const cd of calDates) exByServiceDate.set(`${cd.service_id}|${cd.date}`, Number(cd.exception_type));

function serviceRunsOn(serviceId, date) {
  const c = calById.get(serviceId);
  const key = `${serviceId}|${ymd(date)}`;
  const ex = exByServiceDate.get(key);
  if (ex === 2) return false;
  if (ex === 1) return true;
  if (!c) return false;
  const dStr = ymd(date);
  if (dStr < c.start_date || dStr > c.end_date) return false;
  const dow = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"][date.getDay()];
  return c[dow] === "1";
}

function findAliToMadrid(date) {
  const out = [];
  for (const [tripId, sts] of stByTrip) {
    const aliIdx = sts.findIndex(s => s.stop_id === aliTerminal.stop_id);
    if (aliIdx < 0) continue;
    const madIdx = sts.findIndex((s, i) => i > aliIdx && madridIds.has(s.stop_id));
    if (madIdx < 0) continue;
    const trip = tripById.get(tripId);
    if (!trip || !serviceRunsOn(trip.service_id, date)) continue;
    const route = routeById.get(trip.route_id);
    const dep = sts[aliIdx].departure_time;
    const madStop = stops.find(s => s.stop_id === sts[madIdx].stop_id);
    out.push({
      date: iso(date),
      dep,
      origin: aliTerminal.stop_name,
      dest: madStop?.stop_name ?? sts[madIdx].stop_id,
      operator: agency[0]?.agency_name ?? "OUIGO",
      trip_short: trip.trip_short_name || trip.trip_id,
      route: route?.route_long_name || route?.route_short_name || trip.route_id,
    });
  }
  return out.sort((a,b)=>a.dep.localeCompare(b.dep));
}

// === FASE 2 ===
const now = new Date();
const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate()+1);
console.log(`\n=== FASE 2: Alicante → Madrid el ${iso(tomorrow)} ===`);
const tomorrowList = findAliToMadrid(tomorrow);
if (!tomorrowList.length) console.log("  (sin servicios mañana)");
for (const t of tomorrowList) {
  console.log(`  ${t.date} | ${t.dep} | ${t.origin} → ${t.dest} | ${t.operator} | tren=${t.trip_short} | ${t.route}`);
}

// === FASE 3: 30 días ===
console.log(`\n=== FASE 3: próximos 30 días ===`);
let total = 0;
const perDay = [];
for (let i = 1; i <= 30; i++) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate()+i);
  const list = findAliToMadrid(d);
  perDay.push({ date: iso(d), n: list.length });
  total += list.length;
}
const memAfter = process.memoryUsage().heapUsed;
perDay.forEach(p => console.log(`  ${p.date}: ${p.n}`));
console.log(`\n  TOTAL servicios 30 días : ${total}`);
console.log(`  Promedio diario         : ${(total/30).toFixed(2)}`);
console.log(`  Registros generados     : ${total} (objetos ligeros, en memoria)`);
console.log(`  Memoria heap incremento : ${((memAfter-memBefore)/1024).toFixed(1)} KB`);

// === FASE 4 / 5 ===
console.log(`\n=== FASE 5: validación final ===`);
console.log(`  1. OUIGO GTFS descarga + parse: OK (${buf.byteLength}B, ${trips.length} trips)`);
console.log(`  2. Alicante-Terminal filtrable: OK (${aliTerminal.stop_id})`);
console.log(`  3. Alicante → Madrid mañana   : ${tomorrowList.length} servicios`);
console.log(`  4. Próximos 30 días viables   : ${total} registros`);
console.log(`  5. Volumen manejable          : ${total} filas (≈${((memAfter-memBefore)/1024).toFixed(0)} KB)`);
console.log(`  6. Funciona bajo demanda sin persistencia: OK (todo en memoria, sin escrituras)`);
