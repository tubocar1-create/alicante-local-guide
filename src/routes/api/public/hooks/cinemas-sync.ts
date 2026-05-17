import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Scraping diario de cines usando ecartelera.com como fuente unificada.
// ecartelera publica todas las sesiones por cine y por día en HTML estable,
// así que basta con fetch + regex (sin LLM, sin alucinaciones de fecha).
//
// URL pattern: https://www.ecartelera.com/cines/{id},{dayOffset},1.html
//   dayOffset 0 = hoy (Europe/Madrid), 1 = mañana, ... hasta 13 disponibles.
// Recorremos 0..7 (1 semana) por cine.

type ParsedShow = {
  film_title: string;
  film_slug: string;
  poster_url: string | null;
  duration_min: number | null;
  genre: string | null;
  age_rating: string | null;
  starts_at_ms: number;
  ticket_url: string;
};

type CinemaSource = {
  slug: string;          // slug en nuestra BD
  ecartelera_id: number; // id numérico en ecartelera
};

const SOURCES: CinemaSource[] = [
  { slug: "aana-cinemas",          ecartelera_id: 181 },
  { slug: "kinepolis-plaza-mar-2", ecartelera_id: 184 },
  { slug: "yelmo-puerta-alicante", ecartelera_id: 187 },
  // Odeon no está en ecartelera; lo cubriremos en una fase posterior.
];

const DAY_HORIZON = 7;

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&iacute;/g, "í")
    .replace(/&aacute;/g, "á")
    .replace(/&eacute;/g, "é")
    .replace(/&oacute;/g, "ó")
    .replace(/&uacute;/g, "ú")
    .replace(/&ntilde;/g, "ñ")
    .replace(/&Iacute;/g, "Í")
    .replace(/&Aacute;/g, "Á")
    .replace(/&Eacute;/g, "É")
    .replace(/&Oacute;/g, "Ó")
    .replace(/&Uacute;/g, "Ú")
    .replace(/&Ntilde;/g, "Ñ")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
}

// Devuelve la fecha "hoy" en Europe/Madrid como {y,m,d}.
function madridToday(): { y: number; m: number; d: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.format(new Date()); // YYYY-MM-DD
  const [y, m, d] = parts.split("-").map(Number);
  return { y, m, d };
}

function isMadridDst(y: number, mo: number, d: number): boolean {
  if (mo > 3 && mo < 10) return true;
  if (mo < 3 || mo > 10) return false;
  const lastSunday = (year: number, month: number) => {
    const last = new Date(Date.UTC(year, month, 0));
    return last.getUTCDate() - last.getUTCDay();
  };
  if (mo === 3) return d >= lastSunday(y, 3);
  return d < lastSunday(y, 10);
}

// Combina fecha en Madrid + HH:MM en hora local Madrid → timestamp UTC ms.
function madridDateTimeToUtcMs(
  y: number, m: number, d: number, hh: number, mm: number,
): number {
  const offsetHours = isMadridDst(y, m, d) ? 2 : 1;
  return Date.UTC(y, m - 1, d, hh - offsetHours, mm, 0);
}

// Avanza una fecha Y/M/D en N días (ignorando DST; suficiente para offsets cortos).
function addDays(y: number, m: number, d: number, days: number) {
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return {
    y: dt.getUTCFullYear(),
    m: dt.getUTCMonth() + 1,
    d: dt.getUTCDate(),
  };
}

