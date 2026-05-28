// Server-only helper that registra cada llamada a un proveedor externo
// de pago (Lovable AI, Google Places/Maps, etc.) en la tabla
// external_api_calls. Try/catch silencioso: nunca debe romper la
// llamada original.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type ExternalProvider =
  | "lovable_ai"
  | "google_places"
  | "google_maps"
  | "google_geocoding"
  | "google_directions";

export type TrackExternalCallInput = {
  provider: ExternalProvider;
  endpoint: string;
  caller: string;
  model?: string | null;
  statusCode?: number | null;
  latencyMs?: number | null;
  tokensInput?: number | null;
  tokensOutput?: number | null;
  estimatedCost?: number | null;
  meta?: Record<string, unknown>;
};

export async function trackExternalCall(input: TrackExternalCallInput) {
  try {
    await supabaseAdmin.from("external_api_calls").insert({
      provider: input.provider,
      endpoint: input.endpoint,
      caller: input.caller,
      model: input.model ?? null,
      status_code: input.statusCode ?? null,
      latency_ms: input.latencyMs ?? null,
      tokens_input: input.tokensInput ?? null,
      tokens_output: input.tokensOutput ?? null,
      estimated_cost: input.estimatedCost ?? null,
      meta: (input.meta ?? {}) as never,
    });
  } catch (e) {
    console.error("[trackExternalCall] insert failed", e);
  }
}
