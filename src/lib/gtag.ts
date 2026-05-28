// Helper para enviar eventos a Google Ads (gtag.js)
// El tag global AW-18186927022 se carga en src/routes/__root.tsx
const GA_ID = "AW-18186927022";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function trackEvent(eventName: string, params: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  try {
    window.gtag?.("event", eventName, { send_to: GA_ID, ...params });
  } catch {
    /* noop */
  }
}

export function trackPageView(pageName: string) {
  trackEvent("page_view_" + pageName, { page: pageName });
}
