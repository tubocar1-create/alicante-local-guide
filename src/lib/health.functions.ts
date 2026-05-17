import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Tope duro: máximo 10 resultados por categoría
const MAX_RESULTS = 10;

export type HealthProviderDTO = {
  id: string;
  category: string;
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  lat: number | null;
  lng: number | null;
  rating: number | null;
  user_ratings_total: number | null;
  photos: string[];
  google_place_id: string | null;
  opening_hours: Record<string, unknown> | null;
  price_level: string | null;
  notes: string | null;
  source: string;
};

function toDTO(row: Record<string, unknown>): HealthProviderDTO {
  return {
    id: row.id as string,
    category: row.category as string,
    name: row.name as string,
    address: (row.address as string) ?? null,
    phone: (row.phone as string) ?? null,
    website: (row.website as string) ?? null,
    lat: (row.lat as number) ?? null,
    lng: (row.lng as number) ?? null,
    rating: (row.rating as number) ?? null,
    user_ratings_total: (row.user_ratings_total as number) ?? null,
    photos: (row.photos as string[]) ?? [],
    google_place_id: (row.google_place_id as string) ?? null,
    opening_hours:
      (row.opening_hours as Record<string, unknown>) ?? null,
    price_level: (row.price_level as string) ?? null,
    notes: (row.notes as string) ?? null,
    source: (row.source as string) ?? "google",
  };
}

export const listHealthProviders = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ category: z.string().min(1).max(64) }).parse(data),
  )
  .handler(async ({ data }): Promise<HealthProviderDTO[]> => {
    const { data: rows, error } = await supabaseAdmin
      .from("health_providers")
      .select("*")
      .eq("category", data.category)
      .order("rating", { ascending: false, nullsFirst: false })
      .order("name");
    if (error) throw new Error(error.message);
    return (rows ?? []).map(toDTO);
  });

export const getHealthProvider = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }): Promise<HealthProviderDTO | null> => {
    const { data: row, error } = await supabaseAdmin
      .from("health_providers")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row ? toDTO(row) : null;
  });

// ---- Populate from Google Places (New API) ----
// Solo admins, máximo 10 resultados.

type PlaceNew = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  userRatingCount?: number;
  internationalPhoneNumber?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  priceLevel?: string;
  regularOpeningHours?: {
    weekdayDescriptions?: string[];
  };
  photos?: Array<{ name?: string }>;
};

export const populateHealthCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      category: z.string().min(1).max(64),
      query: z.string().min(2).max(200),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    // Check admin role
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Error("Forbidden: admin role required");

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) throw new Error("GOOGLE_PLACES_API_KEY not configured");

    // searchText (New Places API)
    const res = await fetch(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": [
            "places.id",
            "places.displayName",
            "places.formattedAddress",
            "places.location",
            "places.rating",
            "places.userRatingCount",
            "places.internationalPhoneNumber",
            "places.nationalPhoneNumber",
            "places.websiteUri",
            "places.priceLevel",
            "places.regularOpeningHours.weekdayDescriptions",
            "places.photos.name",
          ].join(","),
        },
        body: JSON.stringify({
          textQuery: data.query,
          pageSize: MAX_RESULTS,
          languageCode: "es",
          regionCode: "ES",
          locationBias: {
            circle: {
              center: { latitude: 38.3452, longitude: -0.481 },
              radius: 25000,
            },
          },
        }),
      },
    );

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Google Places error ${res.status}: ${txt.slice(0, 200)}`);
    }

    const json = (await res.json()) as { places?: PlaceNew[] };
    const places = (json.places ?? []).slice(0, MAX_RESULTS);

    let inserted = 0;
    for (const p of places) {
      if (!p.id || !p.displayName?.text) continue;
      const photos = (p.photos ?? [])
        .slice(0, 10)
        .map(
          (ph) =>
            `https://places.googleapis.com/v1/${ph.name}/media?maxWidthPx=900&key=${apiKey}`,
        );
      const phone = p.internationalPhoneNumber ?? p.nationalPhoneNumber ?? null;
      const { error } = await supabaseAdmin.from("health_providers").upsert(
        {
          category: data.category,
          name: p.displayName.text,
          address: p.formattedAddress ?? null,
          phone,
          website: p.websiteUri ?? null,
          lat: p.location?.latitude ?? null,
          lng: p.location?.longitude ?? null,
          rating: p.rating ?? null,
          user_ratings_total: p.userRatingCount ?? null,
          photos,
          google_place_id: p.id,
          opening_hours: p.regularOpeningHours
            ? (p.regularOpeningHours as unknown as Record<string, unknown>)
            : null,
          price_level: p.priceLevel ?? null,
          source: "google",
        },
        { onConflict: "google_place_id" },
      );
      if (!error) inserted++;
    }

    return { inserted, total: places.length };
  });
