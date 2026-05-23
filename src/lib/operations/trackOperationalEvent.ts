/**
 * Helper centralizado para registrar eventos operacionales desde el cliente.
 *
 * Uso:
 *   trackOperationalEvent({ type: "listing_opened", route: "/restaurants/123", metadata: { id } })
 *
 * - Fire-and-forget: nunca bloquea la UI ni lanza errores al caller.
 * - Auto-rellena `route` con `window.location.pathname` si no se pasa.
 * - Auto-detecta el `user_id` si hay sesión activa.
 * - Pensado SOLO para telemetría operativa/producto. NO usar para IA.
 */
import { supabase } from "@/integrations/supabase/client";
import { logOperationalEvent } from "./operations.functions";

export type OperationalEventType =
  | "listing_opened"
  | "maps_opened"
  | "booking_started"
  | "booking_created"
  | "search_used"
  | "filter_used"
  | "chat_opened"
  | "qr_generated"
  | "section_changed"
  | "page_view"
  // permite también types personalizados (string libre):
  | (string & {});

export interface TrackOperationalEventInput {
  type: OperationalEventType;
  route?: string;
  source?: string;
  business_id?: string | null;
  campaign_id?: string | null;
  conversion_status?: string;
  metadata?: Record<string, unknown>;
}

export function trackOperationalEvent(input: TrackOperationalEventInput): void {
  // No bloquear render: ejecutar en microtask
  void (async () => {
    try {
      let userId: string | null = null;
      try {
        const { data } = await supabase.auth.getSession();
        userId = data.session?.user?.id ?? null;
      } catch {
        // sesión no disponible — ok, evento anónimo
      }

      const route =
        input.route ??
        (typeof window !== "undefined" ? window.location.pathname : null);

      await logOperationalEvent({
        data: {
          type: input.type,
          route: route ?? undefined,
          source: input.source ?? undefined,
          business_id: input.business_id ?? undefined,
          campaign_id: input.campaign_id ?? undefined,
          user_id: userId ?? undefined,
          conversion_status: input.conversion_status ?? undefined,
          metadata: input.metadata ?? {},
        },
      });
    } catch (e) {
      // Silencioso: la telemetría nunca debe romper la UX
      if (typeof console !== "undefined") {
        console.debug("[trackOperationalEvent] skipped", e);
      }
    }
  })();
}
