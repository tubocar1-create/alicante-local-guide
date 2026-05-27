// Centralized telemetry helper for the AI Agent.
// Use this from any server-side resolver (chat function, server fns,
// scrapers) to register a single interaction with full observability data.
// Insertion uses the admin client so it works regardless of RLS.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { estimateCost } from "./model-pricing";

export type FailureReason =
  | "NO_INTENT_MATCH"
  | "LOW_CONFIDENCE"
  | "EMPTY_RESULTS"
  | "API_FAILURE"
  | "ENTITY_AMBIGUOUS"
  | "OUT_OF_SCOPE";

export type ResolverType =
  | "intent_keyword"
  | "intent_ai"
  | "faq"
  | "proper_noun"
  | "fallback_ai"
  | "manual"
  | "external_api";

export type LogAgentLearningInput = {
  rawQuery: string;
  normalizedQuery?: string | null;
  detectedIntent?: string | null;
  intentConfidence?: number | null;
  resolverType?: ResolverType | null;
  resolved?: boolean;
  fallbackUsed?: boolean;
  failureReason?: FailureReason | null;
  latencyMs?: number | null;
  modelUsed?: string | null;
  tokensInput?: number | null;
  tokensOutput?: number | null;
  estimatedCost?: number | null;
  clickedResult?: string | null;
  conversionEvent?: string | null;
  routeOrigin?: string | null;
  geoContext?: Record<string, unknown> | null;
  sessionId?: string | null;
  decision?: string; // legacy column on agente_learning_log
  notes?: string | null;
  addedKeywords?: string[];
  unknownQueryId?: string | null;
};

/**
 * Persist a single agent interaction into agente_learning_log.
 * All fields are optional; the helper fills sensible defaults and
 * computes estimated_cost when missing.
 * Failures are logged to console but never thrown — telemetry must
 * never break user-facing flows.
 */
export async function logAgentLearning(input: LogAgentLearningInput): Promise<void> {
  try {
    const cost =
      input.estimatedCost ??
      estimateCost(input.modelUsed, input.tokensInput, input.tokensOutput);

    const row = {
      raw_query: input.rawQuery,
      normalized: input.normalizedQuery ?? input.rawQuery.toLowerCase().trim(),
      decision: input.decision ?? (input.resolved ? "resolved" : "logged"),
      intent_key: input.detectedIntent ?? null,
      confidence: input.intentConfidence ?? null,
      model: input.modelUsed ?? null,
      notes: input.notes ?? null,
      added_keywords: input.addedKeywords ?? [],
      unknown_query_id: input.unknownQueryId ?? null,
      // extended columns
      normalized_query: input.normalizedQuery ?? null,
      detected_intent: input.detectedIntent ?? null,
      intent_confidence: input.intentConfidence ?? null,
      resolver_type: input.resolverType ?? null,
      resolved: input.resolved ?? null,
      fallback_used: input.fallbackUsed ?? null,
      failure_reason: input.failureReason ?? null,
      latency_ms: input.latencyMs ?? null,
      model_used: input.modelUsed ?? null,
      tokens_input: input.tokensInput ?? null,
      tokens_output: input.tokensOutput ?? null,
      estimated_cost: cost,
      clicked_result: input.clickedResult ?? null,
      conversion_event: input.conversionEvent ?? null,
      route_origin: input.routeOrigin ?? null,
      geo_context: (input.geoContext ?? null) as never,
      session_id: input.sessionId ?? null,
    };

    const { error } = await supabaseAdmin
      .from("agente_learning_log")
      .insert(row);
    if (error) {
      console.error("[logAgentLearning] insert error:", error.message);
    }

    // Persistir TODO intent detectado en agente_intents (clave learned:auto:<route>)
    // para que aparezca en la página de Aprendizaje, sin importar si vino del
    // resolver local, de keywords o de Gemini.
    await persistDetectedIntent(input);
  } catch (e) {
    console.error("[logAgentLearning] unexpected:", e);
  }
}

// Stopwords mínimas en español para extraer keywords útiles de la query bruta.
const STOPWORDS = new Set<string>([
  "que","cual","cuales","como","donde","cuando","cuanto","cuanta","cuantos","cuantas","quien","quienes",
  "me","mi","mis","tu","tus","su","sus","nos","nuestro","nuestra","te","se","le","les",
  "ya","aqui","alli","ahi","hoy","ahora","manana","tarde","noche","dia","dias","semana","mes",
  "quiero","quisiera","necesito","busco","buscar","ver","ir","hacer","tomar","comer","beber","saber","decir",
  "puedo","puede","podria","sabes","dime","dame","dale","abre","abrir","muestra","mostrar",
  "hay","esta","estan","ser","estar","tener","va","van","voy","vamos","si","no","tambien","pero","con","sin",
  "muy","mas","menos","mucho","poco","algo","alguno","alguna","todo","toda","nada","favor","gracias","hola",
  "por","para","del","las","los","una","uno","unos","unas","ese","esa","eso","este","esta","esto",
  "the","and","for","with","you","are","but","not",
]);

function normalize(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractKw(text: string): string[] {
  return Array.from(
    new Set(
      normalize(text)
        .split(" ")
        .filter((t) => t.length >= 3 && !STOPWORDS.has(t)),
    ),
  ).slice(0, 10);
}

async function persistDetectedIntent(input: LogAgentLearningInput): Promise<void> {
  try {
    const route = input.detectedIntent;
    if (!route || !route.startsWith("/")) return;
    if (input.resolved === false) return;

    const reply = (input.notes ?? "").trim();
    const newKws = extractKw(input.rawQuery);
    const extra = (input.addedKeywords ?? []).map(normalize).filter(Boolean);
    const mergedNew = Array.from(new Set([...newKws, ...extra]));

    const safeRoute = route.replace(/\//g, "_").replace(/[^a-zA-Z0-9_-]/g, "_");
    const key = `learned:auto:${safeRoute}`.slice(0, 80);
    const label = `Intent aprendido: ${route}`;

    const { data: existing, error: selErr } = await supabaseAdmin
      .from("agente_intents")
      .select("id, keywords, spoken_reply")
      .eq("key", key)
      .maybeSingle();
    if (selErr) {
      console.warn("[logAgentLearning] intent select failed:", selErr.message);
      return;
    }

    if (existing) {
      const fused = Array.from(
        new Set([...(existing.keywords ?? []), ...mergedNew]),
      ).slice(0, 30);
      const { error: updErr } = await supabaseAdmin
        .from("agente_intents")
        .update({
          spoken_reply: reply || existing.spoken_reply || `Te llevo a ${route}.`,
          route,
          keywords: fused,
          label,
          active: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      if (updErr) console.warn("[logAgentLearning] intent update failed:", updErr.message);
    } else {
      const { error: insErr } = await supabaseAdmin.from("agente_intents").insert({
        key,
        label,
        spoken_reply: reply || `Te llevo a ${route}.`,
        route,
        keywords: mergedNew,
        priority: 35,
        active: true,
        notes: `Auto-aprendido del resolver (${input.resolverType ?? "n/a"}).`,
      });
      if (insErr) console.warn("[logAgentLearning] intent insert failed:", insErr.message);
    }
  } catch (e) {
    console.warn("[logAgentLearning] persistDetectedIntent threw:", e);
  }
}

