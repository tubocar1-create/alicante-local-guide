// Scrapers de agendas regionales y venues para banners informativos.
// Devuelven eventos próximos (≤ 60 días). Si no hay → null y el banner se suspende.

const UA = "Mozilla/5.0 (compatible; AlicanteFriend/1.0)";

export type RegionalEvent = {
  title: string;
  when: string; // texto humano: "Sáb 11 may", "Del 5 al 12 jun", etc.
  excerpt: string; // 1 frase, sitio/lugar/contexto
};

function clean(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(html: string): string {
  return clean(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  );
}

function fmtDateRange(startISO?: string, endISO?: string): string {
  if (!startISO) return "";
  const s = new Date(startISO);
  if (Number.isNaN(s.getTime())) return "";
  const fmt = (d: Date) =>
    d.toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
      timeZone: "Europe/Madrid",
    });
  if (!endISO) return fmt(s);
  const e = new Date(endISO);
  if (Number.isNaN(e.getTime()) || e.toDateString() === s.toDateString()) {
    return fmt(s);
  }
  return `${fmt(s)} – ${fmt(e)}`;
}

// Busca JSON-LD <script type="application/ld+json"> con eventos schema.org.
// Cubre la mayoría de WordPress (The Events Calendar, EventON), Drupal, etc.
async function fetchHtml(url: string, timeoutMs = 6000): Promise<string | null> {
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!r.ok) return null;
    return await r.text();
  } catch {
    return null;
  }
}

function pickEventsFromJsonLd(html: string): RegionalEvent[] {
  const out: RegionalEvent[] = [];
  const blocks = [
    ...html.matchAll(
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    ),
  ];
  const now = Date.now();
  const horizon = now + 60 * 24 * 3600 * 1000;
  const seen = new Set<string>();
  for (const b of blocks) {
    let json: unknown;
    try {
      json = JSON.parse(b[1].trim());
    } catch {
      continue;
    }
    const flat: unknown[] = Array.isArray(json) ? json : [json];
    // Algunos sites embeben { "@graph": [ ... ] }
    const expanded: unknown[] = [];
    for (const x of flat) {
      if (x && typeof x === "object" && "@graph" in x && Array.isArray((x as { "@graph": unknown[] })["@graph"])) {
        expanded.push(...(x as { "@graph": unknown[] })["@graph"]);
      } else {
        expanded.push(x);
      }
    }
    for (const node of expanded) {
      if (!node || typeof node !== "object") continue;
      const n = node as Record<string, unknown>;
      const t = String(n["@type"] ?? "");
      if (!/Event/i.test(t)) continue;
      const name = clean(String(n.name ?? ""));
      const startISO = typeof n.startDate === "string" ? n.startDate : undefined;
      const endISO = typeof n.endDate === "string" ? n.endDate : undefined;
      if (!name || !startISO) continue;
      const startMs = new Date(startISO).getTime();
      if (!Number.isFinite(startMs)) continue;
      // Si hay endDate, válido mientras no haya pasado del todo.
      const endMs = endISO ? new Date(endISO).getTime() : startMs;
      if (endMs < now - 12 * 3600 * 1000) continue;
      if (startMs > horizon) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const loc = n.location;
      let placeName = "";
      if (loc && typeof loc === "object") {
        const l = loc as Record<string, unknown>;
        placeName = clean(String(l.name ?? ""));
      }
      const desc = clean(String(n.description ?? "")).slice(0, 200);
      const excerpt = (placeName ? `${placeName}. ` : "") + (desc || "Evento programado.");
      out.push({
        title: name,
        when: fmtDateRange(startISO, endISO),
        excerpt: excerpt.slice(0, 220),
      });
    }
  }
  return out;
}

async function scrapeJsonLdAgenda(url: string): Promise<RegionalEvent[] | null> {
  const html = await fetchHtml(url);
  if (!html) return null;
  const events = pickEventsFromJsonLd(html);
  return events.length ? events.slice(0, 10) : null;
}

// ─── Sources ──────────────────────────────────────────────────────────

