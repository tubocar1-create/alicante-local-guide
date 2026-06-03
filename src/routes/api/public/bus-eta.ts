import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Tiempo real oficial QR: la app lee vía /api/public/bus-datos e ingesta el
// resultado en `bus_realtime_snapshots`. Este endpoint público devuelve lo que
// haya cacheado en BBDD. NO llama directo desde el navegador a Vectalia.

function normalizeLine(code: string): string {
  const m = code.trim().toUpperCase().match(/^(\d+)([A-Z]?)$/);
  if (!m) return code.trim().toUpperCase();
  return String(parseInt(m[1], 10)) + m[2];
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

        const wanted = normalizeLine(line);
        const { data, error } = await supabaseAdmin
          .from("bus_realtime_snapshots")
          .select("eta_minutes,captured_at")
          .eq("stop_code", stop)
          .eq("line_code", wanted)
          .maybeSingle();

        const etas = error || !data ? [] : (data.eta_minutes ?? []).slice().sort((a: number, b: number) => a - b);
        const capturedAt = data?.captured_at ?? null;

        let etaMin: number | null = null;
        if (etas.length > 0) {
          if (minThreshold != null && Number.isFinite(minThreshold)) {
            const next = etas.find((m: number) => m >= minThreshold);
            etaMin = next ?? etas[etas.length - 1];
          } else {
            etaMin = etas[Math.min(index, etas.length - 1)];
          }
        }

        return new Response(
          JSON.stringify({ etaMin, all: etas, source: "snapshot-cache", capturedAt, fetchedAt: Date.now() }),
          {
            status: 200,
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          },
        );
      },
    },
  },
});
