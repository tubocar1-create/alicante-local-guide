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
const PIZZAS_QUERIES = [
  "telepizza",
  "domino's pizza",
  "papa john's",
  "pizza hut",
  "pizza móvil",
  "pizzería",
  "pizza a domicilio",
  "pizzería rápida",
];
const BRUNCH_QUERIES = [
  "brunch",
  "desayunos",
  "breakfast",
  "cafetería desayuno",
  "tortitas",
  "pancakes",
  "huevos benedictinos",
  "café especialidad",
  "specialty coffee",
];
const CATEGORY_QUERIES: Record<string, string[]> = {
  asian: ASIAN_QUERIES,
  drinks: DRINKS_QUERIES,
  typical: TYPICAL_QUERIES,
  rice_fish: RICE_FISH_QUERIES,
  italian: ITALIAN_QUERIES,
  pizzas: PIZZAS_QUERIES,
  brunch: BRUNCH_QUERIES,
};
// Refresco SOLO manual desde el panel admin. Sin caducidad automática:
// los lugares fijos no cambian y no queremos sangrar Google API en cada visita.
const STALE_MS = Number.POSITIVE_INFINITY;

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

export const getPlacePhotos = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => {
    const o = d as { placeId?: string; max?: number };
    if (!o?.placeId || typeof o.placeId !== "string") throw new Error("placeId required");
    return { placeId: o.placeId, max: Math.min(o.max ?? 4, 8) };
  })
  .handler(async ({ data }) => {
    // Sin llamadas a Google en cada visita. Devolvemos URLs del proxy interno.
    // Solo si NO hay refs cacheadas aún, hacemos UNA llamada a Place Details
    // para sembrar la lista, y nunca más.
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    const { data: row } = await supabaseAdmin
      .from("places_cache")
      .select("raw")
      .eq("google_place_id", data.placeId)
      .maybeSingle();
    let photos = ((row?.raw as { photos?: Array<{ name: string }> } | null)?.photos ?? []);

    if (photos.length === 0 && apiKey) {
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

    return {
      photos: photos
        .slice(0, data.max)
        .map((p) => `/api/public/google-photo/${p.name}?w=1200`),
    };
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
  rice_fish: [
    "Nou Manolín",
    "Piripi",
    "Monastrell",
    "El Portal Taberna & Wines",
    "La Ereta",
    "Pópuli Bistró",
    "La Taberna del Gourmet",
    "Restaurante Maestral",
    "Dársena Restaurante",
    "Restaurante Aldebarán",
    "La Cantera Restaurante Alicante",
    "Govana",
    "Mesón Labradores",
    "Casa Ibarra",
    "Casa Riquelme",
    "Bodega Aurelio",
    "La Barra de César Anca",
    "Restaurante La Mar Salá Alicante",
    "Restaurante Cruz del Sur Alicante",
    "Restaurante El Coscorrón",
    "Restaurante La Marítima Alicante",
    "Arroceria La Vall Alicante",
    "Restaurante Cibeles Alicante",
    "Restaurante Mary Carmen Alicante",
    "El Chaflán de Aldebarán",
    "Tasca del Pescador",
    "Restaurante Don Camilo Alicante",
    "La Goleta Alicante",
    "Restaurante Sirocco Alicante",
  ],
  italian: [
    "La Taglierina Alicante",
    "Il Forno di Alicante",
    "La Tagliatella Alicante",
    "Pomodoro Pizzería Alicante",
    "Da Tano Alicante",
    "Trattoria Mamma Mia Alicante",
    "La Pasta Nostra Alicante",
    "Il Vespino Alicante",
    "Pizzeria Salerno Alicante",
    "Ristorante Il Cappuccino Alicante",
    "La Bella Napoli Alicante",
    "Pizzería Carlos Alicante",
    "Grosso Napoletano Alicante",
    "NAP Neapolitan Authentic Pizza Alicante",
    "Pizzeria La Vita è Bella Alicante",
    "Ristorante Da Vinci Alicante",
    "Trattoria Da Sergio Alicante",
    "Pizzería Mediterránea Alicante",
    "Bottega di Mamma Rosa Alicante",
    "Ristorante La Dolce Vita Alicante",
    "Pizzeria Ciao Ciao Alicante",
    "Il Pomodorino Alicante",
    "Ristorante Romeo Alicante",
    "Pizzeria Vesuvio Alicante",
  ],
  pizzas: [
    "Telepizza Alicante Maisonnave",
    "Telepizza Alicante Garbinet",
    "Telepizza Alicante San Blas",
    "Telepizza Alicante Vistahermosa",
    "Telepizza Alicante Plaza de los Luceros",
    "Domino's Pizza Alicante Centro",
    "Domino's Pizza Alicante Avenida Aguilera",
    "Domino's Pizza Alicante Babel",
    "Domino's Pizza Alicante San Blas",
    "Papa John's Pizza Alicante",
    "Pizza Hut Alicante Plaza Mar 2",
    "Pizza Móvil Alicante",
    "Pizzería Carlos Alicante Maisonnave",
    "Pizzería Carlos Alicante San Vicente",
    "La Pizza Nostra Alicante",
    "Pizza Jardín Alicante",
    "Pinsa Pizza Alicante",
    "Grosso Napoletano Alicante",
    "NAP Neapolitan Authentic Pizza Alicante",
    "Pomodoro Pizzería Alicante",
    "La Tagliatella Alicante",
    "Pizzeria Salerno Alicante",
    "Pizzeria La Vita è Bella Alicante",
    "Pizzeria Ciao Ciao Alicante",
    "Pizzería Mediterránea Alicante",
    "Pizzería Vesuvio Alicante",
    "Pizzería La Bella Napoli Alicante",
    "Pizzería Hawai Alicante",
  ],
  brunch: [
    "Brunchit Alicante",
    "Manacafé Alicante",
    "Mauro & Sensai Alicante",
    "La Cremería Alicante",
    "Sanissimo Alicante",
    "Velázquez 25 Alicante",
    "Toast Café Alicante",
    "Santagloria Coffee & Bakery Alicante",
    "Granier Alicante",
    "Panaria Alicante",
    "Pópuli Bistró Alicante",
    "El Portal Taberna & Wines Alicante",
    "Cervecería Sento Felipe Bergé",
    "Cervecería Sento Teulada",
    "La Taberna del Gourmet Alicante",
    "Cafés Valiente Alicante",
    "Coffee & Co Alicante",
    "Café del Mar Alicante",
    "Hummus Café Alicante",
    "Cafetería Mendoza Alicante",
    "Cafetería Versalles Alicante",
    "Cafetería Edén Alicante",
    "Pastelería Tahona Alicante",
    "Horno San Buenaventura Alicante",
    "Confitería Pastisseria Pol Alicante",
    "Mercado Central Alicante",
    "Heladería Borgonesse Alicante",
    "El Granaíno Alicante",
    "Pastelería La Madrileña Alicante",
    "La Bodeguita del Medio Alicante",
  ],
};

async function searchGoogleNear(
  textQuery: string,
  apiKey: string,
  center: { lat: number; lng: number },
  radius = 3000,
): Promise<GPlace[]> {
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({
      textQuery,
      languageCode: "es",
      regionCode: "ES",
      maxResultCount: 20,
      locationBias: {
        circle: {
          center: { latitude: center.lat, longitude: center.lng },
          radius,
        },
      },
    }),
  });
  if (!res.ok) {
    console.error("Google Places nearby error", res.status, await res.text());
    return [];
  }
  const json = (await res.json()) as { places?: GPlace[] };
  return json.places ?? [];
}

