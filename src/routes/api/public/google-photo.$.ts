import { createFileRoute } from "@tanstack/react-router";

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
const TRANSPARENT_PIXEL = Uint8Array.from([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00, 0x00, 0x00,
  0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02,
  0x44, 0x01, 0x00, 0x3b,
]);

function publicUrl(path: string) {
  return `${PROJECT_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

function sanitizeKey(ref: string, w: number) {
  const safe = ref.replace(/[^a-zA-Z0-9/_-]/g, "_");
  return `gphotos/${safe}/w${w}.jpg`;
}

function cachedCandidates(ref: string, requestedWidth: number) {
  const safe = ref.replace(/[^a-zA-Z0-9/_-]/g, "_");
  const widths = [requestedWidth, 800, 1200, 600, 1600].filter(
    (width, index, all) => all.indexOf(width) === index,
  );
  return widths.flatMap((width) => [
    `gphotos/${safe}/w${width}.jpg`,
    `${safe}/w${width}.jpg`,
  ]);
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

        // 1. ¿Está cacheada? HEAD a la URL pública (no cuenta como llamada a Google).
        //    Esto se hace SIEMPRE, incluso con el kill-switch apagado: las fotos
        //    ya descargadas viven en nuestro Storage, no cuestan nada servirlas.
        for (const path of cachedCandidates(ref, w)) {
          const cachedUrl = publicUrl(path);
          try {
            const head = await fetch(cachedUrl, { method: "HEAD" });
            if (!head.ok) continue;
            return new Response(null, {
              status: 302,
              headers: {
                Location: cachedUrl,
                "Cache-Control": "public, max-age=31536000, immutable",
              },
            });
          } catch {
            /* try next cache layout */
          }
        }

        return new Response(TRANSPARENT_PIXEL, {
          status: 200,
          headers: { "Content-Type": "image/gif", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
