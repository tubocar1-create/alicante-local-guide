import { createFileRoute } from '@tanstack/react-router';

// Diagnostic probe: fetches https://movilidad.alicante.es/asmpois from the
// Cloudflare Worker runtime to inspect the global mobility POI endpoint.
// Temporary investigation route — safe to remove after analysis.
export const Route = createFileRoute('/api/public/asmpois-probe')({
  server: {
    handlers: {
      GET: async () => {
        const t0 = Date.now();
        try {
          const r = await fetch('https://movilidad.alicante.es/asmpois', {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
              Accept: 'application/json, text/plain, */*',
              Referer: 'https://movilidad.alicante.es/',
              'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
            },
          });
          const ct = r.headers.get('content-type') || '';
          const text = await r.text();
          const elapsed = Date.now() - t0;
          let parsed: unknown = null;
          let parseErr: string | null = null;
          let shape: Record<string, unknown> = {};
          try {
            parsed = JSON.parse(text);
            if (parsed && typeof parsed === 'object') {
              if (Array.isArray(parsed)) {
                shape = { kind: 'array', length: parsed.length, sample0: parsed[0] };
              } else {
                const obj = parsed as Record<string, unknown>;
                const summary: Record<string, unknown> = {};
                for (const [k, v] of Object.entries(obj).slice(0, 40)) {
                  if (Array.isArray(v)) {
                    summary[k] = { type: 'array', length: v.length, sample0: v[0] };
                  } else if (v && typeof v === 'object') {
                    summary[k] = { type: 'object', keys: Object.keys(v).slice(0, 20) };
                  } else {
                    summary[k] = { type: typeof v, value: String(v).slice(0, 120) };
                  }
                }
                shape = { kind: 'object', topKeys: Object.keys(obj), summary };
              }
            }
          } catch (e) {
            parseErr = e instanceof Error ? e.message : String(e);
          }
          return Response.json({
            ok: true,
            status: r.status,
            contentType: ct,
            elapsedMs: elapsed,
            bytes: text.length,
            preview: text.slice(0, 1200),
            parseErr,
            shape,
          });
        } catch (e) {
          return Response.json(
            {
              ok: false,
              error: e instanceof Error ? e.message : String(e),
              elapsedMs: Date.now() - t0,
            },
            { status: 200 },
          );
        }
      },
    },
  },
});