export const discoverNearbyPlaces = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => {
    const o = d as { lat?: number; lng?: number; category?: string; radius?: number };
    if (typeof o?.lat !== "number" || typeof o?.lng !== "number") {
      throw new Error("lat/lng required");
    }
    if (!o.category || !CATEGORY_QUERIES[o.category]) {
      throw new Error("valid category required");
    }
    return {
      lat: o.lat,
      lng: o.lng,
      category: o.category,
      radius: Math.max(500, Math.min(o.radius ?? 3000, 8000)),
    };
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) return { added: 0 };
    const queries = CATEGORY_QUERIES[data.category]!;
    const seen = new Map<string, CachedPlace>();
    for (const q of queries) {
      const places = await searchGoogleNear(q, apiKey, { lat: data.lat, lng: data.lng }, data.radius);
      for (const p of places) {
        const row = toRow(p, data.category);
        if (row && !seen.has(row.google_place_id)) seen.set(row.google_place_id, row);
      }
    }
    const rows = Array.from(seen.values());
    if (rows.length === 0) return { added: 0 };
    const { error } = await supabaseAdmin
      .from("places_cache")
      .upsert(rows as never, { onConflict: "google_place_id" });
    if (error) {
      console.error(`upsert nearby ${data.category} error`, error);
      throw error;
    }
    return { added: rows.length };
  });

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


