import { createServerFn } from "@tanstack/react-start";
import { getGooglePlacesKey } from "@/lib/google-killswitch.server";
import { fetchGoogle } from "@/lib/observability/google";
import { z } from "zod";
import { MAP_BEACHES, getBeachBySlug, GOOGLE_PHOTO_SKIP, type MapBeach } from "./playas-map-data";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Lee las fotos locales (subidas por nosotros) desde la BD para un slug.
async function loadLocalPhotos(slug: string): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from("beach_covers")
    .select("photos")
    .eq("slug", slug)
    .maybeSingle();
  return (data?.photos ?? []) as string[];
}

const PLACES_BASE = "https://places.googleapis.com/v1";

async function getKey(): Promise<string | null> {
  return await getGooglePlacesKey();
}

// Caché perpetua de detalles de Google Places por slug de playa.
// Una vez cacheado, NUNCA se vuelve a llamar a Google salvo refresco manual del admin.
async function loadCachedBySlug(slug: string): Promise<PlaceDetails | null> {
  const { data } = await supabaseAdmin
    .from("google_place_details_cache")
    .select("details")
    .eq("cache_key", `beach:${slug}`)
    .maybeSingle();
  if (!data?.details) return null;
  return data.details as unknown as PlaceDetails;
}

async function saveCachedBySlug(slug: string, details: PlaceDetails): Promise<void> {
  await supabaseAdmin
    .from("google_place_details_cache")
    .upsert(
      {
        place_id: details.id,
        cache_key: `beach:${slug}`,
        details: details as never,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: "cache_key" },
    );
}

async function findPlaceId(beach: MapBeach): Promise<string | null> {
  const key = await getKey();
  if (!key) return null;
  try {
    const res = await fetchGoogle({
      provider: "google_places",
      endpoint: "places:searchText",
      caller: "playas-map:findPlaceId",
      url: `${PLACES_BASE}/places:searchText`,
      init: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask": "places.id",
        },
        body: JSON.stringify({
          textQuery: `${beach.name} Alicante`,
          locationBias: { circle: { center: { latitude: beach.lat, longitude: beach.lng }, radius: 3000 } },
          maxResultCount: 1,
          languageCode: "es",
        }),
      },
    });
    if (!res.ok) return null;
    const j: any = await res.json();
    return (j.places?.[0]?.id as string) ?? null;
  } catch {
    return null;
  }
}

// Devuelve URL del proxy interno (cachea en Storage en la 1ª petición y nunca
// más vuelve a llamar a Google para esa foto).
function photoMediaUri(photoName: string, maxWidthPx = 1600): string | null {
  if (!photoName?.startsWith("places/")) return null;
  const w = Math.min(Math.max(Math.round(maxWidthPx), 80), 1600);
  return `/api/public/google-photo/${photoName}?w=${w}`;
}


type PlaceDetails = {
  id: string;
  photoNames: string[];
  reviews: Array<{ author: string; rating: number; text: string; relativeTime?: string }>;
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  formattedAddress?: string;
};

async function getPlaceDetailsLive(placeId: string): Promise<PlaceDetails | null> {
  const key = await getKey();
  if (!key) return null;
  try {
    const res = await fetchGoogle({
      provider: "google_places",
      endpoint: "places:details",
      caller: "playas-map:getPlaceDetailsLive",
      url: `${PLACES_BASE}/places/${encodeURIComponent(placeId)}?languageCode=es`,
      init: {
        headers: {
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask":
            "id,photos,reviews,rating,userRatingCount,googleMapsUri,formattedAddress",
        },
      },
    });

    if (!res.ok) return null;
    const j: any = await res.json();
    const photos: any[] = j.photos ?? [];
    const reviews: any[] = j.reviews ?? [];
    return {
      id: j.id,
      photoNames: photos.map((p) => p.name).filter(Boolean),
      reviews: reviews.slice(0, 5).map((r) => ({
        author: r.authorAttribution?.displayName ?? "Visitante",
        rating: Number(r.rating) || 0,
        text: r.text?.text ?? r.originalText?.text ?? "",
        relativeTime: r.relativePublishTimeDescription,
      })),
      rating: typeof j.rating === "number" ? j.rating : undefined,
      userRatingCount: typeof j.userRatingCount === "number" ? j.userRatingCount : undefined,
      googleMapsUri: j.googleMapsUri,
      formattedAddress: j.formattedAddress,
    };
  } catch {
    return null;
  }
}

