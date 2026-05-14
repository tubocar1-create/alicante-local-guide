import { createFileRoute } from "@tanstack/react-router";

// Proxy ligero a AENA. AENA expone vuelos programados en
// /sites/Satellite?pagename=AENA_ConsultarVuelos
// flightType=S (salidas) | L (llegadas). Sin `dosDias` devuelve ~3 días
// (que es la ventana real publicada por AENA, aunque la UI hable de
// "próximos días").

type AenaFlight = {
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

// Refresco semanal: cacheamos hasta el próximo domingo 03:00 UTC.
// Una vez por semana (domingo) hacemos un único scraping y reutilizamos
// esos datos durante los 7 días siguientes.
function nextSundayRefresh(now = new Date()): number {
  const d = new Date(now);
  d.setUTCHours(3, 0, 0, 0);
  const day = d.getUTCDay(); // 0 = domingo
  const daysUntilSunday = day === 0 && now.getTime() < d.getTime() ? 0 : 7 - day;
  d.setUTCDate(d.getUTCDate() + daysUntilSunday);
  return d.getTime();
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

        if (cache && cache.key === key && Date.now() < cache.expiresAt) {
          return Response.json({ flights: cache.data, cached: true });
        }

        const aenaUrl = `https://www.aena.es/sites/Satellite?pagename=AENA_ConsultarVuelos&airport=${airport}&flightType=${type}`;
        try {
          const r = await fetch(aenaUrl, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
              Accept: "application/json,text/plain,*/*",
              "Accept-Language": "es-ES,es;q=0.9",
            },
          });
          if (!r.ok) {
            return Response.json(
              { flights: [], error: `AENA HTTP ${r.status}` },
              { status: 200 },
            );
          }
          const text = await r.text();
          const parsed = JSON.parse(text) as AenaFlight[];
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
          cache = { key, at: Date.now(), data: slim };
          return new Response(JSON.stringify({ flights: slim }), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "public, max-age=604800",
            },
          });
        } catch (e) {
          console.error("[aena-flights] failed", e);
          return Response.json(
            { flights: [], error: "AENA fetch failed" },
            { status: 200 },
          );
        }
      },
    },
  },
});
