import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const getRefreshStats = createServerFn({ method: "GET" }).handler(async () => {
  const [hotels, places, beaches, health, busTotal, busPending] = await Promise.all([
    supabaseAdmin.from("hotels_static").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("places_cache").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("beach_covers").select("slug", { count: "exact", head: true }),
    supabaseAdmin
      .from("health_centers")
      .select("id", { count: "exact", head: true })
      .not("google_place_id", "is", null),
    supabaseAdmin.from("bus_stops").select("code", { count: "exact", head: true }),
    supabaseAdmin
      .from("bus_stops")
      .select("code", { count: "exact", head: true })
      .is("lat", null)
      .not("name", "is", null),
  ]);
  return {
    hotels: hotels.count ?? 0,
    places: places.count ?? 0,
    beaches: beaches.count ?? 0,
    health: health.count ?? 0,
    busTotal: busTotal.count ?? 0,
    busPending: busPending.count ?? 0,
  };
});
