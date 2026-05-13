import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { trackEvent } from "./track";

function randomCode(len = 12) {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
}

const PURPOSE = z.enum(["visit", "referral", "promo", "booking", "campaign"]);

export const createQrCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        business_id: z.string().uuid(),
        purpose: PURPOSE.default("visit"),
        expires_at: z.string().datetime().optional(),
        max_uses: z.number().int().positive().max(100000).optional(),
        payload: z.record(z.string(), z.unknown()).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const code = randomCode();
    const { data: row, error } = await supabase
      .from("qr_codes")
      .insert({
        business_id: data.business_id,
        purpose: data.purpose,
        expires_at: data.expires_at ?? null,
        max_uses: data.max_uses ?? null,
        payload: (data.payload ?? {}) as never,
        code,
        created_by: userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await trackEvent(supabase, {
      type: "qr_created",
      business_id: data.business_id,
      user_id: userId,
      metadata: { purpose: data.purpose },
    });
    return { qr: row };
  });

export const listQrCodes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ business_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("qr_codes")
      .select("*")
      .eq("business_id", data.business_id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return { qrs: rows ?? [] };
  });

export const validateQrCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ code: z.string().min(4).max(64) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: qr, error } = await supabase
      .from("qr_codes")
      .select("*")
      .eq("code", data.code)
      .single();
    if (error || !qr) return { ok: false, reason: "not_found" as const };
    if (!qr.active) return { ok: false, reason: "inactive" as const };
    if (qr.expires_at && new Date(qr.expires_at).getTime() < Date.now())
      return { ok: false, reason: "expired" as const };
    if (qr.max_uses != null && qr.uses >= qr.max_uses)
      return { ok: false, reason: "exhausted" as const };

    await supabase
      .from("qr_codes")
      .update({ uses: qr.uses + 1 })
      .eq("id", qr.id);

    await supabase.from("visits").insert({
      business_id: qr.business_id,
      qr_id: qr.id,
      user_id: userId,
      source: "scan",
    });

    await trackEvent(supabase, {
      type: "qr_validated",
      business_id: qr.business_id,
      user_id: userId,
      conversion_status: qr.purpose === "referral" ? "converted" : "visit",
      metadata: { purpose: qr.purpose },
    });

    return { ok: true as const, qr };
  });