// Versión cacheada perpetuamente por slug. Esta es la que deben usar las rutas públicas.
async function getPlaceDetailsForBeach(beach: MapBeach): Promise<PlaceDetails | null> {
  const cached = await loadCachedBySlug(beach.slug);
  if (cached) return cached;
  const placeId = await findPlaceId(beach);
  if (!placeId) return null;
  const live = await getPlaceDetailsLive(placeId);
  if (live) await saveCachedBySlug(beach.slug, live);
  return live;
}

export type MapBeachWithCover = MapBeach & { photo: string | null };

export const getMapBeaches = createServerFn({ method: "GET" }).handler(
  async (): Promise<MapBeachWithCover[]> => {
    // 1) Read cached covers from DB (one query for all slugs).
    const { data: cached } = await supabaseAdmin
      .from("beach_covers")
      .select("slug, public_url");
    const cacheMap = new Map<string, string>();
    for (const row of cached ?? []) {
      if (row.public_url) cacheMap.set(row.slug, row.public_url);
    }

    const results = await Promise.all(
      MAP_BEACHES.map(async (b) => {
        // Cache hit → no Google call.
        const cachedUrl = cacheMap.get(b.slug);
        if (cachedUrl) return { ...b, photo: cachedUrl };

        // Local fallback (fotos almacenadas en BD).
        const local = await loadLocalPhotos(b.slug);
        if (local.length > 0) return { ...b, photo: local[0] };

        // Last resort: live Google fetch (cacheada perpetuamente por slug).
        let photo: string | null = null;
        const details = await getPlaceDetailsForBeach(b);
        if (details) {
          const skip = GOOGLE_PHOTO_SKIP[b.slug] ?? 0;
          const firstPhoto = details.photoNames?.[skip];
          if (firstPhoto) photo = await photoMediaUri(firstPhoto, 1200);
        }
        return { ...b, photo };
      }),
    );
    return results;
  },
);


export type BeachReview = { author: string; rating: number; text: string; relativeTime?: string };

export type BeachQuick = {
  beach: MapBeach;
  cover: string | null;
  googleMapsUri?: string;
};

export type BeachExtras = {
  photos: string[];
  review: string;
  reviews: BeachReview[];
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  formattedAddress?: string;
};

async function aiBeachReview(beach: MapBeach): Promise<string> {
  const apiKey = process.env.LOVABLE_API_KEY;
  const fallback = `${beach.name} es uno de esos rincones del litoral alicantino con personalidad propia. ${beach.description} Una buena opción para combinar baño, paseo y un rato de calma frente al Mediterráneo.`;
  if (!apiKey) return fallback;
  const prompt = `Escribe una reseña breve (90-130 palabras) en español sobre "${beach.name}", en la costa de Alicante. Contexto: ${beach.description}. Tono cercano, simpático y honesto, como si se lo recomendaras a un amigo que viene de visita. Menciona ambiente, tipo de arena o roca, a quién le encaja y un consejo práctico (acceso, mejor hora, snorkel, viento...). Sin listas, sin markdown, sin emojis. No inventes datos verificables (chiringuitos concretos, precios, distancias exactas).`;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "Eres un guía local de Alicante, cercano y honesto, especialista en playas y calas." },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) return fallback;
    const j: any = await res.json();
    return (j.choices?.[0]?.message?.content as string) || fallback;
  } catch {
    return fallback;
  }
}

