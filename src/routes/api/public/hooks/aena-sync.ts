import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Sincroniza el feed oficial del aeropuerto y vuelca los vuelos a la BD
// para que el resto de la app trabaje solo contra nuestra base de datos.
//
// Se ejecuta semanalmente vía cron y guarda los vuelos a ~14 días vista
// (el feed devuelve la ventana máxima disponible). Los recálculos cada
// 30 minutos NO vuelven a AENA: trabajan sobre estas filas.

type RawFlight = {
  numVuelo: string;
  fecha: string;
  horaProgramada: string;
  horaEstimada?: string;
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

const HORIZON_MS = 14 * 24 * 60 * 60 * 1000;

function toIso(fecha: string, hora: string): string | null {
  const [d, m, y] = fecha.split("/").map((n) => parseInt(n, 10));
  const [hh, mm] = (hora || "").split(":").map((n) => parseInt(n, 10));
  if (!d || !m || !y || isNaN(hh) || isNaN(mm)) return null;
  return new Date(y, m - 1, d, hh, mm, 0, 0).toISOString();
}

function clean(v: string | undefined | null): string | null {
  if (!v || v === "null" || v === "NTERM") return null;
  return v;
}

async function fetchAndStore(airport: string, type: "S" | "L") {
  const src = `https://www.aena.es/sites/Satellite?pagename=AENA_ConsultarVuelos&airport=${airport}&flightType=${type}&dosDias=si`;
  const r = await fetch(src, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      Accept: "application/json,text/plain,*/*",
      "Accept-Language": "es-ES,es;q=0.9",
    },
  });
  if (!r.ok) throw new Error(`Upstream ${type} HTTP ${r.status}`);
  const parsed = JSON.parse(await r.text()) as RawFlight[];
  const now = Date.now();
  const horizon = now + HORIZON_MS;

  const rows = parsed
    .map((f) => {
      const iso = toIso(f.fecha, f.horaProgramada);
      if (!iso) return null;
      const ts = new Date(iso).getTime();
      if (ts > horizon) return null;
      return {
        airport,
        flight_type: type,
        num_vuelo: `${f.iataCompania || ""}${f.numVuelo}`.trim(),
        fecha: f.fecha,
        hora_programada: (f.horaProgramada || "").slice(0, 5),
        hora_estimada: f.horaEstimada ? f.horaEstimada.slice(0, 5) : null,
        scheduled_at: iso,
        iata_otro: f.iataOtro || null,
        ciudad: f.ciudadIataOtro || null,
        estado: clean(f.estado),
        terminal: clean(f.terminal),
        puerta: clean(f.puertaPrimera),
        mostrador: clean(f.mostradorDesde)
          ? `${f.mostradorDesde}${
              clean(f.mostradorHasta) ? `–${f.mostradorHasta}` : ""
            }`
          : null,
        compania: clean(f.nombreCompania),
        iata_compania: clean(f.iataCompania),
        aeronave: clean(f.tipoAeronave),
        updated_at: new Date().toISOString(),
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  // Upsert por la clave única (airport, flight_type, num_vuelo, fecha, hora_programada).
  // Trocamos para no exceder límites de carga.
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const { error } = await supabaseAdmin
      .from("aena_flights")
      .upsert(slice, {
        onConflict: "airport,flight_type,num_vuelo,fecha,hora_programada",
      });
    if (error) throw error;
  }
  return rows.length;
}

export const Route = createFileRoute("/api/public/hooks/aena-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const airport = (url.searchParams.get("airport") || "ALC")
          .toUpperCase()
          .replace(/[^A-Z]/g, "")
          .slice(0, 4);
        try {
          const [s, l] = await Promise.all([
            fetchAndStore(airport, "S"),
            fetchAndStore(airport, "L"),
          ]);
          return Response.json({ ok: true, airport, salidas: s, llegadas: l });
        } catch (e: unknown) {
          console.error("[aena-sync] failed", e);
          const msg = e instanceof Error ? e.message : String(e);
          return Response.json({ ok: false, error: msg }, { status: 500 });
        }
      },
      GET: async ({ request }) => {
        // Permite disparo manual desde el navegador.
        const url = new URL(request.url);
        const airport = (url.searchParams.get("airport") || "ALC")
          .toUpperCase()
          .replace(/[^A-Z]/g, "")
          .slice(0, 4);
        try {
          const [s, l] = await Promise.all([
            fetchAndStore(airport, "S"),
            fetchAndStore(airport, "L"),
          ]);
          return Response.json({ ok: true, airport, salidas: s, llegadas: l });
        } catch (e: unknown) {
          console.error("[aena-sync] failed", e);
          const msg = e instanceof Error ? e.message : String(e);
          return Response.json({ ok: false, error: msg }, { status: 500 });
        }
      },
    },
  },
});
