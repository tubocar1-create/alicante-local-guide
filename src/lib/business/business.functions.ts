import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const slugRe = /^[a-z0-9][a-z0-9-]{1,60}$/;

const CreateSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().regex(slugRe),
  sector: z.string().min(2).max(60),
  description: z.string().max(1000).optional(),
  address: z.string().max(240).optional(),
  phone: z.string().max(40).optional(),
  email: z.string().email().max(160).optional().or(z.literal("")),
  whatsapp: z.string().max(40).optional(),
  website: z.string().url().max(240).optional().or(z.literal("")),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

export const listMyBusinesses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    // Owner businesses
    const ownedRes = await supabase
      .from("businesses")
      .select("*")
      .eq("owner_id", userId);
    if (ownedRes.error) throw new Error(ownedRes.error.message);

    // Member businesses (via business_users)
    const memberRes = await supabase
      .from("business_users")
      .select("business_id")
      .eq("user_id", userId);
    const memberIds = (memberRes.data ?? []).map((r) => r.business_id);

    let memberBiz: typeof ownedRes.data = [];
    if (memberIds.length) {
      const r = await supabase
        .from("businesses")
        .select("*")
        .in("id", memberIds);
      memberBiz = r.data ?? [];
    }

    const map = new Map<string, (typeof ownedRes.data)[number]>();
    for (const b of [...(ownedRes.data ?? []), ...memberBiz]) map.set(b.id, b);
    const businesses = Array.from(map.values()).sort((a, b) =>
      b.created_at.localeCompare(a.created_at),
    );
    return { businesses };
  });

export const createBusiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Ensure caller has business_user role (required by RLS insert policy).
    // Self-grant on first onboarding via admin client (bypasses user_roles RLS).
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "business_user" }, { onConflict: "user_id,role" });
    if (roleErr) throw new Error(roleErr.message);

    const { data: row, error } = await supabase
      .from("businesses")
      .insert({
        ...data,
        email: data.email || null,
        website: data.website || null,
        owner_id: userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { business: row };
  });

export const getBusiness = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("businesses")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    return { business: row };
  });
