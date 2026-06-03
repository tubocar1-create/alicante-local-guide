import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Bus } from "lucide-react";

export const Route = createFileRoute("/buses_/$code")({
  component: BusOriginPage,
});

function BusOriginPage() {
  const { code } = Route.useParams();
  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Link
            to="/buses"
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
            aria-label="Volver"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2">
            <Bus className="h-5 w-5 text-primary" />
            <h1 className="text-base font-semibold">{code}</h1>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-2xl space-y-4 px-4 py-5">
        <p className="rounded-xl border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
          Pendiente: rutas frecuentes desde <strong>{code}</strong>. Te las
          conectaré en cuanto me pases la lista (origen → destino y operador).
        </p>
      </main>
    </div>
  );
}
