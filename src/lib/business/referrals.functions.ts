import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { trackEvent } from "./track";

function randomCode() {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

export const generateReferral = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ business_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const code = randomCode();
    const { data: row, error } = await supabase
      .from("referrals")
      .insert({
        business_id: data.business_id,
        referrer_user_id: userId,
        code,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await trackEvent(supabase, {
      type: "referral_created",
      business_id: data.business_id,
      user_id: userId,
    });
    return { referral: row };
  });

export const listReferrals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ business_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("referrals")
      .select("*")
      .eq("business_id", data.business_id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return { referrals: rows ?? [] };
  });
