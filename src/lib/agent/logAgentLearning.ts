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
      geo_context: input.geoContext ?? null,
      session_id: input.sessionId ?? null,
    };

    const { error } = await supabaseAdmin
      .from("agente_learning_log")
      .insert(row);
    if (error) {
      console.error("[logAgentLearning] insert error:", error.message);
    }
  } catch (e) {
    console.error("[logAgentLearning] unexpected:", e);
  }
}
