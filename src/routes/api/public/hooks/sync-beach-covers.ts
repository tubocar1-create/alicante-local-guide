import { createFileRoute } from "@tanstack/react-router";
import { getGooglePlacesKey } from "@/lib/google-killswitch.server";
import { fetchGoogle } from "@/lib/observability/google";
import { MAP_BEACHES, GOOGLE_PHOTO_SKIP, type MapBeach } from "@/lib/playas-map-data";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const PLACES_BASE = "https://places.googleapis.com/v1";
const BUCKET = "beach-photos";

async function key() {
  return await getGooglePlacesKey();
}


async function findPlaceId(b: MapBeach): Promise<string | null> {
  const k = await key();
  if (!k) return null;
  const res = await fetchGoogle({
    provider: "google_places",
    endpoint: "places:searchText",
    caller: "sync-beach-covers:findPlaceId",
    url: `${PLACES_BASE}/places:searchText`,
    init: {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": k,
        "X-Goog-FieldMask": "places.id",
      },
      body: JSON.stringify({
        textQuery: `${b.name} Alicante`,
        locationBias: { circle: { center: { latitude: b.lat, longitude: b.lng }, radius: 3000 } },
        maxResultCount: 1,
        languageCode: "es",
      }),
    },
  });
  if (!res.ok) return null;
  const j: any = await res.json();
  return j.places?.[0]?.id ?? null;
}

async function getCoverPhotoName(placeId: string, skip: number): Promise<{ name: string; attribution: string } | null> {
  const k = await key();
  if (!k) return null;
  const res = await fetchGoogle({
    provider: "google_places",
    endpoint: "places:details",
    caller: "sync-beach-covers:getCoverPhotoName",
    url: `${PLACES_BASE}/places/${encodeURIComponent(placeId)}?languageCode=es`,
    init: { headers: { "X-Goog-Api-Key": k, "X-Goog-FieldMask": "photos" } },
  });
  if (!res.ok) return null;
  const j: any = await res.json();
  const photo = j.photos?.[skip];
  if (!photo?.name) return null;
  const attribution = photo.authorAttributions?.[0]?.displayName ?? "Google";
  return { name: photo.name, attribution };
}

async function fetchPhotoBytes(photoName: string): Promise<{ buf: ArrayBuffer; contentType: string } | null> {
  const k = await key();
  if (!k) return null;
  const url = `${PLACES_BASE}/${photoName}/media?maxWidthPx=1600&key=${k}`;
  const res = await fetchGoogle({
    provider: "google_places",
    endpoint: "places:photo:media",
    caller: "sync-beach-covers:fetchPhotoBytes",
    url,
    init: { redirect: "follow" },
  });
  if (!res.ok) return null;
  const buf = await res.arrayBuffer();
  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  return { buf, contentType };
}

async function syncOne(b: MapBeach, force: boolean): Promise<{ slug: string; status: string; url?: string }> {
  if (!force) {
    const { data: existing } = await supabaseAdmin
      .from("beach_covers")
      .select("public_url")
      .eq("slug", b.slug)
      .maybeSingle();
    if (existing) return { slug: b.slug, status: "skip-exists", url: existing.public_url };
  }

  // Prefer local cover if it exists — no Google fetch needed.
  const local = LOCAL_BEACH_PHOTOS[b.slug] ?? [];
  if (local.length > 0) {
    await supabaseAdmin
      .from("beach_covers")
      .upsert({ slug: b.slug, storage_path: "", public_url: local[0], attribution: "local" });
    return { slug: b.slug, status: "local", url: local[0] };
  }

  const placeId = await findPlaceId(b);
  if (!placeId) return { slug: b.slug, status: "no-place" };
  const skip = GOOGLE_PHOTO_SKIP[b.slug] ?? 0;
  const meta = await getCoverPhotoName(placeId, skip);
  if (!meta) return { slug: b.slug, status: "no-photo" };

  const blob = await fetchPhotoBytes(meta.name);
  if (!blob) return { slug: b.slug, status: "no-bytes" };

  const ext = blob.contentType.includes("png") ? "png" : "jpg";
  const path = `covers/${b.slug}.${ext}`;
  const { error: upErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, blob.buf, { contentType: blob.contentType, upsert: true });
  if (upErr) return { slug: b.slug, status: `upload-err:${upErr.message}` };

  const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
  await supabaseAdmin
    .from("beach_covers")
    .upsert({
      slug: b.slug,
      storage_path: path,
      public_url: pub.publicUrl,
      attribution: `Google · ${meta.attribution}`,
    });
  return { slug: b.slug, status: "ok", url: pub.publicUrl };
}

export const Route = createFileRoute("/api/public/hooks/sync-beach-covers")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const force = url.searchParams.get("force") === "1";
        const only = url.searchParams.get("slug");
        const targets = only ? MAP_BEACHES.filter((b) => b.slug === only) : MAP_BEACHES;
        const results: any[] = [];
        for (const b of targets) {
          try {
            results.push(await syncOne(b, force));
          } catch (e: any) {
            results.push({ slug: b.slug, status: `err:${e?.message ?? "unknown"}` });
          }
        }
        return Response.json({ ok: true, count: results.length, results });
      },
    },
  },
});
