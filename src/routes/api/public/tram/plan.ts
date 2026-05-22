import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// /api/public/tram/plan?origin=<stop_id>&destination=<stop_id>&from=HH:MM&date=YYYY-MM-DD&limit=5
// Devuelve próximas conexiones (directas + con transbordo en Luceros) entre
// dos paradas, con línea, horarios, headsign, color, nº de paradas y, cuando
// aplica, la información del transbordo (tiempo de espera y leg2).

const LUCEROS_STOP_ID = "2";
const MIN_TRANSFER_SECS = 120; // 2 min mínimos para cambiar de andén

type RouteInfo = {
  route_id: string;
  route_short_name: string | null;
  route_long_name: string | null;
  route_color: string | null;
  route_text_color: string | null;
};
type TripInfo = {
  trip_id: string;
  route_id: string;
  trip_headsign: string | null;
  direction_id: number | null;
  service_id: string;
};
type DirectOpt = {
  trip_id: string;
  route_id: string;
  line_short_name: string | null;
  line_long_name: string | null;
  line_color: string | null;
  line_text_color: string | null;
  headsign: string | null;
  direction: number | null;
  depart_time: string;
  depart_seconds: number;
  arrive_time: string;
  arrive_seconds: number;
  duration_min: number;
  stops_between: number;
};

