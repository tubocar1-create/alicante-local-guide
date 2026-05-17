import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Scraping diario de cines usando publicine.net como fuente unificada.
// publicine publica la semana completa por sala en una sola página HTML,
// con horarios, formato (Digital/VOSE/3D) y URL de compra (base64 en data-href).
// Cubre las 4 salas de Alicante: Aana, Kinépolis, Yelmo y Odeón.

type ParsedShow = {
  film_pid: string;          // id numérico publicine (estable)
  film_slug: string;         // slug publicine
  film_title: string;
  poster_url: string | null;
  duration_min: number | null;
  genre: string | null;
  age_rating: string | null;
  director: string | null;
  starts_at_ms: number;
  ticket_url: string | null;
  format: string | null;
};

type CinemaSource = {
  slug: string;         // slug en nuestra BD
  publicine_path: string; // path bajo /cartelera-cine/
};

const SOURCES: CinemaSource[] = [
  { slug: "aana-cinemas",              publicine_path: "alacant-alicante/cines-aana-alicante" },
  { slug: "kinepolis-plaza-mar-2",     publicine_path: "alacant-alicante/kinepolis-alicante-plaza-mar-2" },
  { slug: "yelmo-puerta-alicante",     publicine_path: "alacant-alicante/yelmo-cines-puerta-de-alicante" },
  { slug: "odeon-multicines-alicante", publicine_path: "sant-vicent-del-raspeig/odeon-multicines-alicante" },
];

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

function madridToday(): { y: number; m: number; d: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [y, m, d] = fmt.format(new Date()).split("-").map(Number);
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

function madridDateTimeToUtcMs(
  y: number, m: number, d: number, hh: number, mm: number,
): number {
  const offsetHours = isMadridDst(y, m, d) ? 2 : 1;
  return Date.UTC(y, m - 1, d, hh - offsetHours, mm, 0);
}

// Dado DD/MM (sin año), decide el año más cercano a hoy en Madrid.
function inferYear(dd: number, mm: number, today: { y: number; m: number; d: number }): number {
  // publicine muestra la semana actual; los meses estarán cerca de hoy.
  // Si la diferencia es > 6 meses, asumimos cruce de año.
  let y = today.y;
  const diff = (mm - today.m + 12) % 12; // meses hacia adelante
  if (diff > 6) y -= 1;
  // Si estamos en diciembre y vemos enero, sumar año.
  if (today.m === 12 && mm === 1) y = today.y + 1;
  return y;
}

// Decodifica el data-href de publicine para obtener la URL real de compra.
// Formato: /venda/{filmId}/{cinemaCode}/{base64UrlSafe}
function decodeTicketUrl(dataHref: string): string | null {
  const m = dataHref.match(/\/venda\/\d+\/\d+\/([A-Za-z0-9_-]+)/);
  if (!m) return null;
  try {
    const b64 = m[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    const decoded = atob(b64 + pad);
    if (/^https?:\/\//.test(decoded)) return decoded;
  } catch {
    // fallthrough
  }
  return null;
}

async function fetchPublicine(path: string): Promise<string> {
  const url = `https://www.publicine.net/cartelera-cine/${path}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; AlicanteLocalGuide/1.0; +https://alicante-local-guide.lovable.app)",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "es-ES,es;q=0.9",
    },
  });
  if (!res.ok) throw new Error(`publicine ${path}: HTTP ${res.status}`);
  // publicine devuelve latin1; usamos Buffer para decodificar correctamente.
  const buf = new Uint8Array(await res.arrayBuffer());
  // Detecta charset; si no hay UTF-8 BOM, decodifica como latin1.
  const text = new TextDecoder("iso-8859-1").decode(buf);
  return text;
}

function parsePublicine(html: string, today: { y: number; m: number; d: number }): ParsedShow[] {
  const out: ParsedShow[] = [];

  // Localiza cada bloque de película por su título-link: /pelicula/{id}/{slug}'><h2>TITLE</h2>
  const filmHeaderRe = /href='\/pelicula\/(\d+)\/([a-z0-9-]+)'><h2>([^<]+)<\/h2>/g;
  const headers: { pid: string; slug: string; title: string; start: number }[] = [];
  let hm: RegExpExecArray | null;
  while ((hm = filmHeaderRe.exec(html)) !== null) {
    headers.push({
      pid: hm[1],
      slug: hm[2],
      title: decodeHtml(hm[3]).trim(),
      start: hm.index,
    });
  }

  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    const blockEnd = i + 1 < headers.length ? headers[i + 1].start : html.length;
    const block = html.slice(h.start, blockEnd);

    // Poster: <img alt='TITLE' src='/img/pel/full/{pid}f_...webp'>
    let poster_url: string | null = null;
    // El poster aparece justo antes del header en publicine. Busca en una ventana previa.
    const winStart = Math.max(0, h.start - 1500);
    const window = html.slice(winStart, h.start + 300);
    const pm = window.match(
      new RegExp(`src='(/img/pel/full/${h.pid}f_[^']+\\.(?:webp|jpg|png))'`),
    );
    if (pm) {
      poster_url = `https://www.publicine.net${pm[1]}`;
    }

    // Metadatos
    let director: string | null = null;
    const dmm = block.match(/<span class='up'>DIRECTOR<\/span>([^<]+)</);
    if (dmm) director = decodeHtml(dmm[1]).trim();

    let genre: string | null = null;
    const gmm = block.match(/<span class='up'>GÉNERO<\/span>([^<]+)</);
    if (gmm) genre = decodeHtml(gmm[1]).trim();

    let duration_min: number | null = null;
    const durmm = block.match(/<span class='up'>DURACIÓN<\/span>\s*(\d+)\s*min/);
    if (durmm) duration_min = +durmm[1];

    let age_rating: string | null = null;
    const ammm = block.match(/<span class='up'>CLASIFICACIÓN<\/span>([^<]+)</);
    if (ammm) {
      const raw = decodeHtml(ammm[1]).trim();
      const num = raw.match(/(\d+)/);
      if (num) age_rating = num[1];
      else if (/apta|todos|tp/i.test(raw)) age_rating = "TP";
    }

    // Días: box_dia con "Hoy<br/>DD/MM" o "Lunes<br/>DD/MM" seguido de box_projeccions.
    // Capturamos pares (DD/MM, projecciones-block).
    const dayRe =
      /<span class='dia'>[^<]*<br\/>(\d{2})\/(\d{2})<\/span>[\s\S]*?<div class='box_projeccions'>([\s\S]*?)(?=<div class='box_dia'>|<div class='box ' class='clearfix'>|<\/div>\s*<\/div>\s*<div class='botiga'|<\/div>\s*<\/div>\s*<\/div>\s*<\/div>)/g;
    let dym: RegExpExecArray | null;
    while ((dym = dayRe.exec(block)) !== null) {
      const dd = +dym[1];
      const mo = +dym[2];
      const projBlock = dym[3];
      const yr = inferYear(dd, mo, today);

      // Cada sesión es <div class='horari_pelicula'>HH.MM<div class='versio_pelicula'>FORMAT</div></div>
      // o <div class='horari_pelicula_old'><span class='old'>HH.MM</span><div class='versio_pelicula'>FORMAT</div></div>
      // Algunos están envueltos en <a ... data-href='/venda/...' target='_blank'>...</a>.
      const sessRe =
        /(?:<a[^>]*data-href='([^']+)'[^>]*>)?\s*<div class='horari_pelicula(_old)?'>\s*(?:<span class='old'>)?(\d{1,2})[.:](\d{2})(?:<\/span>)?\s*<div class='versio_pelicula'>([^<]+)<\/div>\s*<\/div>\s*(?:<\/a>)?/g;
      let sm: RegExpExecArray | null;
      while ((sm = sessRe.exec(projBlock)) !== null) {
        const dataHref = sm[1];
        const isOld = !!sm[2];
        const hh = +sm[3];
        const mm = +sm[4];
        const format = decodeHtml(sm[5]).trim();
        const starts_at_ms = madridDateTimeToUtcMs(yr, mo, dd, hh, mm);
        // Filtra pases pasados (>1h atrás).
        if (starts_at_ms < Date.now() - 60 * 60 * 1000) continue;
        // Si es _old y la fecha es hoy, probablemente ya pasó; igualmente filtrado por timestamp.
        void isOld;
        const ticket_url = dataHref ? decodeTicketUrl(dataHref) : null;
        out.push({
          film_pid: h.pid,
          film_slug: h.slug,
          film_title: h.title,
          poster_url,
          duration_min,
          genre,
          age_rating,
          director,
          starts_at_ms,
          ticket_url,
          format: format || null,
        });
      }
    }
  }

  return out;
}

