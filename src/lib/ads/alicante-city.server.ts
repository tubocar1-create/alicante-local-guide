// Datos en vivo del Ayuntamiento de Alicante (movilidad.alicante.es).
// Endpoints descubiertos:
//   GET /asmpois  → JSON con virtual_sections (tráfico), incidencias, eventos
//   GET /parkings → HTML con ocupación en vivo de parkings públicos
// Tráfico aéreo en vivo cerca del aeropuerto ALC/LEAL: OpenSky Network.

const BASE = "https://movilidad.alicante.es";
const UA = "Mozilla/5.0 (compatible; AlicanteFriend/1.0)";

export type ParkingStatus = {
  name: string;
  libres: number;
  total: number;
  ocupacionPct: number;
};

export type TrafficSummary = {
  fluido: number; // tramos con traffic_level 1
  denso: number; //   "      "      "       2
  congestionado: number; // " "      "       3
  total: number;
  incidencias: string[]; // títulos de incidencias activas
  eventos: string[]; // títulos de eventos de tráfico
};

export async function fetchAlicanteParkings(): Promise<ParkingStatus[] | null> {
  try {
    const r = await fetch(`${BASE}/parkings`, {
      headers: { "User-Agent": UA, Accept: "text/html" },
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return null;
    const html = await r.text();
    const libres = [...html.matchAll(/(\d+)\s*plazas?\s*libres?/gi)].map((m) =>
      Number(m[1]),
    );
    const ocup = [...html.matchAll(/Ocupaci[óo]n\s*([\d.,]+)\s*%/gi)].map((m) =>
      Number(m[1].replace(",", ".")),
    );
    const total = [...html.matchAll(/Disponibilidad de\s*(\d+)/gi)].map((m) =>
      Number(m[1]),
    );
    // Nombres en orden de aparición (vienen en <p class="title-parking">)
    const names = [
      ...html.matchAll(
        /class="title-parking[^"]*"[^>]*>\s*([^<]+?)\s*</gi,
      ),
    ].map((m) =>
      m[1]
        .trim()
        .replace(/^APARCAMIENTO\s+/i, "")
        .replace(/\s+/g, " "),
    );
    const n = Math.min(libres.length, ocup.length, total.length);
    if (n === 0) return null;
    const out: ParkingStatus[] = [];
    for (let i = 0; i < n; i++) {
      out.push({
        name: names[i] ?? `Parking ${i + 1}`,
        libres: libres[i],
        total: total[i],
        ocupacionPct: ocup[i],
      });
    }
    return out;
  } catch {
    return null;
  }
}

export async function fetchAlicanteTraffic(): Promise<TrafficSummary | null> {
  try {
    const r = await fetch(`${BASE}/asmpois`, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return null;
    const list: Array<{
      content_type: string;
      title?: string;
      traffic_level?: string;
    }> = await r.json();
    let fluido = 0,
      denso = 0,
      cong = 0,
      total = 0;
    const incidencias: string[] = [];
    const eventos: string[] = [];
    for (const x of list) {
      if (x.content_type === "virtual_section") {
        const lvl = String(x.traffic_level ?? "");
        if (lvl === "1") fluido++;
        else if (lvl === "2") denso++;
        else if (lvl === "3") cong++;
        if (lvl !== "-1" && lvl !== "0") total++;
      } else if (x.content_type === "incidence" && x.title) {
        incidencias.push(x.title);
      } else if (x.content_type === "events" && x.title) {
        eventos.push(x.title);
      }
    }
    return { fluido, denso, congestionado: cong, total, incidencias, eventos };
  } catch {
    return null;
  }
}

export type AirQualityStation = {
  address: string;
  status: "verde" | "amarillo" | "naranja" | "rojo" | "morado" | "desconocido";
};

export async function fetchAlicanteAirQuality(): Promise<AirQualityStation[] | null> {
  try {
    const r = await fetch(`${BASE}/asmpois`, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return null;
    const list: Array<{
      content_type: string;
      address?: string;
      icono?: string;
    }> = await r.json();
    const out: AirQualityStation[] = [];
    for (const x of list) {
      if (x.content_type !== "air_qualities") continue;
      const m = /medioambiental\/(verde|amarillo|naranja|rojo|morado)/i.exec(
        String(x.icono ?? ""),
      );
      out.push({
        address: (x.address ?? "Estación").replace(/\s+/g, " ").trim(),
        status: (m?.[1]?.toLowerCase() as AirQualityStation["status"]) ?? "desconocido",
      });
    }
    return out.length ? out : null;
  } catch {
    return null;
  }
}

export type CulturalEvent = {
  title: string;
  when: string;
  excerpt: string;
};

// Scrape agenda cultural del Ayto. de Alicante (alicante.es/es/agenda).
export async function fetchAlicanteAgenda(): Promise<CulturalEvent[] | null> {
  try {
    const r = await fetch("https://www.alicante.es/es/agenda", {
      headers: { "User-Agent": UA, Accept: "text/html" },
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return null;
    const html = await r.text();
    // Cada item de agenda suele venir como <article>...<h2>Title</h2>...<p>excerpt</p>...De DD MMM YYYY hasta DD MMM YYYY
    const articles = [...html.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/gi)];
    const out: CulturalEvent[] = [];
    for (const a of articles) {
      const block = a[1];
      const titleM = /<h[23][^>]*>\s*(?:<a[^>]*>)?([^<]{4,180})/i.exec(block);
      if (!titleM) continue;
      const title = titleM[1].replace(/\s+/g, " ").trim();
      const text = block
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, " ")
        .trim();
      const whenM = /(De\s+\d{1,2}\s+\w+\s+\d{4}\s+(?:hasta|al)\s+\d{1,2}\s+\w+\s+\d{4}[^.,]*)/i.exec(text);
      const when = whenM?.[1]?.trim() ?? "";
      const excerpt = text
        .replace(title, "")
        .replace(when, "")
        .trim()
        .slice(0, 240);
      if (title && excerpt.length > 20) {
        out.push({ title, when, excerpt });
      }
      if (out.length >= 12) break;
    }
    return out.length ? out : null;
  } catch {
    return null;
  }
}


// === Tráfico aéreo en vivo: OpenSky Network ===
// Aeropuerto Alicante-Elche (ALC / LEAL): 38.2822, -0.5582.
// Bounding box ~35 km alrededor.
export type FlightState = {
  callsign: string;
  country: string;
  airline: string | null;
  flightNumber: string | null;
  originCity: string | null;
  originIata: string | null;
  altitudeM: number | null;
  velocityKmh: number | null;
  onGround: boolean;
  headingDeg: number | null;
  distanceKm: number | null;
  etaMin: number | null;
  approaching: boolean;
};

// Mapeo mínimo de prefijos ICAO de aerolínea → nombre comercial.
// Cubre las aerolíneas más comunes en ALC.
const AIRLINE_ICAO: Record<string, string> = {
  RYR: "Ryanair",
  VLG: "Vueling",
  IBE: "Iberia",
  IBS: "Iberia Express",
  ANE: "Air Nostrum",
  AEA: "Air Europa",
  EZY: "easyJet",
  EJU: "easyJet Europe",
  TRA: "Transavia",
  TFL: "TUI fly",
  TOM: "TUI Airways",
  JAF: "TUI fly Belgium",
  WZZ: "Wizz Air",
  WUK: "Wizz Air UK",
  KLM: "KLM",
  AFR: "Air France",
  DLH: "Lufthansa",
  EWG: "Eurowings",
  BAW: "British Airways",
  BEE: "Jet2",
  EXS: "Jet2",
  SAS: "SAS",
  NAX: "Norwegian",
  NOZ: "Norwegian",
  FIN: "Finnair",
  SWR: "SWISS",
  AUA: "Austrian",
  THY: "Turkish Airlines",
  RAM: "Royal Air Maroc",
  MSR: "EgyptAir",
};

function parseCallsign(callsign: string): {
  airline: string | null;
  flightNumber: string | null;
} {
  const cs = callsign.replace(/\s+/g, "").toUpperCase();
  const m = /^([A-Z]{3})(\d+[A-Z]?)$/.exec(cs);
  if (!m) return { airline: null, flightNumber: null };
  const icao = m[1];
  const num = m[2];
  const airline = AIRLINE_ICAO[icao] ?? null;
  return { airline, flightNumber: airline ? `${icao}${num}` : null };
}

type RouteInfo = { originCity: string | null; originIata: string | null };

async function fetchRoute(callsign: string): Promise<RouteInfo> {
  try {
    const cs = callsign.replace(/\s+/g, "").toUpperCase();
    if (!cs) return { originCity: null, originIata: null };
    const r = await fetch(`https://api.adsbdb.com/v0/callsign/${cs}`, {
      headers: { Accept: "application/json", "User-Agent": UA },
      signal: AbortSignal.timeout(3500),
    });
    if (!r.ok) return { originCity: null, originIata: null };
    const j = (await r.json()) as {
      response?: { flightroute?: { origin?: { municipality?: string; iata_code?: string; name?: string } } };
    };
    const o = j?.response?.flightroute?.origin;
    if (!o) return { originCity: null, originIata: null };
    return {
      originCity: (o.municipality || o.name || "").trim() || null,
      originIata: (o.iata_code || "").trim() || null,
    };
  } catch {
    return { originCity: null, originIata: null };
  }
}

export type AirTraffic = {
  total: number;
  airborne: number;
  onGround: number;
  sample: FlightState[];
};

const ALC_AIRPORT = { lat: 38.2822, lon: -0.5582 };

export async function fetchAlicanteAirTraffic(): Promise<AirTraffic | null> {
  try {
    const url =
      "https://opensky-network.org/api/states/all" +
      "?lamin=38.00&lomin=-0.95&lamax=38.55&lomax=-0.20";
    const r = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(7000),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { states?: unknown[][] | null };
    const raw = j.states ?? [];
    if (!raw.length) return { total: 0, airborne: 0, onGround: 0, sample: [] };
    type WithDist = FlightState & { _d: number };
    const states: WithDist[] = raw.map((s) => {
      const lat = Number(s[6]);
      const lon = Number(s[5]);
      const validPos = Number.isFinite(lat) && Number.isFinite(lon);
      const dx = validPos ? (lon - ALC_AIRPORT.lon) * Math.cos((lat * Math.PI) / 180) : 0;
      const dy = validPos ? lat - ALC_AIRPORT.lat : 0;
      const distDeg = validPos ? Math.sqrt(dx * dx + dy * dy) : Infinity;
      const distanceKm = validPos ? Math.round(distDeg * 111) : null;
      const onGround = Boolean(s[8]);
      const velocityKmh = s[9] != null ? Math.round(Number(s[9]) * 3.6) : null;
      const headingDeg = s[10] != null ? Math.round(Number(s[10])) : null;
      let approaching = false;
      if (validPos && headingDeg != null && !onGround) {
        const bearingToALC = (Math.atan2(-dx, -dy) * 180) / Math.PI;
        const norm = (bearingToALC + 360) % 360;
        const diff = Math.abs(((headingDeg - norm + 540) % 360) - 180);
        approaching = diff < 45;
      }
      const etaMin =
        approaching && distanceKm != null && velocityKmh && velocityKmh > 100
          ? Math.max(1, Math.round((distanceKm / velocityKmh) * 60))
          : null;
      const callsign = String(s[1] ?? "").trim() || "—";
      const { airline, flightNumber } = parseCallsign(callsign);
      return {
        callsign,
        country: String(s[2] ?? "").trim(),
        airline,
        flightNumber,
        originCity: null,
        originIata: null,
        altitudeM: s[7] != null ? Math.round(Number(s[7])) : null,
        velocityKmh,
        onGround,
        headingDeg,
        distanceKm,
        etaMin,
        approaching,
        _d: validPos ? dx * dx + dy * dy : Infinity,
      };
    });
    const airborne = states.filter((s) => !s.onGround).length;
    const onGround = states.length - airborne;
    const sample: FlightState[] = [...states]
      .sort((a, b) => {
        if (a.approaching !== b.approaching) return a.approaching ? -1 : 1;
        return a._d - b._d;
      })
      .slice(0, 6)
      .map(({ _d, ...rest }) => rest);
    // Enriquecer con procedencia (origen) los vuelos que se aproximan.
    const toEnrich = sample.filter((f) => f.approaching && f.callsign !== "—").slice(0, 4);
    const routes = await Promise.all(toEnrich.map((f) => fetchRoute(f.callsign)));
    toEnrich.forEach((f, i) => {
      f.originCity = routes[i].originCity;
      f.originIata = routes[i].originIata;
    });
    return { total: states.length, airborne, onGround, sample };
  } catch {
    return null;
  }
}

// === Renfe Cercanías: próximas llegadas y salidas en Alicante-Terminal ===
// API real usada por el panel oficial (horarios.renfe.com).
// Núcleo 41 = Cercanías Murcia/Alicante.
// Estaciones clave:
//   60911 Alicante-Terminal · 60913 Sant Vicent Centre · 60914 Universidad
//   61200 Murcia del Carmen · 62103 Elx-Parc · 62002 Orihuela
const RENFE_ALC = "60911";
const RENFE_PAIRS: Array<{ other: string; otherName: string; line: string }> = [
  { other: "61200", otherName: "Murcia", line: "C-1" },
  { other: "62002", otherName: "Orihuela", line: "C-1" },
  { other: "60913", otherName: "Sant Vicent", line: "C-3" },
];

export type RenfeTrip = {
  direction: "llegada" | "salida";
  line: string;
  trainCode: string;
  origin: string;
  destination: string;
  scheduledTime: string; // HH:MM
  minutesFromNow: number;
};

async function fetchRenfeOD(
  origen: string,
  destino: string,
  fchaViaje: string,
): Promise<Array<{ linea: string; cdgoTren: string; horaSalida: string; horaLlegada: string }> | null> {
  try {
    const r = await fetch("https://horarios.renfe.com/cer/HorariosServlet", {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": UA, Accept: "application/json" },
      body: JSON.stringify({
        nucleo: "41",
        origen,
        destino,
        fchaViaje,
        validaReglaNegocio: true,
        tiempoReal: false,
        servicioHorarios: "VTI",
        horaViajeOrigen: "00",
        horaViajeLlegada: "26",
        accesibilidadTrenes: false,
      }),
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { horario?: Array<{ linea: string; cdgoTren: string; horaSalida: string; horaLlegada: string }> };
    return j.horario ?? [];
  } catch {
    return null;
  }
}

function nowInMadrid(): { hhmm: string; yyyymmdd: string; minutes: number } {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value])) as Record<string, string>;
  const yyyymmdd = `${parts.year}${parts.month}${parts.day}`;
  const hhmm = `${parts.hour}:${parts.minute}`;
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  return { hhmm, yyyymmdd, minutes };
}

function hhmmToMin(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
}

export async function fetchRenfeAlicanteSchedule(): Promise<RenfeTrip[] | null> {
  const { yyyymmdd, minutes } = nowInMadrid();
  const requests = RENFE_PAIRS.flatMap((p) => [
    fetchRenfeOD(RENFE_ALC, p.other, yyyymmdd).then((horarios) => ({ p, horarios, dir: "salida" as const })),
    fetchRenfeOD(p.other, RENFE_ALC, yyyymmdd).then((horarios) => ({ p, horarios, dir: "llegada" as const })),
  ]);
  const results = await Promise.allSettled(requests);
  const trips: RenfeTrip[] = [];
  for (const r of results) {
    if (r.status !== "fulfilled" || !r.value.horarios) continue;
    const { p, horarios, dir } = r.value;
    for (const h of horarios) {
      const sched = dir === "salida" ? h.horaSalida : h.horaLlegada;
      const min = hhmmToMin(sched) - minutes;
      if (min < -2 || min > 180) continue; // próxima ventana 3h
      trips.push({
        direction: dir,
        line: h.linea || p.line,
        trainCode: h.cdgoTren,
        origin: dir === "salida" ? "Alicante-Terminal" : p.otherName,
        destination: dir === "salida" ? p.otherName : "Alicante-Terminal",
        scheduledTime: sched,
        minutesFromNow: min,
      });
    }
  }
  if (!trips.length) return null;
  // Dedup por trainCode+direction (un mismo tren puede aparecer en varias O-D)
  const seen = new Set<string>();
  const unique = trips.filter((t) => {
    const k = `${t.direction}-${t.trainCode}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  unique.sort((a, b) => a.minutesFromNow - b.minutesFromNow);
  return unique.slice(0, 10);
}

// ─────────────────────────────────────────────────────────────────
// AENA — Cancelaciones del día (scraping del endpoint JSON oculto)
// ─────────────────────────────────────────────────────────────────

export type AenaDisruption = {
  type: "salida" | "llegada";
  status: "cancelado" | "retrasado";
  airline: string;
  flightNumber: string;
  otherCity: string;
  otherIata: string;
  scheduledTime: string; // HH:MM
  estimatedTime: string; // HH:MM (vacío si no hay)
  delayMin: number; // minutos de retraso (0 si cancelado o sin estimada)
  date: string; // dd/mm/yyyy
};

async function fetchAenaFlights(
  flightType: "S" | "L",
): Promise<Array<Record<string, string>> | null> {
  try {
    const r = await fetch(
      `https://www.aena.es/sites/Satellite?pagename=AENA_ConsultarVuelos&airport=ALC&flightType=${flightType}&dosDias=si`,
      {
        method: "POST",
        headers: {
          "User-Agent": UA,
          Accept: "application/json",
          Referer: "https://www.aena.es/es/infovuelos.html",
          "Content-Length": "0",
        },
        signal: AbortSignal.timeout(7000),
      },
    );
    if (!r.ok) return null;
    return (await r.json()) as Array<Record<string, string>>;
  } catch {
    return null;
  }
}

function diffMinutes(progHHMMSS: string, estHHMMSS: string): number {
  if (!progHHMMSS || !estHHMMSS) return 0;
  const [ph, pm] = progHHMMSS.split(":").map(Number);
  const [eh, em] = estHHMMSS.split(":").map(Number);
  if ([ph, pm, eh, em].some((n) => Number.isNaN(n))) return 0;
  let d = eh * 60 + em - (ph * 60 + pm);
  // si cruza medianoche
  if (d < -12 * 60) d += 24 * 60;
  if (d > 12 * 60) d -= 24 * 60;
  return d;
}

/**
 * Devuelve cancelaciones (CAN) y retrasos significativos (RET con >=15 min,
 * o estado RET con cualquier desviación) en ALC. Máx 10. Si Aena falla,
 * devuelve null y el banner queda en suspenso.
 */
export async function fetchAenaDisruptions(): Promise<AenaDisruption[] | null> {
  const [salidas, llegadas] = await Promise.all([
    fetchAenaFlights("S"),
    fetchAenaFlights("L"),
  ]);
  if (!salidas && !llegadas) return null;
  const all: AenaDisruption[] = [];
  const push = (rows: Array<Record<string, string>> | null, type: "salida" | "llegada") => {
    if (!rows) return;
    for (const f of rows) {
      const estado = (f.estado || "").toUpperCase();
      const iataCia = (f.iataCompania || "").trim();
      const num = (f.numVuelo || "").trim();
      const horaProg = (f.horaProgramada || "").slice(0, 5);
      const horaEst = (f.horaEstimada || "").slice(0, 5);
      const delay = diffMinutes(f.horaProgramada || "", f.horaEstimada || "");

      let status: "cancelado" | "retrasado" | null = null;
      if (estado === "CAN") status = "cancelado";
      else if (estado === "RET" || delay >= 15) status = "retrasado";
      if (!status) continue;

      all.push({
        type,
        status,
        airline: (f.nombreCompania || iataCia || "").trim() || "—",
        flightNumber: iataCia && num ? `${iataCia}${num}` : num || "—",
        otherCity: (f.ciudadIataOtro || "").trim() || (f.iataOtro || "").trim() || "—",
        otherIata: (f.iataOtro || "").trim() || "",
        scheduledTime: horaProg,
        estimatedTime: status === "cancelado" ? "" : horaEst,
        delayMin: status === "cancelado" ? 0 : Math.max(0, delay),
        date: (f.fecha || "").trim(),
      });
    }
  };
  push(salidas, "salida");
  push(llegadas, "llegada");
  if (!all.length) return [];
  // Cancelados primero, luego por mayor retraso, luego por hora
  const today = new Date().toLocaleDateString("es-ES", { timeZone: "Europe/Madrid" });
  all.sort((a, b) => {
    if (a.status !== b.status) return a.status === "cancelado" ? -1 : 1;
    const ta = a.date === today ? 0 : 1;
    const tb = b.date === today ? 0 : 1;
    if (ta !== tb) return ta - tb;
    if (a.status === "retrasado") return b.delayMin - a.delayMin;
    return a.scheduledTime.localeCompare(b.scheduledTime);
  });
  return all.slice(0, 10);
}

// ─────────────────────────────────────────────────────────────────
// AENA — Salidas programadas de MAÑANA en ALC (Infovuelos, dosDias=si)
// ─────────────────────────────────────────────────────────────────

export type AenaScheduledFlight = {
  flightNumber: string;
  airline: string;
  destinationCity: string;
  destinationIata: string;
  scheduledTime: string; // HH:MM
  date: string; // dd/mm/yyyy
};

function tomorrowMadridDDMMYYYY(): string {
  const now = new Date();
  // Hoy en Madrid → sumamos 1 día sobre el calendario Madrid
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const d = Number(parts.find((p) => p.type === "day")?.value);
  // Construimos como UTC para evitar desplazamientos de TZ y sumamos 1 día
  const t = new Date(Date.UTC(y, m - 1, d));
  t.setUTCDate(t.getUTCDate() + 1);
  const dd = String(t.getUTCDate()).padStart(2, "0");
  const mm = String(t.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = t.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Devuelve hasta 12 salidas PROGRAMADAS de mañana (Europe/Madrid) en ALC,
 * mezcladas aleatoriamente. Si Aena falla o no hay vuelos → null/[] y el
 * banner se suspende.
 */
export async function fetchAenaTomorrowDepartures(): Promise<AenaScheduledFlight[] | null> {
  const rows = await fetchAenaFlights("S");
  if (!rows) return null;
  const target = tomorrowMadridDDMMYYYY();
  const out: AenaScheduledFlight[] = [];
  for (const f of rows) {
    const fecha = (f.fecha || "").trim();
    if (fecha !== target) continue;
    const estado = (f.estado || "").toUpperCase();
    if (estado === "CAN") continue; // saltamos cancelados de mañana
    const iataCia = (f.iataCompania || "").trim();
    const num = (f.numVuelo || "").trim();
    const horaProg = (f.horaProgramada || "").slice(0, 5);
    if (!horaProg) continue;
    out.push({
      flightNumber: iataCia && num ? `${iataCia}${num}` : num || "—",
      airline: (f.nombreCompania || iataCia || "").trim() || "—",
      destinationCity:
        (f.ciudadIataOtro || "").trim() || (f.iataOtro || "").trim() || "—",
      destinationIata: (f.iataOtro || "").trim() || "",
      scheduledTime: horaProg,
      date: fecha,
    });
  }
  if (!out.length) return [];
  // Shuffle Fisher-Yates
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.slice(0, 12);
}

// ─────────────────────────────────────────────────────────────────
// AliBus — Próximas llegadas de buses urbanos en paradas céntricas
// (Vectalia/Masatusa). API pública usada por alibus.es.
// ─────────────────────────────────────────────────────────────────

export type BusArrival = {
  stop: string;
  line: string;
  destination: string;
  minutes: number;
};

const ALIBUS_API = "https://alibus-buses.eduardogr.workers.dev/";
const ALIBUS_STOPS: Array<{ code: string; label: string }> = [
  { code: "4046", label: "Luceros" },
  { code: "3129", label: "Mercado" },
  { code: "4009", label: "Puerta del Mar" },
  { code: "4118", label: "Estación-Maisonnave" },
  { code: "2606", label: "Rambla" },
];

async function fetchAlibusStop(code: string, label: string): Promise<BusArrival[]> {
  try {
    const url = `${ALIBUS_API}?stop=${encodeURIComponent(code)}&municipio=alicante`;
    const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) return [];
    const j = (await r.json()) as { buses?: Array<{ line?: unknown; destination?: unknown; minutes?: unknown; seconds?: unknown }> };
    const buses = Array.isArray(j.buses) ? j.buses : [];
    return buses
      .map((b) => {
        const line = b.line != null ? String(b.line).trim() : "";
        const destination = b.destination != null ? String(b.destination).trim() : "";
        const mins = Number(b.minutes);
        const secs = Number(b.seconds);
        const minutes = Number.isFinite(mins) ? mins : Number.isFinite(secs) ? Math.round(secs / 60) : NaN;
        if (!line || !Number.isFinite(minutes)) return null;
        return { stop: label, line, destination, minutes } as BusArrival;
      })
      .filter((x): x is BusArrival => x !== null);
  } catch {
    return [];
  }
}

export async function fetchAlibusAlicante(): Promise<BusArrival[] | null> {
  const results = await Promise.allSettled(
    ALIBUS_STOPS.map((s) => fetchAlibusStop(s.code, s.label)),
  );
  const all: BusArrival[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") all.push(...r.value);
  }
  if (!all.length) return null;
  // Ordenar por minutos ascendentes y tomar las 10 más próximas
  all.sort((a, b) => a.minutes - b.minutes);
  return all.slice(0, 10);
}

