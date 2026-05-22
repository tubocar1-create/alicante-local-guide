import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ADMIN_PIN = "7910511";

const TEST_PATTERNS = [
  /@test\.com$/i,
  /@example\.(com|org|net)$/i,
  /\+test@/i,
  /lovable\.dev$/i,
  /noreply/i,
];

function isTestUser(email: string | null | undefined): boolean {
  if (!email) return false;
  return TEST_PATTERNS.some((re) => re.test(email));
}

export const listAdminUsers = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ pin: z.string().min(1).max(32) }).parse(d),
  )
  .handler(async ({ data }) => {
    if (data.pin !== ADMIN_PIN) {
      throw new Response("Forbidden", { status: 403 });
    }

    const { data: rows, error } = await supabaseAdmin
      .from("test_users")
      .select("id,name,email,created_at")
      .order("created_at", { ascending: false })
      .limit(1000);

    if (error) {
      console.error("[admin-users] test_users error:", error.message);
      throw new Response("DB error", { status: 500 });
    }

    const all = (rows ?? []).map((u) => ({
      id: String(u.id),
      name: (u.name as string | null) ?? null,
      email: (u.email as string | null) ?? null,
      created_at: u.created_at as string,
      last_sign_in_at: null as string | null,
      provider: null as string | null,
      confirmed: true,
    }));

    const real = all.filter((u) => !isTestUser(u.email));

    return {
      total: real.length,
      total_with_test: all.length,
      active_7d: 0,
      active_30d: 0,
      users: real,
    };
  });
