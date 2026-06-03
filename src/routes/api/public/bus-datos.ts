import { createFileRoute } from "@tanstack/react-router";

// Fuente oficial acordada para buses Alicante: SUBUS consulta.aspx.
// Akamai bloquea fetch directo desde Cloudflare Workers, así que pasamos por
// Firecrawl (consume 1 crédito por llamada) y reconstruimos el formato
// `Linea X DESTINO: N min` que ya entiende el cliente (bus-qr-client.ts).

const BASE = "http://www.subus.es/QR/Alicante";
const TIMEOUT_MS = 20_000;
const FIRECRAWL_URL = "https://api.firecrawl.dev/v2/scrape";

const jsonHeaders = { "Content-Type": "application/json", "Cache-Control": "no-store" };

function normalizeLine(code: string): string {
  const cleaned = code.replace(/^0+/, "") || "0";
  const m = cleaned.toUpperCase().match(/^(\d+)([A-Z]?)$/);
  if (!m) return cleaned.toUpperCase();
  return String(parseInt(m[1], 10)) + m[2];
}

// Markdown que devuelve Firecrawl tiene bloques tipo:
//   ...PUERTA DEL MAR](https://.../termometros/012_2.pdf "...")
//   1 min.
// Captura destino, línea (3 dígitos) y minutos.
const FC_BLOCK_RE =
  /([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ0-9 .'\-]{1,60}?)\]\([^)]*termometros\/(\d+)_\d\.pdf[^)]*\)[\s\S]{1,120}?(\d+)\s*min/gi;

function buildTiemposFromMarkdown(md: string): string {
  const lines: string[] = [];
  for (const m of md.matchAll(FC_BLOCK_RE)) {
    const destination = m[1].trim();
    const line = normalizeLine(m[2]);
    const mins = parseInt(m[3], 10);
    if (!Number.isFinite(mins)) continue;
    lines.push(`Linea ${line} ${destination}: ${mins} min`);
  }
  return lines.join("\n");
}

async function fetchViaFirecrawl(
  targetUrl: string,
  apiKey: string,
): Promise<{ ok: boolean; status: number; markdown: string | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(FIRECRAWL_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: targetUrl,
        formats: ["markdown"],
        onlyMainContent: false,
        location: { country: "ES" },
      }),
    });
    if (!r.ok) return { ok: false, status: r.status, markdown: null };
    const j = (await r.json()) as { success?: boolean; data?: { markdown?: string } };
    return { ok: !!j.success, status: r.status, markdown: j.data?.markdown ?? null };
  } finally {
    clearTimeout(timeout);
  }
}

export const Route = createFileRoute("/api/public/bus-datos")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const stop = (url.searchParams.get("stop") || "").trim();
        if (!/^\d{1,6}$/.test(stop)) {
          return new Response(JSON.stringify({ error: "bad stop" }), { status: 400, headers: jsonHeaders });
        }
        const consultaUrl = `${BASE}/consulta.aspx?p=${encodeURIComponent(stop)}`;
        const t0 = Date.now();
        const apiKey = process.env.FIRECRAWL_API_KEY;
        if (!apiKey) {
          return new Response(
            JSON.stringify({
              error: "FIRECRAWL_API_KEY not configured",
              ms: Date.now() - t0,
              target: consultaUrl,
            }),
            { status: 500, headers: jsonHeaders },
          );
        }
        try {
          const fc = await fetchViaFirecrawl(consultaUrl, apiKey);
          if (!fc.ok || !fc.markdown) {
            return new Response(
              JSON.stringify({
                ok: false,
                status: fc.status,
                ms: Date.now() - t0,
                target: consultaUrl,
                source: "firecrawl",
                raw: "",
                json: null,
              }),
              { status: 200, headers: jsonHeaders },
            );
          }
          const tiempos = buildTiemposFromMarkdown(fc.markdown);
          // El cliente parsea `raw` directamente; también enviamos `json.tiempos`
          // por compatibilidad con la rama que prefiere JSON.
          return new Response(
            JSON.stringify({
              ok: true,
              status: 200,
              ms: Date.now() - t0,
              target: consultaUrl,
              finalTarget: consultaUrl,
              source: "firecrawl",
              raw: tiempos,
              json: { tiempos },
            }),
            { status: 200, headers: jsonHeaders },
          );
        } catch (e) {
          return new Response(
            JSON.stringify({ error: String(e), ms: Date.now() - t0, target: consultaUrl, source: "firecrawl" }),
            { status: 200, headers: jsonHeaders },
          );
        }
      },
    },
  },
});
