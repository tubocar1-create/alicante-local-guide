// Server functions para las páginas /admin/consumo-ia y /admin/consumo-google.
// Leen agregados de external_api_calls (solo admins).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RangeSchema = z.object({
  hours: z.number().int().min(1).max(24 * 90).default(24),
  provider: z
    .enum([
      "lovable_ai",
      "google_places",
      "google_maps",
      "google_geocoding",
      "google_directions",
    ])
    .optional(),
});

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("No autorizado");
}

export const getConsumptionSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => RangeSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const since = new Date(Date.now() - data.hours * 3600_000).toISOString();
    const q = supabaseAdmin
      .from("external_api_calls")
      .select(
        "provider,endpoint,caller,model,status_code,latency_ms,tokens_input,tokens_output,estimated_cost,created_at",
      )
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5000);
    if (data.provider) q.eq("provider", data.provider);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const list = rows ?? [];
    const totals = {
      calls: list.length,
      tokensIn: 0,
      tokensOut: 0,
      cost: 0,
      errors: 0,
      avgLatency: 0,
    };
    const byCaller = new Map<string, { calls: number; cost: number; tokensIn: number; tokensOut: number }>();
    const byModelOrEndpoint = new Map<string, { calls: number; cost: number; tokensIn: number; tokensOut: number }>();
    const byHour = new Map<string, { calls: number; cost: number }>();
    let totalLatency = 0;
    let latencyCount = 0;

    for (const r of list) {
      totals.tokensIn += r.tokens_input ?? 0;
      totals.tokensOut += r.tokens_output ?? 0;
      totals.cost += Number(r.estimated_cost ?? 0);
      if (r.status_code && r.status_code >= 400) totals.errors += 1;
      if (r.latency_ms != null) {
        totalLatency += r.latency_ms;
        latencyCount += 1;
      }

      const c = byCaller.get(r.caller) ?? { calls: 0, cost: 0, tokensIn: 0, tokensOut: 0 };
      c.calls += 1;
      c.cost += Number(r.estimated_cost ?? 0);
      c.tokensIn += r.tokens_input ?? 0;
      c.tokensOut += r.tokens_output ?? 0;
      byCaller.set(r.caller, c);

      const key = r.provider === "lovable_ai" ? (r.model ?? "—") : r.endpoint;
      const m = byModelOrEndpoint.get(key) ?? { calls: 0, cost: 0, tokensIn: 0, tokensOut: 0 };
      m.calls += 1;
      m.cost += Number(r.estimated_cost ?? 0);
      m.tokensIn += r.tokens_input ?? 0;
      m.tokensOut += r.tokens_output ?? 0;
      byModelOrEndpoint.set(key, m);

      const hk = r.created_at.slice(0, 13) + ":00";
      const h = byHour.get(hk) ?? { calls: 0, cost: 0 };
      h.calls += 1;
      h.cost += Number(r.estimated_cost ?? 0);
      byHour.set(hk, h);
    }
    totals.avgLatency = latencyCount ? Math.round(totalLatency / latencyCount) : 0;

    return {
      totals,
      byCaller: [...byCaller.entries()]
        .map(([caller, v]) => ({ caller, ...v }))
        .sort((a, b) => b.calls - a.calls),
      byModelOrEndpoint: [...byModelOrEndpoint.entries()]
        .map(([key, v]) => ({ key, ...v }))
        .sort((a, b) => b.calls - a.calls),
      byHour: [...byHour.entries()]
        .map(([hour, v]) => ({ hour, ...v }))
        .sort((a, b) => a.hour.localeCompare(b.hour)),
      recent: list.slice(0, 100),
    };
  });
