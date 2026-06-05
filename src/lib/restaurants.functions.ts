import { createServerFn } from "@tanstack/react-start";

export type RandomRestaurant = {
  id: string;
  name: string;
  cuisine: string | null;
  lat: number;
  lng: number;
  cover_photo: string;
};

export const getRandomRestaurantsWithPhotos = createServerFn({ method: "GET" }).handler(
  async (): Promise<RandomRestaurant[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Pull a generous pool of restaurants with a real cover photo, then shuffle.
    const { data, error } = await supabaseAdmin
      .from("places")
      .select("id,google_place_id,name,cuisine,lat,lng,cover_photo,category,primary_type")
      .not("cover_photo", "is", null)
      .neq("cover_photo", "")
      .not("google_place_id", "is", null)
      .or("category.eq.restaurant,primary_type.eq.restaurant")
      .limit(400);

    if (error) throw new Error(error.message);

    const rows = (data ?? []).filter(
      (r) => r.name && r.lat != null && r.lng != null && r.cover_photo && r.google_place_id,
    );

    for (let i = rows.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rows[i], rows[j]] = [rows[j], rows[i]];
    }

    return rows.slice(0, 20).map((r) => ({
      id: String(r.google_place_id),
      name: r.name as string,
      cuisine: (r.cuisine as string | null) ?? null,
      lat: Number(r.lat),
      lng: Number(r.lng),
      cover_photo: r.cover_photo as string,
    }));
  },
);
