import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// GET /api/public/tram/valid-origins?destination=<stop_id>
// Devuelve los grupos línea+sentido que sirven a ese destino, y para cada uno
// las paradas previas (en orden y en el sentido correcto) desde donde el usuario
// puede coger ese TRAM. Incluye también grupos accesibles vía transbordo en
// Luceros (origen → Luceros → destino).

const LUCEROS_STOP_ID = "2";
const LUCEROS_STOP_NAME = "Alicante - Luceros";

type StopRow = { stop_id: string; stop_name: string; lat: number | null; lng: number | null };
type StopTimeRow = { trip_id: string; stop_id: string; stop_sequence: number };
type TripRow = { trip_id: string; route_id: string; direction_id: number | null; trip_headsign: string | null };
type RouteRow = {
  route_id: string;
  route_short_name: string | null;
  route_long_name: string | null;
  route_color: string | null;
  route_text_color: string | null;
};

type Group = {
  key: string;
  route_id: string;
  direction_id: number;
  headsign: string | null;
  trip_id: string;
  endSeq: number; // sequence of the "end" stop on this leg (destination or Luceros)
};

async function buildGroupsForLeg(
  legEndStopId: string,
  excludeKeys: Set<string>,
): Promise<{
  groups: Map<string, Group>;
  stopsByTrip: Map<string, Array<{ stop_id: string; stop_sequence: number }>>;
  routeMap: Map<string, RouteRow>;
  stopMap: Map<string, StopRow>;
}> {
  const { data: endTimesRaw } = await supabaseAdmin
    .from("tram_stop_times")
    .select("trip_id, stop_sequence")
    .eq("stop_id", legEndStopId)
    .limit(4000);
  const endTimes = (endTimesRaw ?? []) as Array<{ trip_id: string; stop_sequence: number }>;

  const endSeqByTrip = new Map(endTimes.map((r) => [r.trip_id, r.stop_sequence]));
  const tripIds = Array.from(endSeqByTrip.keys());
  const groups = new Map<string, Group>();
  const stopsByTrip = new Map<string, Array<{ stop_id: string; stop_sequence: number }>>();
  const routeMap = new Map<string, RouteRow>();
  const stopMap = new Map<string, StopRow>();

  if (!tripIds.length) return { groups, stopsByTrip, routeMap, stopMap };

  const { data: tripsRaw } = await supabaseAdmin
    .from("tram_trips")
    .select("trip_id, route_id, direction_id, trip_headsign")
    .in("trip_id", tripIds);
  const trips = (tripsRaw ?? []) as TripRow[];

  for (const t of trips) {
    const dir = t.direction_id ?? 0;
    const key = `${t.route_id}|${dir}`;
    if (excludeKeys.has(key)) continue;
    const seq = endSeqByTrip.get(t.trip_id);
    if (seq == null || seq <= 1) continue;
    const existing = groups.get(key);
    if (!existing || seq > existing.endSeq) {
      groups.set(key, {
        key, route_id: t.route_id, direction_id: dir,
        headsign: t.trip_headsign ?? existing?.headsign ?? null,
        trip_id: t.trip_id, endSeq: seq,
      });
    }
  }
  if (!groups.size) return { groups, stopsByTrip, routeMap, stopMap };

  const repTripIds = Array.from(groups.values()).map((g) => g.trip_id);
  const { data: stRaw } = await supabaseAdmin
    .from("tram_stop_times")
    .select("trip_id, stop_id, stop_sequence")
    .in("trip_id", repTripIds);
  const stopTimes = (stRaw ?? []) as StopTimeRow[];

  const originStopIds = new Set<string>();
  for (const g of groups.values()) {
    const list = stopTimes
      .filter((s) => s.trip_id === g.trip_id && s.stop_sequence < g.endSeq)
      .sort((a, b) => a.stop_sequence - b.stop_sequence);
    stopsByTrip.set(g.trip_id, list);
    list.forEach((s) => originStopIds.add(s.stop_id));
  }

  const routeIds = Array.from(new Set(Array.from(groups.values()).map((g) => g.route_id)));
  const { data: routesRaw } = await supabaseAdmin
    .from("tram_routes")
    .select("route_id, route_short_name, route_long_name, route_color, route_text_color")
    .in("route_id", routeIds);
  ((routesRaw ?? []) as RouteRow[]).forEach((r) => routeMap.set(r.route_id, r));

  const { data: stopsRaw } = await supabaseAdmin
    .from("tram_stops")
    .select("stop_id, stop_name, lat, lng")
    .in("stop_id", Array.from(originStopIds));
  ((stopsRaw ?? []) as StopRow[]).forEach((s) => stopMap.set(s.stop_id, s));

  return { groups, stopsByTrip, routeMap, stopMap };
}

