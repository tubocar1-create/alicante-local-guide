// Hook autónomo del motor predictivo: tick masivo (o de una línea).
// Pensado para llamarse desde pg_cron o un scheduler externo cada 20-60s.
// Protección: header `x-engine-tick-secret` debe coincidir con BUS_FLEET_TICK_SECRET.
// Param opcional ?line=XX para tickar una sola línea.

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { tickLineInternal } from "@/lib/bus-fleet.functions";

export const Route = createFileRoute("/api/public/hooks/bus-fleet-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.BUS_FLEET_TICK_SECRET;
        const provided = request.headers.get("x-engine-tick-secret");
        if (secret && provided !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }
        try {
          const url = new URL(request.url);
          const lineParam = url.searchParams.get("line");
          let codes: string[];
          if (lineParam) {
            codes = [lineParam];
          } else {
            const { data: lines } = await supabaseAdmin.from("bus_lines").select("code");
            codes = (lines ?? []).map((l) => l.code as string);
          }
          const results: Array<{ line: string; ok: boolean; error?: string }> = [];
          for (const code of codes) {
            try {
              await tickLineInternal(code);
              results.push({ line: code, ok: true });
            } catch (e) {
              results.push({ line: code, ok: false, error: e instanceof Error ? e.message : String(e) });
            }
          }
          return new Response(JSON.stringify({ ok: true, count: results.length, results }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return new Response(JSON.stringify({ ok: false, error: msg }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
