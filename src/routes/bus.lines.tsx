import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Bus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useBusGraph } from "@/hooks/useBusGraph";

export const Route = createFileRoute("/bus/lines")({
  head: () => ({
    meta: [
      { title: "Líneas de bus · Alicante" },
      {
        name: "description",
        content:
          "Todas las líneas de bus urbano de Alicante operadas por Vectalia, con sus paradas en Ida y Vuelta.",
      },
    ],
  }),
  component: LinesIndexPage,
});

const PALETTE = [
  "#E84E2C", "#3FA9F5", "#7BC043", "#F4B400", "#9B59B6",
  "#1ABC9C", "#E91E63", "#34495E", "#FF7F50", "#00ACC1",
];

function LinesIndexPage() {
  const { data, loading } = useBusGraph();
  const lines = data?.lines ?? [];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Link
            to="/bus"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
            aria-label="Volver"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-lg font-semibold">Líneas</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-3 px-4 py-6">
        {loading && <p className="text-sm text-muted-foreground">Cargando…</p>}
        {lines.map((l, i) => {
          const color = l.color || PALETTE[i % PALETTE.length];
          return (
            <Link
              key={l.code}
              to="/bus/lines/$code"
              params={{ code: l.code }}
              className="block"
            >
              <Card className="flex items-center justify-between p-3 transition-colors hover:bg-accent">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{ backgroundColor: color }}
                  >
                    {l.code}
                  </div>
                  <div className="leading-tight">
                    <div className="font-medium capitalize">{l.name}</div>
                    <div className="text-xs text-muted-foreground">Vectalia</div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Card>
            </Link>
          );
        })}
      </main>
    </div>
  );
}
