const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  const url = new URL(req.url);
  const stop = url.searchParams.get("stop") || "2939";
  const mode = url.searchParams.get("mode") || "page";

  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    "Referer": "https://qr.vectalia.es/Alicante/mapa.aspx",
    "Accept": "*/*",
  };

  if (mode === "page") {
    const r = await fetch(`https://qr.vectalia.es/Alicante/consulta.aspx?p=${stop}`, { headers });
    const text = await r.text();
    return new Response(text, { headers: { "Content-Type": "text/plain", ...corsHeaders } });
  }
  if (mode === "req") {
    // try request.aspx with no line filter
    const r = await fetch(`https://qr.vectalia.es/Alicante/lib/request.aspx?p=${stop}&l=`, {
      headers: { ...headers, "X-Requested-With": "XMLHttpRequest" },
    });
    const text = await r.text();
    return new Response(JSON.stringify({ status: r.status, body: text }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
  return new Response("bad mode", { status: 400 });
});
