// Consulta de créditos restantes de Firecrawl (cuenta del workspace).
import { createServerFn } from "@tanstack/react-start";

export type FirecrawlCreditsResult =
  | {
      ok: true;
      remaining: number;
      planCredits: number;
      periodStart: string;
      periodEnd: string;
      fetchedAt: number;
    }
  | { ok: false; error: string };

export const getFirecrawlCredits = createServerFn({ method: "GET" }).handler(
  async (): Promise<FirecrawlCreditsResult> => {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) return { ok: false, error: "FIRECRAWL_API_KEY no configurada" };
    try {
      const r = await fetch("https://api.firecrawl.dev/v1/team/credit-usage", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!r.ok) return { ok: false, error: `HTTP ${r.status}` };
      const j = (await r.json()) as {
        success?: boolean;
        data?: {
          remaining_credits?: number;
          plan_credits?: number;
          billing_period_start?: string;
          billing_period_end?: string;
        };
      };
      const d = j?.data;
      if (!j?.success || !d) return { ok: false, error: "Respuesta inválida" };
      return {
        ok: true,
        remaining: Number(d.remaining_credits ?? 0),
        planCredits: Number(d.plan_credits ?? 0),
        periodStart: String(d.billing_period_start ?? ""),
        periodEnd: String(d.billing_period_end ?? ""),
        fetchedAt: Date.now(),
      };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
);
