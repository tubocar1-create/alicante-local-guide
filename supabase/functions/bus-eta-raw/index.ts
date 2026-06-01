// Devuelve el texto crudo de Vectalia para un stop (y línea opcional).
// Lo usa el server fn getStopRealtime para parsear con coordenadas.

const VECTALIA_RT_URL = "https://qr.vectalia.es/Alicante/lib/request.aspx";
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  const url = new URL(req.url);
  const stop = (url.searchParams.get("stop") || "").trim();
  const line = (url.searchParams.get("line") || "").trim();

  if (!/^\d{3,6}$/.test(stop) || (line && !/^\d{1,3}[A-Za-z]?$/.test(line))) {
    return new Response(JSON.stringify({ error: "bad params", raw: "" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const padded = line ? toVectaliaLineCode(line) : "";
    const target = `${VECTALIA_RT_URL}?p=${encodeURIComponent(stop)}&l=${encodeURIComponent(padded)}`;
    const sbKey = Deno.env.get("SCRAPINGBEE_API_KEY");
    let fetchUrl = target;
    if (sbKey) {
      const sb = new URL("https://app.scrapingbee.com/api/v1/");
      sb.searchParams.set("api_key", sbKey);
      sb.searchParams.set("url", target);
      sb.searchParams.set("render_js", "false");
      fetchUrl = sb.toString();
    }
    const r = await fetch(fetchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        Referer: "https://qr.vectalia.es/Alicante/mapa.aspx",
        "X-Requested-With": "XMLHttpRequest",
        Accept: "*/*",
      },
    });
    const raw = r.ok ? await r.text() : "";
    return new Response(JSON.stringify({ raw, status: r.status, via: sbKey ? "scrapingbee" : "direct" }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (e) {
    console.error("[bus-eta-raw] failed", e);
    return new Response(JSON.stringify({ raw: "", error: String(e) }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
