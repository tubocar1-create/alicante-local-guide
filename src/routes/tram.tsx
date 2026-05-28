import { createFileRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { TramInline } from "@/components/TramInline";

export const Route = createFileRoute("/tram")({
  head: () => ({
    meta: [
      { title: "TRAM Alicante — Líneas, paradas y próximas salidas" },
      {
        name: "description",
        content:
          "Consulta líneas, estaciones y próximas salidas del TRAM de Alicante (FGV) en tiempo real.",
      },
      { property: "og:title", content: "TRAM Alicante — Líneas, paradas y próximas salidas" },
      { property: "og:description", content: "Consulta líneas, estaciones y próximas salidas del TRAM de Alicante (FGV) en tiempo real." },
      { property: "og:url", content: "https://vamosalicante.com/tram" }
    ],
  links: [
      { rel: "canonical", href: "https://vamosalicante.com/tram" },
    ],
  }),
  component: TramPage,
});

function TramPage() {
  const navigate = useNavigate();
  const location = useLocation();

  if (location.pathname !== "/tram") {
    return <Outlet />;
  }

  return (
    <main className="h-dvh overflow-y-auto overscroll-contain bg-background pb-24">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border/60 bg-background/90 px-3 py-2.5 backdrop-blur">
        <button
          type="button"
          onClick={() => navigate({ to: "/" })}
          className="flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium shadow-sm transition active:scale-95"
          aria-label="Volver a Transporte"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Volver
        </button>
        <h1 className="text-sm font-semibold tracking-tight">🚋 TRAM Alicante</h1>
      </header>
      <div className="mx-auto max-w-2xl p-3">
        <TramInline embedded />
      </div>
    </main>
  );
}
