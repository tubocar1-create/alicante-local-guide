// Server functions for sending app emails via Resend.
// Authenticated callers only (booking confirmations, welcome retrigger, etc.).
// Public contact form uses the /api/public/contact server route instead.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  ADMIN_NOTIFICATIONS_TO,
  sendEmail,
} from "./send.server";
import {
  adminNotificationEmail,
  bookingConfirmationEmail,
  welcomeEmail,
} from "./templates.server";

const emailSchema = z.string().trim().toLowerCase().email().max(254);

// ── Welcome email (called after email verification, client side) ───────────
export const sendWelcomeEmailFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { name?: string }) =>
    z.object({ name: z.string().trim().max(80).optional() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const userEmail = (context as any).claims?.email as string | undefined;
    if (!userEmail) throw new Error("No email on session");
    const tpl = welcomeEmail({ name: data.name });
    await sendEmail({ to: userEmail, subject: tpl.subject, html: tpl.html });
    return { ok: true };
  });

// ── Booking confirmation ──────────────────────────────────────────────────
export const sendBookingConfirmationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    to: string;
    name?: string;
    title: string;
    details: Array<[string, string]>;
    ctaLabel?: string;
    ctaUrl?: string;
  }) =>
    z
      .object({
        to: emailSchema,
        name: z.string().trim().max(80).optional(),
        title: z.string().trim().min(1).max(120),
        details: z.array(z.tuple([z.string().max(60), z.string().max(200)])).max(20),
        ctaLabel: z.string().max(40).optional(),
        ctaUrl: z.string().url().max(500).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const tpl = bookingConfirmationEmail(data);
    await sendEmail({ to: data.to, subject: tpl.subject, html: tpl.html });
    // Mirror to admin
    const admin = adminNotificationEmail({
      subject: `Nueva confirmación: ${data.title}`,
      lines: [["Cliente", data.to], ["Título", data.title], ...data.details],
    });
    await sendEmail({ to: ADMIN_NOTIFICATIONS_TO, subject: admin.subject, html: admin.html });
    return { ok: true };
  });

// ── Generic admin notification (admin-only) ───────────────────────────────
export const sendAdminNotificationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { subject: string; lines?: Array<[string, string]>; body?: string }) =>
    z
      .object({
        subject: z.string().trim().min(1).max(160),
        lines: z.array(z.tuple([z.string().max(60), z.string().max(300)])).max(30).optional(),
        body: z.string().max(4000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    // Only admins may send arbitrary admin pings
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Response("Forbidden", { status: 403 });

    const tpl = adminNotificationEmail({
      subject: data.subject,
      lines: data.lines ?? [],
      body: data.body,
    });
    await sendEmail({ to: ADMIN_NOTIFICATIONS_TO, subject: tpl.subject, html: tpl.html });
    return { ok: true };
  });
