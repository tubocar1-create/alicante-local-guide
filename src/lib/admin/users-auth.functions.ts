// Admin-only: list real authenticated users from auth.users + profiles.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AuthUserRow = {
  id: string;
  email: string | null;
  email_confirmed: boolean;
  provider: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  full_name: string | null;
  display_name: string | null;
  city: string | null;
  blocked: boolean;
  last_seen_at: string | null;
  permissions: string[];
  roles: string[];
};

export const listAuthUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    // Verify admin
    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin");
    if (!roleRows || roleRows.length === 0) {
      throw new Response("Forbidden", { status: 403 });
    }

    // Page through all auth users (cap to 1000 for safety)
    const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (error) throw new Error(error.message);

    const ids = list.users.map((u) => u.id);
    const [{ data: profiles }, { data: perms }, { data: roles }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id,full_name,display_name,city,blocked,last_seen_at")
        .in("id", ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"]),
      supabaseAdmin
        .from("user_permissions")
        .select("user_id,permission,granted")
        .in("user_id", ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"]),
      supabaseAdmin
        .from("user_roles")
        .select("user_id,role")
        .in("user_id", ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"]),
    ]);

    const profMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    const permMap = new Map<string, string[]>();
    for (const p of perms ?? []) {
      if (!p.granted) continue;
      const arr = permMap.get(p.user_id) ?? [];
      arr.push(p.permission);
      permMap.set(p.user_id, arr);
    }
    const roleMap = new Map<string, string[]>();
    for (const r of roles ?? []) {
      const arr = roleMap.get(r.user_id) ?? [];
      arr.push(r.role);
      roleMap.set(r.user_id, arr);
    }

    const rows: AuthUserRow[] = list.users.map((u) => {
      const prof = profMap.get(u.id);
      const provider = u.app_metadata?.provider ?? u.identities?.[0]?.provider ?? null;
      return {
        id: u.id,
        email: u.email ?? null,
        email_confirmed: !!u.email_confirmed_at,
        provider,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        full_name: prof?.full_name ?? null,
        display_name: prof?.display_name ?? null,
        city: prof?.city ?? null,
        blocked: !!prof?.blocked,
        last_seen_at: prof?.last_seen_at ?? null,
        permissions: permMap.get(u.id) ?? [],
        roles: roleMap.get(u.id) ?? [],
      };
    });

    return { users: rows, total: list.users.length };
  });
