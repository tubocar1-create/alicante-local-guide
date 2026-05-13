import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

const emptyMetrics = (error?: string) => ({
  totals: {} as Record<string, number>,
  series: [] as Array<{ date: string; count: number }>,
  summary: {
    total: 0,
    visit_viewed: 0,
    qr_created: 0,
    qr_validated: 0,
    bookings: 0,
    referrals: 0,
    conversion_pct: 0,
    qr_redemption_pct: 0,
  },
  error,
});

export const getBusinessMetrics = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z
      .object({
        business_id: z.string().uuid(),
        days: z.number().int().min(1).max(90).default(7),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const PUBLISHABLE = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!SUPABASE_URL || !(SERVICE_ROLE || PUBLISHABLE)) {
      console.error("Business metrics unavailable: backend env is missing");
      return emptyMetrics("BACKEND_UNAVAILABLE");
    }

    const authHeader = getRequestHeader("authorization");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "")
      : null;

    // Use service role when available so open-mode (no session) dashboards work.
    const supabase = SERVICE_ROLE
      ? createClient<Database>(SUPABASE_URL, SERVICE_ROLE, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : createClient<Database>(SUPABASE_URL, PUBLISHABLE!, {
          global: token
            ? { headers: { Authorization: `Bearer ${token}` } }
            : undefined,
          auth: {
            storage: undefined,
            persistSession: false,
            autoRefreshToken: false,
          },
        });

    const since = new Date(
      Date.now() - data.days * 24 * 60 * 60 * 1000,
    ).toISOString();
    const { data: rows, error } = await supabase
      .from("interaction_events")
      .select("type, occurred_at, conversion_status")
      .eq("business_id", data.business_id)
      .gte("occurred_at", since)
      .order("occurred_at", { ascending: true });
    if (error) {
      console.error("Business metrics query failed:", error.message);
      return emptyMetrics("METRICS_UNAVAILABLE");
    }

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
