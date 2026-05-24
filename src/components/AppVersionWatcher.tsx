import { useEffect } from "react";
import { useAppAuth } from "@/hooks/useAppAuth";

// Silently reloads the page when a new deploy is detected.
// Strategy: each SSR response embeds <meta name="app-version" content="..."/>.
// On load (and on tab focus) we fetch "/" with no-cache, parse that meta,
// and if it differs from the version this tab was rendered with, we reload.
function getCurrentVersion(): string | null {
  if (typeof document === "undefined") return null;
  const el = document.querySelector('meta[name="app-version"]');
  return el?.getAttribute("content") ?? null;
}

async function fetchLatestVersion(signal?: AbortSignal): Promise<string | null> {
  try {
    const res = await fetch("/", {
      cache: "no-store",
      credentials: "same-origin",
      headers: { "cache-control": "no-cache" },
      signal,
    });
    if (!res.ok) return null;
    const html = await res.text();
    const m = html.match(/<meta\s+name=["']app-version["']\s+content=["']([^"']+)["']/i);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}

export function AppVersionWatcher() {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isAuthenticated) return;

    const current = getCurrentVersion();
    if (!current) return;

    let cancelled = false;
    const ctrl = new AbortController();

    const check = async () => {
      if (cancelled || document.visibilityState !== "visible") return;
      const latest = await fetchLatestVersion(ctrl.signal);
      if (cancelled || !latest) return;
      if (latest !== current) {
        // Reload silently to pick up the new bundle.
        window.location.reload();
      }
    };

    // Check shortly after load, then on visibility/focus changes.
    const t = window.setTimeout(check, 1500);
    const onVis = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);

    return () => {
      cancelled = true;
      ctrl.abort();
      window.clearTimeout(t);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, [isAuthenticated]);

  return null;
}
