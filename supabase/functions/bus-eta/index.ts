// Proxy a tiempo real de Vectalia (Alicante).
// Algunas IPs de Cloudflare Workers parecen estar filtradas por Vectalia,
// por eso resolvemos esta llamada desde una edge function Deno.

const VECTALIA_RT_URL = "https://qr.vectalia.es/Alicante/lib/request.aspx";
const ARRIVAL_RE = /Linea\s+(\d+)\s+([^:]+?)\s*:\s*(\d+)\s*min/gi;
const VECTALIA_LINE_CODES: Record<string, string> = {
  "14": "084",
};

function toVectaliaLineCode(lineCode: string): string {
  return VECTALIA_LINE_CODES[lineCode] ?? lineCode.padStart(3, "0");
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Cache-Control": "no-store",
};

async function fetchEtas(stopCode: string, lineCode: string): Promise<number[]> {
  try {
    const vectaliaLine = toVectaliaLineCode(lineCode);
    const r = await fetch(
      `${VECTALIA_RT_URL}?p=${encodeURIComponent(stopCode)}&l=${encodeURIComponent(vectaliaLine)}`,
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
    if (!r.ok) return [];
    const txt = await r.text();
    const mins: number[] = [];
    for (const m of txt.matchAll(ARRIVAL_RE)) {
      const ln = m[1].trim().padStart(3, "0");
      if (ln !== vectaliaLine) continue;
      const min = parseInt(m[3], 10);
      if (Number.isFinite(min)) mins.push(min);
    }
    return mins.sort((a, b) => a - b);
  } catch (e) {
    console.error("[bus-eta] fetch failed", e);
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  const url = new URL(req.url);
  const stop = (url.searchParams.get("stop") || "").trim();
  const line = (url.searchParams.get("line") || "").trim();
  const indexRaw = (url.searchParams.get("index") || "0").trim();
  const minRaw = (url.searchParams.get("min") || "").trim();
  const index = Math.max(0, Math.min(5, parseInt(indexRaw, 10) || 0));
  const minThreshold = minRaw ? parseInt(minRaw, 10) : null;

  if (!/^\d{1,6}$/.test(stop) || !/^\d{1,3}[A-Za-z]?$/.test(line)) {
    return new Response(JSON.stringify({ error: "bad params" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const etas = await fetchEtas(stop, line);
  let etaMin: number | null = null;
  if (etas.length > 0) {
    if (minThreshold != null && Number.isFinite(minThreshold)) {
      const next = etas.find((m) => m >= minThreshold);
      etaMin = next ?? etas[etas.length - 1];
    } else {
      etaMin = etas[Math.min(index, etas.length - 1)];
    }
  }

  return new Response(JSON.stringify({ etaMin, all: etas, fetchedAt: Date.now() }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
});
