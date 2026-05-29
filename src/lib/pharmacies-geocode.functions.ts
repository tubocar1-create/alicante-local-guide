import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Geocoding via Nominatim (OpenStreetMap). Free, no API key needed.
// Rate limit: max 1 request/second + descriptive User-Agent.
// https://operations.osmfoundation.org/policies/nominatim/

const USER_AGENT = "VamosAlicante/1.0 (contacto@vamosalicante.com)";

const VIEWBOX = "-0.65,38.55,-0.05,38.20"; // left,top,right,bottom (Alicante metro)

async function geocodeOne(
  address: string,
  postalCode: string | null,
  city: string | null,
): Promise<{ lat: number; lng: number } | null> {
  const parts = [address, postalCode, city || "Alicante", "España"].filter(Boolean);
  const q = parts.join(", ");
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "es");
  url.searchParams.set("viewbox", VIEWBOX);
  url.searchParams.set("bounded", "1");
  url.searchParams.set("addressdetails", "0");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "es" },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as Array<{ lat: string; lon: string }>;
  if (!data?.length) return null;
  const lat = Number(data[0].lat);
  const lng = Number(data[0].lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

export const geocodePharmacies = createServerFn({ method: "POST" }).handler(async () => {
  const { data: rows, error } = await supabaseAdmin
    .from("pharmacies")
    .select("id,name,address,postal_code,city")
    .is("lat", null)
    .not("address", "is", null)
    .limit(60); // ~60s/run respetando 1 req/s Nominatim
  if (error) return { ok: false, error: error.message, updated: 0, total: 0 };

  let updated = 0;
  let failed = 0;
  for (const p of rows ?? []) {
    if (!p.address) continue;
    try {
      const g = await geocodeOne(p.address, p.postal_code, p.city);
      if (g) {
        await supabaseAdmin
          .from("pharmacies")
          .update({ lat: g.lat, lng: g.lng, geocoded_at: new Date().toISOString() })
          .eq("id", p.id);
        updated++;
      } else {
        // Mark as attempted to avoid retrying forever
        await supabaseAdmin
          .from("pharmacies")
          .update({ geocoded_at: new Date().toISOString() })
          .eq("id", p.id);
        failed++;
      }
    } catch {
      failed++;
    }
    // Respect Nominatim 1 req/s policy
    await new Promise((r) => setTimeout(r, 1100));
  }
  return { ok: true, updated, failed, total: rows?.length ?? 0 };
});

export const getPharmaciesGeocodeStats = createServerFn({ method: "GET" }).handler(async () => {
  const { count: total } = await supabaseAdmin
    .from("pharmacies")
    .select("*", { count: "exact", head: true });
  const { count: withCoords } = await supabaseAdmin
    .from("pharmacies")
    .select("*", { count: "exact", head: true })
    .not("lat", "is", null);
  const { count: pending } = await supabaseAdmin
    .from("pharmacies")
    .select("*", { count: "exact", head: true })
    .is("lat", null);
  return { total: total ?? 0, withCoords: withCoords ?? 0, pending: pending ?? 0 };
});
