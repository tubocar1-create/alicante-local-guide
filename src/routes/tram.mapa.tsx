import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ExternalLink } from "lucide-react";
import mapaLineas from "@/assets/tram-mapa-lineas.jpg";

export const Route = createFileRoute("/tram/mapa")({
  head: () => ({
    meta: [
      { title: "Mapa de líneas TRAM Alicante" },
      { name: "description", content: "Plano zonal tarifario del TRAM Metropolità d'Alacant (FGV) con todas las líneas." },
    ],
  }),
  component: TramMapaPage,
});

function TramMapaPage() {
  const navigate = useNavigate();
  return (
    <main className="h-dvh overflow-y-auto overscroll-contain bg-background pb-24">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border/60 bg-background/90 px-3 py-2.5 backdrop-blur">
        <button
          type="button"
          onClick={() => navigate({ to: "/tram" })}
          className="flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium shadow-sm transition active:scale-95"
          aria-label="Volver al TRAM"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Volver
        </button>
        <h1 className="text-sm font-semibold tracking-tight">🗺️ Mapa de líneas TRAM</h1>
        <a
          href={mapaLineas}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium shadow-sm hover:bg-accent/40"
        >
          <ExternalLink className="h-3 w-3" /> Abrir
        </a>
      </header>
      <div className="mx-auto max-w-3xl p-3">
        <p className="mb-2 px-1 text-[11px] text-muted-foreground">
          Pellizca para hacer zoom. Fuente: FGV · tramalacant.es
        </p>
        <div className="overflow-auto rounded-2xl border border-border bg-card shadow-sm">
          <img
            src={mapaLineas}
            alt="Plano zonal tarifario del TRAM de Alicante con todas las líneas (1, 2, 3, 4, 5 y 9)"
            className="block w-full max-w-none"
            loading="eager"
          />
        </div>
      </div>
    </main>
  );
}
