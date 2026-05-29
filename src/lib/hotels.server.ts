import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getGooglePlacesKey } from "@/lib/google-killswitch.server";
import { fetchGoogle } from "@/lib/observability/google";

// Centro de búsqueda: Puerta del Mar, Alicante
const ALICANTE_LAT = 38.3402;
const ALICANTE_LNG = -0.481;
const RADIUS_M = 30000;

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

// FIELD_MASK adelgazado al MÍNIMO (solo Basic Data, ~$5/1000).
// Eliminados Pro/Enterprise fields. Sincronización SOLO manual desde admin.
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.shortFormattedAddress",
  "places.location",
  "places.primaryType",
  "places.types",
  "places.googleMapsUri",
  "places.photos",
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

// Construye una URL del proxy interno en lugar de la URL firmada de Google.
// Así, cada visita NO genera llamada a Google: la primera petición cachea la
// imagen en Storage y las siguientes la sirven desde nuestro propio dominio.
function photoUrl(name: string | undefined, _apiKey: string) {
  if (!name) return null;
  return `/api/public/google-photo/${name}?w=600`;
}

async function nearbyPage(apiKey: string) {
  const res = await fetchGoogle({
    provider: "google_places",
    endpoint: "places:searchNearby",
    caller: "hotels:nearbyPage",
    url: PLACES_URL,
    init: {
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
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Places ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as { places?: any[] };
}

export async function syncStaticHotelsImpl() {
  const apiKey = await getGooglePlacesKey();
  if (!apiKey) throw new Error("GOOGLE_PLACES_API_KEY not configured");

  // Google Places (New) Nearby devuelve como máximo 20 resultados por llamada,
  // sin paginación. Para cubrir 30 km generamos una rejilla de sub-búsquedas de
  // ~5 km de radio espaciadas ~7 km, y deduplicamos por place id.
  const SUBCELL_RADIUS_M = 5000;
  const STEP_KM = 7;
  const latStepDeg = STEP_KM / 111;
  const lngStepDeg = STEP_KM / (111 * Math.cos((ALICANTE_LAT * Math.PI) / 180));
  const radiusDeg = RADIUS_M / 1000 / 111;
  const centers: Array<{ lat: number; lng: number }> = [];
  for (let dLat = -radiusDeg; dLat <= radiusDeg; dLat += latStepDeg) {
    for (
      let dLng = -radiusDeg / Math.cos((ALICANTE_LAT * Math.PI) / 180);
      dLng <= radiusDeg / Math.cos((ALICANTE_LAT * Math.PI) / 180);
      dLng += lngStepDeg
    ) {
      const lat = ALICANTE_LAT + dLat;
      const lng = ALICANTE_LNG + dLng;
      // Mantener solo centros dentro del círculo de 30 km (con margen del sub-radio)
      if (distanceKm(lat, lng) <= RADIUS_M / 1000 + SUBCELL_RADIUS_M / 1000) {
        centers.push({ lat, lng });
      }
    }
  }

  const seen = new Map<string, any>();
  for (const center of centers) {
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
              center: { latitude: center.lat, longitude: center.lng },
              radius: SUBCELL_RADIUS_M,
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
  }

  // Filtro final: solo dentro del círculo real de 30 km
  for (const [id, p] of seen) {
    const lat = Number(p.location?.latitude);
    const lng = Number(p.location?.longitude);
    if (!isFinite(lat) || !isFinite(lng) || distanceKm(lat, lng) > RADIUS_M / 1000) {
      seen.delete(id);
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
