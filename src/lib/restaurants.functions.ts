import { createServerFn } from "@tanstack/react-start";

export type RandomRestaurant = {
  id: string;
  name: string;
  cuisine: string | null;
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
    const o = (d ?? {}) as { lat?: number; lng?: number; cuisineKeys?: string[] };
    return {
      lat: typeof o.lat === "number" ? o.lat : null,
      lng: typeof o.lng === "number" ? o.lng : null,
      cuisineKeys: Array.isArray(o.cuisineKeys)
        ? o.cuisineKeys.filter((s) => typeof s === "string").slice(0, 20)
        : null,
    };
  })
  .handler(async ({ data }): Promise<RandomRestaurant[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rowsRaw, error } = await supabaseAdmin
      .from("places")
      .select("id,google_place_id,name,cuisine,lat,lng,cover_photo,category,primary_type")
      .not("cover_photo", "is", null)
      .neq("cover_photo", "")
      .not("google_place_id", "is", null)
      .or("category.eq.restaurant,primary_type.eq.restaurant,primary_type.ilike.%restaurant%,primary_type.eq.meal_takeaway,primary_type.eq.meal_delivery")
      .limit(800);

    if (error) throw new Error(error.message);

    let rows = (rowsRaw ?? []).filter(
      (r) => r.name && r.lat != null && r.lng != null && r.cover_photo && r.google_place_id,
    );

    // Optional filter: match keys against cuisine OR primary_type
    if (data.cuisineKeys && data.cuisineKeys.length) {
      const keys = data.cuisineKeys.map((k) => k.toLowerCase());
      rows = rows.filter((r) => {
        const c = ((r.cuisine as string | null) ?? "").toLowerCase();
        const t = ((r.primary_type as string | null) ?? "").toLowerCase();
        return keys.some((k) => c.includes(k) || t.includes(k));
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

    return rows.slice(0, 20).map((r) => {
      const t = (r.primary_type as string | null) ?? null;
      const c = (r.cuisine as string | null) ?? null;
      const label = t && t !== "restaurant" ? t : c;
      return {
        id: String(r.google_place_id),
        name: r.name as string,
        cuisine: label,
        lat: Number(r.lat),
        lng: Number(r.lng),
        cover_photo: r.cover_photo as string,
      };
    });
  });
