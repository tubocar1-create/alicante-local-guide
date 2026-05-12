import { createFileRoute } from "@tanstack/react-router";

const VECTALIA_RT_URL = "https://qr.vectalia.es/Alicante/lib/request.aspx";
const ARRIVAL_RE = /Linea\s+(\d+)\s+([^:]+?)\s*:\s*(\d+)\s*min/gi;

async function fetchEtas(stopCode: string, lineCode: string): Promise<number[]> {
  try {
    const padded = lineCode.padStart(3, "0");
    const r = await fetch(
      `${VECTALIA_RT_URL}?p=${encodeURIComponent(stopCode)}&l=${encodeURIComponent(padded)}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
          Referer: "https://qr.vectalia.es/Alicante/mapa.aspx",
          "X-Requested-With": "XMLHttpRequest",
        },
      },
    );
    if (!r.ok) return [];
    const txt = await r.text();
    const matches = [...txt.matchAll(ARRIVAL_RE)];
    const mins: number[] = [];
    for (const m of matches) {
      const ln = String(parseInt(m[1], 10));
      if (ln !== lineCode) continue;
      const min = parseInt(m[3], 10);
      if (Number.isFinite(min)) mins.push(min);
    }
    return mins.sort((a, b) => a - b);
  } catch {
    return [];
  }
}

export const Route = createFileRoute("/api/public/bus-eta")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const stop = (url.searchParams.get("stop") || "").trim();
        const line = (url.searchParams.get("line") || "").trim();
        const indexRaw = (url.searchParams.get("index") || "0").trim();
        const minRaw = (url.searchParams.get("min") || "").trim();
        const index = Math.max(0, Math.min(5, parseInt(indexRaw, 10) || 0));
        const minThreshold = minRaw ? parseInt(minRaw, 10) : null;
        if (!/^\d{1,6}$/.test(stop) || !/^\d{1,3}$/.test(line)) {
          return new Response(JSON.stringify({ error: "bad params" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        const etas = await fetchEtas(stop, line);
        let etaMin: number | null = null;
        if (etas.length > 0) {
          if (Number.isFinite(minThreshold) && minThreshold != null) {
            const next = etas.find((m) => m >= minThreshold!);
            etaMin = next ?? etas[etas.length - 1];
          } else {
            etaMin = etas[Math.min(index, etas.length - 1)];
          }
        }
        return new Response(JSON.stringify({ etaMin, all: etas, fetchedAt: Date.now() }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
