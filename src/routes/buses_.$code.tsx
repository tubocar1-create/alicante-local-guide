import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Bus } from "lucide-react";

export const Route = createFileRoute("/buses_/$code")({
  component: BusOriginPage,
});

function BusOriginPage() {
  const { code } = Route.useParams();
  return (
    <div
      className="h-dvh overflow-y-auto overscroll-contain text-slate-100 lg:min-h-screen lg:h-auto lg:overflow-visible"
      style={{
        background: "linear-gradient(180deg, #020617 0%, #06111f 50%, #020617 100%)",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-amber-500/[0.06] blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-3xl px-3 pb-10 pt-5 md:px-6">
        <header className="mb-4 flex items-center justify-between">
          <Link
            to="/buses"
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-[11px] text-slate-300 transition hover:border-amber-500/50 hover:text-amber-300"
          >
            <ArrowLeft className="h-3 w-3" />
            Volver
          </Link>
          <div className="flex items-center gap-2">
            <Bus className="h-4 w-4 text-amber-300" />
            <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-amber-300">
              {code}
            </span>
          </div>
        </header>

        <div className="mb-4">
          <p className="text-[10px] uppercase tracking-[0.3em] text-amber-300/90">
            Dashboard de Buses
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-white md:text-4xl">
            Rutas{" "}
            <span className="bg-gradient-to-r from-amber-300 via-white to-orange-300 bg-clip-text text-transparent">
              desde {code}
            </span>
          </h1>
        </div>

        <div className="rounded-2xl border border-dashed border-amber-500/30 bg-amber-950/20 p-4 text-sm text-slate-300">
          Pendiente: rutas frecuentes desde <strong className="text-amber-200">{code}</strong>. Te las conectaré en cuanto me pases la lista (origen → destino y operador).
        </div>
      </div>
    </div>
  );
}