// Extrae sesiones de un HTML de página de cine de ecartelera.
function parseEcarteleraDay(
  html: string,
  date: { y: number; m: number; d: number },
): ParsedShow[] {
  const out: ParsedShow[] = [];
  // Cada película es un bloque <div class="titem" ...> ... </div> hasta el siguiente titem
  const blocks = html.split(/<div class="titem"/).slice(1);
  for (const raw of blocks) {
    // Cortamos en el siguiente cierre razonable (próximo titem ya removido)
    const block = raw;

    // Título + slug interno de ecartelera (sirve para slug estable)
    const titMatch = block.match(
      /<p class="tit"><a href="https:\/\/www\.ecartelera\.com\/peliculas\/([^/]+)\/[^"]*"[^>]*>([^<]+)<\/a>/,
    );
    if (!titMatch) continue;
    const film_slug = titMatch[1];
    const film_title = decodeHtml(titMatch[2]).trim();
    if (!film_title) continue;

    // Póster: preferimos webp y lo cambiamos a jpg (más universal)
    let poster_url: string | null = null;
    const posterMatch = block.match(
      /srcset="(https:\/\/www\.ecartelera\.com\/carteles\/[^"]+\.(?:webp|jpg|png))"/,
    );
    if (posterMatch) {
      poster_url = posterMatch[1].replace(/\.webp$/, ".jpg");
    }

    // Datos: <p class="data"><span>98 min.</span> <span>Japón</span> <span>Animación</span> <span>TP</span></p>
    let duration_min: number | null = null;
    let genre: string | null = null;
    let age_rating: string | null = null;
    const dataMatch = block.match(/<p class="data">([\s\S]*?)<\/p>/);
    if (dataMatch) {
      const spans = [...dataMatch[1].matchAll(/<span>([^<]+)<\/span>/g)].map(
        (m) => decodeHtml(m[1]).trim(),
      );
      for (const s of spans) {
        const dm = s.match(/^(\d+)\s*min/i);
        if (dm) {
          duration_min = +dm[1];
          continue;
        }
        // Calificación por edad típica en España
        if (/^(TP|\+?\d{1,2}|NR|X)$/i.test(s)) {
          age_rating = s;
          continue;
        }
        // País típico (corto, sin tilde mayoritariamente). Lo ignoramos.
        // El resto lo tratamos como género (primer match no asignado).
        if (!genre && s.length > 2 && !/^(EE\.UU\.|España|Japón|Francia|Italia|Reino Unido|Alemania|Corea del Sur|China|México|Argentina|Brasil|Canadá|Australia|India|Suecia|Dinamarca|Noruega|Finlandia)$/i.test(s)) {
          genre = s;
        }
      }
    }

    // Showtimes del día: <a href=".../comprar/ID/..." data-session-time="HH:MM" ...>HH:MM</a>
    const showRe =
      /<a href="(https:\/\/www\.ecartelera\.com\/cines\/comprar\/[^"]+)"[^>]*data-session-time="(\d{2}):(\d{2})"/g;
    let sm: RegExpExecArray | null;
    while ((sm = showRe.exec(block)) !== null) {
      const ticket_url = decodeHtml(sm[1]);
      const hh = +sm[2];
      const mm = +sm[3];
      const ts = madridDateTimeToUtcMs(date.y, date.m, date.d, hh, mm);
      out.push({
        film_title,
        film_slug,
        poster_url,
        duration_min,
        genre,
        age_rating,
        starts_at_ms: ts,
        ticket_url,
      });
    }
  }
  return out;
}

async function fetchDay(cinemaId: number, dayOffset: number): Promise<string> {
  const url = `https://www.ecartelera.com/cines/${cinemaId},${dayOffset},1.html`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; AlicanteLocalGuide/1.0; +https://alicante-local-guide.lovable.app)",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "es-ES,es;q=0.9",
    },
  });
  if (!res.ok) throw new Error(`ecartelera ${cinemaId} day ${dayOffset}: HTTP ${res.status}`);
  return res.text();
}

async function upsertFilm(s: ParsedShow): Promise<string | null> {
  const slug = slugify(s.film_slug || s.film_title);
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
        title: s.film_title,
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
      title: s.film_title,
      duration_min: s.duration_min,
      genre: s.genre,
      age_rating: s.age_rating,
      poster_url: s.poster_url,
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

  const today = madridToday();
  const allShows: ParsedShow[] = [];
  const dayResults: { day: number; count: number; error?: string }[] = [];

  for (let off = 0; off <= DAY_HORIZON; off++) {
    try {
      const html = await fetchDay(source.ecartelera_id, off);
      const date = addDays(today.y, today.m, today.d, off);
      const shows = parseEcarteleraDay(html, date);
      allShows.push(...shows);
      dayResults.push({ day: off, count: shows.length });
    } catch (e) {
      dayResults.push({
        day: off,
        count: 0,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // Filtra pases futuros (margen -1h por ediciones tardías)
  const now = Date.now();
  const valid = allShows.filter((p) => p.starts_at_ms > now - 60 * 60 * 1000);

  if (valid.length === 0) {
    return {
      slug: source.slug,
      ok: true,
      scraped: allShows.length,
      inserted: 0,
      days: dayResults,
    };
  }

  // Borra futuros del cine para evitar pases obsoletos
  await supabaseAdmin
    .from("showtimes")
    .delete()
    .eq("cinema_id", cinema.id)
    .gte("starts_at", new Date(now - 60 * 60 * 1000).toISOString());

  // Cache films por slug para no repetir lookups
  const filmCache = new Map<string, string>();
  let inserted = 0;
  let lastError: string | null = null;

  for (const s of valid) {
    let film_id = filmCache.get(s.film_slug);
    if (!film_id) {
      const id = await upsertFilm(s);
      if (!id) continue;
      film_id = id;
      filmCache.set(s.film_slug, id);
    }
    const { error } = await supabaseAdmin
      .from("showtimes")
      .upsert(
        {
          cinema_id: cinema.id,
          film_id,
          starts_at: new Date(s.starts_at_ms).toISOString(),
          ticket_url: s.ticket_url,
          source: "ecartelera",
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
    scraped: allShows.length,
    inserted,
    days: dayResults,
    ...(lastError ? { last_error: lastError } : {}),
  };
}

async function runAll(only?: string) {
  const targets = only ? SOURCES.filter((s) => s.slug === only) : SOURCES;
  const results: unknown[] = [];
  for (const src of targets) {
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
