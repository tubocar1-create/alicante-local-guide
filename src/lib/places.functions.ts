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
const DRINKS_QUERIES = [
  "bar",
  "cocktail bar",
  "pub",
  "irish pub",
  "wine bar",
  "vinoteca",
  "cervecería",
  "brewery",
  "rooftop bar",
  "gin tonic bar",
  "discoteca",
  "night club",
  "nightclub",
  "club nocturno",
  "sala de fiestas",
  "karaoke bar",
  "karaoke",
];
const TYPICAL_QUERIES = [
  "restaurante típico alicantino",
  "cocina alicantina",
  "cocina mediterránea",
  "restaurante tradicional",
  "tapas tradicionales",
  "tasca",
  "restaurante típico",
  "cocina española",
];
const RICE_FISH_QUERIES = [
  "arrocería",
  "paella",
  "arroz",
  "arroz a banda",
  "marisquería",
  "restaurante de pescado",
  "pescado fresco",
  "seafood restaurant",
  "rice restaurant",
];
const ITALIAN_QUERIES = [
  "italian restaurant",
  "restaurante italiano",
  "pizzería",
  "pizza",
  "pasta",
  "trattoria",
  "ristorante",
];
const CATEGORY_QUERIES: Record<string, string[]> = {
  asian: ASIAN_QUERIES,
  drinks: DRINKS_QUERIES,
  typical: TYPICAL_QUERIES,
  rice_fish: RICE_FISH_QUERIES,
  italian: ITALIAN_QUERIES,
};
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

// Curated lists: for categories where Google's text search mixes in unrelated
// venues (e.g. "tasca" returns pubs), we hand-pick well-known restaurants and
// then enrich each one with Google Places data by exact name lookup.
const CURATED_LISTS: Partial<Record<string, string[]>> = {
  typical: [
    "Nou Manolín",
    "Piripi",
    "La Taberna del Gourmet",
    "Cervecería Sento Felipe Bergé",
    "Cervecería Sento Teulada",
    "Mesón Labradores",
    "Casa Ibarra",
    "Govana",
    "Casa Riquelme",
    "El Portal Taberna & Wines",
    "La Ereta",
    "Pópuli Bistró",
    "Casa Julio",
    "Bodega Aurelio",
    "La Barra de César Anca",
    "El Chaflán de Aldebarán",
    "Mesón del Labrador",
    "Tasca del Pescador",
    "Restaurante Maestral",
    "Monastrell",
    "El Buen Comer",
    "Restaurante Aldebarán",
    "Casa Vital",
    "Quique Dacosta tabernas",
    "La Vaquería de Castellar",
  ],
};

async function searchOne(textQuery: string, apiKey: string): Promise<GPlace | null> {
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
      maxResultCount: 3,
      locationBias: {
        circle: {
          center: { latitude: ALC_CENTER.lat, longitude: ALC_CENTER.lng },
          radius: 8000,
        },
      },
    }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { places?: GPlace[] };
  return json.places?.[0] ?? null;
}

async function refreshCuratedCategory(category: string) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_PLACES_API_KEY missing");
  const names = CURATED_LISTS[category];
  if (!names || !names.length) return [];

  const seen = new Map<string, CachedPlace>();
  for (const name of names) {
    try {
      const p = await searchOne(name, apiKey);
      if (!p) continue;
      const row = toRow(p, category);
      if (row && !seen.has(row.google_place_id)) {
        seen.set(row.google_place_id, row);
      }
    } catch (e) {
      console.error(`searchOne failed for ${name}`, e);
    }
  }
  const rows = Array.from(seen.values());
  if (rows.length === 0) return rows;

  // Wipe previous rows in this category so removed names don't linger
  await supabaseAdmin.from("places_cache").delete().eq("category", category);
  const { error } = await supabaseAdmin
    .from("places_cache")
    .upsert(rows as never, { onConflict: "google_place_id" });
  if (error) {
    console.error(`upsert curated ${category} error`, error);
    throw error;
  }
  return rows;
}