async function fetchByCategoryOrTag(category: string) {
  // Multi-classification: a place matches if its primary `category` equals X
  // OR its `ai_tags` array contains X. Reclassification writes main categories
  // into both columns, so a paella spot can show up in `rice_fish` and `typical`.
  const { data, error } = await supabaseAdmin
    .from("places_cache")
    .select("*")
    .or(`category.eq.${category},ai_tags.cs.{${category}}`)
    .order("name");
  if (error) throw error;
  return data ?? [];
}

async function getCategoryPlaces(category: string) {
  const existing = await fetchByCategoryOrTag(category);

  const newest = existing.reduce<number>(
    (max, r) => Math.max(max, new Date(r.fetched_at as string).getTime()),
    0,
  );
  const isStale = !existing.length || Date.now() - newest > STALE_MS;

  // `international` has no Google query template — only DB-backed.
  const isRefreshable = category !== "international";

  if (isStale && isRefreshable) {
    try {
      await refreshCategoryFromGoogle(category);
      const fresh = await fetchByCategoryOrTag(category);
      return { places: fresh, refreshed: true };
    } catch (e) {
      console.error(`refresh ${category} failed, returning cached`, e);
      return { places: existing, refreshed: false };
    }
  }
  return { places: existing, refreshed: false };
}

export const getInternationalPlaces = createServerFn({ method: "GET" }).handler(
  async () => getCategoryPlaces("international"),
);

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

export const getBrunchPlaces = createServerFn({ method: "GET" }).handler(
  async () => getCategoryPlaces("brunch"),
);
export const refreshBrunchPlaces = createServerFn({ method: "POST" }).handler(
  async () => ({ count: (await refreshCategoryFromGoogle("brunch")).length }),
);

