// Server fns para el kill-switch global de Google API.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { invalidateGoogleKillSwitchCache } from "@/lib/google-killswitch.server";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden");
}

export const getGoogleKillSwitch = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data } = await supabaseAdmin
      .from("system_flags")
      .select("enabled, updated_at")
      .eq("key", "google_api_enabled")
      .maybeSingle();
    return { enabled: !!data?.enabled, updatedAt: data?.updated_at ?? null };
  });

export const setGoogleKillSwitch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { enabled: boolean }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    await supabaseAdmin
      .from("system_flags")
      .upsert(
        {
          key: "google_api_enabled",
          enabled: data.enabled,
          updated_at: new Date().toISOString(),
          updated_by: context.userId,
        },
        { onConflict: "key" },
      );
    invalidateGoogleKillSwitchCache();
    return { ok: true, enabled: data.enabled };
  });
