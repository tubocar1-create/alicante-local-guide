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

async function hasForegroundPerson(url: string, aiKey: string): Promise<boolean> {
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${aiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  "Does this photo show one or more people as the main subject in the foreground (close-up portraits, selfies, group shots, staff/guests posing)? Answer with a single word: YES or NO. Small distant people in the background count as NO.",
              },
              { type: "image_url", image_url: { url } },
            ],
          },
        ],
      }),
    });
    if (!r.ok) return false;
    const j = (await r.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const t = (j.choices?.[0]?.message?.content ?? "").toString().trim().toUpperCase();
    return t.startsWith("Y");
  } catch {
    return false;
  }
}

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
    const raw = (row?.raw ?? {}) as {
      photos?: Array<{ name: string }>;
      photo_filter?: Record<string, "ok" | "person">;
    };
    const photos = (raw.photos ?? []).slice(0, 20);
    if (!photos.length) return { photos: [] as string[] };

    // Resolve URLs in parallel
    const resolved = await Promise.all(
      photos.map(async (p) => {
        try {
          const r = await fetch(
            `https://places.googleapis.com/v1/${p.name}/media?maxWidthPx=1200&skipHttpRedirect=true&key=${apiKey}`,
          );
          if (!r.ok) return null;
          const j = (await r.json()) as { photoUri?: string };
          return j.photoUri ? { name: p.name, url: j.photoUri } : null;
        } catch {
          return null;
        }
      }),
    );
    const ok = resolved.filter((x): x is { name: string; url: string } => !!x);

    // Classify (cached per photo name) — drop foreground people
    const aiKey = process.env.LOVABLE_API_KEY;
    const cache = { ...(raw.photo_filter ?? {}) };
    if (aiKey) {
      const toCheck = ok.filter((p) => !cache[p.name]);
      const verdicts = await Promise.all(
        toCheck.map(async (p) => ({
          name: p.name,
          person: await hasForegroundPerson(p.url, aiKey),
        })),
      );
      for (const v of verdicts) cache[v.name] = v.person ? "person" : "ok";
      if (verdicts.length) {
        await supabaseAdmin
          .from("hotels_static")
          .update({ raw: { ...raw, photo_filter: cache } as never })
          .eq("id", data.id);
      }
    }

    return { photos: ok.filter((p) => cache[p.name] !== "person").map((p) => p.url) };
  });