export const getPizzasPlaces = createServerFn({ method: "GET" }).handler(
  async () => getCategoryPlaces("pizzas"),
);
export const refreshPizzasPlaces = createServerFn({ method: "POST" }).handler(
  async () => ({ count: (await refreshCategoryFromGoogle("pizzas")).length }),
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

// ============= Manual additions to places_cache =============

const VALID_CATEGORIES = new Set([
  "asian",
  "drinks",
  "typical",
  "rice_fish",
  "italian",
  "pizzas",
  "brunch",
  "international",
  "lookup",
]);

async function followRedirect(url: string): Promise<string> {
  // maps.app.goo.gl / goo.gl/maps short URLs redirect to the long URL.
  // Use GET with redirect: "manual" once, then return the Location header (or the original if none).
  try {
    let current = url;
    for (let i = 0; i < 4; i++) {
      const res = await fetch(current, {
        method: "GET",
        redirect: "manual",
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      const loc = res.headers.get("location");
      if (!loc) return current;
      current = loc.startsWith("http") ? loc : new URL(loc, current).toString();
    }
    return current;
  } catch {
    return url;
  }
}

function parseMapsUrl(longUrl: string): { name?: string; lat?: number; lng?: number } {
  const out: { name?: string; lat?: number; lng?: number } = {};
  try {
    const u = new URL(longUrl);
    // /maps/place/<NAME>/@lat,lng,...
    const m = u.pathname.match(/\/place\/([^/]+)\/?/);
    if (m) {
      try {
        out.name = decodeURIComponent(m[1]).replace(/\+/g, " ");
      } catch {
        out.name = m[1].replace(/\+/g, " ");
      }
    }
    const c = u.pathname.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (c) {
      out.lat = Number(c[1]);
      out.lng = Number(c[2]);
    }
  } catch {
    // ignore
  }
  return out;
}

async function fetchPlaceDetailsById(placeId: string, apiKey: string): Promise<GPlace | null> {
  const res = await fetch(
    `https://places.googleapis.com/v1/places/${placeId}?languageCode=es&regionCode=ES`,
    {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK.replace(/places\./g, ""),
      },
    },
  );
  if (!res.ok) {
    console.error("place details error", res.status, await res.text());
    return null;
  }
  return (await res.json()) as GPlace;
}

async function searchNearOne(
  textQuery: string,
  apiKey: string,
  center: { lat: number; lng: number },
  radius = 200,
): Promise<GPlace | null> {
  const places = await searchGoogleNear(textQuery, apiKey, center, radius);
  return places[0] ?? null;
}

export const addPlaceFromGoogle = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => {
    const o = d as { input?: string; category?: string };
    if (!o?.input || typeof o.input !== "string" || o.input.trim().length < 3) {
      throw new Error("URL o Place ID requerido");
    }
    if (!o.category || !VALID_CATEGORIES.has(o.category)) {
      throw new Error("Categoría inválida");
    }
    return { input: o.input.trim(), category: o.category };
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) throw new Error("GOOGLE_PLACES_API_KEY no configurada");

    let place: GPlace | null = null;

    // Case 1: looks like a raw Place ID (starts with "ChIJ" or "GhIJ")
    if (/^[A-Za-z0-9_-]{20,}$/.test(data.input) && !data.input.includes("/")) {
      place = await fetchPlaceDetailsById(data.input, apiKey);
    }

    // Case 2: URL — follow redirect, parse, then look up
    if (!place && /^https?:\/\//i.test(data.input)) {
      const longUrl = await followRedirect(data.input);
      const parsed = parseMapsUrl(longUrl);
      if (parsed.name) {
        if (parsed.lat != null && parsed.lng != null) {
          place = await searchNearOne(
            parsed.name,
            apiKey,
            { lat: parsed.lat, lng: parsed.lng },
            300,
          );
        }
        if (!place) place = await searchOne(parsed.name, apiKey);
      }
    }

    // Case 3: plain text — search it
    if (!place) {
      place = await searchOne(data.input, apiKey);
    }

    if (!place) {
      return { ok: false, reason: "not_found" as const };
    }

    const row = toRow(place, data.category);
    if (!row) return { ok: false, reason: "bad_data" as const };

    const { error } = await supabaseAdmin
      .from("places_cache")
      .upsert(row as never, { onConflict: "google_place_id" });
    if (error) {
      console.error("addPlaceFromGoogle upsert error", error);
      throw error;
    }
    return {
      ok: true as const,
      place: {
        google_place_id: row.google_place_id,
        name: row.name,
        address: row.address,
        category: row.category,
        rating: row.rating,
        lat: row.lat,
        lng: row.lng,
      },
    };
  });

export const addPlaceManual = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => {
    const o = d as {
      name?: string;
      category?: string;
      address?: string;
      lat?: number;
      lng?: number;
      phone?: string;
      website?: string;
      rating?: number;
      cuisine?: string;
    };
    if (!o?.name || o.name.trim().length < 2) throw new Error("Nombre requerido");
    if (!o.category || !VALID_CATEGORIES.has(o.category)) throw new Error("Categoría inválida");
    return {
      name: o.name.trim().slice(0, 200),
      category: o.category,
      address: o.address?.trim().slice(0, 400) ?? null,
      lat: typeof o.lat === "number" ? o.lat : null,
      lng: typeof o.lng === "number" ? o.lng : null,
      phone: o.phone?.trim().slice(0, 40) ?? null,
      website: o.website?.trim().slice(0, 400) ?? null,
      rating: typeof o.rating === "number" ? o.rating : null,
      cuisine: o.cuisine?.trim().slice(0, 80) ?? null,
    };
  })
  .handler(async ({ data }) => {
    // Synthesize a stable id for manual entries
    const slug = data.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
    const google_place_id = `manual:${data.category}:${slug}`;

    const row: CachedPlace = {
      google_place_id,
      name: data.name,
      cuisine: data.cuisine,
      primary_type: null,
      types: null,
      address: data.address,
      lat: data.lat,
      lng: data.lng,
      opening_hours_text: null,
      opening_hours_json: null,
      open_now: null,
      price_level: null,
      price_range_min: null,
      price_range_max: null,
      price_currency: null,
      rating: data.rating,
      user_rating_count: null,
      phone: data.phone,
      website: data.website,
      category: data.category,
      fetched_at: new Date().toISOString(),
      raw: { source: "manual" },
    };
    const { error } = await supabaseAdmin
      .from("places_cache")
      .upsert(row as never, { onConflict: "google_place_id" });
    if (error) throw error;
    return { ok: true as const, place: { google_place_id, name: data.name, category: data.category } };
  });

