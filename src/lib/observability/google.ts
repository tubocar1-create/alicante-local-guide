// Wrapper para llamadas a Google (Places, Maps, Geocoding, Directions)
// hechas desde server functions / server routes. Mide latencia, status y
// registra en external_api_calls. Además aplica el kill-switch global como
// chokepoint único: si está OFF, NINGUNA llamada sale a Google, da igual
// qué caller haya olvidado comprobarlo.

import {
  trackExternalCall,
  type ExternalProvider,
} from "./track-external-call";
import { isGoogleEnabled } from "@/lib/google-killswitch.server";

export type FetchGoogleInput = {
  provider: Extract<
    ExternalProvider,
    "google_places" | "google_maps" | "google_geocoding" | "google_directions"
  >;
  endpoint: string;
  caller: string;
  url: string;
  init?: RequestInit;
  meta?: Record<string, unknown>;
};

export class GoogleApiDisabledError extends Error {
  constructor() {
    super("GOOGLE_API_DISABLED");
    this.name = "GoogleApiDisabledError";
  }
}

export async function fetchGoogle(input: FetchGoogleInput): Promise<Response> {
  // CHOKEPOINT GLOBAL: si el kill-switch está apagado, ni siquiera abrimos
  // el socket. Logueamos el intento como blocked para auditoría.
  if (!(await isGoogleEnabled())) {
    void trackExternalCall({
      provider: input.provider,
      endpoint: input.endpoint,
      caller: input.caller,
      statusCode: 0,
      latencyMs: 0,
      meta: { ...(input.meta ?? {}), blocked: "killswitch_off" },
    });
    throw new GoogleApiDisabledError();
  }

  const startedAt = Date.now();
  let statusCode = 0;
  let errorMsg: string | null = null;
  try {
    const res = await fetch(input.url, input.init);
    statusCode = res.status;
    if (!res.ok) {
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
