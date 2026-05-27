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
    const { data: supervisionRow, error: getErr } = await supabaseAdmin
      .from("agente_admin_supervisions")
      .select("id,raw_query,normalized,suggested_keywords,unknown_query_id")
      .eq("id", data.id)
      .single();
    if (getErr || !supervisionRow) throw new Error(getErr?.message ?? "Supervisión no encontrada");

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

    // Si se aprueba y se asigna a un intent, fusionar las keywords
    // sugeridas como alias del intent destino (sin duplicados).
    if (data.status === "approved" && data.final_intent) {
      const fallbackKeywords = [
        ...(((supervisionRow.suggested_keywords as string[] | null) ?? [])),
        (supervisionRow.normalized as string | null) ?? "",
        (supervisionRow.raw_query as string | null) ?? "",
      ];
      const trainingKeywords = (data.final_keywords?.length ? data.final_keywords : fallbackKeywords)
        .map((k) => k.toLowerCase().trim())
        .filter(Boolean);

      const { data: intent, error: intentErr } = await supabaseAdmin
        .from("agente_intents")
        .select("id,keywords")
        .eq("key", data.final_intent)
        .maybeSingle();
      if (intentErr) throw new Error(intentErr.message);
      if (!intent) throw new Error(`Intent destino no encontrado: ${data.final_intent}`);

      if (intent) {
        const current = (intent.keywords as string[] | null) ?? [];
        const merged = Array.from(
          new Set([
            ...current,
            ...trainingKeywords,
          ]),
        );
        const { error: updateIntentErr } = await supabaseAdmin
          .from("agente_intents")
          .update({ keywords: merged })
          .eq("id", intent.id);
        if (updateIntentErr) throw new Error(updateIntentErr.message);
      }
    }
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

// ---------------- Dubious resolutions ----------------
// Lista interacciones del log donde resolved=false o fallback_used=true,
// para que el admin pueda revisarlas, anotarlas y/o promoverlas a supervisión.

export type DubiousRow = {
  id: string;
  raw_query: string;
  normalized: string | null;
  detected_intent: string | null;
  resolver_type: string | null;
  resolved: boolean | null;
  fallback_used: boolean | null;
  failure_reason: string | null;
  route_origin: string | null;
  latency_ms: number | null;
  created_at: string;
  reviewed_at: string | null;
  review_status: string | null;
  review_note: string | null;
};

