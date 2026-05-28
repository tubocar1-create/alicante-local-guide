import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Tope duro: máximo 50 resultados por categoría (sólo privados verificados con web)
const MAX_RESULTS = 50;
const AI_CANDIDATES = 60; // pedimos algunos extra para tolerar descartes
const SCRAPE_CONCURRENCY = 6;

export type HealthProviderDTO = {
  id: string;
  category: string;
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  lat: number | null;
  lng: number | null;
  rating: number | null;
  user_ratings_total: number | null;
  photos: string[];
  google_place_id: string | null;
  opening_hours: {
    weekdayDescriptions?: string[];
    periods?: Array<{
      open?: { day?: number; hour?: number; minute?: number };
      close?: { day?: number; hour?: number; minute?: number };
    }>;
    openNow?: boolean;
  } | null;
  price_level: string | null;
  notes: string | null;
  source: string;
};

function toDTO(row: Record<string, unknown>): HealthProviderDTO {
  return {
    id: row.id as string,
    category: row.category as string,
    name: row.name as string,
    address: (row.address as string) ?? null,
    phone: (row.phone as string) ?? null,
    website: (row.website as string) ?? null,
    lat: (row.lat as number) ?? null,
    lng: (row.lng as number) ?? null,
    rating: (row.rating as number) ?? null,
    user_ratings_total: (row.user_ratings_total as number) ?? null,
    photos: (row.photos as string[]) ?? [],
    google_place_id: (row.google_place_id as string) ?? null,
    opening_hours:
      (row.opening_hours as HealthProviderDTO["opening_hours"]) ?? null,
    price_level: (row.price_level as string) ?? null,
    notes: (row.notes as string) ?? null,
    source: (row.source as string) ?? "google",
  };
}

// Mapa de slug de categoría → service_types de health_centers (BD pública)
const PUBLIC_CENTERS_BY_CATEGORY: Record<string, string[]> = {
  "centros-salud": ["centro_salud", "consultorio"],
  urgencias: ["urgencias"],
  especialidades: ["especialidades"],
  "salud-mental": ["salud_mental"],
};

// Convierte horarios abreviados estilo GVA ("L-V 8:00-20:00", "24h",
// "fines de semana y festivos 24h") a periods de Google para que
// computeOpenStatus pueda evaluar abierto/cerrado.
function parseScheduleToPeriods(
  raw: string,
): NonNullable<HealthProviderDTO["opening_hours"]>["periods"] {
  const text = raw.toLowerCase().trim();
  // 24h puro → un único periodo abierto siempre
  if (/^24\s*h?$/.test(text) || /^abierto\s*24/.test(text)) {
    return [{ open: { day: 0, hour: 0, minute: 0 } }];
  }
  const periods: NonNullable<HealthProviderDTO["opening_hours"]>["periods"] = [];
  const segments = text.split(",").map((s) => s.trim());
  for (const seg of segments) {
    // Detecta días: "l-v", "lun-vie", "s-d", "fines de semana", "festivos", "todos los dias"
    let days: number[] = [];
    if (/fines\s+de\s+semana/.test(seg)) days.push(6, 0);
    if (/festivos|domingos/.test(seg) && !days.includes(0)) days.push(0);
    if (/todos\s+los\s+d[ií]as|diario|cada\s+d[ií]a/.test(seg))
      days = [0, 1, 2, 3, 4, 5, 6];
    const dr = seg.match(/\b([ldmjvsx])\s*-\s*([ldmjvsx])\b/);
    const dayCode: Record<string, number> = { d: 0, l: 1, m: 2, x: 3, j: 4, v: 5, s: 6 };
    if (dr) {
      const a = dayCode[dr[1]];
      const b = dayCode[dr[2]];
      if (a != null && b != null) {
        let i = a;
        for (let k = 0; k < 7; k++) {
          days.push(i);
          if (i === b) break;
          i = (i + 1) % 7;
        }
      }
    }
    if (days.length === 0) continue;

    const is24 = /24\s*h|24\s*horas/.test(seg);
    if (is24) {
      for (const d of days) periods.push({ open: { day: d, hour: 0, minute: 0 }, close: { day: d, hour: 23, minute: 59 } });
      continue;
    }
    const rg = seg.match(/(\d{1,2})[:.h]?(\d{2})?\s*-\s*(\d{1,2})[:.h]?(\d{2})?/);
    if (!rg) continue;
    const oh = Number(rg[1]);
    const om = Number(rg[2] ?? 0);
    const ch = Number(rg[3]);
    const cm = Number(rg[4] ?? 0);
    for (const d of days) {
      const crossesMidnight = ch * 60 + cm <= oh * 60 + om;
      periods.push({
        open: { day: d, hour: oh, minute: om },
        close: {
          day: crossesMidnight ? (d + 1) % 7 : d,
          hour: ch,
          minute: cm,
        },
      });
    }
  }
  return periods;
}

