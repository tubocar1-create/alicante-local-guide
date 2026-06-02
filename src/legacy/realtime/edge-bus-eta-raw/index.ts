// Devuelve el JSON crudo de SUBUS para un stop usando consulta.aspx → datos.aspx.

const BASE = "http://www.subus.es/QR/Alicante";
const UA =
  "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36";

function extractCookies(res: Response): string {
  const list = res.headers.getSetCookie?.() ?? [];
  return list.map((c) => c.split(";")[0]).filter(Boolean).join("; ");
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
    const consultaUrl = `${BASE}/consulta.aspx?p=${encodeURIComponent(stop)}`;
    const target = `${BASE}/datos.aspx?p=${encodeURIComponent(stop)}`;
    const page = await fetch(consultaUrl, {
      redirect: "follow",
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "es-ES,es;q=0.9",
      },
    });
    const cookie = extractCookies(page);
    await page.arrayBuffer().catch(() => null);

    const r = await fetch(target, {
      redirect: "follow",
      headers: {
        "User-Agent": UA,
        Referer: consultaUrl,
        "X-Requested-With": "XMLHttpRequest",
        "X-Vectalia-App": "qr-alicante",
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "es-ES,es;q=0.9",
        ...(cookie ? { Cookie: cookie } : {}),
      },
    });
    const raw = r.ok ? await r.text() : "";
    return new Response(JSON.stringify({ raw, status: r.status, sessionStatus: page.status, via: "subus-direct" }), {
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
