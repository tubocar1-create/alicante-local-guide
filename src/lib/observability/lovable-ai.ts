// Wrapper único para llamadas a Lovable AI Gateway.
// Reemplaza todos los `fetch("https://ai.gateway.lovable.dev/...")`.
// Mide latencia, parsea tokens, calcula coste y registra en
// external_api_calls. Devuelve la respuesta JSON tal cual.

import { estimateCost } from "@/lib/agent/model-pricing";
import { trackExternalCall } from "./track-external-call";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export type LovableAIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type CallLovableAIInput = {
  caller: string; // ej: "ai-review", "places.search", "agente.fallback"
  model: string;
  messages: LovableAIMessage[];
  apiKey?: string; // por defecto process.env.LOVABLE_API_KEY
  extraBody?: Record<string, unknown>; // response_format, tools, etc.
  meta?: Record<string, unknown>;
};

export type LovableAIResponse = {
  text: string;
  raw: any;
  tokensInput: number | null;
  tokensOutput: number | null;
  estimatedCost: number;
  latencyMs: number;
  statusCode: number;
};

export async function callLovableAI(input: CallLovableAIInput): Promise<LovableAIResponse> {
  const apiKey = input.apiKey ?? process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY no configurada");

  const body = {
    model: input.model,
    messages: input.messages,
    ...(input.extraBody ?? {}),
  };

  const startedAt = Date.now();
  let statusCode = 0;
  let tokensInput: number | null = null;
  let tokensOutput: number | null = null;
  let errorMsg: string | null = null;
  let text = "";
  let raw: any = null;

  try {
    const res = await fetch(AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    statusCode = res.status;

    if (!res.ok) {
      const txt = await res.text();
      errorMsg = `${res.status}: ${txt.slice(0, 200)}`;
      throw new Error(`AI error ${errorMsg}`);
    }

    raw = await res.json();
    text = raw?.choices?.[0]?.message?.content ?? "";
    tokensInput = raw?.usage?.prompt_tokens ?? null;
    tokensOutput = raw?.usage?.completion_tokens ?? null;
    return {
      text,
      raw,
      tokensInput,
      tokensOutput,
      estimatedCost: estimateCost(input.model, tokensInput, tokensOutput),
      latencyMs: Date.now() - startedAt,
      statusCode,
    };
  } catch (err) {
    if (!errorMsg) errorMsg = err instanceof Error ? err.message : String(err);
    throw err;
  } finally {
    const latencyMs = Date.now() - startedAt;
    void trackExternalCall({
      provider: "lovable_ai",
      endpoint: "chat/completions",
      caller: input.caller,
      model: input.model,
      statusCode,
      latencyMs,
      tokensInput,
      tokensOutput,
      estimatedCost: estimateCost(input.model, tokensInput, tokensOutput),
      meta: {
        ...(input.meta ?? {}),
        ...(errorMsg ? { error: errorMsg } : {}),
      },
    });
  }
}