export async function fetchTeatroPrincipalAgenda(): Promise<RegionalEvent[] | null> {
  const fromJsonLd = await scrapeJsonLdAgenda(
    "https://www.teatroprincipaldealicante.com/programacion-actual/",
  );
  if (fromJsonLd) return fromJsonLd;
  const html = await fetchHtml(
    "https://www.teatroprincipaldealicante.com/programacion-actual/",
  );
  if (!html) return null;
  // Cada show: bloque con día + mes + título + (subtítulo)
  // Patrón visto: "17-18 viernessábadoabril\n### Ernesto Sevilla\n### Yo literal"
  const months = "enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre";
  const re = new RegExp(
    `(\\d{1,2}(?:[\\-–]\\d{1,2})?)[^<]*?(${months})[\\s\\S]{0,400}?<h3[^>]*>\\s*([^<]{3,140})\\s*</h3>(?:[\\s\\S]{0,200}?<h4[^>]*>\\s*([^<]{3,140})\\s*</h4>)?`,
    "gi",
  );
  const out: RegionalEvent[] = [];
  const seen = new Set<string>();
  for (const m of [...html.matchAll(re)]) {
    const day = m[1];
    const month = m[2];
    const title = clean(m[3]);
    const sub = clean(m[4] ?? "");
    if (!title) continue;
    const k = title.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({
      title,
      when: `${day} ${month}`,
      excerpt: sub || "Teatro Principal de Alicante.",
    });
    if (out.length >= 10) break;
  }
  return out.length ? out : null;
}

// Cartel oficial Plaza de Toros Alicante 2026 (cerrado por el promotor).
const PLAZA_TOROS_2026: Array<{ date: string; artist: string; note?: string }> = [
  { date: "2026-03-06", artist: "Fito y Fitipaldis" },
  { date: "2026-07-11", artist: "2º Festival Mediterráneo de Cantautores" },
  { date: "2026-07-25", artist: "Antonio Orozco" },
  { date: "2026-07-12", artist: "Joaquín Sabina" },
  { date: "2026-07-17", artist: "Miguel Bosé" },
  { date: "2026-08-08", artist: "Triana Tour Cano" },
];

export async function fetchPlazaTorosAgenda(): Promise<RegionalEvent[] | null> {
  // Reutiliza helpers definidos más abajo en este módulo (todayMadrid, shuffle).
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const upcoming = PLAZA_TOROS_2026.filter((c) => c.date >= today);
  if (upcoming.length === 0) return null;
  const shuffled = [...upcoming];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, 6).map((c) => ({
    title: c.artist,
    when: fmtDateRange(`${c.date}T21:30:00+02:00`),
    excerpt: "Concierto en la Plaza de Toros de Alicante.",
  }));
}

// ─── Otros venues (mismo patrón: JSON-LD + fallback heurístico) ──────
// Extrae títulos y fechas próximas. Si la web cambia, el banner se
// suspende solo (devuelve null/[]).

async function scrapeVenue(
  url: string,
  venueLabel: string,
): Promise<RegionalEvent[] | null> {
  const fromJsonLd = await scrapeJsonLdAgenda(url);
  if (fromJsonLd) {
    return fromJsonLd.map((e) => ({
      ...e,
      excerpt: e.excerpt || `${venueLabel}.`,
    }));
  }
  const html = await fetchHtml(url);
  if (!html) return null;
  // Heurística: títulos en h2/h3/h4 + fecha cercana ("12 de marzo", "12/03/2025", "12 mar")
  const months = "enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic";
  const re = new RegExp(
    `<h[234][^>]*>\\s*([^<]{4,160})\\s*</h[234]>[\\s\\S]{0,500}?((?:\\d{1,2}\\s+(?:de\\s+)?(?:${months}))|(?:\\d{1,2}\\/\\d{1,2}(?:\\/\\d{2,4})?))`,
    "gi",
  );
  const out: RegionalEvent[] = [];
  const seen = new Set<string>();
  for (const m of [...html.matchAll(re)]) {
    const title = clean(m[1]);
    const when = clean(m[2]);
    if (!title || /cookie|men[uú]|inicio|portada|aviso|política/i.test(title)) continue;
    const k = title.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ title, when, excerpt: `${venueLabel}.` });
    if (out.length >= 8) break;
  }
  return out.length ? out : null;
}

export async function fetchAddaAgenda() {
  return scrapeVenue("https://addaalicante.es/programacion/", "ADDA - Auditorio de la Diputación de Alicante");
}

