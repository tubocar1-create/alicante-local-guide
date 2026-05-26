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
  showtimes: ParsedShowtime[];
};

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
): Promise<ParsedEvent[]> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY missing");

  const sys = `Eres un parser de agendas culturales en Alicante (España).
Recibes el markdown de la web oficial de un recinto y devuelves SOLO JSON con la
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
  "showtimes": [{
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
- Devuelve {"events":[]} si no hay nada utilizable.
- NO incluyas texto fuera del JSON.`;

  const user = `Recinto: ${venueName}
URL fuente: ${sourceUrl}

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

async function syncVenue(
  venue: { id: string; slug: string; name: string },
  sourceUrl: string,
) {
  let markdown = "";
  try {
    markdown = await scrapeMarkdown(sourceUrl);
  } catch (e) {
    return {
      venue: venue.slug,
      ok: false,
      stage: "scrape",
      error: e instanceof Error ? e.message : String(e),
    };
  }
  if (!markdown.trim()) {
    return { venue: venue.slug, ok: true, scraped: 0, inserted: 0 };
  }

  let parsed: ParsedEvent[];
  try {
    parsed = await extractEvents(venue.name, sourceUrl, markdown);
  } catch (e) {
    return {
      venue: venue.slug,
      ok: false,
      stage: "extract",
      error: e instanceof Error ? e.message : String(e),
    };
  }

  let totalInserted = 0;
  let totalSkipped = 0;
  let lastError: string | null = null;
  for (const ev of parsed) {
    const eventId = await upsertEvent(ev, venue.slug);
    if (!eventId) continue;
    const r = await persistShows(eventId, venue.id, ev.showtimes ?? []);
    totalInserted += r.inserted;
    totalSkipped += r.skipped;
    if (r.lastError) lastError = r.lastError;
  }

  // Marca fuente como sincronizada
  await supabaseAdmin
    .from("event_sources")
    .update({ last_scraped_at: new Date().toISOString() })
    .eq("venue_id", venue.id)
    .eq("url", sourceUrl);

  return {
    venue: venue.slug,
    ok: true,
    events: parsed.length,
    inserted: totalInserted,
    skipped: totalSkipped,
    ...(lastError ? { last_error: lastError } : {}),
  };
}

async function runAll(onlySlug?: string) {
  const { data: sources, error } = await supabaseAdmin
    .from("event_sources")
    .select("url, venue_id, enabled, venues!inner(id, slug, name, active)")
    .eq("enabled", true);
  if (error) throw error;

  const results: unknown[] = [];
  for (const row of sources ?? []) {
    const v = (row as unknown as {
      url: string;
      venues: { id: string; slug: string; name: string; active: boolean };
    });
    if (!v.venues?.active) continue;
    if (onlySlug && v.venues.slug !== onlySlug) continue;
    try {
      const r = await syncVenue(
        { id: v.venues.id, slug: v.venues.slug, name: v.venues.name },
        v.url,
      );
      results.push(r);
    } catch (e) {
      results.push({
        venue: v.venues.slug,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // Purga eventos huérfanos sin pases.
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
