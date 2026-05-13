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
    type IssuerPayload = {
      issued_by?: string;
      user_id?: string | null;
      user_name?: string | null;
      user_surname?: string | null;
      user_email?: string | null;
      user_phone?: string | null;
      issued_at?: string | null;
    };
    type Row = {
      id: string;
      code: string;
      purpose: string;
      created_at: string;
      expires_at: string | null;
      uses: number;
      max_uses: number | null;
      active: boolean;
      payload: IssuerPayload | null;
    };
    const empty = (error?: string) => ({ qrs: [] as Row[], error: error ?? null });

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SERVICE_ROLE) return empty("BACKEND_UNAVAILABLE");

    const sb = createClient<Database>(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: rows, error } = await sb
      .from("qr_codes")
      .select("id, code, purpose, created_at, expires_at, uses, max_uses, active, payload")
      .eq("business_id", data.business_id)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) return empty(error.message);
    return { qrs: (rows ?? []) as Row[], error: null };
  });
