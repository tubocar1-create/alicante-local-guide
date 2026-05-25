// HTML email templates for Vamos Alicante. Modern, responsive, brand-aligned.
// Server-only: imported by email.functions.ts / auth-hook server route.

const BRAND = {
  name: "Vamos Alicante",
  url: "https://vamosalicante.com",
  primary: "#0EA5E9", // azul celeste
  primaryDark: "#0369A1",
  accent: "#F59E0B",
  text: "#0F172A",
  muted: "#64748B",
  bg: "#F8FAFC",
};

function layout(title: string, inner: string, preheader = ""): string {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>${escape(title)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${BRAND.text};">
<span style="display:none!important;opacity:0;color:transparent;height:0;width:0;overflow:hidden">${escape(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.bg};padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(15,23,42,0.06);">
      <tr><td style="background:linear-gradient(135deg,${BRAND.primary},${BRAND.primaryDark});padding:28px 32px;">
        <div style="font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.02em;">${BRAND.name}</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.85);margin-top:2px;">Tu guía local en Alicante</div>
      </td></tr>
      <tr><td style="padding:32px;">${inner}</td></tr>
      <tr><td style="padding:20px 32px 28px;border-top:1px solid #E2E8F0;background:#F8FAFC;">
        <div style="font-size:12px;color:${BRAND.muted};line-height:1.6;">
          <a href="${BRAND.url}" style="color:${BRAND.primaryDark};text-decoration:none;font-weight:600;">vamosalicante.com</a> · Alicante, España<br>
          ¿Dudas? Escríbenos a <a href="mailto:supportvamos@gmail.com" style="color:${BRAND.primaryDark};">supportvamos@gmail.com</a>
        </div>
      </td></tr>
    </table>
    <div style="font-size:11px;color:#94A3B8;margin-top:14px;max-width:560px;">© ${new Date().getFullYear()} ${BRAND.name}. Recibes este correo porque interactuaste con nuestra app.</div>
  </td></tr>
</table>
</body></html>`;
}

function btn(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;"><tr><td style="border-radius:999px;background:${BRAND.primary};">
  <a href="${href}" style="display:inline-block;padding:14px 28px;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;border-radius:999px;">${escape(label)}</a>
  </td></tr></table>`;
}

function escape(s: string): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function h1(text: string) {
  return `<h1 style="margin:0 0 12px;font-size:24px;font-weight:800;letter-spacing:-0.02em;color:${BRAND.text};">${escape(text)}</h1>`;
}
function p(text: string) {
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${BRAND.text};">${text}</p>`;
}

// ───────────────────────── Templates ─────────────────────────

export function welcomeEmail(opts: { name?: string }) {
  const name = opts.name?.trim() || "viajero";
  return {
    subject: `¡Bienvenido a ${BRAND.name}, ${name}! 🌊`,
    html: layout(
      "Bienvenido",
      h1(`¡Bienvenido, ${escape(name)}!`) +
        p(`Gracias por unirte a <strong>${BRAND.name}</strong>. Ya puedes explorar playas, vuelos, tranvía, ocio, restaurantes y todo lo que ofrece la ciudad — con un guía local en el bolsillo.`) +
        p(`Empieza preguntando cualquier cosa al asistente: "¿qué playa visito hoy?", "vuelos a Madrid", "cines esta noche"…`) +
        btn("Abrir la app", BRAND.url),
      "Tu guía local en Alicante te espera.",
    ),
  };
}

export function contactConfirmationEmail(opts: { name?: string; message: string }) {
  const name = opts.name?.trim() || "";
  return {
    subject: `Hemos recibido tu mensaje · ${BRAND.name}`,
    html: layout(
      "Mensaje recibido",
      h1(name ? `Gracias, ${escape(name)}` : "Gracias por escribirnos") +
        p(`Hemos recibido tu mensaje y te responderemos lo antes posible (normalmente en 24-48h).`) +
        `<div style="background:${BRAND.bg};border-left:3px solid ${BRAND.primary};padding:12px 14px;border-radius:8px;margin:18px 0;font-size:14px;color:${BRAND.muted};white-space:pre-wrap;">${escape(opts.message)}</div>` +
        p(`Un saludo,<br>El equipo de ${BRAND.name}`),
      "Confirmamos la recepción de tu mensaje.",
    ),
  };
}

export function adminNotificationEmail(opts: { subject: string; lines: Array<[string, string]>; body?: string }) {
  const rows = opts.lines
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 12px;font-size:13px;color:${BRAND.muted};border-bottom:1px solid #E2E8F0;width:140px;">${escape(k)}</td><td style="padding:8px 12px;font-size:14px;color:${BRAND.text};border-bottom:1px solid #E2E8F0;">${escape(v)}</td></tr>`,
    )
    .join("");
  return {
    subject: `[Admin] ${opts.subject}`,
    html: layout(
      opts.subject,
      h1(opts.subject) +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border:1px solid #E2E8F0;border-radius:8px;overflow:hidden;margin:8px 0 16px;">${rows}</table>` +
        (opts.body ? `<div style="font-size:14px;color:${BRAND.text};white-space:pre-wrap;background:${BRAND.bg};padding:12px 14px;border-radius:8px;">${escape(opts.body)}</div>` : ""),
      `Notificación interna: ${opts.subject}`,
    ),
  };
}

