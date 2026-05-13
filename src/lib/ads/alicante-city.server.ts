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
    // Nombres en orden de aparición
    const names = [
      ...html.matchAll(
        /<h[1-4][^>]*>\s*(APARCAMIENTO[^<]+|PLAZA DE AMERICA[^<]*)<\/h/gi,
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
  altitudeM: number | null;
  velocityKmh: number | null;
  onGround: boolean;
  headingDeg: number | null;
  distanceKm: number | null;
  etaMin: number | null;
  approaching: boolean;
};

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
      return {
        callsign: String(s[1] ?? "").trim() || "—",
        country: String(s[2] ?? "").trim(),
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
    return { total: states.length, airborne, onGround, sample };
  } catch {
    return null;
  }
}
