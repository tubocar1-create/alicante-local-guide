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
  opening_hours: { weekdayDescriptions?: string[] } | null;
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
      (row.opening_hours as { weekdayDescriptions?: string[] }) ?? null,
    price_level: (row.price_level as string) ?? null,
    notes: (row.notes as string) ?? null,
    source: (row.source as string) ?? "google",
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
    return (rows ?? []).map(toDTO);
  });

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
    return row ? toDTO(row) : null;
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
    const candidates = await aiCandidates(data.category, label);
    if (!candidates.length) {
      return { inserted: 0, total: 0, source: "ai+web", discarded: 0, reason: "no candidates" };
    }

    // Deduplicar por host
    const seen = new Set<string>();
    const unique = candidates.filter((c) => {
      try {
        const h = new URL(c.website).host.replace(/^www\./, "");
        if (seen.has(h)) return false;
        seen.add(h);
        return true;
      } catch {
        return false;
      }
    });

    const scraped = await runWithConcurrency(unique, SCRAPE_CONCURRENCY, async (c) => {
      const fields = await scrapeWebsite(c.website);
      return { candidate: c, fields };
    });

    const rows = scraped
      .filter((s) => s.fields && (s.fields.phone || s.fields.address))
      .slice(0, MAX_RESULTS)
      .map(({ candidate, fields }, i) => {
        const f = fields!;
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
