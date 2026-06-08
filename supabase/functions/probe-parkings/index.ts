Deno.serve(async () => {
  const url = "https://movilidad.alicante.es/parkings";
  const started = Date.now();
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
        Referer: "https://movilidad.alicante.es/",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
      },
    });
    const text = await res.text();
    let shape: unknown = null;
    let parseErr: string | null = null;
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        const keys = new Set<string>();
        for (const p of parsed) if (p && typeof p === "object") for (const k of Object.keys(p)) keys.add(k);
        shape = {
          kind: "array",
          length: parsed.length,
          allKeys: Array.from(keys),
          sample0: parsed[0],
          sample1: parsed[1],
        };
      } else if (parsed && typeof parsed === "object") {
        shape = { kind: "object", keys: Object.keys(parsed), sample: parsed };
      } else {
        shape = { kind: typeof parsed, value: parsed };
      }
    } catch (e) {
      parseErr = (e as Error).message;
    }
    return new Response(
      JSON.stringify(
        {
          ok: res.ok,
          status: res.status,
          ms: Date.now() - started,
          contentType: res.headers.get("content-type"),
          bytes: text.length,
          parseErr,
          shape,
          preview: text.slice(0, 1500),
        },
        null,
        2,
      ),
      { headers: { "content-type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, ms: Date.now() - started, error: String((err as Error)?.message ?? err) }, null, 2),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }
});
