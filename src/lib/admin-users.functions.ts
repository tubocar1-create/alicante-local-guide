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

// --- List auth users (merged with name from test_users / profiles) ---
export const listAdminUsers = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ pin: z.string().min(1).max(32) }).parse(d),
  )
  .handler(async ({ data }) => {
    if (data.pin !== ADMIN_PIN) {
      throw new Response("Forbidden", { status: 403 });
    }

    // Auto-sync: import any test_users not yet in auth.users so the admin
    // list always reflects every registered person, not just those who
    // signed up through the public auth flow.
    try {
      await syncTestUsersToAuth();
    } catch (e) {
      console.error("[admin-users] auto-sync failed:", e);
    }


    // Paginate auth.users
    const all: Array<{
      id: string;
      email: string | null;
      name: string | null;
      created_at: string;
      last_sign_in_at: string | null;
      provider: string | null;
      confirmed: boolean;
    }> = [];

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
        const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
        const name =
          (meta.name as string | undefined) ??
          (meta.full_name as string | undefined) ??
          (meta.display_name as string | undefined) ??
          null;
        all.push({
          id: u.id,
          email: u.email ?? null,
          name,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at ?? null,
          provider:
            (u.app_metadata as { provider?: string } | null)?.provider ?? null,
          confirmed: !!u.email_confirmed_at || !!u.phone_confirmed_at,
        });
      }
      if (users.length < perPage) break;
      page += 1;
      if (page > 50) break;
    }

    // Enrich missing names from profiles.display_name
    const missingName = all.filter((u) => !u.name).map((u) => u.id);
    if (missingName.length) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id,display_name")
        .in("id", missingName);
      const byId = new Map(
        (profs ?? []).map((p) => [p.id as string, p.display_name as string | null]),
      );
      for (const u of all) {
        if (!u.name) u.name = byId.get(u.id) ?? null;
      }
    }

    const real = all.filter((u) => !isTestUser(u.email));
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    const active_7d = real.filter(
      (u) =>
        u.last_sign_in_at &&
        now - new Date(u.last_sign_in_at).getTime() < 7 * DAY,
    ).length;
    const active_30d = real.filter(
      (u) =>
        u.last_sign_in_at &&
        now - new Date(u.last_sign_in_at).getTime() < 30 * DAY,
    ).length;

    return {
      total: real.length,
      total_with_test: all.length,
      active_7d,
      active_30d,
      users: real
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )
        .slice(0, 500),
    };
  });

// --- One-off migration: import test_users into auth.users ---
function randomPassword(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const migrateTestUsersToAuth = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ pin: z.string().min(1).max(32) }).parse(d),
  )
  .handler(async ({ data }) => {
    if (data.pin !== ADMIN_PIN) {
      throw new Response("Forbidden", { status: 403 });
    }

    const { data: rows, error: tuErr } = await supabaseAdmin
      .from("test_users")
      .select("id,name,email,created_at")
      .order("created_at", { ascending: true });

    if (tuErr) {
      console.error("[migrate] test_users:", tuErr.message);
      throw new Response("DB error", { status: 500 });
    }

    // Build set of existing auth emails
    const existing = new Set<string>();
    let page = 1;
    const perPage = 200;
    for (;;) {
      const { data: res, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage,
      });
      if (error) break;
      const users = res?.users ?? [];
      for (const u of users) if (u.email) existing.add(u.email.toLowerCase());
      if (users.length < perPage) break;
      page += 1;
      if (page > 50) break;
    }

    const created: string[] = [];
    const skipped: string[] = [];
    const failed: Array<{ email: string; error: string }> = [];

    for (const u of rows ?? []) {
      const email = (u.email as string | null)?.trim().toLowerCase();
      if (!email) continue;
      if (existing.has(email)) {
        skipped.push(email);
        continue;
      }
      const name = (u.name as string | null) ?? null;
      const { error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: randomPassword(),
        email_confirm: true,
        user_metadata: name ? { name, full_name: name } : {},
      });
      if (error) {
        failed.push({ email, error: error.message });
      } else {
        created.push(email);
        existing.add(email);
      }
    }

    return {
      created_count: created.length,
      skipped_count: skipped.length,
      failed_count: failed.length,
      created,
      skipped,
      failed,
    };
  });
