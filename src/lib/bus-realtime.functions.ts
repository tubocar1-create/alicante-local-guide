import { createServerFn } from "@tanstack/react-start";

export type StopArrival = {
  line: string;
  destination: string;
  etaMin: number;
  lat: number | null;
  lng: number | null;
};

const VECTALIA_URL = "https://qr.vectalia.es/Alicante/lib/request.aspx";
const ARRIVAL_RE =
  /Linea\s+(\d+)\s+([^:]+?)\s*:\s*(\d+)\s*min\.?\s*:\s*\d+\s*:\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*:/gi;
const VECTALIA_LINE_CODES: Record<string, string> = {
  "14": "084",
};

function toVectaliaLineCode(line: string): string {
  return VECTALIA_LINE_CODES[line] ?? line.padStart(3, "0");
}

function parseArrivals(raw: string): StopArrival[] {
  const out: StopArrival[] = [];
  for (const m of raw.matchAll(ARRIVAL_RE)) {
    const lat = Number(m[4]);
    const lng = Number(m[5]);
    out.push({
      line: String(parseInt(m[1], 10)),
      destination: m[2].trim(),
      etaMin: parseInt(m[3], 10),
      lat: Number.isFinite(lat) && lat !== 0 ? lat : null,
      lng: Number.isFinite(lng) && lng !== 0 ? lng : null,
    });
  }
  return out;
}

function parseArrivalsForRequestedLine(raw: string, requestedLine: string): StopArrival[] {
  return parseArrivals(raw).map((arrival) => ({ ...arrival, line: requestedLine }));
}

// Vectalia parece bloquear/filtrar el pool de IPs de Cloudflare Workers
// (devuelve cuerpo vacío en producción). Para evitarlo, en el servidor
// pedimos a la edge function de Supabase que haga el fetch (Deno, otro
// pool de IPs). Si esa llamada falla, caemos al fetch directo.

async function fetchViaEdge(stop: string, line: string): Promise<string> {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !anonKey) return "";
  try {
    const r = await fetch(
      `${supabaseUrl}/functions/v1/bus-eta-raw?stop=${encodeURIComponent(stop)}&line=${encodeURIComponent(line)}`,
      { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } },
    );
    if (!r.ok) return "";
    const j = (await r.json()) as { raw?: string };
    return j.raw ?? "";
  } catch {
    return "";
  }
}

async function fetchViaScrapingBee(stop: string, line: string): Promise<string> {
  const key = process.env.SCRAPINGBEE_API_KEY;
  if (!key) return "";
  try {
    const lineParam = line ? toVectaliaLineCode(line) : "";
    const target = `${VECTALIA_URL}?p=${encodeURIComponent(stop)}&l=${encodeURIComponent(lineParam)}`;
    const sb = new URL("https://app.scrapingbee.com/api/v1/");
    sb.searchParams.set("api_key", key);
    sb.searchParams.set("url", target);
    sb.searchParams.set("render_js", "false");
    const res = await fetch(sb.toString(), { headers: { Accept: "*/*" } });
    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  }
}

async function fetchDirect(stop: string, line: string): Promise<string> {
  try {
    const lineParam = line ? toVectaliaLineCode(line) : "";
    const res = await fetch(
      `${VECTALIA_URL}?p=${encodeURIComponent(stop)}&l=${encodeURIComponent(lineParam)}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
          Referer: "https://qr.vectalia.es/Alicante/mapa.aspx",
          "X-Requested-With": "XMLHttpRequest",
          Accept: "*/*",
        },
      },
    );
    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  }
}

async function fetchOne(stop: string, line: string): Promise<string> {
  const viaSB = await fetchViaScrapingBee(stop, line);
  if (viaSB) return viaSB;
  const viaEdge = await fetchViaEdge(stop, line);
  if (viaEdge) return viaEdge;
  return fetchDirect(stop, line);
}

export const getStopRealtime = createServerFn({ method: "POST" })
  .inputValidator((data: { stopCode: string; lines?: string[] }) => {
    const code = String(data?.stopCode ?? "").trim();
    if (!/^\d{3,5}$/.test(code)) throw new Error("invalid stopCode");
    const lines = Array.isArray(data?.lines)
      ? data.lines.filter((l) => /^\d{1,3}[A-Za-z]?$/.test(String(l))).map(String)
      : [];
    return { stopCode: code, lines };
  })
  .handler(async ({ data }) => {
    const { stopCode, lines } = data;
    const arrivals: StopArrival[] = [];

    try {
      const raw = await fetchOne(stopCode, "");
      const parsed = parseArrivals(raw);
      if (parsed.length > 0) arrivals.push(...parsed);
    } catch {
      /* ignore */
    }

    if (arrivals.length === 0 && lines.length > 0) {
      const requestedLines = Array.from(new Set(lines));
      const results = await Promise.allSettled(requestedLines.map((l) => fetchOne(stopCode, l)));
      for (let i = 0; i < results.length; i += 1) {
        const r = results[i];
        if (r.status === "fulfilled") arrivals.push(...parseArrivalsForRequestedLine(r.value, requestedLines[i]));
      }
    }

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
