const BASE = "https://www.adif.es/w/60911-alacant/alicante-t";

// 1) Fetch page with cookie jar to get p_p_auth + JSESSIONID
const r1 = await fetch(BASE, { headers: { "User-Agent": "Mozilla/5.0", "Accept":"text/html" } });
const setCookies = r1.headers.getSetCookie ? r1.headers.getSetCookie() : [r1.headers.get("set-cookie")].filter(Boolean);
const cookieHeader = setCookies.map(c => c.split(";")[0]).join("; ");
const html = await r1.text();
const mAuth = html.match(/p_p_auth=([A-Za-z0-9]+)/);
console.log("cookies:", cookieHeader.slice(0,160));
console.log("p_p_auth match:", mAuth && mAuth[1]);

const auth = mAuth[1];
const URL_RES = `${BASE}?p_p_id=servicios_estacion_ServiciosEstacionPortlet&p_p_lifecycle=2&p_p_state=normal&p_p_mode=view&p_p_resource_id=%2FconsultarHorario&p_p_cacheability=cacheLevelPage&assetEntryId=3068526&p_p_auth=${auth}`;

async function call(searchType, trafficType, numPage = 0) {
  const body = new URLSearchParams({
    _servicios_estacion_ServiciosEstacionPortlet_searchType: searchType,
    _servicios_estacion_ServiciosEstacionPortlet_trafficType: trafficType,
    _servicios_estacion_ServiciosEstacionPortlet_numPage: String(numPage),
    _servicios_estacion_ServiciosEstacionPortlet_commuterNetwork: "MURCIA_ALICANTE",
    _servicios_estacion_ServiciosEstacionPortlet_stationCode: "60911",
  });
  const r = await fetch(URL_RES, {
    method: "POST",
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "Accept": "application/json, text/javascript, */*; q=0.01",
      "X-Requested-With": "XMLHttpRequest",
      "Referer": BASE,
      "Cookie": cookieHeader,
    },
    body,
  });
  const text = await r.text();
  try { return JSON.parse(text); } catch { return { _raw: text.slice(0,300), _status: r.status }; }
}

function parseMin(a, b) {
  if (!a || !b || a === b) return 0;
  const [ah, am] = a.split(":").map(Number);
  const [bh, bm] = b.split(":").map(Number);
  let d = (bh * 60 + bm) - (ah * 60 + am);
  if (d < -720) d += 1440;
  if (d > 720) d -= 1440;
  return d;
}

function norm(item, dir, tt) {
  const scheduled = (item.hora || "").trim();
  const estimated = item.horaEstado && item.horaEstado.trim() ? item.horaEstado.trim() : scheduled;
  const delay = parseMin(scheduled, estimated);
  let status = "EN_HORA";
  if (item.markupColor === "suppressed") status = "CANCELADO";
  else if (delay > 0) status = "RETRASO";
  else if (delay < 0) status = "ADELANTO";
  else if (item.markupColor === "audited") status = "CAMBIO";
  const op = (item.trenDatosOp || "").replace(/<[^>]+>/g,"").trim() || (tt === "cercanias" ? "Renfe Cercanías" : "Renfe");
  return {
    direction: dir, operator: op,
    train_number: (item.tren || "").replace(/<[^>]+>/g,"").trim(),
    origin: dir === "LLEGADA" ? (item.estacion||"").trim() : "Alicante-Terminal",
    destination: dir === "SALIDA" ? (item.estacion||"").trim() : "Alicante-Terminal",
    scheduled_time: scheduled,
    estimated_time: estimated,
    delay_minutes: delay,
    platform: (item.via || "").trim(),
    status,
    observation: (item.observation || "").trim(),
  };
}

const ops = [
  ["proximasSalidas", "cercanias"],
  ["proximasSalidas", "avldmd"],
  ["proximasLlegadas", "cercanias"],
  ["proximasLlegadas", "avldmd"],
];

const flat = [];
for (const [s, t] of ops) {
  const dir = s === "proximasSalidas" ? "SALIDA" : "LLEGADA";
  let total = 0;
  for (let p = 0; p < 6; p++) {
    const j = await call(s, t, p);
    if (!j.horarios) { if (p===0) console.log("err", s, t, j); break; }
    total += j.horarios.length;
    for (const it of j.horarios) flat.push(norm(it, dir, t));
    if (j.horarios.length < 10) break;
  }
  console.log(`${s} ${t}: ${total}`);
}

console.log("\n=== TOTAL trenes:", flat.length);
const operators = [...new Set(flat.map(x => x.operator))];
console.log("Operadores:", operators.join(" | "));

const anomalies = flat.filter(x => x.status !== "EN_HORA" || x.observation);
console.log("Anomalías:", anomalies.length);
const maxDelay = flat.reduce((m,x)=> x.delay_minutes>m?x.delay_minutes:m, 0);
console.log("Retraso máximo:", maxDelay, "min");

console.log("\n=== ANOMALÍAS ===");
for (const a of anomalies) {
  const icon = a.status === "CANCELADO" ? "❌" : a.status === "RETRASO" ? "🚨" : a.status === "ADELANTO" ? "⏪" : "⚠️";
  const d = a.delay_minutes ? ` ${a.delay_minutes>0?"+":""}${a.delay_minutes} min` : "";
  console.log(`${icon} [${a.direction}] ${a.operator} ${a.train_number} → ${a.destination !== "Alicante-Terminal" ? a.destination : a.origin} | prog ${a.scheduled_time} → est ${a.estimated_time}${d} | vía ${a.platform} | ${a.status}${a.observation ? " · "+a.observation : ""}`);
}

console.log("\n=== MUESTRA NORMALIZADA (primeros 8) ===");
for (const x of flat.slice(0,8)) console.log(JSON.stringify(x));
