import { createFileRoute } from "@tanstack/react-router";
import { getGooglePlacesKey } from "@/lib/google-killswitch.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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

        // 1. Check cache first (no Google call) — sirve siempre, incluso con kill-switch off.
        try {
          const head = await fetch(cachedUrl, { method: "HEAD" });
          if (head.ok) {
            return new Response(null, {
              status: 302,
              headers: {
                Location: cachedUrl,
                "Cache-Control": "public, max-age=31536000, immutable",
              },
            });
          }
        } catch {
          /* fall through to fetch */
        }

        // 2. Cache miss → ahora sí necesitamos la API key.
        const key = await getGooglePlacesKey();
        if (!key) return new Response("Photo not cached, Google API disabled", { status: 404 });

        // 2. Ask Google for the signed photoUri.
        const apiUrl = `https://places.googleapis.com/v1/${ref}/media?maxWidthPx=${w}&skipHttpRedirect=true&key=${encodeURIComponent(
          key,
        )}`;
        const r = await fetch(apiUrl);
        if (!r.ok) return new Response("Photo error", { status: r.status });
        const j = (await r.json()) as { photoUri?: string };
        if (!j.photoUri) return new Response("No photoUri", { status: 502 });

        // 3. Download the image bytes from Google's CDN.
        const imgRes = await fetch(j.photoUri);
        if (!imgRes.ok) {
          // Couldn't cache — fall back to direct redirect so the user still sees the image.
          return new Response(null, {
            status: 302,
            headers: { Location: j.photoUri, "Cache-Control": "public, max-age=3600" },
          });
        }
        const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
        const bytes = new Uint8Array(await imgRes.arrayBuffer());

        // 4. Upload to Storage (idempotent — upsert in case of race).
        const { error: upErr } = await supabaseAdmin.storage
          .from(BUCKET)
          .upload(objectPath, bytes, {
            contentType,
            cacheControl: "31536000",
            upsert: true,
          });
        if (upErr) {
          console.error("shop-photo storage upload failed", upErr);
          // Fall back: still serve the image via direct redirect.
          return new Response(null, {
            status: 302,
            headers: { Location: j.photoUri, "Cache-Control": "public, max-age=3600" },
          });
        }

        return new Response(null, {
          status: 302,
          headers: {
            Location: cachedUrl,
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});
