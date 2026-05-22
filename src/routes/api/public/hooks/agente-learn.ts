import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ─── Autoaprendizaje del agente ────────────────────────────────────────
// Lee consultas desconocidas en agente_unknown_queries, las clasifica con
// Lovable AI dentro de los 12 dominios oficiales y, si la confianza es
// alta, añade las nuevas keywords al intent correspondiente de agente_intents.
// Lo demás queda registrado en agente_learning_log para revisión humana.

const VALID_INTENT_KEYS = [
  "comer",
  "dormir",
  "playas",
  "comprar",
  "tomar_algo",
  "transporte",
  "mapa",
  "salud",
  "ocio",
  "fiestas",
  "clima",
  "perfil",
] as const;

const MODEL = "google/gemini-3-flash-preview";
const CONFIDENCE_AUTO_APPLY = 0.8;
const MIN_COUNT = 2;
const BATCH_SIZE = 25;

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ñ\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

async function classifyQuery(rawQuery: string): Promise<{
  intent_key: string | null;
  keywords: string[];
  confidence: number;
  reason: string;
} | null> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

  const system = `Eres un clasificador de intenciones para una guía urbana de Alicante.
Recibes una frase que el agente NO supo interpretar. Devuelves a qué dominio pertenece
(de la lista oficial) y propones 1-4 keywords/frases cortas en español, normalizadas
(minúsculas, sin acentos ni signos), que podrían añadirse al diccionario del agente para
que la próxima vez la entienda. Si la frase no encaja claramente en ningún dominio o es
una conversación genérica (saludo, insulto, prueba…), devuelve intent_key=null.

Dominios oficiales:
- comer (restaurantes, cocina, dónde comer)
- dormir (hoteles, alojamiento)
- playas (playas, calas, baño)
- comprar (tiendas, shopping)
- tomar_algo (bares, copas, terrazas)
- transporte (bus, tram, taxi, cómo llegar)
- mapa (explorar, mapa)
- salud (hospital, farmacia, médico, urgencias)
- ocio (cine, teatro, conciertos, eventos)
- fiestas (hogueras, moros y cristianos, fiesta local)
- clima (tiempo, lluvia, temperatura)
- perfil (mi cuenta, ajustes)`;

  const tools = [
    {
      type: "function",
      function: {
        name: "classify_intent",
        description: "Clasifica la frase y propone keywords nuevas",
        parameters: {
          type: "object",
          properties: {
            intent_key: {
              type: ["string", "null"],
              enum: [...VALID_INTENT_KEYS, null],
              description: "Dominio al que pertenece, o null si no encaja",
            },
            keywords: {
              type: "array",
              items: { type: "string" },
              maxItems: 4,
              description: "Keywords normalizadas (minúsculas, sin acentos), 1-4 elementos",
            },
            confidence: {
              type: "number",
              minimum: 0,
              maximum: 1,
              description: "Confianza de la clasificación (0..1)",
            },
            reason: {
              type: "string",
              description: "Breve justificación (≤120 caracteres)",
            },
          },
          required: ["intent_key", "keywords", "confidence", "reason"],
          additionalProperties: false,
        },
      },
    },
  ];

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: `Frase del usuario: «${rawQuery}»` },
      ],
      tools,
      tool_choice: { type: "function", function: { name: "classify_intent" } },
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    console.error("ai gateway error", res.status, t);
    return null;
  }

  const json = await res.json();
  const call = json.choices?.[0]?.message?.tool_calls?.[0];
  if (!call) return null;
  try {
    const args = JSON.parse(call.function.arguments);
    return {
      intent_key: args.intent_key ?? null,
      keywords: Array.isArray(args.keywords) ? args.keywords.map(norm).filter(Boolean) : [],
      confidence: Number(args.confidence ?? 0),
      reason: String(args.reason ?? "").slice(0, 300),
    };
  } catch (e) {
    console.error("parse tool args failed", e);
    return null;
  }
}

async function runLearning() {
  // 1. Pick a batch of unprocessed queries with enough recurrence.
  const { data: rows, error } = await supabaseAdmin
    .from("agente_unknown_queries")
    .select("id, query, normalized, count")
    .is("processed_at", null)
    .gte("count", MIN_COUNT)
    .order("count", { ascending: false })
    .limit(BATCH_SIZE);

  if (error) throw new Error(error.message);
  if (!rows || rows.length === 0) {
    return { processed: 0, applied: 0, skipped: 0 };
  }

  // 2. Cache intents to dedupe keywords.
  const { data: intents } = await supabaseAdmin
    .from("agente_intents")
    .select("key, keywords")
    .in("key", VALID_INTENT_KEYS as unknown as string[]);
  const intentMap = new Map<string, Set<string>>();
  for (const row of intents ?? []) {
    intentMap.set(row.key, new Set((row.keywords ?? []).map((k: string) => norm(k))));
  }

  let applied = 0;
  let skipped = 0;

  for (const row of rows) {
    let decision = "skipped";
    let addedKeywords: string[] = [];
    let intentKey: string | null = null;
    let confidence = 0;
    let reason = "";

    try {
      const result = await classifyQuery(row.query);
      if (result) {
        intentKey = result.intent_key;
        confidence = result.confidence;
        reason = result.reason;

        if (
          intentKey &&
          (VALID_INTENT_KEYS as readonly string[]).includes(intentKey) &&
          confidence >= CONFIDENCE_AUTO_APPLY &&
          result.keywords.length > 0
        ) {
          const existing = intentMap.get(intentKey) ?? new Set<string>();
          const fresh = result.keywords.filter((k) => k.length >= 3 && !existing.has(k));
          if (fresh.length > 0) {
            const merged = Array.from(new Set([...Array.from(existing), ...fresh]));
            const { error: updErr } = await supabaseAdmin
              .from("agente_intents")
              .update({ keywords: merged })
              .eq("key", intentKey);
            if (updErr) {
              decision = "error";
              reason = `update_failed: ${updErr.message}`;
            } else {
              for (const k of fresh) existing.add(k);
              intentMap.set(intentKey, existing);
              addedKeywords = fresh;
              decision = "auto_applied";
              applied += 1;
            }
          } else {
            decision = "already_known";
          }
        } else if (intentKey) {
          decision = "low_confidence";
          skipped += 1;
        } else {
          decision = "no_intent";
          skipped += 1;
        }
      } else {
        decision = "ai_error";
        skipped += 1;
      }
    } catch (e) {
      decision = "exception";
      reason = e instanceof Error ? e.message : "unknown";
      skipped += 1;
    }

    await supabaseAdmin.from("agente_learning_log").insert({
      unknown_query_id: row.id,
      raw_query: row.query,
      normalized: row.normalized,
      intent_key: intentKey,
      added_keywords: addedKeywords,
      confidence,
      decision,
      model: MODEL,
      notes: reason,
    });

    await supabaseAdmin
      .from("agente_unknown_queries")
      .update({
        processed_at: new Date().toISOString(),
        auto_assigned_intent: decision === "auto_applied" ? intentKey : null,
        auto_added_keywords: addedKeywords,
        confidence,
      })
      .eq("id", row.id);
  }

  return { processed: rows.length, applied, skipped };
}

export const Route = createFileRoute("/api/public/hooks/agente-learn")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const summary = await runLearning();
          return new Response(JSON.stringify({ ok: true, ...summary }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          console.error("agente-learn error", e);
          return new Response(
            JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "unknown" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
      GET: async () => {
        // Permite probarlo desde el navegador / curl sin POST.
        try {
          const summary = await runLearning();
          return new Response(JSON.stringify({ ok: true, ...summary }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          return new Response(
            JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "unknown" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
