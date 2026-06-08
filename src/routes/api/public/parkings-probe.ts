import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/public/parkings-probe')({
  server: {
    handlers: {
      GET: async () => {
        const t0 = Date.now();
        try {
          const r = await fetch('https://movilidad.alicante.es/parkings', {
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
          let shape: Record<string, unknown> = {};
          let parseErr: string | null = null;
          try {
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed)) {
              shape = {
                kind: 'array',
                length: parsed.length,
                sample0: parsed[0],
                sample1: parsed[1],
                allKeys: Array.from(
                  new Set(parsed.flatMap((p: any) => (p && typeof p === 'object' ? Object.keys(p) : []))),
                ),
              };
            } else if (parsed && typeof parsed === 'object') {
              shape = { kind: 'object', topKeys: Object.keys(parsed), sample: parsed };
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
            preview: text.slice(0, 2000),
            parseErr,
            shape,
          });
        } catch (e) {
          return Response.json({
            ok: false,
            error: e instanceof Error ? e.message : String(e),
            elapsedMs: Date.now() - t0,
          });
        }
      },
    },
  },
});
