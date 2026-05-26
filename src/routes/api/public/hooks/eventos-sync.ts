import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Scraping mensual de eventos (teatro, conciertos, festivales) para los recintos
// registrados en `venues` / `event_sources`. Usa Firecrawl para extraer el
// markdown limpio de cada web y Lovable AI (Gemini) para convertirlo en una
// lista estructurada de eventos + pases. Datos no disponibles → null.

const FIRECRAWL_URL = "https://api.firecrawl.dev/v2/scrape";
const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const HORIZON_ISO = "2026-12-31T22:59:59.000Z";

type ParsedShowtime = {
  starts_at: string; // ISO UTC
  ends_at?: string | null;
  price_min?: number | null;
  price_max?: number | null;
  currency?: string | null;
  ticket_url?: string | null;
};

type ParsedEvent = {
  title: string;
  category: string; // teatro | concierto | opera | danza | festival | musical | infantil | otro
  description?: string | null;
  poster_url?: string | null;
  artist?: string | null;
  genre?: string | null;
  duration_min?: number | null;
  age_rating?: string | null;
  source_url?: string | null;
  venue_name?: string | null; // sólo agregadores: nombre del recinto a resolver
  showtimes: ParsedShowtime[];
};

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}


function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

async function scrapeMarkdown(url: string): Promise<string> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw new Error("FIRECRAWL_API_KEY missing");
  const res = await fetch(FIRECRAWL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      url,
      formats: ["markdown"],
      onlyMainContent: true,
      waitFor: 1500,
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Firecrawl ${res.status}: ${txt.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    success?: boolean;
    data?: { markdown?: string };
    markdown?: string;
  };
  const md = json.data?.markdown ?? json.markdown ?? "";
  return md;
}

