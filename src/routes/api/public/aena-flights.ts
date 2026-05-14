import { createFileRoute } from "@tanstack/react-router";

// Proxy ligero al feed oficial de vuelos programados del aeropuerto.
// flightType=S (salidas) | L (llegadas).
//
// Recalculamos cada 30 minutos: filtramos los vuelos que ya han salido /
// aterrizado y conservamos los próximos vuelos hasta 7 días vista.

type RawFlight = {
  numVuelo: string;
  fecha: string;            // dd/mm/yyyy
  horaProgramada: string;   // hh:mm:ss
  fechaEstimada?: string;
  horaEstimada?: string;
  iataAena: string;
  iataOtro: string;
  ciudadIataOtro: string;
  estado?: string;
  tipoVuelo: "S" | "L";
  terminal?: string;
  puertaPrimera?: string;
  mostradorDesde?: string;
  mostradorHasta?: string;
  nombreCompania?: string;
  iataCompania?: string;
  tipoAeronave?: string;
};

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

let cache: { key: string; expiresAt: number; data: Slim[] } | null = null;

// Refresco cada 30 minutos.
const CACHE_MS = 30 * 60 * 1000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Convierte fecha dd/mm/yyyy + hh:mm[:ss] a timestamp ms (hora local Madrid ~ UTC+1/2).
// Para filtrar pasado/futuro basta comparar con Date.now() asumiendo misma zona.
function toTs(fecha: string, hora: string): number {
  const [d, m, y] = fecha.split("/").map((n) => parseInt(n, 10));
  const [hh, mm] = hora.split(":").map((n) => parseInt(n, 10));
  if (!d || !m || !y || isNaN(hh) || isNaN(mm)) return 0;
  return new Date(y, m - 1, d, hh, mm, 0, 0).getTime();
}

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
        const key = `${airport}:${type}`;
        const now = Date.now();

        const filterWindow = (rows: Slim[]) =>
          rows.filter((f) => {
            const ts = toTs(f.fecha, f.horaProgramada);
            if (!ts) return false;
            return ts >= now - 5 * 60 * 1000 && ts <= now + WEEK_MS;
          });

        if (cache && cache.key === key && now < cache.expiresAt) {
          return Response.json({ flights: filterWindow(cache.data), cached: true });
        }

        const sourceUrl = `https://www.aena.es/sites/Satellite?pagename=AENA_ConsultarVuelos&airport=${airport}&flightType=${type}&dosDias=si`;
        try {
          const r = await fetch(sourceUrl, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
              Accept: "application/json,text/plain,*/*",
              "Accept-Language": "es-ES,es;q=0.9",
            },
          });
          if (!r.ok) {
            return Response.json(
              { flights: [], error: `Upstream HTTP ${r.status}` },
              { status: 200 },
            );
          }
          const text = await r.text();
          const parsed = JSON.parse(text) as RawFlight[];
          const slim: Slim[] = parsed.map((f) => ({
            numVuelo: `${f.iataCompania || ""}${f.numVuelo}`.trim(),
            fecha: f.fecha,
            horaProgramada: (f.horaProgramada || "").slice(0, 5),
            horaEstimada:
              f.horaEstimada && f.horaEstimada !== "null"
                ? f.horaEstimada.slice(0, 5)
                : undefined,
            iataOtro: f.iataOtro,
            ciudad: f.ciudadIataOtro,
            estado: f.estado && f.estado !== "null" ? f.estado : undefined,
            terminal:
              f.terminal && f.terminal !== "null" && f.terminal !== "NTERM"
                ? f.terminal
                : undefined,
            puerta:
              f.puertaPrimera && f.puertaPrimera !== "null"
                ? f.puertaPrimera
                : undefined,
            mostrador:
              f.mostradorDesde && f.mostradorDesde !== "null"
                ? `${f.mostradorDesde}${
                    f.mostradorHasta && f.mostradorHasta !== "null"
                      ? `–${f.mostradorHasta}`
                      : ""
                  }`
                : undefined,
            compania:
              f.nombreCompania && f.nombreCompania !== "null"
                ? f.nombreCompania
                : undefined,
            iataCompania:
              f.iataCompania && f.iataCompania !== "null"
                ? f.iataCompania
                : undefined,
            aeronave:
              f.tipoAeronave && f.tipoAeronave !== "null"
                ? f.tipoAeronave
                : undefined,
          }));
          cache = { key, expiresAt: now + CACHE_MS, data: slim };
          return new Response(
            JSON.stringify({ flights: filterWindow(slim) }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                "Cache-Control": "public, max-age=1800",
              },
            },
          );
        } catch (e) {
          console.error("[flights] failed", e);
          return Response.json(
            { flights: [], error: "Upstream fetch failed" },
            { status: 200 },
          );
        }
      },
    },
  },
});
