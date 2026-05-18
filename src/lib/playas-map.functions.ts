import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { MAP_BEACHES, getBeachBySlug, type MapBeach } from "./playas-map-data";

const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";

function gwHeaders(extra?: Record<string, string>) {
  const lovable = process.env.LOVABLE_API_KEY;
  const gmaps = process.env.GOOGLE_MAPS_API_KEY;
  if (!lovable) throw new Error("LOVABLE_API_KEY missing");
  if (!gmaps) throw new Error("GOOGLE_MAPS_API_KEY missing");
  return {
    Authorization: `Bearer ${lovable}`,
    "X-Connection-Api-Key": gmaps,
    "Content-Type": "application/json",
    ...(extra ?? {}),
  };
}

async function findPlaceId(beach: MapBeach): Promise<string | null> {
  try {
    const res = await fetch(`${GATEWAY}/places/v1/places:searchText`, {
      method: "POST",
      headers: gwHeaders({ "X-Goog-FieldMask": "places.id,places.displayName" }),
      body: JSON.stringify({
        textQuery: `${beach.name} Alicante`,
        locationBias: { circle: { center: { latitude: beach.lat, longitude: beach.lng }, radius: 3000 } },
        maxResultCount: 1,
        languageCode: "es",
      }),
    });
    if (!res.ok) return null;
    const j: any = await res.json();
    return (j.places?.[0]?.id as string) ?? null;
  } catch {
    return null;
  }
}

async function photoMediaUri(photoName: string, maxWidthPx = 1600): Promise<string | null> {
  try {
    const url = `${GATEWAY}/places/v1/${photoName}/media?maxWidthPx=${maxWidthPx}&skipHttpRedirect=true`;
    const res = await fetch(url, { headers: gwHeaders() });
    if (!res.ok) return null;
    const j: any = await res.json();
    return (j.photoUri as string) ?? null;
  } catch {
    return null;
  }
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

async function getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  try {
    const res = await fetch(`${GATEWAY}/places/v1/places/${encodeURIComponent(placeId)}?languageCode=es`, {
      headers: gwHeaders({
        "X-Goog-FieldMask":
          "id,photos,reviews,rating,userRatingCount,googleMapsUri,formattedAddress",
      }),
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

export type MapBeachWithCover = MapBeach & { photo: string | null };

export const getMapBeaches = createServerFn({ method: "GET" }).handler(
  async (): Promise<MapBeachWithCover[]> => {
    const results = await Promise.all(
      MAP_BEACHES.map(async (b) => {
        const placeId = await findPlaceId(b);
        let photo: string | null = null;
        if (placeId) {
          const details = await getPlaceDetails(placeId);
          const firstPhoto = details?.photoNames?.[0];
          if (firstPhoto) photo = await photoMediaUri(firstPhoto, 1200);
        }
        return { ...b, photo };
      }),
    );
    return results;
  },
);

export type BeachReview = { author: string; rating: number; text: string; relativeTime?: string };

export type BeachDetail = {
  beach: MapBeach;
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
        model: "google/gemini-2.5-flash",
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

export const getBeachDetail = createServerFn({ method: "POST" })
  .inputValidator((input: { slug: string }) =>
    z.object({ slug: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/) }).parse(input),
  )
  .handler(async ({ data }): Promise<BeachDetail | null> => {
    const beach = getBeachBySlug(data.slug);
    if (!beach) return null;
    const [placeId, review] = await Promise.all([findPlaceId(beach), aiBeachReview(beach)]);
    let photos: string[] = [];
    let reviews: BeachReview[] = [];
    let rating: number | undefined;
    let userRatingCount: number | undefined;
    let googleMapsUri: string | undefined;
    let formattedAddress: string | undefined;
    if (placeId) {
      const details = await getPlaceDetails(placeId);
      if (details) {
        reviews = details.reviews;
        rating = details.rating;
        userRatingCount = details.userRatingCount;
        googleMapsUri = details.googleMapsUri;
        formattedAddress = details.formattedAddress;
        const photoNames = details.photoNames.slice(0, 5);
        const uris = await Promise.all(photoNames.map((n) => photoMediaUri(n, 1600)));
        photos = uris.filter((u): u is string => !!u);
      }
    }
    return { beach, photos, review, reviews, rating, userRatingCount, googleMapsUri, formattedAddress };
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
