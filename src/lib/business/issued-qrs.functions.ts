import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

export const listIssuedQrs = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z
      .object({
        business_id: z.string().uuid(),
        limit: z.number().int().min(1).max(200).default(100),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return { qrs: [] as Array<Record<string, unknown>>, error: "BACKEND_UNAVAILABLE" };
    }
    const sb = createClient<Database>(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: rows, error } = await sb
      .from("qr_codes")
      .select("id, code, purpose, created_at, expires_at, uses, max_uses, active, payload")
      .eq("business_id", data.business_id)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) return { qrs: [], error: error.message };
    return { qrs: rows ?? [] };
  });
