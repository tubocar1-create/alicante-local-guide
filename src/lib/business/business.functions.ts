import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";

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

type BusinessRow = Database["public"]["Tables"]["businesses"]["Row"];

export const listMyBusinesses = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ businesses: BusinessRow[]; error?: string }> => {
    const authHeader = getRequestHeader("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return { businesses: [], error: "UNAUTHORIZED" };
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      return { businesses: [], error: "BACKEND_UNAVAILABLE" };
    }

    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return { businesses: [], error: "UNAUTHORIZED" };

      const ownedRes = await supabase
        .from("businesses")
        .select("*")
        .eq("owner_id", userId);
      if (ownedRes.error) return { businesses: [], error: ownedRes.error.message };

      const memberRes = await supabase
        .from("business_users")
        .select("business_id")
        .eq("user_id", userId);
      const memberIds = (memberRes.data ?? []).map((r) => r.business_id);

      let memberBiz: BusinessRow[] = [];
      if (memberIds.length) {
        const r = await supabase.from("businesses").select("*").in("id", memberIds);
        memberBiz = r.data ?? [];
      }

      const map = new Map<string, BusinessRow>();
      for (const b of [...(ownedRes.data ?? []), ...memberBiz]) map.set(b.id, b);
      const businesses = Array.from(map.values()).sort((a, b) =>
        b.created_at.localeCompare(a.created_at),
      );
      return { businesses };
    } catch (e) {
      console.error("listMyBusinesses failed", e);
      return { businesses: [], error: "LIST_FAILED" };
    }
  },
);

export const createBusiness = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => CreateSchema.parse(d))
  .handler(async ({ data }) => {
    const authHeader = getRequestHeader("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return { business: null, error: "UNAUTHORIZED" as const };
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      return { business: null, error: "BACKEND_UNAVAILABLE" as const };
    }

    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return { business: null, error: "UNAUTHORIZED" as const };

      // Ensure caller has business_user role (required by RLS insert policy).
      const { error: roleErr } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: userId, role: "business_user" }, { onConflict: "user_id,role" });
      if (roleErr) return { business: null, error: roleErr.message };

      // Ensure unique slug by appending a numeric suffix on collision.
      let slug = data.slug;
      for (let i = 0; i < 5; i++) {
        const { data: existing } = await supabaseAdmin
          .from("businesses")
          .select("id")
          .eq("slug", slug)
          .maybeSingle();
        if (!existing) break;
        slug = `${data.slug}-${Math.random().toString(36).slice(2, 6)}`;
      }

      const { data: row, error } = await supabase
        .from("businesses")
        .insert({
          ...data,
          slug,
          email: data.email || null,
          website: data.website || null,
          owner_id: userId,
        })
        .select()
        .single();
      if (error) return { business: null, error: error.message };
      return { business: row };
    } catch (e) {
      console.error("createBusiness failed", e);
      return { business: null, error: "CREATE_FAILED" as const };
    }
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
