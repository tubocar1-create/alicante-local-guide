// Datos en vivo del Ayuntamiento de Alicante (movilidad.alicante.es).
// Endpoints descubiertos:
//   GET /asmpois  → JSON con virtual_sections (tráfico), incidencias, eventos
//   GET /parkings → HTML con ocupación en vivo de parkings públicos

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