export const listPlacesByCategory = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => {
    const o = d as { category?: string };
    if (!o?.category || !VALID_CATEGORIES.has(o.category)) throw new Error("Categoría inválida");
    return { category: o.category };
  })
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabaseAdmin
      .from("places_cache")
      .select("google_place_id,name,address,rating,lat,lng,category,fetched_at")
      .eq("category", data.category)
      .order("name");
    if (error) throw error;
    return { places: rows ?? [] };
  });

export const deletePlace = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => {
    const o = d as { placeId?: string };
    if (!o?.placeId) throw new Error("placeId requerido");
    return { placeId: o.placeId };
  })
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("places_cache")
      .delete()
      .eq("google_place_id", data.placeId);
    if (error) throw error;
    return { ok: true as const };
  });

// ============= AI-tagged virtual categories =============
// Reuses places_cache rows (any category) and adds free-form ai_tags assigned
// by the Lovable AI gateway. No new Google Places calls are made.

export const VIRTUAL_TAGS = [
  "fast_food",
  "fast_food:burger",
  "fast_food:pizza",
  "fast_food:montaditos",
  "fast_food:kebab",
  "fast_food:chicken",
  "fast_food:mexican",
  "vegan",
  "desserts",
  "desserts:icecream",
  "cheap",
] as const;
export type VirtualTag = (typeof VIRTUAL_TAGS)[number];

type ClassifyRow = {
  google_place_id: string;
  name: string;
  cuisine: string | null;
  primary_type: string | null;
  types: string[] | null;
  price_level: string | null;
  address: string | null;
  category: string;
};

const CLASSIFY_BATCH = 40;
const TAGS_LIST = VIRTUAL_TAGS.join(", ");
const SYSTEM_PROMPT = `Eres un clasificador de restaurantes/bares/cafés de Alicante.
Devuelves SOLO etiquetas de esta lista cerrada: ${TAGS_LIST}.

Reglas:
- "fast_food" agrupa hamburgueserías, pizzerías de cadena, montaditos, kebaps, pollo frito, mexicano rápido.
  Si aplica, añade además la sub-etiqueta (p.ej. ["fast_food","fast_food:burger"]).
- "vegan" sólo si el sitio es vegano, vegetariano o claramente "saludable / bowls / poke".
- "desserts" para heladerías, pastelerías, cafeterías con postres, chocolaterías, gofres, crepes.
  Las heladerías llevan SIEMPRE además "desserts:icecream".
- "cheap" si price_level es FREE/INEXPENSIVE, o el nombre/tipo indica menú barato, fast food, comida callejera.
- Devuelve [] si NO encaja en ninguna etiqueta.
Responde SOLO JSON: { "results": [ { "id": "<google_place_id>", "tags": ["..."] }, ... ] }`;

async function classifyBatch(rows: ClassifyRow[], apiKey: string): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  const userPayload = rows.map((r) => ({
    id: r.google_place_id,
    name: r.name,
    cuisine: r.cuisine,
    primary_type: r.primary_type,
    types: r.types?.slice(0, 6) ?? null,
    price_level: r.price_level,
    address: r.address,
    category: r.category,
  }));
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(userPayload) },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    console.error("AI classify error", res.status, await res.text());
    return out;
  }
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = json.choices?.[0]?.message?.content ?? "";
  try {
    const parsed = JSON.parse(content) as { results?: Array<{ id: string; tags: string[] }> };
    const valid = new Set<string>(VIRTUAL_TAGS as readonly string[]);
    for (const r of parsed.results ?? []) {
      const tags = (r.tags ?? []).filter((t) => valid.has(t));
      out.set(r.id, tags);
    }
  } catch (e) {
    console.error("AI classify parse error", e, content.slice(0, 200));
  }
  // Ensure rows that had no tag assigned still get an empty array
  // so we don't reclassify them on every call.
  for (const r of rows) {
    if (!out.has(r.google_place_id)) out.set(r.google_place_id, []);
  }
  return out;
}

