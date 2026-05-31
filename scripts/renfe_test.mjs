// Prueba técnica Renfe GTFS — en memoria, sin persistencia.
import { unzipSync, strFromU8 } from "fflate";

const NAP_URL = "https://nap.transportes.gob.es/api/Fichero/download/1098"; // Renfe Media/LD/AVE
const KEY = process.env.NAP_API_KEY;
if (!KEY) { console.error("Falta NAP_API_KEY"); process.exit(1); }

console.log("→ Descargando GTFS Renfe (Media/LD/AVE)...");
const res = await fetch(NAP_URL, { headers: { ApiKey: KEY } });
if (!res.ok) { console.error("HTTP", res.status); process.exit(1); }
const buf = new Uint8Array(await res.arrayBuffer());
console.log(`  ${(buf.byteLength/1024/1024).toFixed(2)} MB`);

const zip = unzipSync(buf);
function csv(name) {
  const u8 = zip[name];
  if (!u8) return [];
  const txt = strFromU8(u8);
  const lines = txt.split(/\r?\n/).filter(Boolean);
  const head = lines[0].replace(/^\uFEFF/, "").split(",").map(h => h.trim());
  return lines.slice(1).map(l => {
    // parser CSV simple sin comillas anidadas (Renfe no las usa en estos campos clave)
    const cols = []; let cur = ""; let q = false;
    for (let i=0;i<l.length;i++){const c=l[i];
      if (q){ if(c==='"'){if(l[i+1]==='"'){cur+='"';i++;}else q=false;} else cur+=c; }
      else { if(c==='"')q=true; else if(c===","){cols.push(cur);cur="";} else cur+=c; }
    }
    cols.push(cur);
    const o={}; head.forEach((h,i)=>o[h]=cols[i]??""); return o;
  });
}

console.log("→ Parseando archivos...");
const stops = csv("stops.txt");
const routes = csv("routes.txt");
const trips = csv("trips.txt");
const stopTimes = csv("stop_times.txt");
const calendar = csv("calendar.txt");
const calDates = csv("calendar_dates.txt");
console.log(`  stops=${stops.length} routes=${routes.length} trips=${trips.length} stop_times=${stopTimes.length} cal=${calendar.length} calDates=${calDates.length}`);

