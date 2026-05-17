import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Scraping diario de cines (Alicante). Usa Firecrawl con extracción JSON
// (LLM) para tolerar layouts heterogéneos en cada web oficial.
// Para cada cine:
//   1) scrape de la URL de cartelera con un schema JSON.
//   2) upsert de cada película (por slug derivado del título).
//   3) borra los pases futuros del cine y reinserta los nuevos.

type ScrapedShow = {
  film_title: string;
  original_title?: string | null;
  duration_min?: number | null;
  genre?: string | null;
  age_rating?: string | null;
  poster_url?: string | null;
  starts_at: string; // ISO 8601 con TZ
  room?: string | null;
  version?: string | null; // VOSE / Doblada / etc.
  format?: string | null;  // 2D / 3D / IMAX / VIP
  ticket_url?: string | null;
};

type CinemaSource = {
  slug: string;
  url: string;
  prompt: string;
};

const SOURCES: CinemaSource[] = [
  {
    slug: "kinepolis-plaza-mar-2",
    url: "https://www.kinepolis.es/cines/kinepolis-plaza-mar-2/cartelera",
    prompt:
      "Extrae todos los pases de la cartelera de Kinepolis Plaza Mar 2 (Alicante). Para cada pase: título, duración (min), género, calificación por edad, póster (URL), fecha+hora ISO, sala, versión (VOSE/Doblada), formato (2D/3D/IMAX/VIP) y URL de compra.",
  },
  {
    slug: "yelmo-puerta-alicante",
    url: "https://www.yelmocines.es/cartelera/alicante/yelmo-cines-puerta-alicante-3d",
    prompt:
      "Extrae los pases de Yelmo Cines Puerta de Alicante. La página agrupa por película; cada película muestra una lista de horarios HH:MM con un link de compra. Las fechas aparecen como '17 mayo', '18 mayo' (día + mes en español). Para cada pase devuelve: título de la película, póster (URL absoluta), versión (ej. '2D ESPAÑOL'), formato (2D/3D), fecha+hora (ISO), y URL de compra (https://compra.yelmocines.es/...).",
  },
  {
    slug: "aana-cinemas",
    url: "https://cine.entradas.com/cine/sant-joan-d-alacant/cines-aana-san-juan/sesiones",
    prompt:
      "Extrae los pases de Cines Aana San Juan. La página lista películas y para cada una una tabla con columnas de fecha ('Hoy', 'lun, 18/05', 'mar, 19/05'...) y horas HH:MM cada una con un enlace tipo /evento/NNNN. Para cada combinación película+fecha+hora devuelve: título, póster (URL absoluta), duración en minutos, género, calificación por edad, tecnología/formato ('Digital'), fecha+hora ISO y URL de compra absoluta.",
  },
  {
    slug: "odeon-multicines-alicante",
    url: "https://odeonmulticines.com/odeon-alicante/peliculas",
    prompt:
      "Extrae los pases programados en Odeon Multicines Alicante. Para cada pase: título de la película, póster (URL absoluta), duración, género, calificación, fecha+hora ISO, sala, versión, formato y URL de compra (https://odeonmulticines.com/producto/...).",
  },
];

