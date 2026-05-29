import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isGoogleEnabled } from "@/lib/google-killswitch.server";

// Proxy genérico cache-on-first-hit para fotos de Google Places (New).
// URL: /api/public/google-photo/places/{placeId}/photos/{photoId}?w=800
//
// Flujo:
// 1. ¿Existe ya el archivo en Storage? → 302 a su URL pública (0 llamadas Google).
// 2. Si no → 1 llamada a Google para la photoUri, descargar bytes, subir a Storage,
//    302 a la URL pública. A partir de aquí, NUNCA se vuelve a llamar a Google
//    para esa foto.
//
// Reutiliza el bucket público "shop-photos" para no proliferar buckets.

const BUCKET = "shop-photos";
const PROJECT_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";

function publicUrl(path: string) {
  return `${PROJECT_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

function sanitizeKey(ref: string, w: number) {
  const safe = ref.replace(/[^a-zA-Z0-9/_-]/g, "_");
  return `gphotos/${safe}/w${w}.jpg`;
}

export const Route = createFileRoute("/api/public/google-photo/$")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const ref = params._splat;
        if (!ref || !ref.startsWith("places/")) {
          return new Response("Missing or invalid ref", { status: 400 });
        }

        const url = new URL(request.url);
        const w = Math.min(
          Math.max(parseInt(url.searchParams.get("w") || "800", 10) || 800, 80),
          1600,
        );

        const objectPath = sanitizeKey(ref, w);
        const cachedUrl = publicUrl(objectPath);

        // 1. ¿Está cacheada? HEAD a la URL pública (no cuenta como llamada a Google).
        //    Esto se hace SIEMPRE, incluso con el kill-switch apagado: las fotos
        //    ya descargadas viven en nuestro Storage, no cuestan nada servirlas.
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
          /* fall through */
        }

        // 2. No estaba en Storage → llamar a Google UNA VEZ y cachear para siempre.
        //    HONRA el kill-switch: si está OFF, devolvemos 404 sin llamar a Google.
        if (!(await isGoogleEnabled())) {
          return new Response("Photo not cached, Google API disabled", { status: 404 });
        }
        const key = process.env.GOOGLE_PLACES_API_KEY;
        if (!key) return new Response("Photo not cached, no API key", { status: 404 });

        // 2. Pedir a Google la URL firmada de la foto.
        const apiUrl = `https://places.googleapis.com/v1/${ref}/media?maxWidthPx=${w}&skipHttpRedirect=true&key=${encodeURIComponent(
          key,
        )}`;
        const r = await fetch(apiUrl);
        if (!r.ok) return new Response("Photo error", { status: r.status });
        const j = (await r.json()) as { photoUri?: string };
        if (!j.photoUri) return new Response("No photoUri", { status: 502 });

        // 3. Descargar bytes desde la CDN de Google.
        const imgRes = await fetch(j.photoUri);
        if (!imgRes.ok) {
          return new Response(null, {
            status: 302,
            headers: { Location: j.photoUri, "Cache-Control": "public, max-age=3600" },
          });
        }
        const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
        const bytes = new Uint8Array(await imgRes.arrayBuffer());

        // 4. Subir a Storage (upsert por si dos peticiones concurrentes coinciden).
        const { error: upErr } = await supabaseAdmin.storage
          .from(BUCKET)
          .upload(objectPath, bytes, {
            contentType,
            cacheControl: "31536000",
            upsert: true,
          });
        if (upErr) {
          console.error("google-photo storage upload failed", upErr);
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