// =================== FASE 1 ===================
console.log("\n========== FASE 1 — VALIDAR ESTACIÓN ALICANTE ==========");
const norm = s => (s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const alicanteStops = stops.filter(s => {
  const n = norm(s.stop_name);
  return n.includes("alicante") || n.includes("alacant");
});
console.log(`Coincidencias 'Alicante/Alacant': ${alicanteStops.length}`);
alicanteStops.forEach(s => console.log(`  ${s.stop_id} | ${s.stop_code||"-"} | ${s.stop_name}`));

const terminal = alicanteStops.find(s => /terminal/i.test(s.stop_name));
if (!terminal) { console.error("\n✗ No se encontró Alicante-Terminal. STOP."); process.exit(1); }
console.log(`\n✓ Alicante-Terminal: stop_id=${terminal.stop_id} code=${terminal.stop_code||"-"} name="${terminal.stop_name}"`);

// Madrid: cualquier stop con "Madrid"
const madridStops = stops.filter(s => norm(s.stop_name).includes("madrid"));
const madridIds = new Set(madridStops.map(s=>s.stop_id));
console.log(`Estaciones Madrid en GTFS: ${madridStops.length}`);

// Índices
const tripsById = new Map(trips.map(t=>[t.trip_id,t]));
const routesById = new Map(routes.map(r=>[r.route_id,r]));
const stopName = new Map(stops.map(s=>[s.stop_id,s.stop_name]));
const calById = new Map(calendar.map(c=>[c.service_id,c]));
const calDatesByService = new Map();
for (const c of calDates) {
  if (!calDatesByService.has(c.service_id)) calDatesByService.set(c.service_id, []);
  calDatesByService.get(c.service_id).push(c);
}

// stop_times agrupados por trip (ordenados por stop_sequence)
const timesByTrip = new Map();
for (const st of stopTimes) {
  if (!timesByTrip.has(st.trip_id)) timesByTrip.set(st.trip_id, []);
  timesByTrip.get(st.trip_id).push(st);
}
for (const arr of timesByTrip.values()) arr.sort((a,b)=>Number(a.stop_sequence)-Number(b.stop_sequence));

// Trips que parten de Alicante-Terminal y pasan por Madrid después
function tripsAlicanteMadrid() {
  const out = [];
  for (const [trip_id, sts] of timesByTrip) {
    const idxA = sts.findIndex(s => s.stop_id === terminal.stop_id);
    if (idxA < 0) continue;
    const after = sts.slice(idxA+1);
    const idxM = after.findIndex(s => madridIds.has(s.stop_id));
    if (idxM < 0) continue;
    out.push({ trip_id, depart: sts[idxA], arrive: after[idxM] });
  }
  return out;
}
const candidates = tripsAlicanteMadrid();
console.log(`\nTrips Alicante-Terminal → Madrid (cualquier día): ${candidates.length}`);

// Helpers calendario
const DOW = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
function ymd(d){ return d.toISOString().slice(0,10).replace(/-/g,""); }
function serviceRunsOn(service_id, date /* Date */) {
  const ymdStr = ymd(date);
  const cal = calById.get(service_id);
  let runs = false;
  if (cal) {
    if (cal.start_date <= ymdStr && ymdStr <= cal.end_date) {
      runs = cal[DOW[date.getUTCDay()]] === "1";
    }
  }
  const exc = (calDatesByService.get(service_id)||[]).find(c=>c.date===ymdStr);
  if (exc) {
    if (exc.exception_type === "1") runs = true;
    else if (exc.exception_type === "2") runs = false;
  }
  return runs;
}

function classify(route) {
  const ln = (route?.route_long_name||"").toUpperCase();
  const sn = (route?.route_short_name||"").toUpperCase();
  const all = ln+" "+sn;
  if (all.includes("AVLO")) return "AVLO";
  if (all.includes("OUIGO")) return "OUIGO";
  if (all.includes("IRYO")) return "IRYO";
  if (all.includes("AVE")) return "AVE";
  if (all.includes("ALVIA") || all.includes("EUROMED") || all.includes("INTERCITY") || all.includes("ALTARIA") || all.includes("TALGO")) return "Larga Distancia";
  if (all.includes("MD") || all.includes("MEDIA")) return "Media Distancia";
  if (all.includes("REGIONAL")) return "Regional";
  if (all.includes("CERCAN")) return "Cercanías";
  return route?.route_short_name || route?.route_long_name || "?";
}

// =================== FASE 2 ===================
console.log("\n========== FASE 2 — SERVICIOS MAÑANA ==========");
const tomorrow = new Date(); tomorrow.setUTCDate(tomorrow.getUTCDate()+1);
const ymdT = ymd(tomorrow);
console.log(`Fecha: ${ymdT}`);

const services = [];
for (const c of candidates) {
  const trip = tripsById.get(c.trip_id);
  if (!trip) continue;
  if (!serviceRunsOn(trip.service_id, tomorrow)) continue;
  const route = routesById.get(trip.route_id);
  services.push({
    fecha: ymdT,
    salida: c.depart.departure_time,
    destino: stopName.get(c.arrive.stop_id),
    operador: route?.agency_id || "RENFE",
    tren: trip.trip_short_name || trip.trip_id,
    tipo: classify(route),
  });
}
services.sort((a,b)=>a.salida.localeCompare(b.salida));
console.log(`Servicios encontrados: ${services.length}\n`);
for (const s of services) {
  console.log(`  ${s.fecha}  ${s.salida}  → ${s.destino.padEnd(28)}  ${s.tipo.padEnd(18)}  ${s.tren.padEnd(10)}  ${s.operador}`);
}

// =================== FASE 3 ===================
console.log("\n========== FASE 3 — PRÓXIMOS 30 DÍAS ==========");
const ops = new Map();
let total = 0;
for (let d=0; d<30; d++) {
  const day = new Date(); day.setUTCDate(day.getUTCDate()+d);
  for (const c of candidates) {
    const trip = tripsById.get(c.trip_id);
    if (!trip || !serviceRunsOn(trip.service_id, day)) continue;
    total++;
    const route = routesById.get(trip.route_id);
    const op = route?.agency_id || "RENFE";
    ops.set(op, (ops.get(op)||0)+1);
  }
}
console.log(`Total servicios 30 días: ${total}`);
console.log(`Promedio diario: ${(total/30).toFixed(1)}`);
console.log(`Operadores: ${[...ops.entries()].map(([k,v])=>`${k}=${v}`).join(", ")}`);

console.log("\n✓ Fin. Memoria temporal descartada.");
