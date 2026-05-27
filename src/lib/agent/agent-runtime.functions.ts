// Server function pública para que el cliente (AgenteVamos) registre
// cada interacción en agente_learning_log sin exponer la service role key.
// No requiere auth: la telemetría debe poder escribirse para usuarios
// anónimos también. Validamos estrictamente el input con Zod para evitar
// abuso de la escritura libre.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { logAgentLearning } from "./logAgentLearning";

const InteractionSchema = z.object({
  rawQuery: z.string().min(1).max(2000),
  normalizedQuery: z.string().max(2000).optional(),
  detectedIntent: z.string().max(120).nullable().optional(),
  intentConfidence: z.number().min(0).max(1).nullable().optional(),
  resolverType: z
    .enum([
      "intent_keyword",
      "intent_ai",
      "faq",
      "proper_noun",
      "fallback_ai",
      "manual",
      "external_api",
    ])
    .nullable()
    .optional(),
  resolved: z.boolean().optional(),
  fallbackUsed: z.boolean().optional(),
  failureReason: z
    .enum([
      "NO_INTENT_MATCH",
      "LOW_CONFIDENCE",
      "EMPTY_RESULTS",
      "API_FAILURE",
      "ENTITY_AMBIGUOUS",
      "OUT_OF_SCOPE",
    ])
    .nullable()
    .optional(),
  latencyMs: z.number().int().min(0).max(120_000).nullable().optional(),
  modelUsed: z.string().max(120).nullable().optional(),
  tokensInput: z.number().int().min(0).max(10_000_000).nullable().optional(),
  tokensOutput: z.number().int().min(0).max(10_000_000).nullable().optional(),
  routeOrigin: z.string().max(500).nullable().optional(),
  sessionId: z.string().max(120).nullable().optional(),
  decision: z.string().max(120).optional(),
  notes: z.string().max(4000).nullable().optional(),
});

export const logAgentInteraction = createServerFn({ method: "POST" })
  .inputValidator((input) => InteractionSchema.parse(input))
  .handler(async ({ data }) => {
    await logAgentLearning(data);
    return { ok: true as const };
  });
