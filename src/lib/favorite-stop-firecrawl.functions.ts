import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BASE = "http://www.subus.es/QR/Alicante";
const FIRECRAWL_URL = "https://api.firecrawl.dev/v2/scrape";
const DAILY_LIMIT = 3;
const TIMEOUT_MS = 20_000;
// Sentinel for "unlimited" (admin). Avoid Infinity — TanStack serverFn
// serialization (devalue) rejects non-finite numbers and turns the response
// into a thrown Response on the client.
const UNLIMITED = 9999;

function normalizeLine(code: string): string {
  const cleaned = code.replace(/^0+/, "") || "0";
  const m = cleaned.toUpperCase().match(/^(\d+)([A-Z]?)$/);
  if (!m) return cleaned.toUpperCase();
  return String(parseInt(m[1], 10)) + m[2];
}

const FC_BLOCK_RE =
  /([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ0-9 .'\-]{1,60}?)\]\([^)]*termometros\/(\d+)_\d\.pdf[^)]*\)[\s\S]{1,120}?(\d+)\s*min/gi;

type Arrival = { line: string; destination: string; etaMin: number };

function parseMarkdown(md: string): Arrival[] {
  const out: Arrival[] = [];
  for (const m of md.matchAll(FC_BLOCK_RE)) {
    const destination = m[1].trim();
    const line = normalizeLine(m[2]);
    const mins = parseInt(m[3], 10);
    if (!Number.isFinite(mins)) continue;
    out.push({ line, destination, etaMin: mins });
  }
  out.sort((a, b) => a.etaMin - b.etaMin);
  return out;
}

async function callFirecrawl(targetUrl: string, apiKey: string): Promise<string | null> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(FIRECRAWL_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: targetUrl,
        formats: ["markdown"],
        onlyMainContent: false,
        location: { country: "ES" },
      }),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { success?: boolean; data?: { markdown?: string } };
    return j.success ? (j.data?.markdown ?? null) : null;
  } finally {
    clearTimeout(t);
  }
}

export type FavoriteStopRealtimeResult =
  | {
      ok: true;
      etaMin: number | null;
      all: number[];
      destination: string | null;
      fetchedAt: number;
      remaining: number; // calls remaining after this one (Infinity for admin)
      isAdmin: boolean;
      limit: number;
    }
  | {
      ok: false;
      reason: "limit" | "firecrawl_error" | "config";
      message: string;
      remaining: number;
      isAdmin: boolean;
      limit: number;
    };

export const requestFavoriteStopRealtime = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        stopId: z.string().regex(/^\d{1,6}$/),
        line: z.string().min(1).max(8),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<FavoriteStopRealtimeResult> => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Admin bypass
    const { data: adminRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    const isAdmin = !!adminRow;

    // Count today's calls (Europe/Madrid day)
    const now = new Date();
    // Madrid is UTC+1/+2; using simple "today since midnight Madrid" via SQL is cleaner.
    // Compute the start of the Madrid day in UTC.
    const madridNow = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Madrid" }));
    const madridMidnight = new Date(
      madridNow.getFullYear(),
      madridNow.getMonth(),
      madridNow.getDate(),
      0,
      0,
      0,
    );
    // Convert Madrid midnight back to UTC by offset diff.
    const offsetMin = (now.getTime() - madridNow.getTime()) / 60000;
    const startUtc = new Date(madridMidnight.getTime() + offsetMin * 60000);

    let used = 0;
    if (!isAdmin) {
      const { count } = await supabaseAdmin
        .from("firecrawl_call_log")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", startUtc.toISOString());
      used = count ?? 0;
      if (used >= DAILY_LIMIT) {
        return {
          ok: false,
          reason: "limit",
          message: `Has alcanzado el límite promocional de ${DAILY_LIMIT} llamadas diarias.`,
          remaining: 0,
          isAdmin: false,
          limit: DAILY_LIMIT,
        };
      }
    }

    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      return {
        ok: false,
        reason: "config",
        message: "Servicio no configurado.",
        remaining: isAdmin ? UNLIMITED : DAILY_LIMIT - used,
        isAdmin,
        limit: DAILY_LIMIT,
      };
    }

    const targetUrl = `${BASE}/consulta.aspx?p=${encodeURIComponent(data.stopId)}`;
    let md: string | null = null;
    try {
      md = await callFirecrawl(targetUrl, apiKey);
    } catch {
      md = null;
    }
    if (!md) {
      return {
        ok: false,
        reason: "firecrawl_error",
        message: "No se pudo consultar Vectalia en este momento.",
        remaining: isAdmin ? UNLIMITED : DAILY_LIMIT - used,
        isAdmin,
        limit: DAILY_LIMIT,
      };
    }

    const arrivals = parseMarkdown(md);
    const wanted = normalizeLine(data.line);
    const forLine = arrivals.filter((a) => a.line === wanted);
    const all = forLine.map((a) => a.etaMin);
    const destination = forLine[0]?.destination ?? null;
    const etaMin = all[0] ?? null;

    // Log the call (count it whether or not the line had a hit — Firecrawl was used)
    await supabaseAdmin.from("firecrawl_call_log").insert({
      user_id: userId,
      purpose: "favorite_stop",
      stop_id: data.stopId,
      line: wanted,
      metadata: { etaMin, count: all.length },
    });

    const newUsed = used + 1;
    return {
      ok: true,
      etaMin,
      all,
      destination,
      fetchedAt: Date.now(),
      remaining: isAdmin ? UNLIMITED : Math.max(0, DAILY_LIMIT - newUsed),
      isAdmin,
      limit: DAILY_LIMIT,
    };
  });
