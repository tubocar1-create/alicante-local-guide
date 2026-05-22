import { createFileRoute } from "@tanstack/react-router";
import { fetchAlicanteIncidencias } from "@/lib/ads/alicante-city.server";

const BASE = "https://movilidad.alicante.es";
const UA = "Mozilla/5.0 (compatible; AlicanteFriend/1.0)";

async function debugFeed() {
  try {
    const r = await fetch(`${BASE}/asmpois`, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return { ok: false, status: r.status };
    const list = (await r.json()) as Array<Record<string, unknown>>;
    const counts: Record<string, number> = {};
    const incidences: Array<Record<string, unknown>> = [];
    for (const x of list) {
      const t = String(x.content_type ?? "?");
      counts[t] = (counts[t] ?? 0) + 1;
      if (t === "incidence") incidences.push(x);
    }
    return { ok: true, total: list.length, counts, incidences };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export const Route = createFileRoute("/api/public/refresh-incidencias")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const items = await fetchAlicanteIncidencias();
          return new Response(
            JSON.stringify({
              ok: true,
              count: items?.length ?? 0,
              at: new Date().toISOString(),
            }),
            { headers: { "Content-Type": "application/json" } },
          );
        } catch (err) {
          console.error("refresh-incidencias failed", err);
          return new Response(
            JSON.stringify({ ok: false, error: (err as Error).message }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
      GET: async ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.has("debug")) {
          const dbg = await debugFeed();
          return new Response(JSON.stringify(dbg, null, 2), {
            headers: { "Content-Type": "application/json" },
          });
        }
        const items = await fetchAlicanteIncidencias();
        return new Response(
          JSON.stringify({ ok: true, count: items?.length ?? 0, items }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
