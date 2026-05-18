import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { syncStaticHotelsImpl } from "./hotels.server";
import { fetchHotelCalendarImpl } from "./hotels-liteapi.server";

export const syncStaticHotels = createServerFn({ method: "POST" }).handler(
  async () => {
    try {
      const result = await syncStaticHotelsImpl();
      return { ok: true as const, ...result };
    } catch (e: any) {
      console.error("syncStaticHotels failed", e);
      return { ok: false as const, error: e?.message ?? "unknown" };
    }
  },
);

export const listHotels = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("hotels_static")
    .select(
      "id, liteapi_hotel_id, name, address, stars, hotel_type, neighborhood, distance_km, main_image, booking_url, lat, lng, hotels_dynamic(available, current_price, currency, breakfast_included, free_cancellation, rooms_available, room_types, updated_at)",
    )
    .order("stars", { ascending: false, nullsFirst: false })
    .limit(500);
  if (error) return { hotels: [], error: error.message };
  return { hotels: data ?? [], error: null };
});

export const getHotel = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("hotels_static")
      .select(
        "id, liteapi_hotel_id, name, address, stars, hotel_type, neighborhood, distance_km, main_image, booking_url, lat, lng, amenities, raw, hotels_dynamic(available, current_price, currency, breakfast_included, free_cancellation, rooms_available, room_types, updated_at)",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) return { hotel: null, error: error.message };
    return { hotel: row, error: null };
  });

export const getHotelCalendar = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string; startDate: string; endDate?: string }) => d)
  .handler(async ({ data }) => {
    try {
      const res = await fetchHotelCalendarImpl(data.id, data.startDate, data.endDate);
      return { ok: true as const, ...res };
    } catch (e: any) {
      console.error("getHotelCalendar failed", e);
      return { ok: false as const, error: e?.message ?? "unknown", days: [] };
    }
  });

export const getHotelPhotos = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) return { photos: [] as string[] };
    const { data: row } = await supabaseAdmin
      .from("hotels_static")
      .select("raw")
      .eq("id", data.id)
      .maybeSingle();
    const photos = ((row?.raw as { photos?: Array<{ name: string }> } | null)?.photos ?? []).slice(0, 20);
    if (!photos.length) return { photos: [] as string[] };
    const urls = await Promise.all(
      photos.map(async (p) => {
        try {
          const r = await fetch(
            `https://places.googleapis.com/v1/${p.name}/media?maxWidthPx=1200&skipHttpRedirect=true&key=${apiKey}`,
          );
          if (!r.ok) return null;
          const j = (await r.json()) as { photoUri?: string };
          return j.photoUri ?? null;
        } catch {
          return null;
        }
      }),
    );
    return { photos: urls.filter((u): u is string => !!u) };
  });
