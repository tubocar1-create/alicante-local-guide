import { createFileRoute } from "@tanstack/react-router";

// Proxy a tiempo real de Vectalia vía ScrapingBee (la IP de Cloudflare Workers
// está bloqueada por Vectalia). Devuelve la próxima ETA en minutos para una
// línea concreta de una parada.

const VECTALIA_DATA_URL = "https://movilidad.vectalia.es/QR/Alicante/datos.aspx";
const VECTALIA_REQUEST_URL = "https://movilidad.vectalia.es/QR/Alicante/lib/request.aspx";
const VECTALIA_PAGE_URL = "https://movilidad.vectalia.es/QR/Alicante/consulta.aspx";
const ARRIVAL_RE = /Linea\s+(\d{1,3}[A-Za-z]?)\s+([^:]+?)\s*:\s*(\d+)\s*min/gi;
const VECTALIA_LINE_CODES: Record<string, string> = { "14": "084" };

function toVectaliaLineCode(line: string): string {
  return VECTALIA_LINE_CODES[line] ?? line.padStart(3, "0");
}

function normalizeLine(code: string): string {
  const m = code.trim().toUpperCase().match(/^(\d+)([A-Z]?)$/);
  if (!m) return code.trim().toUpperCase();
  return String(parseInt(m[1], 10)) + m[2];
}

function parseEtas(raw: string, requestedLine: string): number[] {
  const wanted = normalizeLine(requestedLine);
  const out: number[] = [];
  for (const m of raw.matchAll(ARRIVAL_RE)) {
    if (normalizeLine(m[1]) !== wanted) continue;
    const min = parseInt(m[3], 10);
    if (Number.isFinite(min)) out.push(min);
  }
  return out.sort((a, b) => a - b);
}

async function sbFetch(target: string): Promise<Response | null> {
  const key = process.env.SCRAPINGBEE_API_KEY;
  if (!key) return null;
  const sb = new URL("https://app.scrapingbee.com/api/v1/");
  sb.searchParams.set("api_key", key);
  sb.searchParams.set("url", target);
  sb.searchParams.set("render_js", "false");
  try {
    const r = await fetch(sb.toString(), { headers: { Accept: "*/*" } });
    return r;
  } catch {
    return null;
  }
}

async function fromDatos(stop: string, line: string): Promise<number[]> {
  const r = await sbFetch(`${VECTALIA_DATA_URL}?p=${encodeURIComponent(stop)}`);
  if (!r || !r.ok) return [];
  const data = (await r.json().catch(() => null)) as { tiempos?: string } | null;
  return parseEtas(data?.tiempos ?? "", line);
}

async function fromRequest(stop: string, line: string): Promise<number[]> {
  const padded = toVectaliaLineCode(line);
  const r = await sbFetch(
    `${VECTALIA_REQUEST_URL}?p=${encodeURIComponent(stop)}&l=${encodeURIComponent(padded)}`,
  );
  if (!r || !r.ok) return [];
  return parseEtas(await r.text(), line);
}

async function fromPage(stop: string, line: string): Promise<number[]> {
  const r = await sbFetch(`${VECTALIA_PAGE_URL}?p=${encodeURIComponent(stop)}`);
  if (!r || !r.ok) return [];
  const html = await r.text();
  const idx = html.indexOf('var text = "');
  if (idx === -1) return [];
  const tail = html.slice(idx);
  const end = tail.indexOf('";\n\t\t\tvar textavisos');
  const block = end > 0 ? tail.slice(0, end + 1) : tail.slice(0, 5000);
  return parseEtas(block, line);
}

export const Route = createFileRoute("/api/public/bus-eta")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const stop = (url.searchParams.get("stop") || "").trim();
        const line = (url.searchParams.get("line") || "").trim();
        const indexRaw = (url.searchParams.get("index") || "0").trim();
        const minRaw = (url.searchParams.get("min") || "").trim();
        const index = Math.max(0, Math.min(5, parseInt(indexRaw, 10) || 0));
        const minThreshold = minRaw ? parseInt(minRaw, 10) : null;

        if (!/^\d{1,6}$/.test(stop) || !/^\d{1,3}[A-Za-z]?$/.test(line)) {
          return new Response(JSON.stringify({ error: "bad params" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        let etas = await fromDatos(stop, line);
        let source = "data";
        if (etas.length === 0) {
          etas = await fromRequest(stop, line);
          source = "request";
        }
        if (etas.length === 0) {
          etas = await fromPage(stop, line);
          source = "page";
        }

        let etaMin: number | null = null;
        if (etas.length > 0) {
          if (minThreshold != null && Number.isFinite(minThreshold)) {
            const next = etas.find((m) => m >= minThreshold);
            etaMin = next ?? etas[etas.length - 1];
          } else {
            etaMin = etas[Math.min(index, etas.length - 1)];
          }
        }

        return new Response(
          JSON.stringify({ etaMin, all: etas, source, fetchedAt: Date.now() }),
          {
            status: 200,
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          },
        );
      },
    },
  },
});