export const listDubiousInteractions = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    PinSchema.extend({
      status: z.enum(["pending", "reviewed", "all"]).default("pending"),
      kind: z.enum(["all", "unresolved", "fallback", "low_confidence"]).default("all"),
      search: z.string().max(200).optional(),
      limit: z.number().int().min(1).max(500).default(200),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    assertPin(data.pin);
    let q = supabaseAdmin
      .from("agente_learning_log")
      .select(
        "id,raw_query,normalized,detected_intent,resolver_type,resolved,fallback_used,failure_reason,route_origin,latency_ms,created_at,reviewed_at,review_status,review_note",
      )
      .or("resolved.is.false,fallback_used.is.true")
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (data.status === "pending") q = q.is("reviewed_at", null);
    if (data.status === "reviewed") q = q.not("reviewed_at", "is", null);
    if (data.kind === "unresolved") q = q.is("resolved", false);
    if (data.kind === "fallback") q = q.eq("fallback_used", true);
    if (data.kind === "low_confidence") q = q.eq("failure_reason", "LOW_CONFIDENCE");
    if (data.search && data.search.trim()) {
      q = q.ilike("raw_query", `%${data.search.trim()}%`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: (rows ?? []) as DubiousRow[] };
  });

export const reviewDubiousInteraction = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    PinSchema.extend({
      id: z.string().uuid(),
      status: z.enum([
        "ok",                 // está bien, marcado como revisado
        "misrouted",          // mal enrutada
        "missing_intent",     // falta intent / falta keyword
        "needs_faq",          // debería responder con FAQ
        "spam",
        "ignore",
      ]),
      note: z.string().max(2000).optional(),
      promote_to_supervision: z.boolean().default(false),
      suggested_intent: z.string().max(80).optional(),
      suggested_keywords: z.array(z.string()).max(50).default([]),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    assertPin(data.pin);

    // 1) marcar la fila como revisada en el log
    const { data: row, error: getErr } = await supabaseAdmin
      .from("agente_learning_log")
      .select("id,raw_query,normalized")
      .eq("id", data.id)
      .single();
    if (getErr || !row) throw new Error(getErr?.message ?? "Not found");

    const { error: updErr } = await supabaseAdmin
      .from("agente_learning_log")
      .update({
        reviewed_at: new Date().toISOString(),
        review_status: data.status,
        review_note: data.note ?? null,
      })
      .eq("id", data.id);
    if (updErr) throw new Error(updErr.message);

    // 2) opcional: crear item de supervisión para entrenar el agente
    if (data.promote_to_supervision) {
      const { error: supErr } = await supabaseAdmin
        .from("agente_admin_supervisions")
        .insert({
          source: "manual_review",
          learning_log_id: data.id,
          raw_query: row.raw_query as string,
          normalized: (row.normalized as string) ?? (row.raw_query as string).toLowerCase(),
          suggested_intent: data.suggested_intent ?? null,
          suggested_keywords: data.suggested_keywords ?? [],
          status: "pending",
          reason: data.status,
          admin_notes: data.note ?? null,
        });
      if (supErr) throw new Error(supErr.message);
    }

    return { ok: true as const };
  });

// ---------------- Doctrine audit (per turn) ----------------
// Guarda la auditoría de un turno contra los 5 criterios de la doctrina
// + la fase detectada (1..4) + veredicto global. Es SOLO análisis: no
// modifica intents/keywords. Para aplicar correcciones se usa
// quickResolveDubious.

const CriteriaScore = z.enum(["ok", "warn", "bad", "na"]);
const CriteriaSchema = z.object({
  philosophy: CriteriaScore,
  intent: CriteriaScore,
  context: CriteriaScore,
  route: CriteriaScore,
  endpoint: CriteriaScore,
});
export type AuditCriteria = z.infer<typeof CriteriaSchema>;

export const saveAuditVerdict = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    PinSchema.extend({
      id: z.string().uuid(),
      phase: z.number().int().min(1).max(4),
      criteria: CriteriaSchema,
      verdict: z.enum(["ok", "adjust", "critical"]),
      note: z.string().max(2000).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    assertPin(data.pin);
    const { error } = await supabaseAdmin
      .from("agente_learning_log")
      .update({
        audit_phase: data.phase,
        audit_criteria: data.criteria,
        audit_verdict: data.verdict,
        audit_note: data.note ?? null,
        audited_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ---------------- Conversations (turn-by-turn replay) ----------------
// Agrupa las filas de agente_learning_log en "conversaciones":
//  - Si dos filas comparten session_id  → misma conversación.
//  - Si no hay session_id              → se agrupan por route_origin con
//    una ventana temporal (gap > 5 min ⇒ nueva conversación).
// Pensado para que el admin pueda ver la secuencia exacta de preguntas /
// respuestas y corregir justo el turno donde el agente falló.

export type ConversationTurn = {
  id: string;
  created_at: string;
  raw_query: string;
  detected_intent: string | null;
  resolver_type: string | null;
  resolved: boolean | null;
  fallback_used: boolean | null;
  failure_reason: string | null;
  latency_ms: number | null;
  decision: string | null;
  route_origin: string | null;
  notes: string | null;
  reviewed_at: string | null;
  review_status: string | null;
  review_note: string | null;
  audit_phase: number | null;
  audit_verdict: string | null;
  audit_note: string | null;
  audited_at: string | null;
  gap_ms: number | null; // ms desde el turno anterior (null en el primero)
  model_used: string | null;
  reply_text: string | null;
};

export type ConversationDTO = {
  key: string;                // session_id real o sintético
  session_id: string | null;  // null si fue sintética
  started_at: string;
  ended_at: string;
  route_origin: string | null;
  total_turns: number;
  unresolved_turns: number;
  fallback_turns: number;
  total_latency_ms: number;
  total_cost: number;
  turns: ConversationTurn[];
};

export const listAgentConversations = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    PinSchema.extend({
      days: z.number().int().min(1).max(30).default(7),
      limit_rows: z.number().int().min(50).max(2000).default(800),
      only_with_issues: z.boolean().default(false),
    }).parse(d),
  )
  .handler(async ({ data }): Promise<{ conversations: ConversationDTO[] }> => {
    assertPin(data.pin);
    const since = new Date(
      Date.now() - data.days * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { data: rows, error } = await supabaseAdmin
      .from("agente_learning_log")
      .select(
        "id,created_at,session_id,raw_query,detected_intent,resolver_type,resolved,fallback_used,failure_reason,latency_ms,decision,route_origin,notes,model_used,estimated_cost,reviewed_at,review_status,review_note,audit_phase,audit_verdict,audit_note,audited_at",
      )
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(data.limit_rows);
    if (error) throw new Error(error.message);

    const GAP_MS = 5 * 60 * 1000;
    // Map<groupKey, ConversationDTO>
    const groups = new Map<string, ConversationDTO>();
    // Para clustering temporal cuando session_id es null: trackeamos
    // el último timestamp visto por (route_origin || "__no_route__").
    const lastByRoute = new Map<
      string,
      { key: string; lastTs: number }
    >();
    let syntheticCounter = 0;

    for (const r of rows ?? []) {
      const createdAt = new Date(r.created_at as string).getTime();
      const sid = (r.session_id as string | null) ?? null;
      const route = (r.route_origin as string | null) ?? null;

      let key: string;
      if (sid) {
        key = `sid:${sid}`;
      } else {
        const bucket = route ?? "__no_route__";
        const prev = lastByRoute.get(bucket);
        if (prev && createdAt - prev.lastTs <= GAP_MS) {
          key = prev.key;
        } else {
          syntheticCounter += 1;
          key = `syn:${bucket}:${syntheticCounter}`;
        }
        lastByRoute.set(bucket, { key, lastTs: createdAt });
      }

      let convo = groups.get(key);
      if (!convo) {
        convo = {
          key,
          session_id: sid,
          started_at: r.created_at as string,
          ended_at: r.created_at as string,
          route_origin: route,
          total_turns: 0,
          unresolved_turns: 0,
          fallback_turns: 0,
          total_latency_ms: 0,
          total_cost: 0,
          turns: [],
        };
        groups.set(key, convo);
      }

      const prevTurn = convo.turns[convo.turns.length - 1];
      const gapMs = prevTurn
        ? createdAt - new Date(prevTurn.created_at).getTime()
        : null;

      convo.turns.push({
        id: r.id as string,
        created_at: r.created_at as string,
        raw_query: (r.raw_query as string) ?? "",
        detected_intent: (r.detected_intent as string | null) ?? null,
        resolver_type: (r.resolver_type as string | null) ?? null,
        resolved: (r.resolved as boolean | null) ?? null,
        fallback_used: (r.fallback_used as boolean | null) ?? null,
        failure_reason: (r.failure_reason as string | null) ?? null,
        latency_ms: (r.latency_ms as number | null) ?? null,
        decision: (r.decision as string | null) ?? null,
        route_origin: route,
        notes: (r.notes as string | null) ?? null,
        reviewed_at: (r.reviewed_at as string | null) ?? null,
        review_status: (r.review_status as string | null) ?? null,
        review_note: (r.review_note as string | null) ?? null,
        audit_phase: (r.audit_phase as number | null) ?? null,
        audit_verdict: (r.audit_verdict as string | null) ?? null,
        audit_note: (r.audit_note as string | null) ?? null,
        audited_at: (r.audited_at as string | null) ?? null,
        gap_ms: gapMs,
      });
      convo.total_turns += 1;
      if (r.resolved === false) convo.unresolved_turns += 1;
      if (r.fallback_used === true) convo.fallback_turns += 1;
      convo.total_latency_ms += Number(r.latency_ms ?? 0);
      convo.total_cost += Number(r.estimated_cost ?? 0);
      convo.ended_at = r.created_at as string;
    }

    let conversations = [...groups.values()];
    if (data.only_with_issues) {
      conversations = conversations.filter(
        (c) => c.unresolved_turns > 0 || c.fallback_turns > 0,
      );
    }
    // Más reciente primero, por ended_at.
    conversations.sort((a, b) => (a.ended_at < b.ended_at ? 1 : -1));
    // Redondeo de coste
    conversations.forEach((c) => {
      c.total_cost = Number(c.total_cost.toFixed(4));
    });

    return { conversations };
  });

// ---------------- Quick resolve (in-panel fix) ----------------
// Permite resolver la incidencia directamente desde el panel:
//  - add_keyword     → añade keyword(s) a un intent existente
//  - create_intent   → crea un nuevo intent (key/label/route/keywords/spoken_reply)
//  - add_faq         → crea una FAQ
//  - add_alias       → añade alias a un proper_noun (entidad)
// Además marca la fila del log como revisada con review_status="resolved_in_panel".

export const quickResolveDubious = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    PinSchema.extend({
      id: z.string().uuid(),
      action: z.enum(["add_keyword", "create_intent", "add_faq", "add_alias"]),
      // add_keyword / add_alias
      target_key: z.string().max(120).optional(),
      keywords: z.array(z.string().min(1).max(120)).max(20).default([]),
      // create_intent
      intent_key: z.string().max(80).optional(),
      intent_label: z.string().max(160).optional(),
      intent_route: z.string().max(200).optional(),
      intent_spoken_reply: z.string().max(500).optional(),
      // add_faq
      faq_response: z.string().max(2000).optional(),
      note: z.string().max(1000).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    assertPin(data.pin);

    const { data: row, error: getErr } = await supabaseAdmin
      .from("agente_learning_log")
      .select("id,raw_query,normalized")
      .eq("id", data.id)
      .single();
    if (getErr || !row) throw new Error(getErr?.message ?? "Not found");

    const baseKeyword =
      ((row.normalized as string | null) ?? (row.raw_query as string) ?? "")
        .trim()
        .toLowerCase();
    const kws = Array.from(
      new Set(
        [baseKeyword, ...data.keywords]
          .map((k) => k.trim().toLowerCase())
          .filter(Boolean),
      ),
    );

    let summary = "";

    if (data.action === "add_keyword") {
      if (!data.target_key) throw new Error("Falta intent destino");
      const { data: existing, error: e1 } = await supabaseAdmin
        .from("agente_intents")
        .select("id,keywords")
        .eq("key", data.target_key)
        .single();
      if (e1 || !existing) throw new Error(e1?.message ?? "Intent no existe");
      const merged = Array.from(
        new Set([...(existing.keywords as string[] ?? []), ...kws]),
      );
      const { error: e2 } = await supabaseAdmin
        .from("agente_intents")
        .update({ keywords: merged })
        .eq("id", existing.id);
      if (e2) throw new Error(e2.message);
      summary = `Keywords añadidas a "${data.target_key}"`;
    } else if (data.action === "create_intent") {
      if (!data.intent_key || !data.intent_label || !data.intent_spoken_reply) {
        throw new Error("key, label y respuesta son obligatorios");
      }
      const { error } = await supabaseAdmin.from("agente_intents").insert({
        key: data.intent_key,
        label: data.intent_label,
        route: data.intent_route ?? null,
        keywords: kws,
        spoken_reply: data.intent_spoken_reply,
        priority: 100,
        active: true,
      });
      if (error) throw new Error(error.message);
      summary = `Intent "${data.intent_key}" creado`;
    } else if (data.action === "add_faq") {
      if (!data.faq_response) throw new Error("Falta la respuesta de la FAQ");
      const { error } = await supabaseAdmin.from("agente_faqs").insert({
        response: data.faq_response,
        keywords: kws,
        any_of: [],
        priority: 100,
        active: true,
      });
      if (error) throw new Error(error.message);
      summary = "FAQ creada";
    } else if (data.action === "add_alias") {
      if (!data.target_key) throw new Error("Falta entidad destino");
      const { data: existing, error: e1 } = await supabaseAdmin
        .from("agente_proper_nouns")
        .select("id,aliases")
        .eq("normalized", data.target_key)
        .maybeSingle();
      if (e1) throw new Error(e1.message);
      if (!existing) throw new Error("Entidad no encontrada");
      const merged = Array.from(
        new Set([...(existing.aliases as string[] ?? []), ...kws]),
      );
      const { error: e2 } = await supabaseAdmin
        .from("agente_proper_nouns")
        .update({ aliases: merged })
        .eq("id", existing.id);
      if (e2) throw new Error(e2.message);
      summary = `Alias añadidos a "${data.target_key}"`;
    }

    await supabaseAdmin
      .from("agente_learning_log")
      .update({
        reviewed_at: new Date().toISOString(),
        review_status: "resolved_in_panel",
        review_note: data.note ? `${summary} — ${data.note}` : summary,
      })
      .eq("id", data.id);

    return { ok: true as const, summary };
  });

// ---------------- Delete conversation ----------------
// Descarta una conversación completa: borra los turnos indicados del log
// de aprendizaje del agente. El cliente pasa los ids visibles en el panel
// (ConversationDTO.turns[].id).

export const deleteConversationTurns = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    PinSchema.extend({
      ids: z.array(z.string().uuid()).min(1).max(500),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    assertPin(data.pin);
    const { error } = await supabaseAdmin
      .from("agente_learning_log")
      .delete()
      .in("id", data.ids);
    if (error) throw new Error(error.message);
    return { ok: true as const, deleted: data.ids.length };
  });

