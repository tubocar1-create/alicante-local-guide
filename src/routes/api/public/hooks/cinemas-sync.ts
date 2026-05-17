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
];

// Odeon Alicante tiene parser propio (web propia con cookie default_center).
const ODEON_SLUG = "odeon-multicines-alicante";
const ODEON_BASE = "https://odeonmulticines.com";
const ODEON_COOKIE = "default_center=odeon-alicante";

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

  const { inserted, lastError } = await persistShows(cinema.id, valid, "ecartelera", now);

  return {
    slug: source.slug,
    ok: true,
    scraped: allShows.length,
    inserted,
    days: dayResults,
    ...(lastError ? { last_error: lastError } : {}),
  };
}

// ===== Persistencia compartida (borra futuros y reinserta) =====
async function persistShows(
  cinemaId: string,
  valid: ParsedShow[],
  source: string,
  now: number,
): Promise<{ inserted: number; lastError: string | null }> {
  if (valid.length === 0) {
    return { inserted: 0, lastError: null };
  }

  await supabaseAdmin
    .from("showtimes")
    .delete()
    .eq("cinema_id", cinemaId)
    .gte("starts_at", new Date(now - 60 * 60 * 1000).toISOString());

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
          cinema_id: cinemaId,
          film_id,
          starts_at: new Date(s.starts_at_ms).toISOString(),
          ticket_url: s.ticket_url,
          format: (s as ParsedShow & { format?: string | null }).format ?? null,
          source,
        },
        { onConflict: "cinema_id,film_id,starts_at" },
      );
    if (error) {
      lastError = error.message;
    } else {
      inserted++;
    }
  }
  return { inserted, lastError };
}

// ===== Odeon Multicines Alicante =====
// Estrategia: enumerar /odeon-alicante/peliculas para sacar los slugs de
// /producto/{slug}; en cada producto extraer bloques day-YYYY-MM-DD con
// botones .btn_sesion que llevan a /odeon-alicante/sesion?pid=...&sesion=...
async function fetchOdeon(path: string): Promise<string> {
  const res = await fetch(`${ODEON_BASE}${path}`, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; AlicanteLocalGuide/1.0; +https://alicante-local-guide.lovable.app)",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "es-ES,es;q=0.9",
      Cookie: ODEON_COOKIE,
    },
  });
  if (!res.ok) throw new Error(`odeon ${path}: HTTP ${res.status}`);
  return res.text();
}

