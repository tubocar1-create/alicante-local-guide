import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function checkIsAdmin(): Promise<boolean> {
  try {
    const auth = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
    if (!auth) return false;
    const token = auth.replace(/^Bearer\s+/i, "").trim();
    if (!token) return false;
    const { data: userRes } = await supabaseAdmin.auth.getUser(token);
    const uid = userRes?.user?.id;
    if (!uid) return false;
    const { data: role } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", uid)
      .eq("role", "admin")
      .maybeSingle();
    return !!role;
  } catch {
    return false;
  }
}


const BASE = "http://www.subus.es/QR/Alicante";
const FIRECRAWL_URL = "https://api.firecrawl.dev/v2/scrape";
const DAILY_LIMIT = 3;
const TIMEOUT_MS = 20_000;

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
  .inputValidator((input: unknown) =>
    z
      .object({
        stopId: z.string().regex(/^\d{1,6}$/),
        line: z.string().min(1).max(8),
        visitorId: z.string().min(8).max(128),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<FavoriteStopRealtimeResult> => {
    const visitorId = data.visitorId;

    // Start of the Madrid day in UTC
    const now = new Date();
    const madridNow = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Madrid" }));
    const madridMidnight = new Date(
      madridNow.getFullYear(),
      madridNow.getMonth(),
      madridNow.getDate(),
      0,
      0,
      0,
    );
    const offsetMin = (now.getTime() - madridNow.getTime()) / 60000;
    const startUtc = new Date(madridMidnight.getTime() + offsetMin * 60000);

    const isAdmin = await checkIsAdmin();

    // Count today's calls for this visitor (anonymous, by visitorId)
    const { count } = await supabaseAdmin
      .from("firecrawl_call_log")
      .select("id", { count: "exact", head: true })
      .eq("visitor_id", visitorId)
      .gte("created_at", startUtc.toISOString());
    const used = count ?? 0;
    if (!isAdmin && used >= DAILY_LIMIT) {
      return {
        ok: false,
        reason: "limit",
        message: `Has alcanzado el límite promocional de ${DAILY_LIMIT} llamadas diarias.`,
        remaining: 0,
        isAdmin: false,
        limit: DAILY_LIMIT,
      };
    }

    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      return {
        ok: false,
        reason: "config",
        message: "Servicio no configurado.",
        remaining: isAdmin ? Number.POSITIVE_INFINITY : DAILY_LIMIT - used,
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
        remaining: DAILY_LIMIT - used,
        isAdmin: false,
        limit: DAILY_LIMIT,
      };
    }

    const arrivals = parseMarkdown(md);
    const wanted = normalizeLine(data.line);
    const forLine = arrivals.filter((a) => a.line === wanted);
    const all = forLine.map((a) => a.etaMin);
    const destination = forLine[0]?.destination ?? null;
    const etaMin = all[0] ?? null;

    await supabaseAdmin.from("firecrawl_call_log").insert({
      user_id: null,
      visitor_id: visitorId,
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
      remaining: Math.max(0, DAILY_LIMIT - newUsed),
      isAdmin: false,
      limit: DAILY_LIMIT,
    };
  });