// Fast: returns beach info + a cover photo (local first; only hits Google if no local).
export const getBeachQuick = createServerFn({ method: "POST" })
  .inputValidator((input: { slug: string }) =>
    z.object({ slug: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/) }).parse(input),
  )
  .handler(async ({ data }): Promise<BeachQuick | null> => {
    const beach = getBeachBySlug(data.slug);
    if (!beach) return null;
    const local = await loadLocalPhotos(beach.slug);
    if (local.length > 0) {
      return { beach, cover: local[0] };
    }
    const details = await getPlaceDetailsForBeach(beach);
    if (!details) return { beach, cover: null };
    const skip = GOOGLE_PHOTO_SKIP[beach.slug] ?? 0;
    const first = details.photoNames?.[skip];
    const cover = first ? await photoMediaUri(first, 1200) : null;
    return { beach, cover, googleMapsUri: details.googleMapsUri };
  });

// Slow: photos beyond cover, AI review, Google reviews, address.
export const getBeachExtras = createServerFn({ method: "POST" })
  .inputValidator((input: { slug: string }) =>
    z.object({ slug: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/) }).parse(input),
  )
  .handler(async ({ data }): Promise<BeachExtras | null> => {
    const beach = getBeachBySlug(data.slug);
    if (!beach) return null;
    const [details, review] = await Promise.all([
      getPlaceDetailsForBeach(beach),
      aiBeachReview(beach),
    ]);
    let photos: string[] = [];
    let reviews: BeachReview[] = [];
    let rating: number | undefined;
    let userRatingCount: number | undefined;
    let googleMapsUri: string | undefined;
    let formattedAddress: string | undefined;
    const local = await loadLocalPhotos(beach.slug);
    if (details) {
      reviews = details.reviews;
      rating = details.rating;
      userRatingCount = details.userRatingCount;
      googleMapsUri = details.googleMapsUri;
      formattedAddress = details.formattedAddress;
      const skip = GOOGLE_PHOTO_SKIP[beach.slug] ?? 0;
      const maxGoogle = Math.max(0, 20 - local.length);
      const photoNames = details.photoNames.slice(skip, skip + maxGoogle);
      const uris = await Promise.all(photoNames.map((n: string) => photoMediaUri(n, 1600)));
      photos = uris.filter((u): u is string => !!u);
    }
    const merged = [...local, ...photos.filter((p) => !local.includes(p))];
    return { photos: merged, review, reviews, rating, userRatingCount, googleMapsUri, formattedAddress };
  });


export const getCoastIntro = createServerFn({ method: "GET" }).handler(async (): Promise<{ text: string }> => {
  const apiKey = process.env.LOVABLE_API_KEY;
  const fallback =
    "Bienvenido al carrusel de la costa alicantina: aquí caben el Castillo mirando desde arriba como un cotilla, las calas del Cabo donde los peces te saludan en plan vecinos curiosos, San Juan con sus kilómetros de arena para perderse y volver tarde, y al sur, dunas tranquilas para fingir que estás de retiro espiritual. Desliza, elige víctima, y nos vemos con los pies en remojo.";
  if (!apiKey) return { text: fallback };
  const prompt =
    "Escribe un comentario amplio (90-130 palabras), divertido, jocoso y muy agradable, en español, sobre la costa de Alicante y la variedad de sus 17 playas (Postiguet bajo el Castillo, San Juan-Muchavista, calas del Cabo de las Huertas como Cantalar, Palmera, Judíos y Tío Ximo, Albufereta, Almadraba, Saladar-Urbanova, Agua Amarga, Altet, Arenales del Sol y Carabassí al sur). Tono cercano, como un amigo guasón pero cariñoso. Permite algún chiste suave. Sin listas, sin markdown, sin emojis. Termina invitando a deslizar las fotos y abrir el mapa.";
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Eres un guía local alicantino, cercano, divertido y con chispa." },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) return { text: fallback };
    const j: any = await res.json();
    const text = (j.choices?.[0]?.message?.content as string) || fallback;
    return { text };
  } catch {
    return { text: fallback };
  }
});
