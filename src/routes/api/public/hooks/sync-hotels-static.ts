import { createFileRoute } from "@tanstack/react-router";
import { syncStaticHotelsImpl } from "@/lib/hotels.server";

export const Route = createFileRoute("/api/public/hooks/sync-hotels-static")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const result = await syncStaticHotelsImpl();
          return Response.json({ ok: true, ...result });
        } catch (e: any) {
          console.error(e);
          return Response.json(
            { ok: false, error: e?.message ?? "unknown" },
            { status: 500 },
          );
        }
      },
      GET: async () => {
        try {
          const result = await syncStaticHotelsImpl();
          return Response.json({ ok: true, ...result });
        } catch (e: any) {
          return Response.json(
            { ok: false, error: e?.message ?? "unknown" },
            { status: 500 },
          );
        }
      },
    },
  },
});
