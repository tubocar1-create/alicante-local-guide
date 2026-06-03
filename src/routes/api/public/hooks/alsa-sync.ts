import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { parseAlsaResults, type AlsaJourney } from "@/lib/alsa-parser";

// Sincroniza horarios y precios de ALSA Alicante↔Madrid.
// Estrategia: hacemos 2 scrapes (ida + vuelta) el jueves 04/06/2026 (día con
// servicio completo de 24h) y replicamos cada salida para los próximos 30 días.
// Precios "desde" se guardan a fecha de scrape, no se replican como reales.

const ROUTE_SLUG = "alicante-madrid";
const ORIGIN_ID = "93000";       // Alicante Estación de Autobús
const DESTINATION_ID = "90155";  // Madrid Estación Sur
const SOURCE_DATE = "04/06/2026"; // dd/mm/yyyy
const DAYS = 30;

function checkoutUrl(originId: string, destinationId: string, dateDmy: string) {
  return `https://www.alsa.com/es/checkout?originStationId=${originId}&destinationStationId=${destinationId}&departureDate=${dateDmy}&adults=1&children=0&babies=0&largeFamily=NONE`;
}

async function firecrawlScrape(url: string): Promise<string> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) throw new Error("FIRECRAWL_API_KEY no configurado");
  const r = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      url,
      formats: ["markdown"],
      onlyMainContent: true,
      waitFor: 4000,
      location: { country: "ES", languages: ["es"] },
    }),
  });
  const json = (await r.json()) as { success?: boolean; data?: { markdown?: string }; error?: string };
  if (!r.ok || !json.success) throw new Error(`Firecrawl HTTP ${r.status}: ${json.error ?? "fail"}`);
  return json.data?.markdown ?? "";
}

function todayMadrid(): Date {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric", month: "2-digit", day: "2-digit",
  });
  const parts = fmt.formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;
  return new Date(`${y}-${m}-${d}T00:00:00Z`);
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

type Row = {
  route_slug: string;
  direction: "S" | "L";
  service_date: string;
  departure_time: string;
  arrival_time: string;
  duration_minutes: number;
  origin_station: string;
  destination_station: string;
  bus_type: string | null;
  price_from_eur: number | null;
  promo_price_eur: number | null;
  observations: string[];
  source_date: string;
};

function buildRows(journeys: AlsaJourney[], direction: "S" | "L", sourceIso: string): Row[] {
  const out: Row[] = [];
  const start = todayMadrid();
  for (let i = 0; i < DAYS; i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    const serviceDate = isoDate(d);
    for (const j of journeys) {
      if (!j.origin || !j.destination) continue;
      out.push({
        route_slug: ROUTE_SLUG,
        direction,
        service_date: serviceDate,
        departure_time: j.departure,
        arrival_time: j.arrival,
        duration_minutes: j.durationMinutes,
        origin_station: j.origin,
        destination_station: j.destination,
        bus_type: j.busType,
        price_from_eur: j.priceFromEur,
        promo_price_eur: j.promoPriceEur,
        observations: j.observations,
        source_date: sourceIso,
      });
    }
  }
  return out;
}

async function upsertChunks(rows: Row[]): Promise<number> {
  const CHUNK = 500;
  let total = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const { error, count } = await supabaseAdmin
      .from("alsa_schedules")
      .upsert(slice, {
        onConflict: "route_slug,direction,service_date,departure_time,origin_station,destination_station",
        count: "exact",
      });
    if (error) throw new Error(`upsert: ${error.message}`);
    total += count ?? slice.length;
  }
  return total;
}

async function syncRoute() {
  const sourceIso = "2026-06-04";
  const idaUrl = checkoutUrl(ORIGIN_ID, DESTINATION_ID, SOURCE_DATE);
  const vueltaUrl = checkoutUrl(DESTINATION_ID, ORIGIN_ID, SOURCE_DATE);

  const [idaMd, vueltaMd] = await Promise.all([
    firecrawlScrape(idaUrl),
    firecrawlScrape(vueltaUrl),
  ]);

  const ida = parseAlsaResults(idaMd);
  const vuelta = parseAlsaResults(vueltaMd);

  if (ida.length === 0 && vuelta.length === 0) {
    throw new Error("No se extrajo ningún viaje del scrape");
  }

  // Limpiar histórico de este slug para los próximos 30 días antes de reinyectar.
  const start = todayMadrid();
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + DAYS - 1);

  const { error: delErr } = await supabaseAdmin
    .from("alsa_schedules")
    .delete()
    .eq("route_slug", ROUTE_SLUG)
    .gte("service_date", isoDate(start))
    .lte("service_date", isoDate(end));
  if (delErr) throw new Error(`delete: ${delErr.message}`);

  const rows = [
    ...buildRows(ida, "S", sourceIso),
    ...buildRows(vuelta, "L", sourceIso),
  ];
  const inserted = await upsertChunks(rows);

  return {
    route_slug: ROUTE_SLUG,
    ida_count: ida.length,
    vuelta_count: vuelta.length,
    rows_inserted: inserted,
    window_start: isoDate(start),
    window_end: isoDate(end),
    source_date: sourceIso,
  };
}

export const Route = createFileRoute("/api/public/hooks/alsa-sync")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const result = await syncRoute();
          return new Response(JSON.stringify({ ok: true, ...result }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return new Response(JSON.stringify({ ok: false, error: msg }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
      POST: async () => {
        try {
          const result = await syncRoute();
          return new Response(JSON.stringify({ ok: true, ...result }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return new Response(JSON.stringify({ ok: false, error: msg }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
