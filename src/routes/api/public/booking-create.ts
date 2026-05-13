import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

// Public booking creation. Accepts an unauthenticated POST so the public app
// (which uses beta localStorage auth) can submit reservations on behalf of the
// visitor. Inserts via service role; no PII returned beyond the new id.

const Schema = z.object({
  business_id: z.string().uuid(),
  service_id: z.string().uuid().optional(),
  scheduled_at: z.string().datetime(),
  party_size: z.number().int().min(1).max(50).default(1),
  customer_name: z.string().min(1).max(120),
  customer_phone: z.string().max(40).optional(),
  customer_email: z.string().email().max(160).optional(),
  notes: z.string().max(500).optional(),
});

function admin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
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

        const { data, error } = await a
          .from("bookings")
          .insert(parsed)
          .select("id, status")
          .single();
        if (error) return Response.json({ ok: false, error: error.message }, { status: 400 });

        await a.from("interaction_events").insert({
          type: "booking_created",
          business_id: parsed.business_id,
          source: "public_api",
          metadata: { service_id: parsed.service_id ?? null } as never,
        });

        return Response.json({ ok: true, id: data.id, status: data.status });
      },
    },
  },
});