export const Route = createFileRoute("/api/public/tram/valid-origins")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const destination = url.searchParams.get("destination");
        if (!destination) {
          return new Response(JSON.stringify({ error: "destination required" }), { status: 400 });
        }

        const direct = await buildGroupsForLeg(destination, new Set());
        const result: Array<{
          route_id: string;
          line_short_name: string | null;
          line_long_name: string | null;
          line_color: string | null;
          line_text_color: string | null;
          direction_id: number;
          headsign: string | null;
          via_transfer?: boolean;
          transfer_at?: string;
          stops: Array<{ stop_id: string; stop_name: string; stop_lat: number | null; stop_lon: number | null }>;
        }> = [];

        for (const g of direct.groups.values()) {
          const r = direct.routeMap.get(g.route_id);
          const list = direct.stopsByTrip.get(g.trip_id) ?? [];
          const stops = list
            .map((s) => direct.stopMap.get(s.stop_id))
            .filter((s): s is StopRow => Boolean(s))
            .map((s) => ({
              stop_id: s.stop_id, stop_name: s.stop_name,
              stop_lat: s.lat, stop_lon: s.lng,
            }));
          if (!stops.length) continue;
          result.push({
            route_id: g.route_id,
            line_short_name: r?.route_short_name ?? null,
            line_long_name: r?.route_long_name ?? null,
            line_color: r?.route_color ?? null,
            line_text_color: r?.route_text_color ?? null,
            direction_id: g.direction_id,
            headsign: g.headsign,
            stops,
          });
        }

        // === Transbordo en Luceros ===
        // Solo si alguna línea directa para por Luceros (es decir, desde Luceros
        // se puede llegar al destino) y el propio destino no es Luceros.
        const lucerosReachesDest =
          destination !== LUCEROS_STOP_ID &&
          Array.from(direct.groups.values()).some((g) =>
            (direct.stopsByTrip.get(g.trip_id) ?? []).some((s) => s.stop_id === LUCEROS_STOP_ID),
          );

        if (lucerosReachesDest) {
          // Excluir grupos línea+sentido que ya cubren el destino directamente,
          // para no duplicar opciones que NO necesitan transbordo.
          const excludeKeys = new Set(direct.groups.keys());
          const transfer = await buildGroupsForLeg(LUCEROS_STOP_ID, excludeKeys);

          for (const g of transfer.groups.values()) {
            const r = transfer.routeMap.get(g.route_id);
            const list = transfer.stopsByTrip.get(g.trip_id) ?? [];
            const stops = list
              .map((s) => transfer.stopMap.get(s.stop_id))
              .filter((s): s is StopRow => Boolean(s))
              // Evitar listar el propio destino como origen.
              .filter((s) => s.stop_id !== destination)
              .map((s) => ({
                stop_id: s.stop_id, stop_name: s.stop_name,
                stop_lat: s.lat, stop_lon: s.lng,
              }));
            if (!stops.length) continue;
            result.push({
              route_id: g.route_id,
              line_short_name: r?.route_short_name ?? null,
              line_long_name: r?.route_long_name ?? null,
              line_color: r?.route_color ?? null,
              line_text_color: r?.route_text_color ?? null,
              direction_id: g.direction_id,
              headsign: g.headsign,
              via_transfer: true,
              transfer_at: LUCEROS_STOP_NAME,
              stops,
            });
          }
        }

        return Response.json({ destination, groups: result });
      },
    },
  },
});
