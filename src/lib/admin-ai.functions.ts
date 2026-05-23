// Server functions that power the /admin/ai observability & training panel.
// All functions are PIN-gated (consistent with admin-users.functions.ts)
// and use the admin Supabase client. They return plain serializable DTOs.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ADMIN_PIN = "7910511";

function assertPin(pin: string) {
  if (pin !== ADMIN_PIN) {
    throw new Response("Forbidden", { status: 403 });
  }
}

const PinSchema = z.object({ pin: z.string().min(1).max(32) });

// ---------------- Overview ----------------

export type AiOverviewDTO = {
  total: number;
  resolved: number;
  fallback: number;
  unknownPending: number;
  avgLatencyMs: number;
  totalCost: number;
  resolutionRate: number;
  fallbackRate: number;
  topIntents: Array<{ intent: string; count: number }>;
  topFailures: Array<{ reason: string; count: number }>;
  topRepeatedUnresolved: Array<{ query: string; count: number }>;
  generatedAt: string;
};

export const getAiOverview = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => PinSchema.parse(d))
  .handler(async ({ data }): Promise<AiOverviewDTO> => {
    assertPin(data.pin);
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: logs } = await supabaseAdmin
      .from("agente_learning_log")
      .select(
        "detected_intent,failure_reason,resolved,fallback_used,latency_ms,estimated_cost,raw_query,created_at",
      )
      .gte("created_at", since)
      .limit(5000);

    const rows = logs ?? [];
    const total = rows.length;
    const resolved = rows.filter((r) => r.resolved === true).length;
    const fallback = rows.filter((r) => r.fallback_used === true).length;
    const latencies = rows
      .map((r) => r.latency_ms)
      .filter((v): v is number => typeof v === "number");
    const avgLatencyMs = latencies.length
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : 0;
    const totalCost = Number(
      rows
        .map((r) => Number(r.estimated_cost ?? 0))
        .reduce((a, b) => a + b, 0)
        .toFixed(4),
    );

    const intentCounter = new Map<string, number>();
    const failureCounter = new Map<string, number>();
    const unresolvedCounter = new Map<string, number>();
    for (const r of rows) {
      if (r.detected_intent) {
        intentCounter.set(
          r.detected_intent,
          (intentCounter.get(r.detected_intent) ?? 0) + 1,
        );
      }
      if (r.failure_reason) {
        failureCounter.set(
          r.failure_reason,
          (failureCounter.get(r.failure_reason) ?? 0) + 1,
        );
      }
      if (r.resolved === false && r.raw_query) {
        unresolvedCounter.set(
          r.raw_query,
          (unresolvedCounter.get(r.raw_query) ?? 0) + 1,
        );
      }
    }

    const topIntents = [...intentCounter.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([intent, count]) => ({ intent, count }));
    const topFailures = [...failureCounter.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([reason, count]) => ({ reason, count }));
    const topRepeatedUnresolved = [...unresolvedCounter.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([query, count]) => ({ query, count }));

    const { count: unknownPending } = await supabaseAdmin
      .from("agente_unknown_queries")
      .select("id", { count: "exact", head: true })
      .is("processed_at", null);

    return {
      total,
      resolved,
      fallback,
      unknownPending: unknownPending ?? 0,
      avgLatencyMs,
      totalCost,
      resolutionRate: total ? Number((resolved / total).toFixed(3)) : 0,
      fallbackRate: total ? Number((fallback / total).toFixed(3)) : 0,
      topIntents,
      topFailures,
      topRepeatedUnresolved,
      generatedAt: new Date().toISOString(),
    };
  });

// ---------------- Time series ----------------

export type AiTimeseriesDTO = {
  days: Array<{ date: string; total: number; resolved: number; fallback: number; cost: number }>;
};

export const getAiTimeseries = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    PinSchema.extend({ days: z.number().int().min(1).max(90).default(14) }).parse(d),
  )
  .handler(async ({ data }): Promise<AiTimeseriesDTO> => {
    assertPin(data.pin);
    const since = new Date(Date.now() - data.days * 24 * 60 * 60 * 1000).toISOString();
    const { data: logs } = await supabaseAdmin
      .from("agente_learning_log")
      .select("created_at,resolved,fallback_used,estimated_cost")
      .gte("created_at", since)
      .limit(10000);

    const map = new Map<string, { total: number; resolved: number; fallback: number; cost: number }>();
    for (const r of logs ?? []) {
      const d = (r.created_at as string).slice(0, 10);
      const cur = map.get(d) ?? { total: 0, resolved: 0, fallback: 0, cost: 0 };
      cur.total += 1;
      if (r.resolved === true) cur.resolved += 1;
      if (r.fallback_used === true) cur.fallback += 1;
      cur.cost += Number(r.estimated_cost ?? 0);
      map.set(d, cur);
    }
    const days = [...map.entries()]
      .map(([date, v]) => ({ date, ...v, cost: Number(v.cost.toFixed(4)) }))
      .sort((a, b) => a.date.localeCompare(b.date));
    return { days };
  });

