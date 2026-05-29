import { createFileRoute } from "@tanstack/react-router";

// Cache-on-first-hit proxy for Google Places (New) photos.
// URL shape: /api/public/shop-photo/places/{placeId}/photos/{photoId}?w=800
//
// Flow:
// 1. Build deterministic storage key from ref + width.
// 2. If the object exists in the `shop-photos` bucket → 302 to its public URL.
// 3. Otherwise: ask Google for the signed photoUri, download the bytes,
//    upload to Storage, then 302 to the public URL.
// Result: 1 Google Places API call per (photo, width) FOREVER, instead of per request.

const BUCKET = "shop-photos";
const PROJECT_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";

function publicUrl(path: string) {
  return `${PROJECT_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

function sanitizeKey(ref: string, w: number) {
  // ref looks like "places/<placeId>/photos/<photoId>"; keep structure, safe chars only.
  const safe = ref.replace(/[^a-zA-Z0-9/_-]/g, "_");
  return `${safe}/w${w}.jpg`;
}

function googlePhotoCacheKey(ref: string, w: number) {
  const safe = ref.replace(/[^a-zA-Z0-9/_-]/g, "_");
  return `gphotos/${safe}/w${w}.jpg`;
}

async function redirectIfCached(paths: string[]) {
  for (const path of paths) {
    const url = publicUrl(path);
    try {
      const head = await fetch(url, { method: "HEAD" });
      if (head.ok) {
        return new Response(null, {
          status: 302,
          headers: {
            Location: url,
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      }
    } catch {
      // Try the next known cache location.
    }
  }
  return null;
}

export const Route = createFileRoute("/api/public/shop-photo/$")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const ref = params._splat;
        if (!ref) return new Response("Missing ref", { status: 400 });

        const url = new URL(request.url);
        const w = Math.min(parseInt(url.searchParams.get("w") || "800", 10) || 800, 1600);

        const objectPath = sanitizeKey(ref, w);
        const cachedUrl = publicUrl(objectPath);

        // 1. Check every existing cache layout first (no Google call) — sirve siempre,
        //    incluso con kill-switch off. Históricamente `/google-photo` guardaba
        //    en `gphotos/...`, así que `/shop-photo` debe reutilizarlo.
        const cached = await redirectIfCached([objectPath, googlePhotoCacheKey(ref, w)]);
        if (cached) return cached;

        return new Response("Photo not cached", { status: 404 });
      },
    },
  },
});
