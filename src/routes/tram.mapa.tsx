import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ExternalLink, Minus, Plus, RotateCcw } from "lucide-react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import mapaLineas from "@/assets/tram-mapa-lineas.jpg";

export const Route = createFileRoute("/tram/mapa")({
  head: () => ({
    meta: [
      { title: "Mapa de líneas TRAM Alicante" },
      { name: "description", content: "Plano zonal tarifario del TRAM Metropolità d'Alacant (FGV) con todas las líneas." },
      { property: "og:title", content: "Mapa de líneas TRAM Alicante" },
      { property: "og:description", content: "Plano interactivo de líneas y zonas tarifarias del TRAM de Alicante (FGV)." },
      { property: "og:url", content: "https://vamosalicante.com/tram/mapa" },
    ],
    links: [{ rel: "canonical", href: "https://vamosalicante.com/tram/mapa" }],
  }),
  component: TramMapaPage,
});

function TramMapaPage() {
  const navigate = useNavigate();
  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-background">
      <header className="flex flex-none items-center gap-2 border-b border-border/60 bg-background/90 px-3 py-2.5 backdrop-blur">
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

      <div className="relative flex-1 overflow-hidden bg-muted/30">
        <TransformWrapper
          initialScale={1}
          minScale={1}
          maxScale={6}
          centerOnInit
          wheel={{ step: 0.15 }}
          doubleClick={{ mode: "toggle", step: 2 }}
          pinch={{ step: 5 }}
        >
          {({ zoomIn, zoomOut, resetTransform }) => (
            <>
              <TransformComponent
                wrapperClass="!w-full !h-full"
                contentClass="!w-full !h-full flex items-center justify-center"
              >
                <img
                  src={mapaLineas}
                  alt="Plano zonal tarifario del TRAM de Alicante con todas las líneas (1, 2, 3, 4, 5 y 9)"
                  className="max-h-full max-w-full select-none"
                  draggable={false}
                />
              </TransformComponent>

              <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
                <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-border bg-card/95 px-1.5 py-1 shadow-lg backdrop-blur">
                  <button
                    type="button"
                    onClick={() => zoomOut()}
                    aria-label="Alejar"
                    className="rounded-full p-2 transition hover:bg-accent/40 active:scale-95"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => resetTransform()}
                    aria-label="Restablecer zoom"
                    className="rounded-full p-2 transition hover:bg-accent/40 active:scale-95"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => zoomIn()}
                    aria-label="Acercar"
                    className="rounded-full p-2 transition hover:bg-accent/40 active:scale-95"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </TransformWrapper>
      </div>
    </main>
  );
}