const fmt = (n: number) => {
  const h = Math.floor(n / 3600), m = Math.floor((n % 3600) / 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

async function findDirect(
  origin: string,
  destination: string,
  fromSecs: number,
  maxOrigRows: number,
  services: Set<string>,
  routeCache: Map<string, RouteInfo>,
): Promise<DirectOpt[]> {
  if (origin === destination) return [];
  const [{ data: origRaw }, { data: destRaw }] = await Promise.all([
    supabaseAdmin
      .from("tram_stop_times")
      .select("trip_id, stop_sequence, departure_seconds")
      .eq("stop_id", origin)
      .gte("departure_seconds", fromSecs)
      .order("departure_seconds", { ascending: true })
      .limit(maxOrigRows),
    supabaseAdmin
      .from("tram_stop_times")
      .select("trip_id, stop_sequence, arrival_seconds")
      .eq("stop_id", destination)
      .limit(4000),
  ]);
  const origRows = (origRaw ?? []) as Array<{ trip_id: string; stop_sequence: number; departure_seconds: number }>;
  const destMap = new Map<string, { stop_sequence: number; arrival_seconds: number }>();
  ((destRaw ?? []) as Array<{ trip_id: string; stop_sequence: number; arrival_seconds: number }>).forEach((r) => {
    destMap.set(r.trip_id, { stop_sequence: r.stop_sequence, arrival_seconds: r.arrival_seconds });
  });
  const candidateIds = origRows
    .filter((r) => {
      const d = destMap.get(r.trip_id);
      return d && d.stop_sequence > r.stop_sequence;
    })
    .map((r) => r.trip_id);
  if (!candidateIds.length) return [];

  const uniq = Array.from(new Set(candidateIds));
  const { data: tripsRaw } = await supabaseAdmin
    .from("tram_trips")
    .select("trip_id, route_id, trip_headsign, direction_id, service_id")
    .in("trip_id", uniq);
  const trips = (tripsRaw ?? []) as TripInfo[];
  const tripMap = new Map(trips.filter((t) => services.has(t.service_id)).map((t) => [t.trip_id, t]));

  const missingRoutes = Array.from(new Set(Array.from(tripMap.values()).map((t) => t.route_id)))
    .filter((id) => !routeCache.has(id));
  if (missingRoutes.length) {
    const { data: routes } = await supabaseAdmin
      .from("tram_routes")
      .select("route_id, route_short_name, route_long_name, route_color, route_text_color")
      .in("route_id", missingRoutes);
    ((routes ?? []) as RouteInfo[]).forEach((r) => routeCache.set(r.route_id, r));
  }

  return origRows
    .map((r): DirectOpt | null => {
      const trip = tripMap.get(r.trip_id);
      const dest = destMap.get(r.trip_id);
      if (!trip || !dest || dest.stop_sequence <= r.stop_sequence) return null;
      const route = routeCache.get(trip.route_id);
      return {
        trip_id: r.trip_id,
        route_id: trip.route_id,
        line_short_name: route?.route_short_name ?? null,
        line_long_name: route?.route_long_name ?? null,
        line_color: route?.route_color ?? null,
        line_text_color: route?.route_text_color ?? null,
        headsign: trip.trip_headsign,
        direction: trip.direction_id,
        depart_time: fmt(r.departure_seconds),
        depart_seconds: r.departure_seconds,
        arrive_time: fmt(dest.arrival_seconds),
        arrive_seconds: dest.arrival_seconds,
        duration_min: Math.max(1, Math.round((dest.arrival_seconds - r.departure_seconds) / 60)),
        stops_between: dest.stop_sequence - r.stop_sequence,
      };
    })
    .filter((o): o is DirectOpt => o !== null);
}

export const Route = createFileRoute("/api/public/tram/plan")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const origin = url.searchParams.get("origin");
        const destination = url.searchParams.get("destination");
        if (!origin || !destination) {
          return new Response(JSON.stringify({ error: "origin & destination required" }), { status: 400 });
        }
        if (origin === destination) return Response.json({ options: [] });

        const today = new Date();
        const dateStr = url.searchParams.get("date") || today.toISOString().slice(0, 10);
        const from = url.searchParams.get("from") ||
          `${String(today.getHours()).padStart(2, "0")}:${String(today.getMinutes()).padStart(2, "0")}`;
        const limit = Math.min(Number(url.searchParams.get("limit") || 5), 30);
        const [fh, fm] = from.split(":").map(Number);
        const fromSecs = fh * 3600 + fm * 60;

        // 1) Servicios activos hoy.
        const dow = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"][new Date(dateStr + "T00:00:00").getDay()];
        const { data: cal } = await supabaseAdmin
          .from("tram_calendar")
          .select(`service_id, ${dow}`)
          .lte("start_date", dateStr).gte("end_date", dateStr);
        const services = new Set(((cal ?? []) as any[]).filter((c) => c[dow]).map((c) => c.service_id as string));
        const { data: exc } = await supabaseAdmin
          .from("tram_calendar_dates").select("service_id, exception_type").eq("date", dateStr);
        ((exc ?? []) as any[]).forEach((e) => {
          if (e.exception_type === 1) services.add(e.service_id);
          if (e.exception_type === 2) services.delete(e.service_id);
        });
        if (!services.size) return Response.json({ options: [] });

        const routeCache = new Map<string, RouteInfo>();

        // 2) Opciones directas.
        const direct = await findDirect(origin, destination, fromSecs, 200, services, routeCache);

        // 3) Opciones con transbordo en Luceros (si ninguno de los extremos lo es).
        let transferOptions: Array<DirectOpt & {
          transfer: {
            at_stop_id: string;
            at_stop_name: string;
            wait_min: number;
            leg1_arrive_time: string;
            leg2_depart_time: string;
            leg2: {
              trip_id: string;
              route_id: string;
              line_short_name: string | null;
              line_color: string | null;
              line_text_color: string | null;
              headsign: string | null;
              depart_time: string;
              arrive_time: string;
              duration_min: number;
              stops_between: number;
            };
          };
        }> = [];

        if (origin !== LUCEROS_STOP_ID && destination !== LUCEROS_STOP_ID) {
          // Leg1: origin → Luceros (próximas salidas)
          const leg1s = await findDirect(origin, LUCEROS_STOP_ID, fromSecs, 120, services, routeCache);
          if (leg1s.length) {
            // Leg2: todas las salidas Luceros → destination en horizonte amplio
            const earliestLeg2From = Math.min(...leg1s.map((l) => l.arrive_seconds + MIN_TRANSFER_SECS));
            const leg2Pool = await findDirect(LUCEROS_STOP_ID, destination, earliestLeg2From, 500, services, routeCache);

            // Filtro de orientación: descartar transbordos donde leg2 pase por
            // el origen (vuelve hacia atrás) o donde leg1 ya alcance el destino
            // (sería un viaje directo, no un transbordo real).
            const candidateL1 = Array.from(new Set(leg1s.map((l) => l.trip_id)));
            const candidateL2 = Array.from(new Set(leg2Pool.map((l) => l.trip_id)));
            const [{ data: l1ReachDestRaw }, { data: l2PassOrigRaw }] = await Promise.all([
              candidateL1.length
                ? supabaseAdmin
                    .from("tram_stop_times")
                    .select("trip_id")
                    .in("trip_id", candidateL1)
                    .eq("stop_id", destination)
                : Promise.resolve({ data: [] as { trip_id: string }[] }),
              candidateL2.length
                ? supabaseAdmin
                    .from("tram_stop_times")
                    .select("trip_id")
                    .in("trip_id", candidateL2)
                    .eq("stop_id", origin)
                : Promise.resolve({ data: [] as { trip_id: string }[] }),
            ]);
            const l1ReachesDest = new Set(((l1ReachDestRaw ?? []) as { trip_id: string }[]).map((r) => r.trip_id));
            const l2PassesOrigin = new Set(((l2PassOrigRaw ?? []) as { trip_id: string }[]).map((r) => r.trip_id));

            // Para cada leg1 válido, elegir el leg2 más temprano compatible.
            const seenPair = new Set<string>();
            for (const l1 of leg1s) {
              if (l1ReachesDest.has(l1.trip_id)) continue; // ya es directo
              const minDepart = l1.arrive_seconds + MIN_TRANSFER_SECS;
              const l2 = leg2Pool.find((x) =>
                x.depart_seconds >= minDepart &&
                !l2PassesOrigin.has(x.trip_id) &&
                !seenPair.has(`${l1.line_short_name}|${x.line_short_name}|${x.trip_id}`),
              );
              if (!l2) continue;
              seenPair.add(`${l1.line_short_name}|${l2.line_short_name}|${l2.trip_id}`);
              transferOptions.push({
                ...l1,
                trip_id: `${l1.trip_id}|${l2.trip_id}`,
                arrive_time: l2.arrive_time,
                arrive_seconds: l2.arrive_seconds,
                duration_min: Math.max(1, Math.round((l2.arrive_seconds - l1.depart_seconds) / 60)),
                stops_between: l1.stops_between + l2.stops_between,
                transfer: {
                  at_stop_id: LUCEROS_STOP_ID,
                  at_stop_name: "Alicante - Luceros",
                  wait_min: Math.max(0, Math.round((l2.depart_seconds - l1.arrive_seconds) / 60)),
                  leg1_arrive_time: l1.arrive_time,
                  leg2_depart_time: l2.depart_time,
                  leg2: {
                    trip_id: l2.trip_id,
                    route_id: l2.route_id,
                    line_short_name: l2.line_short_name,
                    line_color: l2.line_color,
                    line_text_color: l2.line_text_color,
                    headsign: l2.headsign,
                    depart_time: l2.depart_time,
                    arrive_time: l2.arrive_time,
                    duration_min: l2.duration_min,
                    stops_between: l2.stops_between,
                  },
                },
              });
            }
          }
        }

        // 4) Mezclar directas + con transbordo, ordenar por salida.
        const all = [...direct, ...transferOptions]
          .sort((a, b) =>
            a.depart_seconds - b.depart_seconds ||
            a.arrive_seconds - b.arrive_seconds,
          )
          .slice(0, Math.max(limit, 8));

        return Response.json({ origin, destination, date: dateStr, from, options: all });
      },
    },
  },
});
