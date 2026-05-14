import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Recálculo cada 30 minutos: elimina los vuelos que ya han salido /
// aterrizado para que el endpoint de lectura sirva siempre la lista
// "viva". No vuelve a llamar a AENA — eso lo hace aena-sync semanalmente.

export const Route = createFileRoute("/api/public/hooks/aena-prune")({
  server: {
    handlers: {
      POST: async () => {
        const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const { error, count } = await supabaseAdmin
          .from("aena_flights")
          .delete({ count: "exact" })
          .lt("scheduled_at", cutoff);
        if (error) {
          console.error("[aena-prune] failed", error);
          return Response.json(
            { ok: false, error: error.message },
            { status: 500 },
          );
        }
        return Response.json({ ok: true, removed: count ?? 0, cutoff });
      },
    },
  },
});
