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
  // Disabled by user request: no automatic reload on version change.
  // This prevented "Parada favorita" real-time state from being preserved.
  return null;
}

