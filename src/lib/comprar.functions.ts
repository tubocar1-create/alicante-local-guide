import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

function admin() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type ShopTree = {
  sectors: Array<{
    id: string;
    slug: string;
    name: string;
    short_label: string | null;
    emoji: string | null;
    subsectors: Array<{
      id: string;
      slug: string;
      name: string;
      emoji: string | null;
      subsubsectors: Array<{
        id: string;
        slug: string;
        name: string;
        emoji: string | null;
        intents: Array<{
          id: string;
          label: string;
          keywords: string[];
          verbal_recommendation: string | null;
        }>;
      }>;
    }>;
  }>;
};

export const getShopTree = createServerFn({ method: "GET" }).handler(async (): Promise<ShopTree> => {
  const sb = admin();
  const [sec, sub, sss, intents] = await Promise.all([
    sb.from("shop_sectors").select("*").eq("active", true).order("sort_order"),
    sb.from("shop_subsectors").select("*").eq("active", true).order("sort_order"),
    sb.from("shop_subsubsectors").select("*").eq("active", true).order("sort_order"),
    sb
      .from("shop_intents")
      .select("id,subsubsector_id,label,keywords,verbal_recommendation,priority")
      .eq("active", true)
      .order("priority"),
  ]);
  if (sec.error) throw new Error(sec.error.message);
  const sectors = (sec.data ?? []).map((s) => ({
    id: s.id,
    slug: s.slug,
    name: s.name,
    short_label: s.short_label,
    emoji: s.emoji,
    subsectors: (sub.data ?? [])
      .filter((x) => x.sector_id === s.id)
      .map((ss) => ({
        id: ss.id,
        slug: ss.slug,
        name: ss.name,
        emoji: ss.emoji,
        subsubsectors: (sss.data ?? [])
          .filter((x) => x.subsector_id === ss.id)
          .map((sx) => ({
            id: sx.id,
            slug: sx.slug,
            name: sx.name,
            emoji: sx.emoji,
            intents: (intents.data ?? [])
              .filter((i) => i.subsubsector_id === sx.id)
              .map((i) => ({
                id: i.id,
                label: i.label,
                keywords: (i.keywords ?? []) as string[],
                verbal_recommendation: i.verbal_recommendation,
              })),
          })),
      })),
  }));
  return { sectors };
});

