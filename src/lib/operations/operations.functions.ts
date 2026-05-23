/**
 * Centro de Control Operativo — server functions
 *
 * Toda la telemetría operacional (NO IA) vive aquí.
 * - logOperationalEvent: inserta en `interaction_events` con el admin client
 *   (permite tracking anónimo sin necesidad de sesión).
 * - listOperationalEvents / getOperationalEvent: lecturas para el dashboard.
 * - saveOperationalReview / listOperationalReviews: anotaciones manuales.
 * - getOperationalKpis: tarjetas superiores (hoy vs ayer).
 *
 * Mantener completamente separado de agente IA / aprendizaje del agente.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
// Nota: el panel admin se protege vía PIN (sessionStorage), no por auth real.
// Esta es la misma convención que las server fns de admin-ai.functions.ts.

// ---------- Schemas ----------

const TrackSchema = z.object({
  type: z.string().min(1).max(64).regex(/^[a-z0-9_]+$/),
  route: z.string().max(255).optional().nullable(),
  source: z.string().max(64).optional().nullable(),
  business_id: z.string().uuid().optional().nullable(),
  campaign_id: z.string().uuid().optional().nullable(),
  user_id: z.string().uuid().optional().nullable(),
  conversion_status: z.string().max(64).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});

const ListSchema = z.object({
  search: z.string().max(255).optional().default(""),
  type: z.string().max(64).optional().default(""),
  limit: z.number().int().min(1).max(200).optional().default(50),
  offset: z.number().int().min(0).max(10000).optional().default(0),
});

const ReviewSchema = z.object({
  event_id: z.string().uuid(),
  flag: z.enum([
    "ok",
    "incorrect_data",
    "wrong_category",
    "duplicate",
    "false_positive",
    "not_an_error",
  ]),
  corrected_type: z.string().max(64).nullable().optional(),
  corrected_category: z.string().max(64).nullable().optional(),
  corrected_source: z.string().max(64).nullable().optional(),
  note: z.string().max(2000).nullable().optional(),
});

// ---------- Tracking (público, fire-and-forget) ----------

/**
 * Registra un evento operacional. Pensado para llamarse desde el cliente
 * vía `trackOperationalEvent`. Nunca lanza al caller para no romper la UX.
 */
export const logOperationalEvent = createServerFn({ method: "POST" })
  .inputValidator((input) => TrackSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      await supabaseAdmin.from("interaction_events").insert({
        type: data.type,
        business_id: data.business_id ?? null,
        user_id: data.user_id ?? null,
        campaign_id: data.campaign_id ?? null,
        source: data.source ?? data.route ?? null,
        conversion_status: data.conversion_status ?? null,
        metadata: {
          ...data.metadata,
          route: data.route ?? null,
        } as never,
      });
      return { ok: true };
    } catch (e) {
      console.error("[operations.log] failed", e);
      return { ok: false };
    }
  });

// ---------- Admin: lectura ----------

export const getOperationalKpis = createServerFn({ method: "GET" })
  .handler(async () => {
    const now = new Date();
    const startToday = new Date(now);
    startToday.setHours(0, 0, 0, 0);
    const startYesterday = new Date(startToday);
    startYesterday.setDate(startYesterday.getDate() - 1);

    const countBetween = async (from: Date, to: Date, type?: string) => {
      let q = supabaseAdmin
        .from("interaction_events")
        .select("*", { count: "exact", head: true })
        .gte("occurred_at", from.toISOString())
        .lt("occurred_at", to.toISOString());
      if (type) q = q.eq("type", type);
      const { count } = await q;
      return count ?? 0;
    };

    const distinctUsersToday = async () => {
      const { data } = await supabaseAdmin
        .from("interaction_events")
        .select("user_id")
        .gte("occurred_at", startToday.toISOString())
        .not("user_id", "is", null)
        .limit(5000);
      const set = new Set<string>();
      (data ?? []).forEach((r) => r.user_id && set.add(r.user_id as string));
      return set.size;
    };

    const [eventsToday, eventsYesterday, clicks, bookings, maps, users] =
      await Promise.all([
        countBetween(startToday, now),
        countBetween(startYesterday, startToday),
        countBetween(startToday, now, "listing_opened"),
        countBetween(startToday, now, "booking_created"),
        countBetween(startToday, now, "maps_opened"),
        distinctUsersToday(),
      ]);

    return {
      eventsToday,
      eventsYesterday,
      clicks,
      bookings,
      maps,
      users,
    };
  });

export const listOperationalEvents = createServerFn({ method: "POST" })
  .inputValidator((input) => ListSchema.parse(input))
  .handler(async ({ data }) => {
    let q = supabaseAdmin
      .from("interaction_events")
      .select("*", { count: "exact" })
      .order("occurred_at", { ascending: false })
      .range(data.offset, data.offset + data.limit - 1);

    if (data.type) q = q.eq("type", data.type);
    if (data.search) {
      // búsqueda básica por tipo o source
      q = q.or(`type.ilike.%${data.search}%,source.ilike.%${data.search}%`);
    }

    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [], total: count ?? 0 };
  });

export const getOperationalEvent = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { data: event } = await supabaseAdmin
      .from("interaction_events")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();

    const { data: reviews } = await supabaseAdmin
      .from("operational_event_reviews")
      .select("*")
      .eq("event_id", data.id)
      .order("created_at", { ascending: false });

    return { event, reviews: reviews ?? [] };
  });

// ---------- Admin: anotaciones manuales ----------

export const saveOperationalReview = createServerFn({ method: "POST" })
  .inputValidator((input) => ReviewSchema.parse(input))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("operational_event_reviews")
      .insert({
        event_id: data.event_id,
        flag: data.flag,
        corrected_type: data.corrected_type ?? null,
        corrected_category: data.corrected_category ?? null,
        corrected_source: data.corrected_source ?? null,
        note: data.note ?? null,
        reviewed_by: null,
      });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
