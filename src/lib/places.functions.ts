import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type CachedPlace = {
  google_place_id: string;
  name: string;
  cuisine: string | null;
  primary_type: string | null;
  types: string[] | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  opening_hours_text: string | null;
  opening_hours_json: unknown;
  open_now: boolean | null;
  price_level: string | null;
  price_range_min: number | null;
  price_range_max: number | null;
  price_currency: string | null;
  rating: number | null;
  user_rating_count: number | null;
  phone: string | null;
  website: string | null;
  category: string;
  fetched_at: string;
  raw?: unknown;
};

const ALC_CENTER = { lat: 38.3452, lng: -0.481 };
const ASIAN_QUERIES = [
  "japanese restaurant",
  "sushi",
  "ramen",
  "chinese restaurant",
  "thai restaurant",
  "korean restaurant",
  "vietnamese restaurant",
  "asian restaurant",
];
const STALE_MS = 24 * 60 * 60 * 1000; // 24h

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.types",
  "places.primaryType",
  "places.primaryTypeDisplayName",
  "places.regularOpeningHours",
  "places.currentOpeningHours",
  "places.priceLevel",
  "places.priceRange",
  "places.rating",
  "places.userRatingCount",
  "places.nationalPhoneNumber",
  "places.websiteUri",
  "places.photos",
].join(",");

type GPlace = {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  types?: string[];
  primaryType?: string;
  primaryTypeDisplayName?: { text?: string };
  regularOpeningHours?: {
    openNow?: boolean;
    weekdayDescriptions?: string[];
    periods?: unknown;
  };
  currentOpeningHours?: { openNow?: boolean };
  priceLevel?: string;
  priceRange?: {
    startPrice?: { units?: string; currencyCode?: string };
    endPrice?: { units?: string; currencyCode?: string };
  };
  rating?: number;
  userRatingCount?: number;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  photos?: Array<{ name: string; widthPx?: number; heightPx?: number }>;
};

async function searchGoogle(textQuery: string, apiKey: string): Promise<GPlace[]> {
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({
      textQuery: `${textQuery} Alicante`,
      languageCode: "es",
      regionCode: "ES",
      maxResultCount: 20,
      locationBias: {
        circle: {
          center: { latitude: ALC_CENTER.lat, longitude: ALC_CENTER.lng },
          radius: 6000,
        },
      },
    }),
  });
  if (!res.ok) {
    console.error("Google Places error", res.status, await res.text());
    return [];
  }
  const json = (await res.json()) as { places?: GPlace[] };
  return json.places ?? [];
}

function toRow(p: GPlace, category: string): CachedPlace | null {
  if (!p.id || !p.displayName?.text) return null;
  const pr = p.priceRange;
  const start = pr?.startPrice?.units ? Number(pr.startPrice.units) : null;
  const end = pr?.endPrice?.units ? Number(pr.endPrice.units) : null;
  return {
    google_place_id: p.id,
    name: p.displayName.text,
    cuisine: p.primaryTypeDisplayName?.text ?? p.primaryType ?? null,
    primary_type: p.primaryType ?? null,
    types: p.types ?? null,
    address: p.formattedAddress ?? null,
    lat: p.location?.latitude ?? null,
    lng: p.location?.longitude ?? null,
    opening_hours_text:
      p.regularOpeningHours?.weekdayDescriptions?.join(" · ") ?? null,
    opening_hours_json: p.regularOpeningHours ?? null,
    open_now:
      p.currentOpeningHours?.openNow ?? p.regularOpeningHours?.openNow ?? null,
    price_level: p.priceLevel ?? null,
    price_range_min: start,
    price_range_max: end,
    price_currency: pr?.startPrice?.currencyCode ?? pr?.endPrice?.currencyCode ?? null,
    rating: p.rating ?? null,
    user_rating_count: p.userRatingCount ?? null,
    phone: p.nationalPhoneNumber ?? null,
    website: p.websiteUri ?? null,
    category,
    fetched_at: new Date().toISOString(),
    raw: { photos: p.photos ?? [] } as unknown,
  };
}

async function resolvePhotoUri(photoName: string, apiKey: string, maxWidth = 1200): Promise<string | null> {
  try {
    const url = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidth}&skipHttpRedirect=true&key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const j = (await res.json()) as { photoUri?: string };
    return j.photoUri ?? null;
  } catch {
    return null;
  }
}

export const getPlacePhotos = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => {
    const o = d as { placeId?: string; max?: number };
    if (!o?.placeId || typeof o.placeId !== "string") throw new Error("placeId required");
    return { placeId: o.placeId, max: Math.min(o.max ?? 4, 8) };
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) return { photos: [] as string[] };
    const { data: row } = await supabaseAdmin
      .from("places_cache")
      .select("raw")
      .eq("google_place_id", data.placeId)
      .maybeSingle();
    let photos = ((row?.raw as { photos?: Array<{ name: string }> } | null)?.photos ?? []);

    // Backfill: if no photos cached, fetch Place Details once and persist
    if (photos.length === 0) {
      try {
        const res = await fetch(`https://places.googleapis.com/v1/places/${data.placeId}?languageCode=es`, {
          headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": "photos" },
        });
        if (res.ok) {
          const j = (await res.json()) as { photos?: Array<{ name: string }> };
          photos = j.photos ?? [];
          if (photos.length) {
            const newRaw = { ...(row?.raw as object ?? {}), photos };
            await supabaseAdmin
              .from("places_cache")
              .update({ raw: newRaw as never })
              .eq("google_place_id", data.placeId);
          }
        }
      } catch (e) {
        console.error("place details photos fetch failed", e);
      }
    }

    const urls = await Promise.all(
      photos.slice(0, data.max).map((p) => resolvePhotoUri(p.name, apiKey)),
    );
    return { photos: urls.filter((u): u is string => !!u) };
  });