const SHOW_SCHEMA = {
  type: "object",
  properties: {
    shows: {
      type: "array",
      items: {
        type: "object",
        properties: {
          film_title: { type: "string" },
          original_title: { type: "string" },
          duration_min: { type: "number" },
          genre: { type: "string" },
          age_rating: { type: "string" },
          poster_url: { type: "string" },
          starts_at: { type: "string", description: "ISO 8601 con zona Europe/Madrid" },
          room: { type: "string" },
          version: { type: "string" },
          format: { type: "string" },
          ticket_url: { type: "string" },
        },
        required: ["film_title", "starts_at"],
      },
    },
  },
  required: ["shows"],
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

async function firecrawlScrape(url: string, prompt: string): Promise<ScrapedShow[]> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) throw new Error("FIRECRAWL_API_KEY no configurada");

  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const dateContext = `HOY es ${todayIso} (zona Europe/Madrid). SOLO devuelve pases con fecha >= ${todayIso}. NUNCA inventes fechas: usa EXACTAMENTE las fechas y horas que aparecen visiblemente en la página. Si una fila muestra solo el día de la semana (ej. "Vie") o un día sin año, asume el año ${today.getUTCFullYear()} y la próxima ocurrencia futura de ese día. Formato obligatorio: "YYYY-MM-DDTHH:MM" (sin zona, se asume Europe/Madrid). Si no encuentras pases reales con fecha, devuelve shows: [].`;
  const fullPrompt = `${prompt}\n\n${dateContext}`;

  const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      formats: [{ type: "json", prompt: fullPrompt, schema: SHOW_SCHEMA }],
      onlyMainContent: false,
      waitFor: 4000,
      location: { country: "ES", languages: ["es"] },
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Firecrawl ${res.status}: ${txt.slice(0, 300)}`);
  }
  const body = (await res.json()) as {
    data?: { json?: { shows?: ScrapedShow[] } };
    json?: { shows?: ScrapedShow[] };
  };
  const shows = body.data?.json?.shows ?? body.json?.shows ?? [];
  return Array.isArray(shows) ? shows : [];
}

async function upsertFilm(s: ScrapedShow): Promise<string | null> {
  const title = (s.film_title || "").trim();
  if (!title) return null;
  const slug = slugify(title);
  if (!slug) return null;

  const { data: existing } = await supabaseAdmin
    .from("films")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (existing?.id) {
    await supabaseAdmin
      .from("films")
      .update({
        title,
        original_title: s.original_title ?? undefined,
        duration_min: s.duration_min ?? undefined,
        genre: s.genre ?? undefined,
        age_rating: s.age_rating ?? undefined,
        poster_url: s.poster_url ?? undefined,
      })
      .eq("id", existing.id);
    return existing.id;
  }

  const { data: inserted, error } = await supabaseAdmin
    .from("films")
    .insert({
      slug,
      title,
      original_title: s.original_title ?? null,
      duration_min: s.duration_min ?? null,
      genre: s.genre ?? null,
      age_rating: s.age_rating ?? null,
      poster_url: s.poster_url ?? null,
      active: true,
    })
    .select("id")
    .single();
  if (error) {
    console.error("[cinemas-sync] insert film failed", slug, error.message);
    return null;
  }
  return inserted?.id ?? null;
}

async function syncCinema(source: CinemaSource) {
  const { data: cinema } = await supabaseAdmin
    .from("cinemas")
    .select("id, slug")
    .eq("slug", source.slug)
    .maybeSingle();
  if (!cinema?.id) {
    return { slug: source.slug, ok: false, error: "cine no encontrado en BD" };
  }

  let shows: ScrapedShow[];
  try {
    shows = await firecrawlScrape(source.url, source.prompt);
  } catch (e) {
    return {
      slug: source.slug,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }

  // Solo pases con fecha futura válida (ventana 30 días)
  const now = Date.now();
  const horizon = now + 30 * 24 * 60 * 60 * 1000;
  const parsed = shows.map((s) => {
    const ts = parseShowDate(s.starts_at);
    return { s, ts };
  });
  const valid = parsed.filter(
    (p) =>
      p.ts != null &&
      p.ts > now - 60 * 60 * 1000 &&
      p.ts < horizon,
  );

  if (valid.length === 0) {
    return {
      slug: source.slug,
      ok: true,
      scraped: shows.length,
      inserted: 0,
      sample_dates: shows.slice(0, 3).map((s) => s.starts_at),
    };
  }

  // Borra pases futuros del cine para evitar pases obsoletos
  await supabaseAdmin
    .from("showtimes")
    .delete()
    .eq("cinema_id", cinema.id)
    .gte("starts_at", new Date(now - 60 * 60 * 1000).toISOString());

  let inserted = 0;
  let lastError: string | null = null;
  for (const { s, ts } of valid) {
    const film_id = await upsertFilm(s);
    if (!film_id) continue;
    const { error } = await supabaseAdmin
      .from("showtimes")
      .upsert(
        {
          cinema_id: cinema.id,
          film_id,
          starts_at: new Date(ts!).toISOString(),
          room: s.room ?? null,
          version: s.version ?? null,
          format: s.format ?? null,
          ticket_url: s.ticket_url ?? null,
          source: source.url,
        },
        { onConflict: "cinema_id,film_id,starts_at" },
      );
    if (error) {
      lastError = error.message;
    } else {
      inserted++;
    }
  }

  return {
    slug: source.slug,
    ok: true,
    scraped: shows.length,
    inserted,
    ...(lastError ? { last_error: lastError } : {}),
  };
}

// Parser robusto: acepta ISO, ISO sin TZ (asume Europe/Madrid),
// "YYYY-MM-DD HH:mm" y similares.
function parseShowDate(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const s = String(raw).trim();
  // Caso 1: ISO con zona (Z o ±HH:MM)
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) {
    const t = Date.parse(s);
    return Number.isFinite(t) ? t : null;
  }
  // Caso 2: YYYY-MM-DD[T ]HH:mm(:ss)? sin TZ → asumir Europe/Madrid
  const m = s.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/,
  );
  if (m) {
    const [, y, mo, d, hh, mm, ss] = m;
    // Madrid en mayo-octubre = UTC+2, resto = UTC+1
    const offsetHours = isMadridDst(+y, +mo, +d) ? 2 : 1;
    const utcMs = Date.UTC(
      +y,
      +mo - 1,
      +d,
      +hh - offsetHours,
      +mm,
      ss ? +ss : 0,
    );
    return utcMs;
  }
  // Fallback: parse nativo
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

function isMadridDst(y: number, mo: number, d: number): boolean {
  // Aprox: DST en España de último domingo marzo a último domingo octubre
  if (mo > 3 && mo < 10) return true;
  if (mo < 3 || mo > 10) return false;
  const lastSunday = (year: number, month: number) => {
    const last = new Date(Date.UTC(year, month, 0));
    return last.getUTCDate() - last.getUTCDay();
  };
  if (mo === 3) return d >= lastSunday(y, 3);
  return d < lastSunday(y, 10);
}

async function runAll(only?: string) {
  const targets = only
    ? SOURCES.filter((s) => s.slug === only)
    : SOURCES;
  const results: unknown[] = [];
  for (const src of targets) {
    // Secuencial para no saturar Firecrawl y evitar throttling
    const r = await syncCinema(src);
    results.push(r);
  }
  return results;
}

export const Route = createFileRoute("/api/public/hooks/cinemas-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const only = url.searchParams.get("cinema") || undefined;
        try {
          const results = await runAll(only ?? undefined);
          return Response.json({ ok: true, results });
        } catch (e) {
          console.error("[cinemas-sync] failed", e);
          return Response.json(
            { ok: false, error: e instanceof Error ? e.message : String(e) },
            { status: 500 },
          );
        }
      },
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const only = url.searchParams.get("cinema") || undefined;
        try {
          const results = await runAll(only ?? undefined);
          return Response.json({ ok: true, results });
        } catch (e) {
          console.error("[cinemas-sync] failed", e);
          return Response.json(
            { ok: false, error: e instanceof Error ? e.message : String(e) },
            { status: 500 },
          );
        }
      },
    },
  },
});
