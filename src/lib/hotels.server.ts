import { supabaseAdmin } from "@/integrations/supabase/client.server";

const LITEAPI_BASE = "https://api.liteapi.travel/v3.0";
const ALICANTE_LAT = 38.3452;
const ALICANTE_LNG = -0.481;
const RADIUS_M = 10000;

function authHeaders() {
  const key = process.env.LITEAPI_KEY;
  if (!key) throw new Error("LITEAPI_KEY not configured");
  return { "X-API-Key": key, accept: "application/json" };
}

function distanceKm(lat: number, lng: number) {
  const R = 6371;
  const dLat = ((lat - ALICANTE_LAT) * Math.PI) / 180;
  const dLng = ((lng - ALICANTE_LNG) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((ALICANTE_LAT * Math.PI) / 180) *
      Math.cos((lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

export async function syncStaticHotelsImpl() {
  const url = new URL(`${LITEAPI_BASE}/data/hotels`);
  url.searchParams.set("countryCode", "ES");
  url.searchParams.set("cityName", "Alicante");
  url.searchParams.set("latitude", String(ALICANTE_LAT));
  url.searchParams.set("longitude", String(ALICANTE_LNG));
  url.searchParams.set("distance", String(RADIUS_M));
  url.searchParams.set("limit", "1000");

  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LiteAPI ${res.status}: ${text.slice(0, 300)}`);
  }
  const json = (await res.json()) as { data?: any[] };
  const hotels = json.data ?? [];

  if (hotels.length === 0) return { fetched: 0, upserted: 0 };

  const rows = hotels.map((h: any) => {
    const lat = Number(h.latitude ?? h.lat);
    const lng = Number(h.longitude ?? h.lng);
    return {
      liteapi_hotel_id: String(h.id ?? h.hotelId),
      name: h.name ?? "Hotel sin nombre",
      address: h.address ?? h.hotelDescription?.address ?? null,
      lat: isFinite(lat) ? lat : null,
      lng: isFinite(lng) ? lng : null,
      stars: h.stars ?? h.starRating ?? null,
      hotel_type: h.hotelType ?? h.type ?? null,
      neighborhood: h.zone ?? h.neighborhood ?? null,
      distance_km: isFinite(lat) && isFinite(lng) ? distanceKm(lat, lng) : null,
      main_image: h.main_photo ?? h.thumbnail ?? h.images?.[0]?.url ?? null,
      booking_url: `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(
        `${h.name ?? ""} Alicante`,
      )}`,
      amenities: h.amenities ?? h.hotelFacilities ?? [],
      raw: h,
    };
  });

  const { error } = await supabaseAdmin
    .from("hotels_static")
    .upsert(rows, { onConflict: "liteapi_hotel_id" });

  if (error) throw new Error(`Upsert failed: ${error.message}`);
  return { fetched: hotels.length, upserted: rows.length };
}
