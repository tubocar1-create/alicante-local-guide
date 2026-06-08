Deno.serve(async () => {
  const url = "http://www.subus.es/QR/Alicante/consulta.aspx?p=5110";
  const started = Date.now();
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; VamosAlicanteBot/1.0)",
        "Accept": "text/html,application/xhtml+xml",
      },
    });
    const body = await res.text();
    return new Response(
      JSON.stringify({
        ok: res.ok,
        status: res.status,
        statusText: res.statusText,
        ms: Date.now() - started,
        contentType: res.headers.get("content-type"),
        length: body.length,
        snippet: body.slice(0, 1200),
      }, null, 2),
      { headers: { "content-type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        ms: Date.now() - started,
        error: String((err as Error)?.message ?? err),
        name: (err as Error)?.name,
      }, null, 2),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }
});
