import { createServerFn } from "@tanstack/react-start";

export type RandomRestaurant = {
  id: string;
  name: string;
  cuisine: string | null;
  tags: string[];
  lat: number;
  lng: number;
  cover_photo: string;
};

function distKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export const getRandomRestaurantsWithPhotos = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => {
    const o = (d ?? {}) as { lat?: number; lng?: number; tagKeys?: string[]; cuisineKeys?: string[] };
    // cuisineKeys kept for backwards compatibility but treated as tagKeys
    const tk = Array.isArray(o.tagKeys) ? o.tagKeys : o.cuisineKeys;
    return {
      lat: typeof o.lat === "number" ? o.lat : null,
      lng: typeof o.lng === "number" ? o.lng : null,
      tagKeys: Array.isArray(tk)
        ? tk.filter((s) => typeof s === "string").slice(0, 30)
        : null,
    };
  })
  .handler(async ({ data }): Promise<RandomRestaurant[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rowsRaw, error } = await supabaseAdmin
      .from("places")
      .select("id,google_place_id,name,cuisine,lat,lng,cover_photo,category,primary_type,ai_tags")
      .not("cover_photo", "is", null)
      .neq("cover_photo", "")
      .not("google_place_id", "is", null)
      .or("category.eq.restaurant,primary_type.eq.restaurant,primary_type.ilike.%restaurant%,primary_type.eq.meal_takeaway,primary_type.eq.meal_delivery")
      .limit(1000);

    if (error) throw new Error(error.message);

    let rows = (rowsRaw ?? []).filter(
      (r) => r.name && r.lat != null && r.lng != null && r.cover_photo && r.google_place_id,
    );

    // Filter by ai_tags (exact match against any of the provided keys)
    if (data.tagKeys && data.tagKeys.length) {
      const keys = data.tagKeys.map((k) => k.toLowerCase());
      rows = rows.filter((r) => {
        const tags = (r.ai_tags as string[] | null) ?? [];
        return tags.some((t) => keys.includes(String(t).toLowerCase()));
      });
    }

    if (data.lat != null && data.lng != null) {
      const origin = { lat: data.lat, lng: data.lng };
      rows.sort(
        (a, b) =>
          distKm(origin, { lat: Number(a.lat), lng: Number(a.lng) }) -
          distKm(origin, { lat: Number(b.lat), lng: Number(b.lng) }),
      );
      rows = rows.slice(0, 60);
    }

    for (let i = rows.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rows[i], rows[j]] = [rows[j], rows[i]];
    }

    return rows.slice(0, 20).map((r) => ({
      id: String(r.google_place_id),
      name: r.name as string,
      cuisine: (r.cuisine as string | null) ?? null,
      tags: ((r.ai_tags as string[] | null) ?? []).map(String),
      lat: Number(r.lat),
      lng: Number(r.lng),
      cover_photo: r.cover_photo as string,
    }));
  });