function healthCenterToDTO(row: Record<string, unknown>, category: string): HealthProviderDTO {
  const hours = (row.schedule as string | null) ?? null;
  const periods = hours ? parseScheduleToPeriods(hours) : undefined;
  const opening = hours
    ? ({
        weekdayDescriptions: [hours],
        periods: periods && periods.length > 0 ? periods : undefined,
      } as HealthProviderDTO["opening_hours"])
    : null;
  return {
    id: row.id as string,
    category,
    name: row.name as string,
    address: (row.address as string) ?? null,
    phone: (row.phone as string) ?? null,
    website: (row.website as string) ?? null,
    lat: (row.lat as number) ?? null,
    lng: (row.lng as number) ?? null,
    rating: null,
    user_ratings_total: null,
    photos: [],
    google_place_id: null,
    opening_hours: opening,
    price_level: null,
    notes: (row.notes as string) ?? null,
    source: "public",
  };
}

export const listHealthProviders = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ category: z.string().min(1).max(64) }).parse(data),
  )
  .handler(async ({ data }): Promise<HealthProviderDTO[]> => {
    const { data: rows, error } = await supabaseAdmin
      .from("health_providers")
      .select("*")
      .eq("category", data.category)
      .order("rating", { ascending: false, nullsFirst: false })
      .order("name");
    if (error) throw new Error(error.message);
    const providers = (rows ?? []).map(toDTO);

    const serviceTypes = PUBLIC_CENTERS_BY_CATEGORY[data.category];
    if (serviceTypes) {
      const { data: centers } = await supabaseAdmin
        .from("health_centers")
        .select("*")
        .in("service_type", serviceTypes)
        .order("name");
      const publicDtos = (centers ?? []).map((r) => healthCenterToDTO(r, data.category));
      return [...publicDtos, ...providers];
    }
    return providers;
  });

// Devuelve fotos de un centro de salud público. Para no llamar a Google en
// cada visita, persistimos en health_centers el google_place_id y la lista
// de google_photo_refs la PRIMERA vez. A partir de ahí, devolvemos URLs del
// proxy interno y NUNCA más se llama a Google para este centro.
async function fetchGooglePhotosForCenter(
  centerId: string,
  name: string,
  address: string | null,
  municipality: string | null,
  cachedPlaceId: string | null,
  cachedRefs: string[] | null,
): Promise<{ photos: string[]; placeId: string | null }> {
  const refs = cachedRefs ?? [];
  if (refs.length) {
    return {
      photos: refs.map((pn) => `/api/public/google-photo/${pn}?w=1600`),
      placeId: cachedPlaceId,
    };
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return { photos: [], placeId: cachedPlaceId };

  try {
    const textQuery = [name, address, municipality].filter(Boolean).join(", ");
    const searchRes = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.id,places.displayName,places.photos",
      },
      body: JSON.stringify({
        textQuery,
        languageCode: "es",
        regionCode: "ES",
        maxResultCount: 1,
      }),
    });
    if (!searchRes.ok) return { photos: [], placeId: cachedPlaceId };
    const sj = (await searchRes.json()) as {
      places?: Array<{ id?: string; photos?: Array<{ name: string }> }>;
    };
    const place = sj.places?.[0];
    const placeId = place?.id ?? cachedPlaceId ?? null;
    const photoRefs = (place?.photos ?? []).slice(0, 6).map((p) => p.name);

    // Persistir para no volver a llamar a Google nunca más para este centro.
    await supabaseAdmin
      .from("health_centers")
      .update({
        google_place_id: placeId,
        google_photo_refs: photoRefs,
      })
      .eq("id", centerId);

    return {
      photos: photoRefs.map((pn) => `/api/public/google-photo/${pn}?w=1600`),
      placeId,
    };
  } catch {
    return { photos: [], placeId: cachedPlaceId };
  }
}

