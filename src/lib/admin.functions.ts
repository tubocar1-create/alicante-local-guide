import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Returns whether the currently authenticated user has the `admin` role
 * in `public.user_roles`. Used to gate hidden admin-only pages on the client.
 */
export const checkIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (error) {
      // If RLS hides the row, treat as non-admin.
      return { isAdmin: false };
    }
    return { isAdmin: !!data };
  });
