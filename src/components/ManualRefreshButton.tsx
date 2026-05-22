import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

// Pequeño botón flotante para forzar la recarga de la app (PWA incluida),
// saltándose la caché del navegador / service worker.
export function ManualRefreshButton() {
  const { isAuthenticated } = useAuth();
  const [spinning, setSpinning] = useState(false);

  if (!isAuthenticated) return null;

  const handleRefresh = async () => {
    setSpinning(true);
    try {
      // Borra cachés (PWA / service worker) si existen.
      if ("caches" in window) {
        const names = await caches.keys();
        await Promise.all(names.map((n) => caches.delete(n)));
      }
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.update().catch(() => null)));
      }
    } catch {
      // ignore
    }
    // Recarga con cache-buster para forzar HTML fresco.
    const url = new URL(window.location.href);
    url.searchParams.set("_r", Date.now().toString());
    window.location.replace(url.toString());
  };

  return (
    <button
      type="button"
      onClick={handleRefresh}
      aria-label="Refrescar app"
      title="Refrescar app"
      className="fixed bottom-4 left-4 z-[60] inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background/80 text-foreground shadow-md backdrop-blur transition hover:bg-accent active:scale-95"
    >
      <RefreshCw className={`h-4 w-4 ${spinning ? "animate-spin" : ""}`} />
    </button>
  );
}
