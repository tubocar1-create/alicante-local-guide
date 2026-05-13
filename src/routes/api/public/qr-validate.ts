import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// Public QR validation endpoint. Accepts ?code=XXX (GET, scanned from camera apps)
// or POST { code }. Performs validation as the *anonymous* role (no user session)
// using the service role key — RLS bypass is intentional and limited to:
//   - reading the qr_codes row
//   - incrementing uses
//   - inserting a visit (no user_id) and an interaction_event
// No PII is returned.

function getAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function validate(code: string) {
  const c = (code || "").trim();
  if (!/^[A-Z0-9]{4,64}$/.test(c)) {
    return { ok: false, reason: "bad_code" as const };
  }
  const admin = getAdminClient();
  if (!admin) return { ok: false, reason: "config" as const };

  const { data: qr } = await admin
    .from("qr_codes")
    .select("*")
    .eq("code", c)
    .maybeSingle();

  if (!qr) return { ok: false, reason: "not_found" as const };
  if (!qr.active) return { ok: false, reason: "inactive" as const };
  if (qr.expires_at && new Date(qr.expires_at).getTime() < Date.now())
    return { ok: false, reason: "expired" as const };
  if (qr.max_uses != null && qr.uses >= qr.max_uses)
    return { ok: false, reason: "exhausted" as const };

  await admin.from("qr_codes").update({ uses: qr.uses + 1 }).eq("id", qr.id);
  await admin.from("visits").insert({
    business_id: qr.business_id,
    qr_id: qr.id,
    source: "public_scan",
  });
  await admin.from("interaction_events").insert({
    type: "qr_validated",
    business_id: qr.business_id,
    source: "public_scan",
    metadata: { purpose: qr.purpose } as never,
  });

  return {
    ok: true as const,
    business_id: qr.business_id,
    purpose: qr.purpose,
  };
}

export const Route = createFileRoute("/api/public/qr-validate")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const code = new URL(request.url).searchParams.get("code") ?? "";
        const result = await validate(code);
        return Response.json(result, { status: result.ok ? 200 : 400 });
      },
      POST: async ({ request }) => {
        const body = await request.json().catch(() => ({}));
        const result = await validate(String(body.code ?? ""));
        return Response.json(result, { status: result.ok ? 200 : 400 });
      },
    },
  },
});
