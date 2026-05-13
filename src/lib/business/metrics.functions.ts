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

    const visitViewed = totals["visit_viewed"] ?? 0;
    const qrCreated = totals["qr_created"] ?? 0;
    const qrValidated = totals["qr_validated"] ?? 0;
    const bookings = totals["booking_created"] ?? 0;

    const conversion =
      visitViewed > 0 ? Math.round((qrValidated / visitViewed) * 100) : 0;
    const qrRedemption =
      qrCreated > 0 ? Math.round((qrValidated / qrCreated) * 100) : 0;

    return {
      totals,
      series,
      summary: {
        total: rows?.length ?? 0,
        visit_viewed: visitViewed,
        qr_created: qrCreated,
        qr_validated: qrValidated,
        bookings,
        referrals: totals["referral_created"] ?? 0,
        conversion_pct: conversion,
        qr_redemption_pct: qrRedemption,
      },
    };
  });
