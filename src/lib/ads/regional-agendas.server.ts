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

export async function fetchSanVicenteAgenda() {
  return scrapeJsonLdAgenda("https://raspeig.es/agenda/");
}

export async function fetchSantJoanAgenda() {
  return scrapeJsonLdAgenda("https://www.santjoandalacant.es/events/");
}

export async function fetchMutxamelAgenda() {
  return scrapeJsonLdAgenda("https://ayto.mutxamel.org/eventos-mtx/");
}

export async function fetchSantaPolaAgenda() {
  return scrapeJsonLdAgenda("https://www.santapola4you.es/es/calendar/");
}

export async function fetchVisitElcheAgenda() {
  // Fuerza al mes actual
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return scrapeJsonLdAgenda(`https://www.visitelche.com/eventos/mes/${ym}/`);
}

export async function fetchBenidormAgenda(): Promise<RegionalEvent[] | null> {
  // benidorm.org/es/agenda no expone JSON-LD; fallback: lista de festivales/eventos publicados como noticias.
  const html = await fetchHtml("https://benidorm.org/es/agenda");
  if (!html) return null;
  // Busca enlaces a eventos: estructura típica de su CMS usa <h3> o <h2> con título dentro de <a href="/es/evento/...">
  const matches = [
    ...html.matchAll(
      /<a[^>]+href="[^"]*\/(?:agenda|evento|noticia)[^"]*"[^>]*>([^<]{8,160})<\/a>/gi,
    ),
  ];
  const seen = new Set<string>();
  const out: RegionalEvent[] = [];
  for (const m of matches) {
    const title = clean(m[1]);
    const k = title.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    if (/cookie|aviso|men[uú]|inicio|portada|saltar/i.test(title)) continue;
    out.push({ title, when: "", excerpt: "Publicado en agenda oficial de Benidorm." });
    if (out.length >= 8) break;
  }
  return out.length ? out : null;
}

export async function fetchTorreviejaAgenda(): Promise<RegionalEvent[] | null> {
  const fromJsonLd = await scrapeJsonLdAgenda("https://culturatorrevieja.com/programacion/");
  if (fromJsonLd) return fromJsonLd;
  const html = await fetchHtml("https://culturatorrevieja.com/programacion/");
  if (!html) return null;
  // Cada item: <h4> Título </h4> ... <span class="date">DD/MM/YYYY - HH:MM</span> ... lugar
  const items = [
    ...html.matchAll(
      /<h4[^>]*>\s*([^<]{4,180})\s*<\/h4>[\s\S]{0,500}?(\d{2}\/\d{2}\/\d{4})(?:\s*-\s*(\d{1,2}:\d{2}))?[\s\S]{0,400}?(Teatro\s+Municipal|Auditorio[^<]*|Palacio[^<]*|Plaza[^<]*)?/gi,
    ),
  ];
  const out: RegionalEvent[] = [];
  for (const it of items) {
    const title = clean(it[1]);
    const date = it[2];
    const time = it[3] ?? "";
    const place = clean(it[4] ?? "Cultura Torrevieja");
    if (!title || /^todo$|^musical$/i.test(title)) continue;
    out.push({
      title,
      when: time ? `${date} ${time}` : date,
      excerpt: place,
    });
    if (out.length >= 8) break;
  }
  return out.length ? out : null;
}

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

export async function fetchPlazaTorosAgenda(): Promise<RegionalEvent[] | null> {
  const fromJsonLd = await scrapeJsonLdAgenda("https://plazatorosalicante.com/conciertos-y-eventos/");
  if (fromJsonLd) return fromJsonLd;
  const html = await fetchHtml("https://plazatorosalicante.com/conciertos-y-eventos/");
  if (!html) return null;
  // Títulos típicos: "## MANUEL CARRASCO – 19 de septiembre" → buscamos h2/h3 con guión y fecha
  const items = [
    ...html.matchAll(
      /<h[23][^>]*>\s*([^<]+(?:[–\-—])\s*\d{1,2}\s+de\s+\w+(?:\s+\d{4})?)\s*<\/h[23]>/gi,
    ),
  ];
  const out: RegionalEvent[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    const raw = clean(it[1]);
    const k = raw.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    // Separa título y fecha
    const split = raw.split(/[–\-—]\s*/);
    const title = split[0] ? split[0].trim() : raw;
    const when = split[1] ? split[1].trim() : "";
    out.push({ title, when, excerpt: "Plaza de Toros de Alicante." });
    if (out.length >= 8) break;
  }
  return out.length ? out : null;
}

// ─── Mercadillos: calendario estático del Ayto. (Concejalía de Mercados) ──
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
