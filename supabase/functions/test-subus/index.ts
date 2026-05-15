const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  const url = new URL(req.url);
  const stop = url.searchParams.get("stop") || "2939";
  const targets = [
    `http://www.subus.es/QR/Alicante/consulta.aspx?p=${stop}`,
    `https://movilidad.vectalia.es/QR/Alicante/consulta.aspx?p=${stop}`,
    `https://movilidad.vectalia.es/Alicante/lib/request.aspx?p=${stop}&l=`,
    `https://qr.vectalia.es/Alicante/consulta.aspx?p=${stop}`,
  ];
  const out: any[] = [];
  for (const t of targets) {
    try {
      const r = await fetch(t, {
        redirect: "follow",
        headers: {
          "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "es-ES,es;q=0.9",
          "Referer": "https://movilidad.vectalia.es/",
        },
      });
      const text = await r.text();
      out.push({ url: t, status: r.status, len: text.length, snippet: text.slice(0, 800) });
    } catch (e) {
      out.push({ url: t, error: String(e) });
    }
  }
  return new Response(JSON.stringify(out, null, 2), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
});
