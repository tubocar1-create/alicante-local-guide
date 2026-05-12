import { createFileRoute } from "@tanstack/react-router";

const VECTALIA_RT_URL = "https://qr.vectalia.es/Alicante/lib/request.aspx";
const ARRIVAL_RE = /Linea\s+(\d+)\s+([^:]+?)\s*:\s*(\d+)\s*min/gi;

async function fetchEta(stopCode: string, lineCode: string): Promise<number | null> {
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
    if (!r.ok) return null;
    const txt = await r.text();
    const matches = [...txt.matchAll(ARRIVAL_RE)];
    let best: number | null = null;
    for (const m of matches) {
      const ln = String(parseInt(m[1], 10));
      if (ln !== lineCode) continue;
      const min = parseInt(m[3], 10);
      if (Number.isFinite(min) && (best == null || min < best)) best = min;
    }
    return best;
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/public/bus-eta")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const stop = (url.searchParams.get("stop") || "").trim();
        const line = (url.searchParams.get("line") || "").trim();
        if (!/^\d{1,6}$/.test(stop) || !/^\d{1,3}$/.test(line)) {
          return new Response(JSON.stringify({ error: "bad params" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        const etaMin = await fetchEta(stop, line);
        return new Response(JSON.stringify({ etaMin, fetchedAt: Date.now() }), {
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
