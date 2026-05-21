import { createFileRoute } from "@tanstack/react-router";

// Proxy/redirector for Google Places (New) photos.
// URL shape: /api/public/shop-photo/places/{placeId}/photos/{photoId}?w=800
export const Route = createFileRoute("/api/public/shop-photo/$")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const ref = params._splat;
        if (!ref) return new Response("Missing ref", { status: 400 });
        const key = process.env.GOOGLE_PLACES_API_KEY;
        if (!key) return new Response("No key", { status: 500 });

        const url = new URL(request.url);
        const w = Math.min(parseInt(url.searchParams.get("w") || "800", 10) || 800, 1600);

        // Ask Google for the signed photoUri (no key needed by the browser).
        const apiUrl = `https://places.googleapis.com/v1/${ref}/media?maxWidthPx=${w}&skipHttpRedirect=true&key=${encodeURIComponent(
          key,
        )}`;
        const r = await fetch(apiUrl);
        if (!r.ok) return new Response("Photo error", { status: r.status });
        const j = (await r.json()) as { photoUri?: string };
        if (!j.photoUri) return new Response("No photoUri", { status: 502 });
        return new Response(null, {
          status: 302,
          headers: {
            Location: j.photoUri,
            "Cache-Control": "public, max-age=86400",
          },
        });
      },
    },
  },
});