export function bookingConfirmationEmail(opts: {
  name?: string;
  title: string;
  details: Array<[string, string]>;
  ctaLabel?: string;
  ctaUrl?: string;
}) {
  const rows = opts.details
    .map(
      ([k, v]) =>
        `<tr><td style="padding:10px 14px;font-size:13px;color:${BRAND.muted};border-bottom:1px solid #E2E8F0;width:160px;">${escape(k)}</td><td style="padding:10px 14px;font-size:14px;color:${BRAND.text};border-bottom:1px solid #E2E8F0;font-weight:600;">${escape(v)}</td></tr>`,
    )
    .join("");
  return {
    subject: `Confirmación · ${opts.title}`,
    html: layout(
      "Confirmación",
      h1(`¡Confirmado${opts.name ? `, ${escape(opts.name)}` : ""}!`) +
        p(`Tu reserva en <strong>${escape(opts.title)}</strong> está confirmada. Guarda este correo como referencia.`) +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border:1px solid #E2E8F0;border-radius:10px;overflow:hidden;margin:12px 0 4px;">${rows}</table>` +
        (opts.ctaUrl ? btn(opts.ctaLabel || "Ver detalles", opts.ctaUrl) : "") +
        p(`Si necesitas modificar o cancelar, responde a este correo.`),
      `Tu confirmación de ${opts.title}.`,
    ),
  };
}

export function passwordRecoveryEmail(opts: { actionUrl: string }) {
  return {
    subject: `Restablece tu contraseña · ${BRAND.name}`,
    html: layout(
      "Restablece tu contraseña",
      h1("Restablece tu contraseña") +
        p("Hemos recibido una solicitud para restablecer la contraseña de tu cuenta. Haz clic en el botón para crear una nueva. El enlace caduca en 1 hora.") +
        btn("Crear nueva contraseña", opts.actionUrl) +
        p(`<span style="font-size:13px;color:${BRAND.muted};">Si no fuiste tú, ignora este correo — tu contraseña seguirá igual.</span>`),
      "Enlace para restablecer tu contraseña.",
    ),
  };
}

export function magicLinkEmail(opts: { actionUrl: string }) {
  return {
    subject: `Tu enlace de acceso · ${BRAND.name}`,
    html: layout(
      "Enlace de acceso",
      h1("Accede a tu cuenta") +
        p("Pulsa el botón para iniciar sesión. El enlace caduca en 1 hora y solo puede usarse una vez.") +
        btn("Iniciar sesión", opts.actionUrl),
      "Tu enlace de acceso a Vamos Alicante.",
    ),
  };
}

export function emailVerificationEmail(opts: { actionUrl: string }) {
  return {
    subject: `Confirma tu correo · ${BRAND.name}`,
    html: layout(
      "Confirma tu correo",
      h1("Solo un paso más") +
        p("Confirma tu dirección de email para activar tu cuenta y empezar a explorar Alicante con nosotros.") +
        btn("Confirmar email", opts.actionUrl),
      "Confirma tu email para activar la cuenta.",
    ),
  };
}
