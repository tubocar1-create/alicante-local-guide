// Supabase Auth "Send Email Hook" (HTTP) — renders branded emails via Resend.
// Configure in: Supabase Dashboard → Authentication → Hooks → Send Email Hook (HTTP)
//   URL:    https://vamosalicante.com/api/public/auth-email-hook
//   Secret: store value as env var SUPABASE_AUTH_HOOK_SECRET (format: v1,whsec_<base64>)
//
// When configured, Supabase delegates ALL auth emails (signup confirmation,
// password recovery, magic link, email change) to this endpoint instead of
// sending its default templates.

import { createFileRoute } from "@tanstack/react-router";
import {
  emailVerificationEmail,
  magicLinkEmail,
  passwordRecoveryEmail,
} from "@/lib/email/templates.server";
import { sendEmail } from "@/lib/email/send.server";

// Standard Webhooks signature verification (used by Supabase auth hooks).
async function verifySignature(body: string, headers: Headers, secret: string): Promise<boolean> {
  const id = headers.get("webhook-id");
  const ts = headers.get("webhook-timestamp");
  const sig = headers.get("webhook-signature");
  if (!id || !ts || !sig) return false;

  // Secret is "v1,<base64key>"
  const raw = secret.startsWith("v1,") ? secret.slice(3) : secret;
  const keyBytes = Uint8Array.from(atob(raw.replace(/^whsec_/, "")), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const data = new TextEncoder().encode(`${id}.${ts}.${body}`);
  const signed = await crypto.subtle.sign("HMAC", key, data);
  const expected = btoa(String.fromCharCode(...new Uint8Array(signed)));
  // signature header is "v1,<b64> v1,<b64>..." — accept any match
  return sig.split(" ").some((s) => s.replace(/^v1,/, "") === expected);
}

type HookPayload = {
  user: { email: string };
  email_data: {
    token_hash: string;
    redirect_to: string;
    email_action_type:
      | "signup"
      | "login"
      | "invite"
      | "magiclink"
      | "recovery"
      | "email_change"
      | "email_change_new"
      | "email_change_current";
    site_url: string;
    token_new?: string;
  };
};

export const Route = createFileRoute("/api/public/auth-email-hook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.SUPABASE_AUTH_HOOK_SECRET;
        if (!secret) {
          console.error("SUPABASE_AUTH_HOOK_SECRET not configured");
          return new Response("Server not configured", { status: 500 });
        }
        const body = await request.text();
        const ok = await verifySignature(body, request.headers, secret).catch(() => false);
        if (!ok) return new Response("Invalid signature", { status: 401 });

        let payload: HookPayload;
        try {
          payload = JSON.parse(body);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const { user, email_data } = payload;
        const actionUrl =
          `${email_data.site_url}/auth/v1/verify` +
          `?token=${encodeURIComponent(email_data.token_hash)}` +
          `&type=${encodeURIComponent(email_data.email_action_type)}` +
          `&redirect_to=${encodeURIComponent(email_data.redirect_to)}`;

        let tpl: { subject: string; html: string };
        switch (email_data.email_action_type) {
          case "recovery":
            tpl = passwordRecoveryEmail({ actionUrl });
            break;
          case "magiclink":
          case "login":
            tpl = magicLinkEmail({ actionUrl });
            break;
          case "signup":
          case "invite":
          case "email_change":
          case "email_change_new":
          case "email_change_current":
          default:
            tpl = emailVerificationEmail({ actionUrl });
            break;
        }

        try {
          await sendEmail({ to: user.email, subject: tpl.subject, html: tpl.html });
        } catch (err) {
          console.error("auth-email-hook send failed", err);
          return Response.json({ error: { http_code: 502, message: "Email send failed" } }, { status: 502 });
        }
        return Response.json({});
      },
    },
  },
});
