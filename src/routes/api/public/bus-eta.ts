import { createFileRoute } from "@tanstack/react-router";

// Vectalia bloquea/filtra peticiones desde IPs de Cloudflare Workers,
// así que delegamos en la edge function de Supabase (Deno, otro pool de IPs).

export const Route = createFileRoute("/api/public/bus-eta")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const stop = (url.searchParams.get("stop") || "").trim();
        const line = (url.searchParams.get("line") || "").trim();
        const indexRaw = (url.searchParams.get("index") || "0").trim();
        const minRaw = (url.searchParams.get("min") || "").trim();

        if (!/^\d{1,6}$/.test(stop) || !/^\d{1,3}$/.test(line)) {
          return new Response(JSON.stringify({ error: "bad params" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
        const anonKey =
          process.env.SUPABASE_PUBLISHABLE_KEY ||
          process.env.SUPABASE_ANON_KEY ||
          process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        if (!supabaseUrl || !anonKey) {
          return new Response(
            JSON.stringify({ etaMin: null, all: [], error: "missing supabase env" }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        const params = new URLSearchParams({ stop, line });
        if (indexRaw) params.set("index", indexRaw);
        if (minRaw) params.set("min", minRaw);

        try {
          const r = await fetch(
            `${supabaseUrl}/functions/v1/bus-eta?${params.toString()}`,
            {
              headers: {
                apikey: anonKey,
                Authorization: `Bearer ${anonKey}`,
              },
            },
          );
          const text = await r.text();
          return new Response(text, {
            status: r.status,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
            },
          });
        } catch (e) {
          console.error("[bus-eta proxy] failed", e);
          return new Response(
            JSON.stringify({ etaMin: null, all: [], error: "proxy failed" }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
