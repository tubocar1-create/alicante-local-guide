import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/public/test-vectalia')({
  server: {
    handlers: {
      GET: async () => {
        const url = 'https://qr.vectalia.es/Alicante/mapa.aspx?l=012&pl=38.350989692,%20-0.510041734&np=5110&p=1&pr=1'
        const results: any[] = []
        for (let i = 0; i < 3; i++) {
          const t0 = Date.now()
          try {
            const res = await fetch(url, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'es-ES,es;q=0.9',
                'Referer': 'https://qr.vectalia.es/',
              },
            })
            const text = await res.text()
            const etaMatches = [...text.matchAll(/Linea\s+(\w+)[^:]*:\s*(\d+)\s*min/gi)].map(m => ({ linea: m[1], min: m[2] }))
            results.push({
              attempt: i + 1,
              ts: new Date().toISOString(),
              status: res.status,
              ok: res.ok,
              ms: Date.now() - t0,
              bytes: text.length,
              etaMatches,
              snippet: text.slice(0, 400),
            })
          } catch (e: any) {
            results.push({ attempt: i + 1, ts: new Date().toISOString(), error: String(e), ms: Date.now() - t0 })
          }
        }
        return Response.json({ url, results }, { headers: { 'Cache-Control': 'no-store' } })
      },
    },
  },
})