export async function fetchStereoAgenda() {
  return scrapeVenue("https://stereoalicante.es/agenda/", "Stereo Alicante");
}

export async function fetchSalaOneAgenda() {
  return scrapeVenue("https://salaone.com/agenda/", "Sala One Alicante");
}

// Programación oficial Muelle Live (cartel cerrado por el promotor).
// A medida que pasa la fecha, el concierto desaparece. Se rotan al azar.
const MUELLE_LIVE_2026: Array<{ date: string; artist: string }> = [
  { date: "2026-05-29", artist: "Miguel Ríos" },
  { date: "2026-06-06", artist: "La Gossa Sorda" },
  { date: "2026-06-13", artist: "La Reina del Flow Live" },
  { date: "2026-07-02", artist: "Rosario" },
  { date: "2026-07-04", artist: "Rosana" },
  { date: "2026-07-06", artist: "Alan Parsons Live Project" },
  { date: "2026-07-09", artist: "Pablo Alborán" },
  { date: "2026-07-10", artist: "Bandalos Chinos + Silvestre y La Naranja" },
  { date: "2026-07-11", artist: "Valeria Castro" },
  { date: "2026-07-15", artist: "Anastacia" },
  { date: "2026-07-16", artist: "God Save The Queen" },
  { date: "2026-07-17", artist: "Gira OT 2025" },
  { date: "2026-07-18", artist: "Luz Casal" },
  { date: "2026-08-15", artist: "Loquillo" },
  { date: "2026-08-22", artist: "Sergio Dalma" },
  { date: "2026-09-11", artist: "Vanesa Martín" },
  { date: "2026-09-26", artist: "Raphael" },
];

export async function fetchMuelleLiveAgenda(): Promise<RegionalEvent[] | null> {
  // Hoy en zona Madrid (YYYY-MM-DD)
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const upcoming = MUELLE_LIVE_2026.filter((c) => c.date >= today);
  if (upcoming.length === 0) return null;

  // Rotación aleatoria (Fisher-Yates)
  const shuffled = [...upcoming];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, 8).map((c) => ({
    title: c.artist,
    when: fmtDateRange(`${c.date}T20:00:00+02:00`),
    excerpt: "Concierto en Muelle Live, puerto de Alicante.",
  }));
}