async function upsertFilm(s: ParsedShow): Promise<string | null> {
  const slug = slugify(s.film_slug || s.film_title);
  if (!slug) return null;

  const { data: existing } = await supabaseAdmin
    .from("films")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  const fields = {
    title: s.film_title,
    duration_min: s.duration_min,
    genre: s.genre,
    age_rating: s.age_rating,
    poster_url: s.poster_url,
    director: s.director,
  };

  if (existing?.id) {
    await supabaseAdmin
      .from("films")
      .update(fields)
      .eq("id", existing.id);
    return existing.id;
  }

  const { data: inserted, error } = await supabaseAdmin
    .from("films")
    .insert({ slug, active: true, ...fields })
    .select("id")
    .single();
  if (error) {
    console.error("[cinemas-sync] insert film failed", slug, error.message);
    return null;
  }
  return inserted?.id ?? null;
}

async function persistShows(
  cinemaId: string,
  valid: ParsedShow[],
  now: number,
): Promise<{ inserted: number; lastError: string | null }> {
  // Limpia pases futuros del cine para reflejar el estado actual.
  await supabaseAdmin
    .from("showtimes")
    .delete()
    .eq("cinema_id", cinemaId)
    .gte("starts_at", new Date(now - 60 * 60 * 1000).toISOString());

  if (valid.length === 0) return { inserted: 0, lastError: null };

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
          format: s.format,
          source: "publicine",
        },
        { onConflict: "cinema_id,film_id,starts_at" },
      );
    if (error) lastError = error.message;
    else inserted++;
  }
  return { inserted, lastError };
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

  let html: string;
  try {
    html = await fetchPublicine(source.publicine_path);
  } catch (e) {
    return { slug: source.slug, ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  const today = madridToday();
  const shows = parsePublicine(html, today);
  const now = Date.now();
  const { inserted, lastError } = await persistShows(cinema.id, shows, now);

  return {
    slug: source.slug,
    ok: true,
    scraped: shows.length,
    inserted,
    ...(lastError ? { last_error: lastError } : {}),
  };
}

async function runAll(only?: string) {
  const targets = only ? SOURCES.filter((s) => s.slug === only) : SOURCES;
  const results: unknown[] = [];
  for (const src of targets) {
    results.push(await syncCinema(src));
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
          const results = await runAll(only);
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
          const results = await runAll(only);
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
