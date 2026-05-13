import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

// Public endpoint: registers a user-generated (beta) QR in the backend so it
// shows up on the business dashboard. Best-effort — failures don't block UX.

const Body = z.object({
  place_id: z.string().min(1).max(128),
  place_name: z.string().min(1).max(255),
  code: z.string().min(4).max(64),
  expires_at: z.string().datetime().optional(),
  user_id: z.string().min(1).max(128).optional(),
  user_name: z.string().min(1).max(120).optional(),
  user_surname: z.string().max(120).nullable().optional(),
  user_email: z.string().max(160).nullable().optional(),
  user_phone: z.string().max(40).nullable().optional(),
});

function admin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export const Route = createFileRoute("/api/public/qr-issue")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const sb = admin();
        if (!sb) return Response.json({ ok: false, reason: "config" }, { status: 500 });

        const parsed = Body.safeParse(await request.json().catch(() => ({})));
        if (!parsed.success) {
          return Response.json({ ok: false, reason: "bad_input" }, { status: 400 });
        }
        const { place_id, place_name, code, expires_at, user_id } = parsed.data;

        const slug = `place-${slugify(place_id)}`;

        // Find or create the business shell for this place.
        let { data: biz } = await sb
          .from("businesses")
          .select("id")
          .eq("slug", slug)
          .maybeSingle();

        if (!biz) {
          const ins = await sb
            .from("businesses")
            .insert({
              slug,
              name: place_name,
              sector: "general",
              metadata: { source: "beta_user_qr", place_id } as never,
            })
            .select("id")
            .single();
          if (ins.error) {
            return Response.json(
              { ok: false, reason: "biz_failed", message: ins.error.message },
              { status: 500 },
            );
          }
          biz = ins.data;
        }

        // Insert QR row (ignore if already exists by unique code).
        const qrIns = await sb
          .from("qr_codes")
          .insert({
            business_id: biz.id,
            code,
            purpose: "visit",
            expires_at: expires_at ?? null,
            max_uses: 1,
            payload: { issued_by: "beta_app", user_id: user_id ?? null } as never,
          })
          .select("id")
          .maybeSingle();

        // Log a visit (the user "visited" the place by generating a QR there).
        await sb.from("visits").insert({
          business_id: biz.id,
          source: "beta_user_qr",
          qr_id: qrIns.data?.id ?? null,
          metadata: { place_id, code } as never,
        });

        // Track events: visit_viewed + qr_created so the dashboard reflects both.
        await sb.from("interaction_events").insert([
          {
            type: "visit_viewed",
            business_id: biz.id,
            source: "beta_user",
            metadata: { place_id } as never,
          },
          {
            type: "qr_created",
            business_id: biz.id,
            source: "beta_user",
            metadata: { place_id, code } as never,
          },
        ]);

        return Response.json({ ok: true, business_id: biz.id, qr_id: qrIns.data?.id ?? null });
      },
    },
  },
});