// Helper común: hoy en YYYY-MM-DD zona Madrid
function todayMadrid(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Cartel oficial Rabasa / Área 12 2026
const RABASA_2026: Array<{ date: string; artist: string }> = [
  { date: "2026-06-27", artist: "Dani Martín" },
  { date: "2026-07-08", artist: "The Black Crowes + Los Enemigos" },
  { date: "2026-07-11", artist: "Viva Suecia" },
  { date: "2026-08-21", artist: "Nostalgia Milenial Fest + I Love Reggaeton" },
  { date: "2026-08-22", artist: "Love The 90s" },
  { date: "2026-08-29", artist: "Hombres G" },
];

export async function fetchRabasaAgenda(): Promise<RegionalEvent[] | null> {
  const today = todayMadrid();
  const upcoming = RABASA_2026.filter((c) => c.date >= today);
  if (upcoming.length === 0) return null;
  return shuffle(upcoming).slice(0, 6).map((c) => ({
    title: c.artist,
    when: fmtDateRange(`${c.date}T21:00:00+02:00`),
    excerpt: "Concierto en Multiespacio Rabasa (Área 12), Alicante.",
  }));
}

// Spring Festival 2026 — festival multidía con varios artistas.
const SPRING_FESTIVAL_2026 = {
  start: "2026-05-29",
  end: "2026-05-30",
  artists: ["Love of Lesbian", "Carolina Durante", "Dorian", "La M.O.D.A.", "Xoel López"],
};

export async function fetchSpringAgenda(): Promise<RegionalEvent[] | null> {
  const today = todayMadrid();
  if (SPRING_FESTIVAL_2026.end < today) return null;
  // Un evento por artista, rotando aleatoriamente.
  const when = fmtDateRange(
    `${SPRING_FESTIVAL_2026.start}T20:00:00+02:00`,
    `${SPRING_FESTIVAL_2026.end}T20:00:00+02:00`,
  );
  return shuffle(SPRING_FESTIVAL_2026.artists).map((artist) => ({
    title: `${artist} · Spring Festival`,
    when,
    excerpt: "Spring Festival Alicante, en Spring Club / recinto Spring.",
  }));
}

// Rocanrola 2026 — festival hip-hop multidía.
const ROCANROLA_2026 = {
  start: "2026-04-30",
  end: "2026-05-02",
  artists: ["Kase.O", "Nach", "Delaossa", "Hijos de la Ruina", "Fernandocosta", "Lia Kali"],
};

export async function fetchRocanrolaAgenda(): Promise<RegionalEvent[] | null> {
  const today = todayMadrid();
  if (ROCANROLA_2026.end < today) return null;
  const when = fmtDateRange(
    `${ROCANROLA_2026.start}T19:00:00+02:00`,
    `${ROCANROLA_2026.end}T19:00:00+02:00`,
  );
  return shuffle(ROCANROLA_2026.artists).map((artist) => ({
    title: `${artist} · Rocanrola`,
    when,
    excerpt: "Festival Rocanrola en Alicante (hip-hop, rap).",
  }));
}
// Solo se muestra si HOY hay mercadillo activo.
const MERCADILLOS: Array<{ name: string; days: number[]; hours: string; place: string }> = [
  // 0=domingo, 1=lunes ... 6=sábado
  { name: "Mercadillo de Babel", days: [4, 6], hours: "08:00–14:00", place: "Calle del Asilo (entre Pardo Gimeno y Guillén de Castro)" },
  { name: "Mercadillo Teulada (J.M. Gosálbez)", days: [4, 6], hours: "08:00–14:00", place: "Cruce Avda. Dr. Jiménez Díaz / C. Teulada" },
  { name: "Mercadillo de Benalúa", days: [3], hours: "08:00–14:00", place: "Calles del barrio de Benalúa" },
  { name: "Mercadillo de Plaza de España", days: [2], hours: "08:00–14:00", place: "Plaza de España, Alicante" },
  { name: "Mercadillo de San Blas", days: [5], hours: "08:00–14:00", place: "Avda. Conde Lumiares y aledaños" },
];

export async function fetchMercadillosHoy(): Promise<RegionalEvent[] | null> {
  // Día de la semana en zona Madrid
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Madrid",
    weekday: "short",
  });
  const wk = fmt.format(new Date()); // Mon, Tue, ...
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const today = map[wk] ?? -1;
  const active = MERCADILLOS.filter((m) => m.days.includes(today));
  if (active.length === 0) return [];
  return active.map((m) => ({
    title: m.name,
    when: `Hoy ${m.hours}`,
    excerpt: m.place,
  }));
}

// ─── Songkick (API oficial) ────────────────────────────────────────────
// Metro area de Alicante = 34604. Devuelve conciertos próximos.
export async function fetchSongkickAlicante(): Promise<RegionalEvent[] | null> {
  const apiKey = process.env.SONGKICK_API_KEY;
  if (!apiKey) return null;
  try {
    const url = `https://api.songkick.com/api/3.0/metro_areas/34604/calendar.json?apikey=${apiKey}&per_page=15`;
    const r = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": UA },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    const json = (await r.json()) as {
      resultsPage?: { results?: { event?: Array<Record<string, unknown>> } };
    };
    const events = json.resultsPage?.results?.event ?? [];
    if (events.length === 0) return [];
    const out: RegionalEvent[] = [];
    for (const ev of events) {
      const displayName = clean(String(ev.displayName ?? ""));
      if (!displayName) continue;
      const start = ev.start as { date?: string; time?: string } | undefined;
      const venue = ev.venue as { displayName?: string } | undefined;
      const dateISO = start?.date;
      const when = dateISO ? fmtDateRange(dateISO) : "";
      const place = clean(String(venue?.displayName ?? "Alicante"));
      // displayName típico: "Artist at Venue (City) on Date" → coge la parte del artista
      const artist = displayName.split(/\s+at\s+/i)[0] || displayName;
      out.push({
        title: artist.slice(0, 100),
        when,
        excerpt: `${place}. Vía Songkick.`,
      });
      if (out.length >= 10) break;
    }
    return out.length ? out : [];
  } catch {
    return null;
  }
}
