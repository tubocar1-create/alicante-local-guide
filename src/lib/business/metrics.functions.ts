import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getBusinessMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        business_id: z.string().uuid(),
        days: z.number().int().min(1).max(90).default(7),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const since = new Date(
      Date.now() - data.days * 24 * 60 * 60 * 1000,
    ).toISOString();
    const { data: rows, error } = await context.supabase
      .from("interaction_events")
      .select("type, occurred_at, conversion_status")
      .eq("business_id", data.business_id)
      .gte("occurred_at", since)
      .order("occurred_at", { ascending: true });
    if (error) throw new Error(error.message);

    const totals: Record<string, number> = {};
    const byDay: Record<string, number> = {};
    for (const r of rows ?? []) {
      totals[r.type] = (totals[r.type] ?? 0) + 1;
      const day = r.occurred_at.slice(0, 10);
      byDay[day] = (byDay[day] ?? 0) + 1;
    }
    const series = Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    return {
      totals,
      series,
      summary: {
        total: rows?.length ?? 0,
        visits: totals["qr_validated"] ?? 0,
        bookings: totals["booking_created"] ?? 0,
        referrals: totals["referral_created"] ?? 0,
        qr_created: totals["qr_created"] ?? 0,
      },
    };
  });
