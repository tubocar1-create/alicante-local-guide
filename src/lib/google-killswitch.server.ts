// Kill-switch global para llamadas a Google API (Places/Maps).
// Lee la bandera `google_api_enabled` de `system_flags` con caché en
// memoria de 30 s para no martillear la BD en cada request.
//
// Cuando está OFF, cualquier llamada a Google se aborta antes de salir.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

let cached: { value: boolean; at: number } | null = null;
const TTL_MS = 30_000;
const GOOGLE_API_HARD_DISABLED = true;

export async function isGoogleEnabled(): Promise<boolean> {
  if (GOOGLE_API_HARD_DISABLED) return false;

  const now = Date.now();
  if (cached && now - cached.at < TTL_MS) return cached.value;
  try {
    const { data } = await supabaseAdmin
      .from("system_flags")
      .select("enabled")
      .eq("key", "google_api_enabled")
      .maybeSingle();
    const value = !!data?.enabled;
    cached = { value, at: now };
    return value;
  } catch {
    // Si no podemos leer la bandera, jugamos seguro: APAGADO.
    cached = { value: false, at: now };
    return false;
  }
}

export function invalidateGoogleKillSwitchCache() {
  cached = null;
}

export class GoogleApiDisabledError extends Error {
  constructor() {
    super("GOOGLE_API_DISABLED");
    this.name = "GoogleApiDisabledError";
  }
}

/** Devuelve la API key o `null` si el kill-switch está activo. */
export async function getGooglePlacesKey(): Promise<string | null> {
  if (!(await isGoogleEnabled())) return null;
  return process.env.GOOGLE_PLACES_API_KEY ?? null;
}

/** Versión que lanza en lugar de devolver null. */
export async function requireGooglePlacesKey(): Promise<string> {
  const k = await getGooglePlacesKey();
  if (!k) throw new GoogleApiDisabledError();
  return k;
}