async function refreshCategoryFromGoogle(category: string) {
  if (CURATED_LISTS[category]) return refreshCuratedCategory(category);

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_PLACES_API_KEY missing");
  const queries = CATEGORY_QUERIES[category];
  if (!queries) throw new Error(`unknown category: ${category}`);

  const seen = new Map<string, CachedPlace>();
  for (const q of queries) {
    const places = await searchGoogle(q, apiKey);
    for (const p of places) {
      const row = toRow(p, category);
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
    console.error(`upsert places_cache (${category}) error`, error);
    throw error;
  }
  return rows;
}


async function getCategoryPlaces(category: string) {
  const { data: existing, error } = await supabaseAdmin
    .from("places_cache")
    .select("*")
    .eq("category", category)
    .order("name");
  if (error) throw error;

  const newest = existing?.reduce<number>(
    (max, r) => Math.max(max, new Date(r.fetched_at as string).getTime()),
    0,
  ) ?? 0;
  const isStale = !existing?.length || Date.now() - newest > STALE_MS;

  if (isStale) {
    try {
      await refreshCategoryFromGoogle(category);
      const { data: fresh } = await supabaseAdmin
        .from("places_cache")
        .select("*")
        .eq("category", category)
        .order("name");
      return { places: fresh ?? [], refreshed: true };
    } catch (e) {
      console.error(`refresh ${category} failed, returning cached`, e);
      return { places: existing ?? [], refreshed: false };
    }
  }
  return { places: existing ?? [], refreshed: false };
}

export const getAsianPlaces = createServerFn({ method: "GET" }).handler(
  async () => getCategoryPlaces("asian"),
);
export const refreshAsianPlaces = createServerFn({ method: "POST" }).handler(
  async () => ({ count: (await refreshCategoryFromGoogle("asian")).length }),
);

export const getDrinksPlaces = createServerFn({ method: "GET" }).handler(
  async () => getCategoryPlaces("drinks"),
);
export const refreshDrinksPlaces = createServerFn({ method: "POST" }).handler(
  async () => ({ count: (await refreshCategoryFromGoogle("drinks")).length }),
);

export const getTypicalPlaces = createServerFn({ method: "GET" }).handler(
  async () => getCategoryPlaces("typical"),
);
export const refreshTypicalPlaces = createServerFn({ method: "POST" }).handler(
  async () => ({ count: (await refreshCategoryFromGoogle("typical")).length }),
);

export const getRiceFishPlaces = createServerFn({ method: "GET" }).handler(
  async () => getCategoryPlaces("rice_fish"),
);
export const refreshRiceFishPlaces = createServerFn({ method: "POST" }).handler(
  async () => ({ count: (await refreshCategoryFromGoogle("rice_fish")).length }),
);

export const getItalianPlaces = createServerFn({ method: "GET" }).handler(
  async () => getCategoryPlaces("italian"),
);
export const refreshItalianPlaces = createServerFn({ method: "POST" }).handler(
  async () => ({ count: (await refreshCategoryFromGoogle("italian")).length }),
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

    // Haversine distance in meters
    const distM = (la1: number, lo1: number, la2: number, lo2: number) => {
      const R = 6371000;
      const toRad = (x: number) => (x * Math.PI) / 180;
      const dLat = toRad(la2 - la1);
      const dLon = toRad(lo2 - lo1);
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(la1)) * Math.cos(toRad(la2)) * Math.sin(dLon / 2) ** 2;
      return 2 * R * Math.asin(Math.sqrt(a));
    };

    // Normalize a name for fuzzy comparison (strip accents, punctuation, lowercase)
    const norm = (s: string) =>
      s
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();

    const wantedNorm = norm(data.name);
    const MAX_DIST_M = 200; // accept only places within 200m of the OSM coords

    // 1) Try cache first — only accept if within distance threshold
    const { data: cached } = await supabaseAdmin
      .from("places_cache")
      .select("google_place_id,name,lat,lng");
    if (cached && cached.length && data.lat != null && data.lon != null) {
      const candidates = cached
        .filter(
          (r) =>
            r.lat != null &&
            r.lng != null &&
            norm(r.name as string) === wantedNorm,
        )
        .map((r) => ({
          id: r.google_place_id as string,
          d: distM(
            data.lat as number,
            data.lon as number,
            r.lat as number,
            r.lng as number,
          ),
        }))
        .sort((a, b) => a.d - b.d);
      const hit = candidates[0];
      if (hit && hit.d <= MAX_DIST_M) return { placeId: hit.id };
    }

    // 2) Ask Google Places
    const places = await searchGoogle(data.name, apiKey);
    if (!places.length) return { placeId: null };

    // Pick the closest to the OSM coords with a name that matches
    let pick: GPlace | null = null;
    let pickDist = Infinity;
    if (data.lat != null && data.lon != null) {
      for (const p of places) {
        if (!p.location) continue;
        const d = distM(
          data.lat as number,
          data.lon as number,
          p.location.latitude,
          p.location.longitude,
        );
        const nameOk =
          !p.displayName?.text ||
          norm(p.displayName.text).includes(wantedNorm) ||
          wantedNorm.includes(norm(p.displayName.text));
        if (nameOk && d < pickDist) {
          pick = p;
          pickDist = d;
        }
      }
    } else {
      pick = places[0];
    }

    // Reject if too far — likely a different restaurant
    if (!pick || (data.lat != null && pickDist > MAX_DIST_M)) {
      return { placeId: null };
    }

    const row = toRow(pick, "lookup");
    if (row) {
      await supabaseAdmin
        .from("places_cache")
        .upsert(row as never, { onConflict: "google_place_id" });
    }
    return { placeId: pick.id };
  });