async function ensureClassified(limit = 2000): Promise<{ classified: number }> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) {
    console.warn("LOVABLE_API_KEY missing — skipping AI classification");
    return { classified: 0 };
  }
  const { data: rows, error } = await supabaseAdmin
    .from("places_cache")
    .select("google_place_id,name,cuisine,primary_type,types,price_level,address,category")
    .is("ai_tags", null)
    .limit(limit);
  if (error) throw error;
  if (!rows || rows.length === 0) return { classified: 0 };

  let total = 0;
  for (let i = 0; i < rows.length; i += CLASSIFY_BATCH) {
    const batch = rows.slice(i, i + CLASSIFY_BATCH) as ClassifyRow[];
    const tagged = await classifyBatch(batch, apiKey);
    const updates: Array<{ id: string; tags: string[] }> = [];
    tagged.forEach((tags, id) => updates.push({ id, tags }));
    await Promise.all(
      updates.map((u) =>
        supabaseAdmin
          .from("places_cache")
          .update({ ai_tags: u.tags } as never)
          .eq("google_place_id", u.id),
      ),
    );
    total += updates.length;
  }
  return { classified: total };
}

export const classifyPlacesAi = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => {
    const o = (d ?? {}) as { limit?: number };
    return { limit: Math.max(10, Math.min(o.limit ?? 2000, 5000)) };
  })
  .handler(async ({ data }) => ensureClassified(data.limit));

export const getPlacesByTag = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => {
    const o = d as { tag?: string };
    if (!o?.tag || !(VIRTUAL_TAGS as readonly string[]).includes(o.tag)) {
      throw new Error("tag inválido");
    }
    return { tag: o.tag };
  })
  .handler(async ({ data }) => {
    // Classify ALL pending rows synchronously so the dashboard reflects the entire DB.
    try {
      await ensureClassified(2000);
    } catch (e) {
      console.error("ensureClassified error", e);
    }

    const { data: rows, error } = await supabaseAdmin
      .from("places_cache")
      .select("*")
      .contains("ai_tags", [data.tag])
      .order("name")
      .limit(1000);
    if (error) throw error;
    return { places: rows ?? [] };
  });

export const getSurprisePlaces = createServerFn({ method: "GET" }).handler(async () => {
  // Random sample of well-rated places across the ENTIRE database.
  const { data: rows, error } = await supabaseAdmin
    .from("places_cache")
    .select("*")
    .gte("rating", 4.2)
    .limit(1000);
  if (error) throw error;
  const shuffled = (rows ?? []).slice().sort(() => Math.random() - 0.5);
  return { places: shuffled.slice(0, 80) };
});

// ============= AI re-classification of main category =============
// Walks the entire places_cache and asks Lovable AI to assign the best
// main category (typical, rice_fish, italian, pizzas, brunch, asian, drinks)
// based on the place's "ficha" (name, cuisine, primary_type, types, address).

const MAIN_CATEGORIES = [
  "typical",
  "rice_fish",
  "italian",
  "pizzas",
  "brunch",
  "asian",
  "drinks",
  "international",
] as const;
type MainCategory = (typeof MAIN_CATEGORIES)[number];

const RECLASSIFY_BATCH = 40;
const RECLASSIFY_SYSTEM = `Eres un clasificador de restaurantes/bares/cafés de Alicante.
Asignas a CADA sitio entre 1 y 3 categorías de esta lista cerrada: ${MAIN_CATEGORIES.join(", ")}.

Definiciones:
- "typical": comida típica alicantina/española, tapas, mediterránea tradicional, tascas, mesones.
- "rice_fish": arrocerías, paellas, mariscos, pescados, marisquerías.
- "italian": cocina italiana general (pasta, trattorias, ristorantes).
- "pizzas": pizzerías cuyo producto principal es la pizza.
- "brunch": brunch, desayunos, cafeterías de especialidad, tortitas, bowls saludables.
- "asian": japonés, chino, tailandés, coreano, vietnamita, sushi, ramen, wok.
- "drinks": bares, pubs, coctelerías, cervecerías, vinotecas (consumo principalmente bebida).
- "international": cocinas extranjeras NO incluidas en italian/asian — hindú/indio, libanés, árabe, peruano, mexicano de mesa, latinoamericano (venezolano, colombiano, argentino, cubano, brasileño), turco de mesa, marroquí, griego, etc.

Reglas:
- Devuelve SIEMPRE al menos UNA categoría (la dominante primero).
- Si el sitio encaja claramente en varias, devuélvelas todas (máx. 3). Ej: una arrocería tradicional alicantina → ["rice_fish","typical"]. Un sushi-bar con cócteles → ["asian","drinks"]. Una taberna que sirve paellas → ["typical","rice_fish"].
- "international" SOLO para cocinas extranjeras de mesa (no fast food). Un kebap rápido NO es international.
- La primera categoría del array es la PRIMARIA.
Responde SOLO JSON: { "results": [ { "id": "<google_place_id>", "categories": ["<primaria>", "<otra>", ...] }, ... ] }`;

