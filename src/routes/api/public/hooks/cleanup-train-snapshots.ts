// Limpieza diaria: borra snapshots cuyo `date_end` ya quedó en el pasado.
// Para `alicante` solo hay 1 fila (UPSERT por id), así que en condiciones
// normales esto no borra nada. Es una salvaguarda por si alguna vez se crean
// snapshots con otro id o quedan registros huérfanos.

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function cleanup() {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const cutoff = today.toISOString().slice(0, 10);

  const { data, error } = await supabaseAdmin
    .from("train_schedule_snapshot")
    .delete()
    .lt("date_end", cutoff)
    .select("id");

  if (error) throw new Error(error.message);
  return { deleted: data?.length ?? 0, cutoff };
}

export const Route = createFileRoute("/api/public/hooks/cleanup-train-snapshots")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const result = await cleanup();
          return Response.json({ ok: true, ...result });
        } catch (e: any) {
          return Response.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
        }
      },
      GET: async () => {
        try {
          const result = await cleanup();
          return Response.json({ ok: true, ...result });
        } catch (e: any) {
          return Response.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
        }
      },
    },
  },
});
