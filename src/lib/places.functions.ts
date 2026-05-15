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
  };
}

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
