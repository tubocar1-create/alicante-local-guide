// Public contact-form endpoint. No auth: anyone can submit.
// 1) Sends confirmation to the visitor (Resend)
// 2) Notifies admin (supportvamos@gmail.com)

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  ADMIN_NOTIFICATIONS_TO,
  sendEmail,
} from "@/lib/email/send.server";
import {
  adminNotificationEmail,
  contactConfirmationEmail,
} from "@/lib/email/templates.server";

const ContactSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email().max(254),
  subject: z.string().trim().min(1).max(160).optional(),
  message: z.string().trim().min(5).max(4000),
  // honeypot for bots
  website: z.string().max(0).optional(),
});

// In-memory rate limit (per Worker isolate). Best-effort, not for hard abuse.
const recent = new Map<string, number>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 3;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  // prune
  for (const [k, t] of recent) if (now - t > WINDOW_MS) recent.delete(k);
  let count = 0;
  for (const [k, t] of recent) if (k.startsWith(ip + "|") && now - t < WINDOW_MS) count++;
  if (count >= MAX_PER_WINDOW) return true;
  recent.set(`${ip}|${now}`, now);
  return false;
}

export const Route = createFileRoute("/api/public/contact")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        }),
      POST: async ({ request }) => {
        const ip =
          request.headers.get("cf-connecting-ip") ||
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          "unknown";

        if (rateLimited(ip)) {
          return Response.json({ error: "Too many requests" }, { status: 429 });
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }

        const parsed = ContactSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
        }
        const { name, email, subject, message, website } = parsed.data;
        if (website && website.length > 0) {
          // honeypot triggered, pretend success
          return Response.json({ ok: true });
        }

        try {
          const confirm = contactConfirmationEmail({ name, message });
          await sendEmail({
            to: email,
            subject: confirm.subject,
            html: confirm.html,
            replyTo: ADMIN_NOTIFICATIONS_TO,
          });

          const adminTpl = adminNotificationEmail({
            subject: subject || `Nuevo mensaje de contacto de ${name}`,
            lines: [
              ["Nombre", name],
              ["Email", email],
              ["IP", ip],
              ["Fecha", new Date().toISOString()],
            ],
            body: message,
          });
          await sendEmail({
            to: ADMIN_NOTIFICATIONS_TO,
            subject: adminTpl.subject,
            html: adminTpl.html,
            replyTo: email,
          });

          return Response.json({ ok: true });
        } catch (err) {
          console.error("contact email failed", err);
          return Response.json({ error: "Email service unavailable" }, { status: 502 });
        }
      },
    },
  },
});
