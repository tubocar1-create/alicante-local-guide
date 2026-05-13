import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

// Public booking creation. Accepts either an existing business_id OR a
// `place` payload (OSM listing). When `place` is provided we upsert a
// "shadow" business so the booking + thread can be created.

const PlaceSchema = z.object({
  osm_id: z.string().min(1).max(80),
  name: z.string().min(1).max(160),
  lat: z.number(),
  lng: z.number(),
  kind: z.string().min(1).max(40),
  address: z.string().max(240).optional(),
  phone: z.string().max(40).optional(),
  website: z.string().max(240).optional(),
});

const Schema = z
  .object({
    business_id: z.string().uuid().optional(),
    place: PlaceSchema.optional(),
    user_id: z.string().uuid().optional(),
    service_id: z.string().uuid().optional(),
    scheduled_at: z.string().datetime(),
    party_size: z.number().int().min(1).max(50).default(1),
    customer_name: z.string().min(1).max(120),
    customer_phone: z.string().max(40).optional(),
    customer_email: z.string().email().max(160).optional(),
    notes: z.string().max(500).optional(),
  })
  .refine((d) => d.business_id || d.place, { message: "business_id o place requerido" });

function admin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function resolveBusinessId(
  a: ReturnType<typeof createClient<Database>>,
  parsed: z.infer<typeof Schema>,
): Promise<string> {
  if (parsed.business_id) return parsed.business_id;
  const p = parsed.place!;
  const slug = `osm-${p.osm_id}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const name = p.name.trim();

  // Reuse the visible/open business card first, even if stored with spacing differences.
  const { data: openByName } = await a
    .from("businesses")
    .select("id")
    .ilike("name", `%${name}%`)
    .is("owner_id", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (openByName?.id) return openByName.id;

  const { data: existing } = await a
    .from("businesses")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data: byName } = await a
    .from("businesses")
    .select("id")
    .ilike("name", `%${name}%`)
    .not("owner_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (byName?.id) return byName.id;
  const { data: created, error } = await a
    .from("businesses")
    .insert({
      slug,
      name: p.name,
      sector: p.kind,
      address: p.address ?? null,
      lat: p.lat,
      lng: p.lng,
      phone: p.phone ?? null,
      website: p.website ?? null,
      active: true,
      metadata: { source: "osm", osm_id: p.osm_id } as never,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return created.id;
}

export const Route = createFileRoute("/api/public/booking-create")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let parsed;
        try {
          parsed = Schema.parse(await request.json());
        } catch (e) {
          return Response.json(
            { ok: false, error: e instanceof Error ? e.message : "invalid" },
            { status: 400 },
          );
        }
        const a = admin();
        if (!a) return Response.json({ ok: false, error: "config" }, { status: 500 });

        let businessId: string;
        try {
          businessId = await resolveBusinessId(a, parsed);
        } catch (e) {
          return Response.json(
            { ok: false, error: e instanceof Error ? e.message : "business" },
            { status: 400 },
          );
        }

        const accessToken = crypto.randomUUID();
        const { data, error } = await a
          .from("bookings")
          .insert({
            business_id: businessId,
            user_id: parsed.user_id ?? null,
            service_id: parsed.service_id ?? null,
            scheduled_at: parsed.scheduled_at,
            party_size: parsed.party_size,
            customer_name: parsed.customer_name,
            customer_phone: parsed.customer_phone ?? null,
            customer_email: parsed.customer_email ?? null,
            notes: parsed.notes ?? null,
            metadata: { public_access_token: accessToken } as never,
          })
          .select("id, status")
          .single();
        if (error) return Response.json({ ok: false, error: error.message }, { status: 400 });

        // El trigger create_thread_for_booking ya creó el hilo. Lo recuperamos.
        const { data: thread } = await a
          .from("conversation_threads")
          .select("id")
          .eq("booking_id", data.id)
          .maybeSingle();

        await a.from("interaction_events").insert({
          type: "booking_created",
          business_id: businessId,
          user_id: parsed.user_id ?? null,
          source: "public_api",
          metadata: { service_id: parsed.service_id ?? null } as never,
        });

        return Response.json({
          ok: true,
          id: data.id,
          status: data.status,
          thread_id: thread?.id ?? null,
          access_token: accessToken,
        });
      },
    },
  },
});
