import { createFileRoute } from "@tanstack/react-router";
import { matchHotelsToLiteApiImpl, refreshDynamicHotelsImpl } from "@/lib/hotels-liteapi.server";

export const Route = createFileRoute("/api/public/hooks/refresh-hotels-dynamic")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const doMatch = url.searchParams.get("match") === "1";
        try {
          const match = doMatch ? await matchHotelsToLiteApiImpl() : null;
          const refresh = await refreshDynamicHotelsImpl();
          return Response.json({ ok: true, match, refresh });
        } catch (e: any) {
          console.error(e);
          return Response.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
        }
      },
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const doMatch = url.searchParams.get("match") === "1";
        try {
          const match = doMatch ? await matchHotelsToLiteApiImpl() : null;
          const refresh = await refreshDynamicHotelsImpl();
          return Response.json({ ok: true, match, refresh });
        } catch (e: any) {
          return Response.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
        }
      },
    },
  },
});
