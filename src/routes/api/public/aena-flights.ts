import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Devuelve los vuelos almacenados en la BD para el aeropuerto y tipo
// solicitados. La sincronización con el feed oficial ocurre cada 30 minutos:
// aquí solo leemos de la tabla `aena_flights` ya alimentada por ese proceso.

type Slim = {
  numVuelo: string;
  fecha: string;
  horaProgramada: string;
  horaEstimada?: string;
  iataOtro: string;
  ciudad: string;
  estado?: string;
  terminal?: string;
  puerta?: string;
  mostrador?: string;
  compania?: string;
  iataCompania?: string;
  aeronave?: string;
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export const Route = createFileRoute("/api/public/aena-flights")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const airport = (url.searchParams.get("airport") || "ALC")
          .toUpperCase()
          .replace(/[^A-Z]/g, "")
          .slice(0, 4);
        const type = url.searchParams.get("type") === "L" ? "L" : "S";

        const now = Date.now();
        const fromIso = new Date(now - 5 * 60 * 1000).toISOString();
        const toIso = new Date(now + WEEK_MS).toISOString();

        // Paginamos en bloques de 1000 para sortear el tope por defecto de PostgREST.
        const PAGE = 1000;
        const MAX_PAGES = 6; // hasta 6000 vuelos / 7 días
        const all: any[] = [];
        for (let page = 0; page < MAX_PAGES; page++) {
          const from = page * PAGE;
          const to = from + PAGE - 1;
          const { data, error } = await supabaseAdmin
            .from("aena_flights")
            .select(
              "num_vuelo, fecha, hora_programada, hora_estimada, iata_otro, ciudad, estado, terminal, puerta, mostrador, compania, iata_compania, aeronave",
            )
            .eq("airport", airport)
            .eq("flight_type", type)
            .gte("scheduled_at", fromIso)
            .lte("scheduled_at", toIso)
            .order("scheduled_at", { ascending: true })
            .range(from, to);

          if (error) {
            console.error("[aena-flights] db error", error);
            return Response.json(
              { flights: [], error: error.message },
              { status: 200 },
            );
          }
          if (!data || data.length === 0) break;
          all.push(...data);
          if (data.length < PAGE) break;
        }

        const flights: Slim[] = all.map((r) => ({
          numVuelo: r.num_vuelo,
          fecha: r.fecha,
          horaProgramada: r.hora_programada,
          horaEstimada: r.hora_estimada || undefined,
          iataOtro: r.iata_otro || "",
          ciudad: r.ciudad || "",
          estado: r.estado || undefined,
          terminal: r.terminal || undefined,
          puerta: r.puerta || undefined,
          mostrador: r.mostrador || undefined,
          compania: r.compania || undefined,
          iataCompania: r.iata_compania || undefined,
          aeronave: r.aeronave || undefined,
        }));

        return new Response(JSON.stringify({ flights }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=60, stale-while-revalidate=120",
          },
        });
      },
    },
  },
});
