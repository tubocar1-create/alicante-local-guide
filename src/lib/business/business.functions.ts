import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
    const { data, error } = await supabase
      .from("businesses")
      .select("*")
      .or(`owner_id.eq.${userId},id.in.(select business_id from business_users where user_id=${userId})`)
      .order("created_at", { ascending: false });
    if (error) {
      // Fallback simple query (owner only) if the OR filter syntax breaks
      const r = await supabase
        .from("businesses")
        .select("*")
        .eq("owner_id", userId)
        .order("created_at", { ascending: false });
      if (r.error) throw r.error;
      return { businesses: r.data ?? [] };
    }
    return { businesses: data ?? [] };
  });

export const createBusiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
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