async function refreshAsianFromGoogle() {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_PLACES_API_KEY missing");

  const seen = new Map<string, CachedPlace>();
  for (const q of ASIAN_QUERIES) {
    const places = await searchGoogle(q, apiKey);
    for (const p of places) {
      const row = toRow(p, "asian");
      if (row && !seen.has(row.google_place_id)) {
        seen.set(row.google_place_id, row);
      }
    }
  }
  const rows = Array.from(seen.values());
  if (rows.length === 0) return rows;

  const { error } = await supabaseAdmin
    .from("places_cache")
    .upsert(rows as never, { onConflict: "google_place_id" });
  if (error) {
    console.error("upsert places_cache error", error);
    throw error;
  }
  return rows;
}

export const getAsianPlaces = createServerFn({ method: "GET" }).handler(
  async () => {
    const { data: existing, error } = await supabaseAdmin
      .from("places_cache")
      .select("*")
      .eq("category", "asian")
      .order("name");
    if (error) throw error;

    const newest = existing?.reduce<number>(
      (max, r) => Math.max(max, new Date(r.fetched_at as string).getTime()),
      0,
    ) ?? 0;
    const isStale = !existing?.length || Date.now() - newest > STALE_MS;

    if (isStale) {
      try {
        await refreshAsianFromGoogle();
        const { data: fresh } = await supabaseAdmin
          .from("places_cache")
          .select("*")
          .eq("category", "asian")
          .order("name");
        return { places: fresh ?? [], refreshed: true };
      } catch (e) {
        console.error("refresh failed, returning cached", e);
        return { places: existing ?? [], refreshed: false };
      }
    }
    return { places: existing ?? [], refreshed: false };
  },
);

export const refreshAsianPlaces = createServerFn({ method: "POST" }).handler(
  async () => {
    const rows = await refreshAsianFromGoogle();
    return { count: rows.length };
  },
);

export const getPlaceById = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => {
    const o = d as { placeId?: string };
    if (!o?.placeId || typeof o.placeId !== "string") throw new Error("placeId required");
    return { placeId: o.placeId };
  })
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("places_cache")
      .select("*")
      .eq("google_place_id", data.placeId)
      .maybeSingle();
    if (error) throw error;
    return { place: row };
  });

/**
 * Resolve a Google Place by name + coordinates. Used for restaurants from
 * Overpass/OSM that don't have a google_place_id yet — finds the closest
 * matching Google Place, caches it, and returns its placeId.
 */
export const resolvePlaceByName = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => {
    const o = d as { name?: string; lat?: number; lon?: number };
    if (!o?.name || typeof o.name !== "string") throw new Error("name required");
    return {
      name: o.name.slice(0, 200),
      lat: typeof o.lat === "number" ? o.lat : null,
      lon: typeof o.lon === "number" ? o.lon : null,
    };
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) return { placeId: null as string | null };

    // Try cache first by name match
    const { data: cached } = await supabaseAdmin
      .from("places_cache")
      .select("google_place_id,name,lat,lng")
      .ilike("name", data.name);
    if (cached && cached.length) {
      // Pick nearest if coords given
      if (data.lat != null && data.lon != null) {
        const best = cached
          .filter((r) => r.lat != null && r.lng != null)
          .map((r) => ({
            id: r.google_place_id as string,
            d:
              Math.abs((r.lat as number) - (data.lat as number)) +
              Math.abs((r.lng as number) - (data.lon as number)),
          }))
          .sort((a, b) => a.d - b.d)[0];
        if (best) return { placeId: best.id };
      }
      return { placeId: cached[0].google_place_id as string };
    }

    const places = await searchGoogle(data.name, apiKey);
    if (!places.length) return { placeId: null };

    // Pick the result closest to provided coords (if any), otherwise the first
    let pick: GPlace | undefined = places[0];
    if (data.lat != null && data.lon != null) {
      pick = places
        .filter((p) => p.location)
        .map((p) => ({
          p,
          d:
            Math.abs((p.location!.latitude) - (data.lat as number)) +
            Math.abs((p.location!.longitude) - (data.lon as number)),
        }))
        .sort((a, b) => a.d - b.d)[0]?.p ?? places[0];
    }
    if (!pick) return { placeId: null };

    const row = toRow(pick, "lookup");
    if (row) {
      await supabaseAdmin
        .from("places_cache")
        .upsert(row as never, { onConflict: "google_place_id" });
    }
    return { placeId: pick.id };
  });
