import { createServerFn } from "@tanstack/react-start";
import { getGooglePlacesKey } from "@/lib/google-killswitch.server";
import { fetchGoogle } from "@/lib/observability/google";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Bounding box for Alicante metro area to constrain Places results.
const ALC_CENTER = { lat: 38.3452, lng: -0.481 };

type GeocodeResult = { code: string; name: string; lat: number; lng: number };

async function geocodeOne(name: string, apiKey: string): Promise<{ lat: number; lng: number } | null> {
  // Google Places Text Search (New) — biased to Alicante.
  const url = "https://places.googleapis.com/v1/places:searchText";
  const body = {
    textQuery: `Parada de bus ${name}, Alicante`,
    locationBias: {
      circle: { center: ALC_CENTER, radius: 12000 },
    },
    maxResultCount: 1,
    languageCode: "es",
    regionCode: "ES",
  };
  const res = await fetchGoogle({
    provider: "google_places",
    endpoint: "places:searchText",
    caller: "bus-geocode:geocodeOne",
    url,
    init: {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.location,places.displayName",
      },
      body: JSON.stringify(body),
    },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    places?: Array<{ location?: { latitude: number; longitude: number } }>;
  };
  const loc = data.places?.[0]?.location;
  if (!loc) return null;
  return { lat: loc.latitude, lng: loc.longitude };
}

export const geocodeBusStops = createServerFn({ method: "POST" }).handler(async () => {
  const apiKey = await getGooglePlacesKey();
  if (!apiKey) return { ok: false, error: "GOOGLE_PLACES_API_KEY no configurada", updated: 0 };

  const { data: stops, error } = await supabaseAdmin
    .from("bus_stops")
    .select("code,name")
    .is("lat", null)
    .not("name", "is", null)
    .limit(120);
  if (error) return { ok: false, error: error.message, updated: 0 };

  const results: GeocodeResult[] = [];
  for (const s of stops ?? []) {
    if (!s.name) continue;
    try {
      const g = await geocodeOne(s.name, apiKey);
      if (g) {
        await supabaseAdmin
          .from("bus_stops")
          .update({ lat: g.lat, lng: g.lng })
          .eq("code", s.code);
        results.push({ code: s.code, name: s.name, lat: g.lat, lng: g.lng });
      }
    } catch {
      // skip
    }
    // small delay to be gentle on the API
    await new Promise((r) => setTimeout(r, 120));
  }
  return { ok: true, updated: results.length, total: stops?.length ?? 0 };
});
