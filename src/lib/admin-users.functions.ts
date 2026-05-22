import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ADMIN_PIN = "7910511";

const TEST_PATTERNS = [
  /test/i,
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

    const all: Array<{
      id: string;
      email: string | null;
      created_at: string;
      last_sign_in_at: string | null;
      provider: string | null;
      confirmed: boolean;
    }> = [];

    // Paginate through all users
    let page = 1;
    const perPage = 200;
    for (;;) {
      const { data: res, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage,
      });
      if (error) {
        console.error("[admin-users] listUsers error:", error.message);
        break;
      }
      const users = res?.users ?? [];
      for (const u of users) {
        all.push({
          id: u.id,
          email: u.email ?? null,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at ?? null,
          provider:
            (u.app_metadata as { provider?: string } | null)?.provider ?? null,
          confirmed: !!u.email_confirmed_at || !!u.phone_confirmed_at,
        });
      }
      if (users.length < perPage) break;
      page += 1;
      if (page > 50) break; // safety
    }

    const real = all.filter((u) => !isTestUser(u.email));
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    const activeLast7 = real.filter(
      (u) =>
        u.last_sign_in_at &&
        now - new Date(u.last_sign_in_at).getTime() < 7 * DAY,
    );
    const activeLast30 = real.filter(
      (u) =>
        u.last_sign_in_at &&
        now - new Date(u.last_sign_in_at).getTime() < 30 * DAY,
    );

    return {
      total: real.length,
      total_with_test: all.length,
      active_7d: activeLast7.length,
      active_30d: activeLast30.length,
      users: real
        .sort((a, b) => {
          const ta = new Date(a.created_at).getTime();
          const tb = new Date(b.created_at).getTime();
          return tb - ta;
        })
        .slice(0, 500),
    };
  });
