// Resend sender via Lovable connector gateway. Server-only.

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

export const FROM_ADDRESS = "Vamos Alicante <soporte@vamosalicante.com>";
export const REPLY_TO = "supportvamos@gmail.com";
export const ADMIN_NOTIFICATIONS_TO = "supportvamos@gmail.com";

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
  from?: string;
};

export async function sendEmail(input: SendEmailInput): Promise<{ id?: string }> {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured");

  const res = await fetch(`${GATEWAY_URL}/emails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": RESEND_API_KEY,
    },
    body: JSON.stringify({
      from: input.from ?? FROM_ADDRESS,
      to: Array.isArray(input.to) ? input.to : [input.to],
      subject: input.subject,
      html: input.html,
      reply_to: input.replyTo ?? REPLY_TO,
    }),
  });

  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Resend send failed [${res.status}]: ${JSON.stringify(data)}`);
  }
  return { id: data?.id };
}