export const getHealthProvider = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }): Promise<HealthProviderDTO | null> => {
    const { data: row, error } = await supabaseAdmin
      .from("health_providers")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (row) return toDTO(row);
    // Fallback: puede ser un centro público (health_centers)
    const { data: center } = await supabaseAdmin
      .from("health_centers")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!center) return null;
    const dto = healthCenterToDTO(center, (center.service_type as string) ?? "publico");
    const { photos, placeId } = await fetchGooglePhotosForCenter(
      center.name as string,
      (center.address as string) ?? null,
      (center.municipality as string) ?? null,
    );
    return { ...dto, photos, google_place_id: placeId };
  });

// ---- Populate: IA genera candidatos reales + Firecrawl verifica con scraping ----
// Sólo admins. Hasta 50 fichas por categoría. Descarta negocios sin web o
// cuya web no aporta teléfono/dirección/horario verificables.

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const FIRECRAWL_URL = "https://api.firecrawl.dev/v2/scrape";

type AiCandidate = {
  name: string;
  website: string;
  address?: string | null;
  area?: string | null;
};

type ScrapedFields = {
  phone: string | null;
  address: string | null;
  hours: string[] | null;
  email: string | null;
  summary: string | null;
};

const CATEGORY_PROMPTS: Record<string, string> = {
  "hospitales-privados": "hospitales y clínicas hospitalarias privadas (Vithas, Quirónsalud, HLA, IMED, Perpetuo Socorro, San Carlos, etc.)",
  odontologia: "clínicas dentales y odontólogos privados",
  opticas: "ópticas (cadenas y locales independientes)",
  rehabilitacion: "centros de fisioterapia y rehabilitación privados",
  psicologia: "consultas de psicología clínica privada",
  "terapia-familiar": "centros de terapia familiar, de pareja y mediación",
  "pediatria-privada": "consultas de pediatría privada y clínicas pediátricas",
  ginecologia: "clínicas ginecológicas y obstétricas privadas",
  "analisis-clinicos": "laboratorios de análisis clínicos privados",
  "diagnostico-imagen": "centros de diagnóstico por imagen (radiología, RMN, TAC, ecografía) privados",
  audiologia: "centros auditivos y de audiología (audífonos)",
  nutricion: "consultas privadas de nutrición y dietética",
  "estetica-medica": "clínicas de medicina y dermatología estética",
  traumatologia: "consultas y clínicas privadas de traumatología",
  cardiologia: "consultas y clínicas privadas de cardiología",
  oftalmologia: "clínicas oftalmológicas privadas (cirugía refractiva, revisiones)",
  vacunacion: "centros de vacunación internacional y medicina del viajero",
  veterinarios: "clínicas veterinarias",
};

async function aiCandidatesBatch(
  category: string,
  label: string,
  exclude: string[],
  batchSize: number,
): Promise<AiCandidate[]> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY missing");
  const focus = CATEGORY_PROMPTS[category] ?? label;
  const excludeText = exclude.length
    ? ` NO repitas estos negocios ya listados: ${exclude.slice(0, 60).join(", ")}.`
    : "";
  const prompt = `Lista ${batchSize} negocios REALES y DISTINTOS de ${focus} ubicados en la provincia de Alicante (Alicante ciudad, San Vicente del Raspeig, Sant Joan d'Alacant, El Campello, Mutxamel, Elche, Santa Pola, San Juan Playa, Playa de San Juan, Albufereta, etc.). Para cada uno devuelve nombre comercial exacto, URL OFICIAL de su sitio web (https://...) y dirección aproximada si la conoces. NO inventes webs: si no estás seguro de la web oficial, omite ese negocio. Prioriza negocios con presencia online real.${excludeText}`;

  const res = await fetch(LOVABLE_AI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "Eres un asistente experto en negocios locales de la provincia de Alicante. Devuelve sólo datos verificables." },
        { role: "user", content: prompt },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "submit_candidates",
            description: "Lista de candidatos con web oficial",
            parameters: {
              type: "object",
              properties: {
                candidates: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      website: { type: "string", description: "URL absoluta https://..." },
                      address: { type: "string" },
                      area: { type: "string", description: "Barrio o municipio" },
                    },
                    required: ["name", "website"],
                  },
                },
              },
              required: ["candidates"],
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "submit_candidates" } },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Lovable AI ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    choices?: Array<{
      message?: { tool_calls?: Array<{ function?: { arguments?: string } }> };
    }>;
  };
  const argsStr = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!argsStr) return [];
  try {
    const parsed = JSON.parse(argsStr) as { candidates?: AiCandidate[] };
    return (parsed.candidates ?? []).filter((c) => c.name && c.website?.startsWith("http"));
  } catch {
    return [];
  }
}

