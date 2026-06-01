import { createServerFn } from "@tanstack/react-start";

export type StopArrival = {
  line: string;
  destination: string;
  etaMin: number;
  lat: number | null;
  lng: number | null;
};

// Flujo real que usa el QR de Subus/Vectalia en Alicante.
// Paso 1: GET consulta.aspx?p=N  → recoge cookies de sesión.
// Paso 2: GET datos.aspx?p=N     → devuelve JSON con { nparada, parada, tiempos, ... }.
// `tiempos` es texto plano: "Linea 012 JORNET NAVARRO : 22 min. : 38.34561,-0.48123 : 05_727; ..."
const BASE = "http://www.subus.es/QR/Alicante";
const UA =
  "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36";

const TIEMPOS_RE =
  /Linea\s+(\d+[A-Za-z]?)\s+([^:]+?)\s*:\s*(\d+)\s*min\.?\s*:\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/gi;

function extractCookies(res: Response): string {
  // Cloudflare Workers: getSetCookie() devuelve array
  const anyHeaders = res.headers as unknown as { getSetCookie?: () => string[] };
  const list = anyHeaders.getSetCookie?.() ?? [];
  return list.map((c) => c.split(";")[0]).filter(Boolean).join("; ");
}

function parseTiempos(raw: string): StopArrival[] {
  const out: StopArrival[] = [];
  for (const m of raw.matchAll(TIEMPOS_RE)) {
    const lat = Number(m[4]);
    const lng = Number(m[5]);
    out.push({
      line: String(parseInt(m[1], 10)) + (m[1].match(/[A-Za-z]$/)?.[0] ?? ""),
      destination: m[2].trim(),
      etaMin: parseInt(m[3], 10),
      lat: Number.isFinite(lat) && lat !== 0 ? lat : null,
      lng: Number.isFinite(lng) && lng !== 0 ? lng : null,
    });
  }
  return out;
}

async function fetchStopFromSubus(stopCode: string): Promise<StopArrival[]> {
  // Paso 1: consulta.aspx → cookies de sesión
  const consultaUrl = `${BASE}/consulta.aspx?p=${encodeURIComponent(stopCode)}`;
  const r1 = await fetch(consultaUrl, {
    redirect: "follow",
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "es-ES,es;q=0.9",
    },
  });
  const cookie = extractCookies(r1);
  // Drenamos el cuerpo para no dejar conexiones colgando
  await r1.arrayBuffer().catch(() => null);

  // Paso 2: datos.aspx → JSON con tiempos
  const datosUrl = `${BASE}/datos.aspx?p=${encodeURIComponent(stopCode)}`;
  const r2 = await fetch(datosUrl, {
    redirect: "follow",
    headers: {
      "User-Agent": UA,
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "es-ES,es;q=0.9",
      Referer: consultaUrl,
      "X-Requested-With": "XMLHttpRequest",
      "X-Vectalia-App": "qr-alicante",
      ...(cookie ? { Cookie: cookie } : {}),
    },
  });
  if (!r2.ok) return [];

  const text = await r2.text();
  let tiempos = "";
  try {
    const json = JSON.parse(text) as { tiempos?: string };
    tiempos = json.tiempos ?? "";
  } catch {
    // por si devuelve texto plano
    tiempos = text;
  }
  return parseTiempos(tiempos);
}

export const getStopRealtime = createServerFn({ method: "POST" })
  .inputValidator((data: { stopCode: string; lines?: string[] }) => {
    const code = String(data?.stopCode ?? "").trim();
    if (!/^\d{3,5}$/.test(code)) throw new Error("invalid stopCode");
    return { stopCode: code };
  })
  .handler(async ({ data }) => {
    let arrivals: StopArrival[] = [];
    try {
      arrivals = await fetchStopFromSubus(data.stopCode);
    } catch {
      arrivals = [];
    }

    // dedup + orden
    const seen = new Set<string>();
    const unique = arrivals.filter((a) => {
      const k = `${a.line}|${a.etaMin}|${a.destination}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    unique.sort((a, b) => a.etaMin - b.etaMin);

    return { arrivals: unique, fetchedAt: new Date().toISOString() };
  });
