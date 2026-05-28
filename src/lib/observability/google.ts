// Wrapper para llamadas a Google (Places, Maps, Geocoding, Directions)
// hechas desde server functions / server routes. Mide latencia, status y
// registra en external_api_calls.

import {
  trackExternalCall,
  type ExternalProvider,
} from "./track-external-call";

export type FetchGoogleInput = {
  provider: Extract<
    ExternalProvider,
    "google_places" | "google_maps" | "google_geocoding" | "google_directions"
  >;
  endpoint: string; // ej "places:searchText", "places/photo", "geocode/json"
  caller: string;
  url: string;
  init?: RequestInit;
  meta?: Record<string, unknown>;
};

export async function fetchGoogle(input: FetchGoogleInput): Promise<Response> {
  const startedAt = Date.now();
  let statusCode = 0;
  let errorMsg: string | null = null;
  try {
    const res = await fetch(input.url, input.init);
    statusCode = res.status;
    if (!res.ok) {
      // Solo capturamos status; el caller hace su propio manejo del body.
      errorMsg = `HTTP ${res.status}`;
    }
    return res;
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : String(err);
    throw err;
  } finally {
    const latencyMs = Date.now() - startedAt;
    void trackExternalCall({
      provider: input.provider,
      endpoint: input.endpoint,
      caller: input.caller,
      statusCode,
      latencyMs,
      meta: {
        ...(input.meta ?? {}),
        ...(errorMsg ? { error: errorMsg } : {}),
      },
    });
  }
}