async function scrapeWebsite(url: string): Promise<ScrapedFields | null> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) throw new Error("FIRECRAWL_API_KEY missing");
  try {
    const res = await fetch(FIRECRAWL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        onlyMainContent: true,
        timeout: 25000,
        formats: [
          "summary",
          {
            type: "json",
            schema: {
              type: "object",
              properties: {
                phone: { type: "string", description: "Teléfono principal en formato +34 ... o 9XX XXX XXX" },
                address: { type: "string", description: "Dirección postal completa con ciudad" },
                hours: {
                  type: "array",
                  items: { type: "string" },
                  description: "Horario por días de la semana, una línea por día",
                },
                email: { type: "string" },
              },
            },
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: { json?: Partial<ScrapedFields>; summary?: string };
    };
    const d = json.data ?? {};
    const extracted = d.json ?? {};
    return {
      phone: extracted.phone ?? null,
      address: extracted.address ?? null,
      hours: Array.isArray(extracted.hours) && extracted.hours.length ? extracted.hours : null,
      email: extracted.email ?? null,
      summary: d.summary ?? null,
    };
  } catch {
    return null;
  }
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

export const populateHealthCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      category: z.string().min(1).max(64),
      query: z.string().min(2).max(200).optional(),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Error("Forbidden: admin role required");

    const label = data.query ?? data.category;

    // Multi-batch: Gemini suele devolver 10-15 por llamada. Pedimos en tandas hasta llegar a AI_CANDIDATES.
    const BATCH_SIZE = 25;
    const MAX_BATCHES = 4;
    const seen = new Set<string>();
    const unique: AiCandidate[] = [];
    for (let b = 0; b < MAX_BATCHES && unique.length < AI_CANDIDATES; b++) {
      const batch = await aiCandidatesBatch(
        data.category,
        label,
        unique.map((u) => u.name),
        BATCH_SIZE,
      );
      let added = 0;
      for (const c of batch) {
        try {
          const h = new URL(c.website).host.replace(/^www\./, "");
          if (seen.has(h)) continue;
          seen.add(h);
          unique.push(c);
          added++;
        } catch {
          continue;
        }
      }
      if (added === 0) break;
    }

    if (!unique.length) {
      return { inserted: 0, total: 0, source: "ai+web", discarded: 0, reason: "no candidates" };
    }

    const scraped = await runWithConcurrency(unique, SCRAPE_CONCURRENCY, async (c: AiCandidate) => {
      const fields = await scrapeWebsite(c.website);
      return { candidate: c, fields };
    });

    const rows = scraped
      // Conservamos todos los candidatos con web válida. Si el scraping falla, mantenemos la ficha con web y dirección IA.
      .slice(0, MAX_RESULTS)
      .map(({ candidate, fields }: { candidate: AiCandidate; fields: ScrapedFields | null }, i: number) => {
        const f: ScrapedFields = fields ?? { phone: null, address: null, hours: null, email: null, summary: null };
        const host = (() => {
          try { return new URL(candidate.website).host.replace(/^www\./, ""); }
          catch { return `unknown-${i}`; }
        })();
        return {
          category: data.category,
          name: candidate.name,
          // Prioridad a datos scrapeados de la web propia
          address: f.address ?? candidate.address ?? null,
          phone: f.phone ?? null,
          website: candidate.website,
          lat: null as number | null,
          lng: null as number | null,
          rating: null as number | null,
          user_ratings_total: null as number | null,
          photos: [] as string[],
          google_place_id: `web-${data.category}-${host}`,
          opening_hours: f.hours
            ? ({ weekdayDescriptions: f.hours } as unknown as never)
            : null,
          price_level: null as string | null,
          source: "ai+web",
          notes: f.summary ?? null,
        };
      });

    if (!rows.length) {
      return {
        inserted: 0,
        total: unique.length,
        discarded: unique.length,
        source: "ai+web",
        reason: "no website verified",
      };
    }

    const { error } = await supabaseAdmin
      .from("health_providers")
      .upsert(rows, { onConflict: "google_place_id" });
    if (error) throw new Error(error.message);

    return {
      inserted: rows.length,
      total: unique.length,
      discarded: unique.length - rows.length,
      source: "ai+web",
    };
  });
