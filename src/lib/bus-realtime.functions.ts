import { createServerFn } from "@tanstack/react-start";

export type StopArrival = {
  line: string; // "12"
  destination: string; // "PUERTA DEL MAR"
  etaMin: number; // minutes
  lat: number | null;
  lng: number | null;
};

const URL = "https://qr.vectalia.es/Alicante/lib/request.aspx";

// Format from server (intended to be JS-eval'd in their page):
//   NOTHING\n" +
//   "Linea 012 PUERTA DEL MAR: 9 min.: 2: 38.351, -0.508: nocab:\n" +
//   "Linea 005 RAMBLA : 1 min.: 2: 38.353, -0.500: nocab:\n" +
const ARRIVAL_RE =
  /Linea\s+(\d+)\s+([^:]+?)\s*:\s*(\d+)\s*min\.?\s*:\s*\d+\s*:\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*:/gi;

function parseArrivals(raw: string): StopArrival[] {
  const out: StopArrival[] = [];
  for (const m of raw.matchAll(ARRIVAL_RE)) {
    const lat = Number(m[4]);
    const lng = Number(m[5]);
    out.push({
      line: String(parseInt(m[1], 10)), // strip leading zeros: "012" -> "12"
      destination: m[2].trim(),
      etaMin: parseInt(m[3], 10),
      lat: Number.isFinite(lat) && lat !== 0 ? lat : null,
      lng: Number.isFinite(lng) && lng !== 0 ? lng : null,
    });
  }
  return out;
}

async function fetchOne(stop: string, line: string): Promise<string> {
  const res = await fetch(`${URL}?p=${encodeURIComponent(stop)}&l=${encodeURIComponent(line)}`, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Referer: "https://qr.vectalia.es/Alicante/mapa.aspx",
      "X-Requested-With": "XMLHttpRequest",
    },
  });
  if (!res.ok) return "";
  return await res.text();
}

export const getStopRealtime = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { stopCode: string; lines?: string[] }) => {
      const code = String(data?.stopCode ?? "").trim();
      if (!/^\d{3,5}$/.test(code)) throw new Error("invalid stopCode");
      const lines = Array.isArray(data?.lines)
        ? data.lines.filter((l) => /^\d{1,3}$/.test(String(l))).map(String)
        : [];
      return { stopCode: code, lines };
    },
  )
  .handler(async ({ data }) => {
    const { stopCode, lines } = data;
    const arrivals: StopArrival[] = [];

    // Strategy: try unified call first (works for many stops).
    try {
      const raw = await fetchOne(stopCode, "");
      const parsed = parseArrivals(raw);
      if (parsed.length > 0) arrivals.push(...parsed);
    } catch {
      /* ignore */
    }

    // If nothing came back and we know the lines, fan out.
    if (arrivals.length === 0 && lines.length > 0) {
      const padded = Array.from(new Set(lines.map((l) => l.padStart(3, "0"))));
      const results = await Promise.allSettled(padded.map((l) => fetchOne(stopCode, l)));
      for (const r of results) {
        if (r.status === "fulfilled") arrivals.push(...parseArrivals(r.value));
      }
    }

    // De-dup (line + etaMin) and sort by ETA
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