// Classify a free-text user query into Sector/Subsector/Subsubsector/Intent.
// Uses Lovable AI for semantic classification. Logs every call into shop_intent_learning.
export const classifyShopIntent = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        query: z.string().min(1).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const sb = admin();
    const normalized = normalize(data.query);

    // Load compact catalogue for the model
    const [{ data: sectors }, { data: subs }, { data: ssubs }, { data: intents }] = await Promise.all([
      sb.from("shop_sectors").select("id,slug,name").eq("active", true),
      sb.from("shop_subsectors").select("id,slug,name,sector_id").eq("active", true),
      sb.from("shop_subsubsectors").select("id,slug,name,subsector_id").eq("active", true),
      sb
        .from("shop_intents")
        .select("id,label,keywords,verbal_recommendation,subsubsector_id")
        .eq("active", true),
    ]);

    const catalog = (sectors ?? []).map((s) => ({
      sector: s.name,
      sector_id: s.id,
      subsectors: (subs ?? [])
        .filter((x) => x.sector_id === s.id)
        .map((ss) => ({
          subsector: ss.name,
          subsector_id: ss.id,
          subsubsectors: (ssubs ?? [])
            .filter((x) => x.subsector_id === ss.id)
            .map((sx) => ({
              subsubsector: sx.name,
              subsubsector_id: sx.id,
              intents: (intents ?? [])
                .filter((i) => i.subsubsector_id === sx.id)
                .map((i) => ({
                  intent_id: i.id,
                  label: i.label,
                  keywords: (i.keywords ?? []) as string[],
                })),
            })),
        })),
    }));

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `Eres un clasificador de intenciones de comercio urbano en Alicante.
Recibes una frase del usuario y debes clasificarla en la mejor rama del catálogo.
Devuelves SIEMPRE la mejor coincidencia, aunque la confianza sea baja.
Si no encaja con ninguna intención existente, devuelve la subsubsector más cercana e intent_id null.
Sugieres 2-4 keywords nuevas si la consulta aporta vocabulario nuevo.
También devuelves una recomendación verbal corta (1-2 frases), natural, urbana, sin listar tiendas concretas, sólo orientación de zona/contexto en Alicante.
Si la consulta es ambigua, propón una pregunta breve para afinar.`;

    const body = {
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Consulta: "${data.query}"\n\nCATALOGO:\n${JSON.stringify(catalog)}`,
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "classify",
            description: "Clasificación de la consulta",
            parameters: {
              type: "object",
              properties: {
                sector_id: { type: "string" },
                subsector_id: { type: "string" },
                subsubsector_id: { type: "string" },
                intent_id: { type: ["string", "null"] },
                confidence: { type: "number", description: "0..1" },
                suggested_keywords: { type: "array", items: { type: "string" } },
                verbal_response: { type: "string" },
                clarifying_question: { type: ["string", "null"] },
              },
              required: [
                "sector_id",
                "subsector_id",
                "subsubsector_id",
                "confidence",
                "verbal_response",
              ],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "classify" } },
    };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`AI gateway ${res.status}: ${txt}`);
    }
    const j = await res.json();
    const call = j.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!call) throw new Error("No classification returned");
    const parsed = JSON.parse(call) as {
      sector_id: string;
      subsector_id: string;
      subsubsector_id: string;
      intent_id: string | null;
      confidence: number;
      suggested_keywords?: string[];
      verbal_response: string;
      clarifying_question?: string | null;
    };

    // Persist learning row
    const needsReview = !parsed.intent_id || parsed.confidence < 0.55;
    await sb.from("shop_intent_learning").insert({
      user_query: data.query,
      normalized_query: normalized,
      matched_sector_id: parsed.sector_id || null,
      matched_subsector_id: parsed.subsector_id || null,
      matched_subsubsector_id: parsed.subsubsector_id || null,
      matched_intent_id: parsed.intent_id || null,
      confidence: parsed.confidence,
      ai_suggested_keywords: parsed.suggested_keywords ?? [],
      ai_response: parsed.verbal_response,
      needs_review: needsReview,
    });

    // Bump hits on matched intent
    if (parsed.intent_id) {
      const { data: cur } = await sb
        .from("shop_intents")
        .select("hits")
        .eq("id", parsed.intent_id)
        .single();
      await sb
        .from("shop_intents")
        .update({ hits: (cur?.hits ?? 0) + 1 })
        .eq("id", parsed.intent_id);
    }

    // Enrich response with names for client navigation
    const sec = sectors?.find((x) => x.id === parsed.sector_id);
    const sub = subs?.find((x) => x.id === parsed.subsector_id);
    const sss = ssubs?.find((x) => x.id === parsed.subsubsector_id);
    const intent = intents?.find((x) => x.id === parsed.intent_id);

    return {
      sector: sec ? { id: sec.id, slug: sec.slug, name: sec.name } : null,
      subsector: sub ? { id: sub.id, slug: sub.slug, name: sub.name } : null,
      subsubsector: sss ? { id: sss.id, slug: sss.slug, name: sss.name } : null,
      intent: intent
        ? { id: intent.id, label: intent.label, verbal: intent.verbal_recommendation }
        : null,
      confidence: parsed.confidence,
      verbal_response: parsed.verbal_response,
      clarifying_question: parsed.clarifying_question ?? null,
      suggested_keywords: parsed.suggested_keywords ?? [],
      needs_review: needsReview,
    };
  });