async function extractEvents(
  venueName: string,
  sourceUrl: string,
  markdown: string,
  isAggregator: boolean,
): Promise<ParsedEvent[]> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY missing");

  const venueFieldDoc = isAggregator
    ? `  "venue_name": string (nombre EXACTO del recinto en Alicante donde ocurre el evento),\n`
    : "";

  const sys = `Eres un parser de agendas culturales en Alicante (España).
Recibes el markdown de ${isAggregator ? "un AGREGADOR de eventos (varios recintos)" : "la web oficial de un recinto"} y devuelves SOLO JSON con la
siguiente forma exacta:

{"events":[{
  "title": string,
  "category": "teatro"|"concierto"|"opera"|"danza"|"festival"|"musical"|"infantil"|"otro",
  "description": string|null,
  "poster_url": string|null (URL absoluta),
  "artist": string|null,
  "genre": string|null,
  "duration_min": number|null,
  "age_rating": string|null,
  "source_url": string|null (URL de la ficha del evento si la hay),
${venueFieldDoc}  "showtimes": [{
    "starts_at": string (ISO 8601 con zona horaria Europe/Madrid expresada en UTC, ej. "2026-06-15T19:30:00.000Z"),
    "ends_at": string|null,
    "price_min": number|null,
    "price_max": number|null,
    "currency": "EUR"|null,
    "ticket_url": string|null
  }]
}]}

Reglas:
- Solo eventos con fecha CONOCIDA y futura (a partir de hoy) y antes del 31/12/2026.
- Si no hay fecha exacta, OMITE el evento.
- Si no hay precio, deja null. NUNCA inventes.
- Asume zona horaria Europe/Madrid al convertir a UTC (CEST=+2 en verano, CET=+1 en invierno).
${isAggregator ? "- venue_name OBLIGATORIO: usa el nombre tal cual aparece (ej. 'Teatro Principal de Alicante', 'ADDA', 'Las Cigarreras', 'IFA Fira Alicante'). Si no se identifica recinto en Alicante ciudad o área metropolitana, OMITE el evento.\n" : ""}- Devuelve {"events":[]} si no hay nada utilizable.
- NO incluyas texto fuera del JSON.`;

  const user = `Fuente: ${venueName}
URL: ${sourceUrl}

MARKDOWN:
${markdown.slice(0, 20000)}`;

  const res = await fetch(AI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`AI ${res.status}: ${txt.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content ?? "{}";
  let parsed: { events?: ParsedEvent[] };
  try {
    parsed = JSON.parse(content);
  } catch {
    return [];
  }
  return Array.isArray(parsed.events) ? parsed.events : [];
}


async function upsertEvent(
  ev: ParsedEvent,
  venueSlug: string,
): Promise<string | null> {
  const baseSlug = slugify(ev.title);
  if (!baseSlug) return null;
  const slug = `${baseSlug}-${venueSlug}`.slice(0, 80);

  const fields = {
    title: ev.title,
    category: ev.category || "otro",
    description: ev.description ?? null,
    poster_url: ev.poster_url ?? null,
    artist: ev.artist ?? null,
    genre: ev.genre ?? null,
    duration_min: ev.duration_min ?? null,
    age_rating: ev.age_rating ?? null,
    source_url: ev.source_url ?? null,
  };

  const { data: existing } = await supabaseAdmin
    .from("events")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (existing?.id) {
    await supabaseAdmin.from("events").update(fields).eq("id", existing.id);
    return existing.id;
  }
  const { data: inserted, error } = await supabaseAdmin
    .from("events")
    .insert({ slug, active: true, ...fields })
    .select("id")
    .single();
  if (error) {
    console.error("[eventos-sync] insert event failed", slug, error.message);
    return null;
  }
  return inserted?.id ?? null;
}

async function persistShows(
  eventId: string,
  venueId: string,
  shows: ParsedShowtime[],
): Promise<{ inserted: number; skipped: number; lastError: string | null }> {
  let inserted = 0;
  let skipped = 0;
  let lastError: string | null = null;
  const now = Date.now();

  for (const s of shows) {
    if (!s.starts_at) {
      skipped++;
      continue;
    }
    const t = Date.parse(s.starts_at);
    if (Number.isNaN(t)) {
      skipped++;
      continue;
    }
    if (t < now - 60 * 60 * 1000) {
      skipped++;
      continue;
    }
    if (s.starts_at > HORIZON_ISO) {
      skipped++;
      continue;
    }
    const { error } = await supabaseAdmin.from("event_showtimes").upsert(
      {
        event_id: eventId,
        venue_id: venueId,
        starts_at: new Date(t).toISOString(),
        ends_at: s.ends_at ?? null,
        price_min: s.price_min ?? null,
        price_max: s.price_max ?? null,
        currency: s.currency ?? "EUR",
        ticket_url: s.ticket_url ?? null,
        source: "scrape",
      },
      { onConflict: "event_id,venue_id,starts_at" },
    );
    if (error) {
      lastError = error.message;
      skipped++;
    } else {
      inserted++;
    }
  }
  return { inserted, skipped, lastError };
}

type VenueRow = { id: string; slug: string; name: string; active: boolean };

async function loadVenueIndex(): Promise<Map<string, VenueRow>> {
  const { data } = await supabaseAdmin
    .from("venues")
    .select("id, slug, name, active")
    .eq("active", true);
  const idx = new Map<string, VenueRow>();
  const aliases: Record<string, string> = {
    "adda": "adda-alicante",
    "adda auditorio": "adda-alicante",
    "auditorio diputacion": "adda-alicante",
    "teatro principal": "teatro-principal-alicante",
    "principal alicante": "teatro-principal-alicante",
    "teatro arniches": "teatro-arniches",
    "arniches": "teatro-arniches",
    "las cigarreras": "las-cigarreras",
    "cigarreras": "las-cigarreras",
    "palau": "palau-congressos-alicante",
    "palau de congressos": "palau-congressos-alicante",
    "plaza de toros": "plaza-toros-alicante",
    "plaza toros alicante": "plaza-toros-alicante",
    "puerto de alicante": "puerto-alicante-eventos",
    "muelle": "muelle-live-alicante",
    "muelle live": "muelle-live-alicante",
    "sala stereo": "sala-stereo",
    "stereo": "sala-stereo",
    "sala the one": "sala-the-one",
    "the one": "sala-the-one",
    "clan cabaret": "clan-cabaret",
    "clan": "clan-cabaret",
    "area 12": "area-12-alicante",
    "rabasa": "rabasa-multiespacio",
    "multiespacio rabasa": "rabasa-multiespacio",
    "casa delle follie": "casa-delle-follie",
    "sociedad de conciertos": "sociedad-conciertos-alicante",
    "ifa": "ifa-fira-alicante",
    "fira alicante": "ifa-fira-alicante",
    "ifa fira alicante": "ifa-fira-alicante",
  };
  for (const v of (data ?? []) as VenueRow[]) {
    idx.set(normalizeName(v.name), v);
    idx.set(normalizeName(v.slug.replace(/-/g, " ")), v);
  }
  for (const [alias, slug] of Object.entries(aliases)) {
    const v = (data ?? []).find((x) => x.slug === slug) as VenueRow | undefined;
    if (v) idx.set(normalizeName(alias), v);
  }
  return idx;
}

function resolveVenue(
  hint: string | null | undefined,
  index: Map<string, VenueRow>,
): VenueRow | null {
  if (!hint) return null;
  const norm = normalizeName(hint);
  if (index.has(norm)) return index.get(norm)!;
  for (const [k, v] of index) {
    if (k.length >= 4 && (norm.includes(k) || k.includes(norm))) return v;
  }
  return null;
}

async function syncSource(
  source: { url: string; parser: string; venue: VenueRow },
  venueIndex: Map<string, VenueRow>,
) {
  const isAggregator = source.parser === "aggregator";
  const label = isAggregator ? `agg:${source.url}` : source.venue.slug;

  let markdown = "";
  try {
    markdown = await scrapeMarkdown(source.url);
  } catch (e) {
    return {
      source: label,
      ok: false,
      stage: "scrape",
      error: e instanceof Error ? e.message : String(e),
    };
  }
  if (!markdown.trim()) {
    return { source: label, ok: true, scraped: 0, inserted: 0 };
  }

  let parsed: ParsedEvent[];
  try {
    parsed = await extractEvents(
      source.venue.name,
      source.url,
      markdown,
      isAggregator,
    );
  } catch (e) {
    return {
      source: label,
      ok: false,
      stage: "extract",
      error: e instanceof Error ? e.message : String(e),
    };
  }

  let totalInserted = 0;
  let totalSkipped = 0;
  let unresolved = 0;
  let lastError: string | null = null;

  for (const ev of parsed) {
    const targetVenue = isAggregator
      ? resolveVenue(ev.venue_name, venueIndex)
      : source.venue;
    if (!targetVenue) {
      unresolved++;
      continue;
    }
    const eventId = await upsertEvent(ev, targetVenue.slug);
    if (!eventId) continue;
    const r = await persistShows(eventId, targetVenue.id, ev.showtimes ?? []);
    totalInserted += r.inserted;
    totalSkipped += r.skipped;
    if (r.lastError) lastError = r.lastError;
  }

  await supabaseAdmin
    .from("event_sources")
    .update({ last_scraped_at: new Date().toISOString() })
    .eq("venue_id", source.venue.id)
    .eq("url", source.url);

  return {
    source: label,
    ok: true,
    events: parsed.length,
    inserted: totalInserted,
    skipped: totalSkipped,
    ...(unresolved ? { unresolved } : {}),
    ...(lastError ? { last_error: lastError } : {}),
  };
}

async function runAll(onlySlug?: string) {
  const { data: sources, error } = await supabaseAdmin
    .from("event_sources")
    .select("url, parser, venue_id, enabled, venues!inner(id, slug, name, active)")
    .eq("enabled", true);
  if (error) throw error;

  const venueIndex = await loadVenueIndex();
  const results: unknown[] = [];
  for (const row of sources ?? []) {
    const r2 = row as unknown as {
      url: string;
      parser: string;
      venues: VenueRow;
    };
    if (!r2.venues) continue;
    if (r2.parser !== "aggregator" && !r2.venues.active) continue;
    if (onlySlug && r2.venues.slug !== onlySlug && r2.parser !== "aggregator") continue;
    try {
      const r = await syncSource(
        { url: r2.url, parser: r2.parser ?? "firecrawl_ai", venue: r2.venues },
        venueIndex,
      );
      results.push(r);
    } catch (e) {
      results.push({
        source: r2.venues.slug,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  await supabaseAdmin.rpc("purge_events_orphan");
  return results;
}


export const Route = createFileRoute("/api/public/hooks/eventos-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const only = url.searchParams.get("venue") || undefined;
        try {
          const results = await runAll(only);
          return Response.json({ ok: true, results });
        } catch (e) {
          console.error("[eventos-sync] failed", e);
          return Response.json(
            { ok: false, error: e instanceof Error ? e.message : String(e) },
            { status: 500 },
          );
        }
      },
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const only = url.searchParams.get("venue") || undefined;
        try {
          const results = await runAll(only);
          return Response.json({ ok: true, results });
        } catch (e) {
          console.error("[eventos-sync] failed", e);
          return Response.json(
            { ok: false, error: e instanceof Error ? e.message : String(e) },
            { status: 500 },
          );
        }
      },
    },
  },
});
