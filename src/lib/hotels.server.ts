import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ALICANTE_LAT = 38.3452;
const ALICANTE_LNG = -0.481;
const RADIUS_M = 10000;

// Google Places (New) – Nearby Search v1
const PLACES_URL = "https://places.googleapis.com/v1/places:searchNearby";

const INCLUDED_TYPES = [
  "hotel",
  "lodging",
  "resort_hotel",
  "extended_stay_hotel",
  "bed_and_breakfast",
  "guest_house",
  "hostel",
  "motel",
  "inn",
  "cottage",
  "private_guest_room",
];

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.priceLevel",
  "places.primaryType",
  "places.types",
  "places.googleMapsUri",
  "places.websiteUri",
  "places.photos",
  "places.shortFormattedAddress",
].join(",");

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

function photoUrl(name: string | undefined, apiKey: string) {
  if (!name) return null;
  return `https://places.googleapis.com/v1/${name}/media?maxHeightPx=600&key=${apiKey}`;
}

async function nearbyPage(apiKey: string) {
  const res = await fetch(PLACES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({
      includedTypes: INCLUDED_TYPES,
      maxResultCount: 20,
      locationRestriction: {
        circle: {
          center: { latitude: ALICANTE_LAT, longitude: ALICANTE_LNG },
          radius: RADIUS_M,
        },
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Places ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as { places?: any[] };
}

export async function syncStaticHotelsImpl() {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_PLACES_API_KEY not configured");

  // Single call: Places (New) Nearby returns up to 20 by type+location.
  // For wider coverage we issue per-type calls and dedupe by place id.
  const seen = new Map<string, any>();
  for (const type of INCLUDED_TYPES) {
    const res = await fetch(PLACES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify({
        includedTypes: [type],
        maxResultCount: 20,
        locationRestriction: {
          circle: {
            center: { latitude: ALICANTE_LAT, longitude: ALICANTE_LNG },
            radius: RADIUS_M,
          },
        },
      }),
    });
    if (!res.ok) continue;
    const json = (await res.json()) as { places?: any[] };
    for (const p of json.places ?? []) {
      if (p?.id) seen.set(p.id, p);
    }
  }

  const places = Array.from(seen.values());
  if (places.length === 0) return { fetched: 0, upserted: 0 };

  const rows = places.map((p: any) => {
    const lat = Number(p.location?.latitude);
    const lng = Number(p.location?.longitude);
    const name = p.displayName?.text ?? "Alojamiento";
    return {
      // We reuse the column name liteapi_hotel_id as the external id slot.
      // Prefix to avoid collisions if we later import LiteAPI ids.
      liteapi_hotel_id: `gp:${p.id}`,
      name,
      address: p.formattedAddress ?? p.shortFormattedAddress ?? null,
      lat: isFinite(lat) ? lat : null,
      lng: isFinite(lng) ? lng : null,
      stars: typeof p.rating === "number" ? p.rating : null,
      hotel_type: p.primaryType ?? null,
      neighborhood: null,
      distance_km: isFinite(lat) && isFinite(lng) ? distanceKm(lat, lng) : null,
      main_image: photoUrl(p.photos?.[0]?.name, apiKey),
      booking_url: `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(
        `${name} Alicante`,
      )}`,
      amenities: p.types ?? [],
      raw: p,
    };
  });

  const { error } = await supabaseAdmin
    .from("hotels_static")
    .upsert(rows, { onConflict: "liteapi_hotel_id" });
  if (error) throw new Error(`Upsert failed: ${error.message}`);

  return { fetched: places.length, upserted: rows.length };
}