// ---------------- Unknown queries ----------------

export const listUnknownQueries = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    PinSchema.extend({
      status: z.enum(["pending", "processed", "all"]).default("pending"),
      search: z.string().max(200).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    assertPin(data.pin);
    let q = supabaseAdmin
      .from("agente_unknown_queries")
      .select("*")
      .order("last_seen_at", { ascending: false })
      .limit(300);
    if (data.status === "pending") q = q.is("processed_at", null);
    if (data.status === "processed") q = q.not("processed_at", "is", null);
    if (data.search && data.search.trim()) {
      q = q.ilike("normalized", `%${data.search.trim().toLowerCase()}%`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

export const actUnknownQuery = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    PinSchema.extend({
      id: z.string().uuid(),
      action: z.enum([
        "promote_intent",
        "add_faq",
        "add_alias",
        "spam",
        "ignore",
        "merge",
        "send_to_supervision",
      ]),
      payload: z.record(z.string(), z.unknown()).default({}),
      notes: z.string().max(1000).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    assertPin(data.pin);

    // Fetch the unknown query
    const { data: uq, error: uqErr } = await supabaseAdmin
      .from("agente_unknown_queries")
      .select("*")
      .eq("id", data.id)
      .single();
    if (uqErr || !uq) throw new Error(uqErr?.message ?? "Not found");

    const payload = data.payload as Record<string, unknown>;

    if (data.action === "promote_intent") {
      const key = String(payload.key ?? `auto_${Date.now()}`);
      const label = String(payload.label ?? uq.normalized);
      const route = (payload.route as string | undefined) ?? null;
      const keywords =
        (payload.keywords as string[] | undefined) ?? [uq.normalized];
      const spokenReply = String(payload.spoken_reply ?? `Te llevo a ${label}.`);
      const { error: insErr } = await supabaseAdmin.from("agente_intents").insert({
        key,
        label,
        route,
        keywords,
        spoken_reply: spokenReply,
        active: true,
        priority: 100,
      });
      if (insErr) throw new Error(insErr.message);
    } else if (data.action === "add_faq") {
      const response = String(payload.response ?? "");
      const keywords =
        (payload.keywords as string[] | undefined) ?? [uq.normalized];
      const { error: faqErr } = await supabaseAdmin.from("agente_faqs").insert({
        response,
        keywords,
        any_of: [],
        priority: 100,
        active: true,
      });
      if (faqErr) throw new Error(faqErr.message);
    } else if (data.action === "add_alias") {
      const targetIntentKey = payload.intent_key as string | undefined;
      const alias = String(payload.alias ?? uq.normalized);
      if (!targetIntentKey) throw new Error("intent_key required");
      const { data: row, error: getErr } = await supabaseAdmin
        .from("agente_intents")
        .select("keywords")
        .eq("key", targetIntentKey)
        .single();
      if (getErr) throw new Error(getErr.message);
      const newKeywords = Array.from(new Set([...(row?.keywords ?? []), alias]));
      const { error: updErr } = await supabaseAdmin
        .from("agente_intents")
        .update({ keywords: newKeywords })
        .eq("key", targetIntentKey);
      if (updErr) throw new Error(updErr.message);
    }

    // Mark processed for terminal actions
    const terminal = ["promote_intent", "add_faq", "spam", "ignore", "merge"] as const;
    if ((terminal as readonly string[]).includes(data.action)) {
      await supabaseAdmin
        .from("agente_unknown_queries")
        .update({ processed_at: new Date().toISOString() })
        .eq("id", data.id);
    }

    // Audit trail
    await supabaseAdmin.from("agente_unknown_query_actions").insert({
      unknown_query_id: data.id,
      action: data.action,
      payload: payload as never,
      notes: data.notes ?? null,
    });

    return { ok: true };
  });

// ---------------- Supervision ----------------

export const listSupervisionItems = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    PinSchema.extend({
      status: z.enum(["pending", "approved", "rejected", "all"]).default("pending"),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    assertPin(data.pin);
    let q = supabaseAdmin
      .from("agente_admin_supervisions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

export const submitSupervision = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    PinSchema.extend({
      id: z.string().uuid(),
      status: z.enum(["approved", "rejected"]),
      final_intent: z.string().optional(),
      final_keywords: z.array(z.string()).optional(),
      admin_notes: z.string().max(2000).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    assertPin(data.pin);
    const { error } = await supabaseAdmin
      .from("agente_admin_supervisions")
      .update({
        status: data.status,
        final_intent: data.final_intent ?? null,
        final_keywords: data.final_keywords ?? [],
        admin_notes: data.admin_notes ?? null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------- Intents CRUD ----------------

export const listIntents = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => PinSchema.parse(d))
  .handler(async ({ data }) => {
    assertPin(data.pin);
    const { data: intents } = await supabaseAdmin
      .from("agente_intents")
      .select("*")
      .order("priority", { ascending: true })
      .limit(500);

    // Aggregate usage stats per intent
    const { data: stats } = await supabaseAdmin
      .from("agente_learning_log")
      .select("detected_intent,resolved,fallback_used,created_at")
      .not("detected_intent", "is", null)
      .limit(5000);

    const usage = new Map<
      string,
      { total: number; resolved: number; fallback: number; lastUsed: string | null }
    >();
    for (const r of stats ?? []) {
      const key = r.detected_intent as string;
      const cur =
        usage.get(key) ?? { total: 0, resolved: 0, fallback: 0, lastUsed: null };
      cur.total += 1;
      if (r.resolved === true) cur.resolved += 1;
      if (r.fallback_used === true) cur.fallback += 1;
      const t = r.created_at as string;
      if (!cur.lastUsed || t > cur.lastUsed) cur.lastUsed = t;
      usage.set(key, cur);
    }

    return {
      intents: (intents ?? []).map((i) => ({
        ...i,
        usage: usage.get(i.key as string) ?? {
          total: 0,
          resolved: 0,
          fallback: 0,
          lastUsed: null,
        },
      })),
    };
  });

export const upsertIntent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    PinSchema.extend({
      id: z.string().uuid().optional(),
      key: z.string().min(1).max(80),
      label: z.string().min(1).max(160),
      route: z.string().max(200).nullable().optional(),
      action: z.string().max(80).nullable().optional(),
      keywords: z.array(z.string()).default([]),
      spoken_reply: z.string().min(1).max(500),
      priority: z.number().int().min(0).max(10000).default(100),
      active: z.boolean().default(true),
      notes: z.string().max(2000).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    assertPin(data.pin);
    const { pin: _pin, id, ...rest } = data;
    if (id) {
      const { error } = await supabaseAdmin
        .from("agente_intents")
        .update(rest)
        .eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("agente_intents").insert(rest);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteIntent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    PinSchema.extend({ id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    assertPin(data.pin);
    const { error } = await supabaseAdmin
      .from("agente_intents")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------- Entities (proper nouns) CRUD ----------------

export const listEntities = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => PinSchema.parse(d))
  .handler(async ({ data }) => {
    assertPin(data.pin);
    const { data: rows } = await supabaseAdmin
      .from("agente_proper_nouns")
      .select("*")
      .order("priority", { ascending: true })
      .limit(1000);
    return { rows: rows ?? [] };
  });

export const upsertEntity = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    PinSchema.extend({
      id: z.string().uuid().optional(),
      name: z.string().min(1).max(200),
      normalized: z.string().min(1).max(200),
      category: z.string().min(1).max(80),
      route: z.string().min(1).max(200),
      aliases: z.array(z.string()).default([]),
      priority: z.number().int().min(0).max(10000).default(100),
      active: z.boolean().default(true),
      source: z.string().max(80).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    assertPin(data.pin);
    const { pin: _pin, id, ...rest } = data;
    if (id) {
      const { error } = await supabaseAdmin
        .from("agente_proper_nouns")
        .update(rest)
        .eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("agente_proper_nouns")
        .insert(rest);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteEntity = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    PinSchema.extend({ id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    assertPin(data.pin);
    const { error } = await supabaseAdmin
      .from("agente_proper_nouns")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------- Analytics ----------------

export const getAiAnalytics = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => PinSchema.parse(d))
  .handler(async ({ data }) => {
    assertPin(data.pin);
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: rows } = await supabaseAdmin
      .from("agente_learning_log")
      .select(
        "raw_query,detected_intent,resolved,fallback_used,conversion_event,clicked_result,route_origin",
      )
      .gte("created_at", since)
      .limit(5000);

    const freq = new Map<string, number>();
    const failed = new Map<string, number>();
    const conversions = new Map<string, number>();
    const clicks = new Map<string, number>();
    const routes = new Map<string, number>();
    for (const r of rows ?? []) {
      if (r.raw_query) freq.set(r.raw_query, (freq.get(r.raw_query) ?? 0) + 1);
      if (r.raw_query && r.resolved === false) {
        failed.set(r.raw_query, (failed.get(r.raw_query) ?? 0) + 1);
      }
      if (r.conversion_event && r.detected_intent) {
        conversions.set(
          r.detected_intent,
          (conversions.get(r.detected_intent) ?? 0) + 1,
        );
      }
      if (r.clicked_result && r.detected_intent) {
        clicks.set(r.detected_intent, (clicks.get(r.detected_intent) ?? 0) + 1);
      }
      if (r.route_origin) {
        routes.set(r.route_origin, (routes.get(r.route_origin) ?? 0) + 1);
      }
    }
    const top = (m: Map<string, number>) =>
      [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
    return {
      mostFrequent: top(freq).map(([q, count]) => ({ query: q, count })),
      mostFailed: top(failed).map(([q, count]) => ({ query: q, count })),
      topConversions: top(conversions).map(([intent, count]) => ({ intent, count })),
      topClicks: top(clicks).map(([intent, count]) => ({ intent, count })),
      topRoutes: top(routes).map(([route, count]) => ({ route, count })),
    };
  });

// ---------------- Costs ----------------

export const getAiCosts = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => PinSchema.parse(d))
  .handler(async ({ data }) => {
    assertPin(data.pin);
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: rows } = await supabaseAdmin
      .from("agente_learning_log")
      .select(
        "created_at,model_used,detected_intent,estimated_cost,tokens_input,tokens_output,raw_query",
      )
      .gte("created_at", since)
      .limit(10000);

    const byDay = new Map<string, number>();
    const byWeek = new Map<string, number>();
    const byModel = new Map<string, { cost: number; tokensIn: number; tokensOut: number }>();
    const byIntent = new Map<string, number>();
    const expensive: Array<{ query: string; cost: number; model: string | null }> = [];

    for (const r of rows ?? []) {
      const cost = Number(r.estimated_cost ?? 0);
      const day = (r.created_at as string).slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + cost);
      const week = isoWeek(new Date(r.created_at as string));
      byWeek.set(week, (byWeek.get(week) ?? 0) + cost);
      const m = r.model_used ?? "unknown";
      const cur = byModel.get(m) ?? { cost: 0, tokensIn: 0, tokensOut: 0 };
      cur.cost += cost;
      cur.tokensIn += Number(r.tokens_input ?? 0);
      cur.tokensOut += Number(r.tokens_output ?? 0);
      byModel.set(m, cur);
      if (r.detected_intent) {
        byIntent.set(r.detected_intent, (byIntent.get(r.detected_intent) ?? 0) + cost);
      }
      if (cost > 0 && r.raw_query) {
        expensive.push({ query: r.raw_query, cost, model: r.model_used ?? null });
      }
    }
    const fmt = (m: Map<string, number>) =>
      [...m.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([k, v]) => ({ key: k, value: Number(v.toFixed(4)) }));

    return {
      byDay: fmt(byDay),
      byWeek: fmt(byWeek),
      byModel: [...byModel.entries()].map(([model, v]) => ({
        model,
        cost: Number(v.cost.toFixed(4)),
        tokensIn: v.tokensIn,
        tokensOut: v.tokensOut,
      })),
      byIntent: [...byIntent.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([intent, cost]) => ({ intent, cost: Number(cost.toFixed(4)) })),
      mostExpensive: expensive
        .sort((a, b) => b.cost - a.cost)
        .slice(0, 20)
        .map((e) => ({ ...e, cost: Number(e.cost.toFixed(6)) })),
    };
  });

function isoWeek(d: Date): string {
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const diff = target.getTime() - firstThursday.getTime();
  const week = 1 + Math.round(diff / (7 * 24 * 60 * 60 * 1000));
  return `${target.getFullYear()}-W${String(week).padStart(2, "0")}`;
}