function parseOdeonProduct(html: string, productSlug: string): ParsedShow[] {
  // Título: <h5>TITLE</h5> (en la ficha) o el primer <h3 class="my-auto p-2">
  let title = "";
  const h5 = html.match(/<h5[^>]*>([^<]+)<\/h5>/);
  if (h5) title = decodeHtml(h5[1]).trim();
  if (!title) {
    const h3 = html.match(/<h3[^>]*class="[^"]*my-auto[^"]*"[^>]*>([^<]+)<\/h3>/);
    if (h3) title = decodeHtml(h3[1]).trim();
  }
  if (!title) title = productSlug.replace(/-/g, " ");

  // Póster
  let poster_url: string | null = null;
  const pm = html.match(/(https:\/\/odeon-cdn\.b-cdn\.net\/show-posters\/[^"?\s]+\.(?:jpg|png|webp))/);
  if (pm) poster_url = pm[1];

  // Duración
  let duration_min: number | null = null;
  const dm = html.match(/>(\d{2,3})\s*min</);
  if (dm) duration_min = +dm[1];

  // Género: primer texto razonable después del icono genre-icon
  let genre: string | null = null;
  const gm = html.match(/genre-icon[^>]*>[\s\S]{0,200}?>([A-Za-zÁÉÍÓÚÑáéíóúñ ]{3,30})</);
  if (gm) genre = decodeHtml(gm[1]).trim();

  // Calificación por edad: alt del icono ari_X.gif
  let age_rating: string | null = null;
  const am = html.match(/age-rating-icons\/[a-z]+\/ari_\d+\.gif[^"]*"[^>]*alt="([^"]+)"/);
  if (am) {
    age_rating = decodeHtml(am[1]).trim();
  } else {
    const am2 = html.match(/alt="([^"]+)"[^>]*src="[^"]*age-rating-icons/);
    if (am2) age_rating = decodeHtml(am2[1]).trim();
  }

  // Pases por día: <div class="day-YYYY-MM-DD ..."> ... </div>
  // Capturamos el bloque hasta el siguiente <div class="day- o cierre del contenedor padre.
  const out: ParsedShow[] = [];
  const dayRe = /<div class="day-(\d{4})-(\d{2})-(\d{2})[^"]*"[^>]*>([\s\S]*?)(?=<div class="day-\d{4}-\d{2}-\d{2}|<\/div>\s*<\/div>\s*<!--\s*SHOW INFO|<!-- SHOW INFO)/g;
  let dm2: RegExpExecArray | null;
  while ((dm2 = dayRe.exec(html)) !== null) {
    const y = +dm2[1];
    const m = +dm2[2];
    const d = +dm2[3];
    const dayBlock = dm2[4];

    // Formato (Digital / Cinity / 3D ...)
    const fmtMatch = dayBlock.match(/data-format="([^"]+)"/);
    const format = fmtMatch ? decodeHtml(fmtMatch[1]).trim() : null;

    // Botones de sesión: <a class="btn_sesion ..." href="...sesion?pid=X&sesion=Y">HH:MM</a>
    const sessRe =
      /<a[^>]*class="btn_sesion[^"]*"[^>]*href="([^"]+)"[^>]*>\s*(\d{1,2}):(\d{2})\s*<\/a>/g;
    let sm: RegExpExecArray | null;
    while ((sm = sessRe.exec(dayBlock)) !== null) {
      const ticket_url = decodeHtml(sm[1]);
      const hh = +sm[2];
      const mm = +sm[3];
      const ts = madridDateTimeToUtcMs(y, m, d, hh, mm);
      out.push({
        film_title: title,
        film_slug: productSlug,
        poster_url,
        duration_min,
        genre,
        age_rating,
        starts_at_ms: ts,
        ticket_url,
        // @ts-expect-error -- extra optional field consumido por persistShows
        format,
      });
    }
  }
  return out;
}

async function syncOdeon() {
  const { data: cinema } = await supabaseAdmin
    .from("cinemas")
    .select("id, slug")
    .eq("slug", ODEON_SLUG)
    .maybeSingle();
  if (!cinema?.id) {
    return { slug: ODEON_SLUG, ok: false, error: "cine no encontrado en BD" };
  }

  let listHtml: string;
  try {
    listHtml = await fetchOdeon("/odeon-alicante/peliculas");
  } catch (e) {
    return { slug: ODEON_SLUG, ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  const slugs = Array.from(
    new Set(
      [...listHtml.matchAll(/odeonmulticines\.com\/producto\/([a-z0-9-]+)/g)].map((m) => m[1]),
    ),
  );

  const allShows: ParsedShow[] = [];
  const perFilm: { slug: string; count: number; error?: string }[] = [];

  for (const slug of slugs) {
    try {
      const html = await fetchOdeon(`/producto/${slug}`);
      const shows = parseOdeonProduct(html, slug);
      allShows.push(...shows);
      perFilm.push({ slug, count: shows.length });
    } catch (e) {
      perFilm.push({ slug, count: 0, error: e instanceof Error ? e.message : String(e) });
    }
  }

  const now = Date.now();
  const valid = allShows.filter((p) => p.starts_at_ms > now - 60 * 60 * 1000);
  const { inserted, lastError } = await persistShows(cinema.id, valid, "odeon", now);

  return {
    slug: ODEON_SLUG,
    ok: true,
    films: slugs.length,
    scraped: allShows.length,
    inserted,
    detail: perFilm,
    ...(lastError ? { last_error: lastError } : {}),
  };
}

async function runAll(only?: string) {
  const results: unknown[] = [];
  // ecartelera-backed cinemas
  const targets = only ? SOURCES.filter((s) => s.slug === only) : SOURCES;
  for (const src of targets) {
    const r = await syncCinema(src);
    results.push(r);
  }
  // Odeon (parser propio)
  if (!only || only === ODEON_SLUG) {
    const r = await syncOdeon();
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
