// Universal event-tracking helper. One source of truth for metrics.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type TrackInput = {
  type: string;
  business_id?: string | null;
  user_id?: string | null;
  campaign_id?: string | null;
  source?: string;
  conversion_status?: string;
  lat?: number;
  lng?: number;
  metadata?: Record<string, unknown>;
};

export async function trackEvent(
  client: SupabaseClient<Database>,
  ev: TrackInput,
) {
  try {
    await client.from("interaction_events").insert({
      type: ev.type,
      business_id: ev.business_id ?? null,
      user_id: ev.user_id ?? null,
      campaign_id: ev.campaign_id ?? null,
      source: ev.source ?? null,
      conversion_status: ev.conversion_status ?? null,
      lat: ev.lat ?? null,
      lng: ev.lng ?? null,
      metadata: (ev.metadata ?? {}) as never,
    });
  } catch (e) {
    // Never block the caller for analytics
    console.error("[track] failed", e);
  }
}