async function reclassifyBatch(
  rows: ClassifyRow[],
  apiKey: string,
): Promise<Map<string, MainCategory[]>> {
  const out = new Map<string, MainCategory[]>();
  const payload = rows.map((r) => ({
    id: r.google_place_id,
    name: r.name,
    cuisine: r.cuisine,
    primary_type: r.primary_type,
    types: r.types?.slice(0, 8) ?? null,
    address: r.address,
    current: r.category,
  }));
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: RECLASSIFY_SYSTEM },
        { role: "user", content: JSON.stringify(payload) },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    console.error("AI reclassify error", res.status, await res.text());
    return out;
  }
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = json.choices?.[0]?.message?.content ?? "";
  try {
    const parsed = JSON.parse(content) as {
      results?: Array<{ id: string; categories?: string[]; category?: string }>;
    };
    const valid = new Set<string>(MAIN_CATEGORIES as readonly string[]);
    for (const r of parsed.results ?? []) {
      const list = (r.categories ?? (r.category ? [r.category] : []))
        .filter((c): c is string => typeof c === "string" && valid.has(c));
      const dedup = Array.from(new Set(list)) as MainCategory[];
      if (dedup.length > 0) out.set(r.id, dedup.slice(0, 3));
    }
  } catch (e) {
    console.error("AI reclassify parse error", e, content.slice(0, 200));
  }
  return out;
}

const VIRTUAL_SET = new Set<string>(VIRTUAL_TAGS as readonly string[]);
const MAIN_SET = new Set<string>(MAIN_CATEGORIES as readonly string[]);

export const reclassifyAllCategories = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => {
    const o = (d ?? {}) as { limit?: number };
    return { limit: Math.max(10, Math.min(o.limit ?? 1000, 5000)) };
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");
    const { data: rows, error } = await supabaseAdmin
      .from("places_cache")
      .select("google_place_id,name,cuisine,primary_type,types,price_level,address,category,ai_tags")
      .neq("category", "lookup")
      .limit(data.limit);
    if (error) throw error;
    if (!rows || rows.length === 0) return { processed: 0, updated: 0 };

    let processed = 0;
    let updated = 0;
    for (let i = 0; i < rows.length; i += RECLASSIFY_BATCH) {
      const batch = rows.slice(i, i + RECLASSIFY_BATCH) as Array<
        ClassifyRow & { ai_tags: string[] | null }
      >;
      const assigned = await reclassifyBatch(batch, apiKey);
      const updates: Array<Promise<unknown>> = [];
      for (const r of batch) {
        processed++;
        const cats = assigned.get(r.google_place_id);
        if (!cats || cats.length === 0) continue;
        const primary = cats[0];
        // Preserve existing virtual tags (fast_food, vegan, desserts, cheap…),
        // strip stale main-category tags, and write the freshly assigned ones.
        const existing = r.ai_tags ?? [];
        const virtual = existing.filter((t) => VIRTUAL_SET.has(t) && !MAIN_SET.has(t));
        const newTags = Array.from(new Set([...cats, ...virtual]));
        updated++;
        updates.push(
          (async () => {
            await supabaseAdmin
              .from("places_cache")
              .update({ category: primary, ai_tags: newTags } as never)
              .eq("google_place_id", r.google_place_id);
          })(),
        );
      }
      await Promise.all(updates);
    }
    return { processed, updated };
  });
