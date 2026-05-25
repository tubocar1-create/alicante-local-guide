import { createFileRoute, Link } from "@tanstack/react-router";
import { Music2, X } from "lucide-react";

export const Route = createFileRoute("/ocio_/conciertos")({
  head: () => ({
    meta: [{ title: "Conciertos en Alicante · Próximamente" }],
  }),
  component: ConciertosPage,
});

function ConciertosPage() {
  return (
    <div
      className="fixed inset-0 z-[60] lg:relative lg:inset-auto lg:z-auto lg:min-h-[60vh] flex flex-col items-center justify-center px-6 text-center text-white"
      style={{
        background:
          "linear-gradient(180deg, #1e1b4b 0%, #3730a3 50%, #0f0820 100%)",
      }}
    >
      <div className="absolute right-4 top-4">
        <Link
          to="/ocio"
          className="rounded-full border border-white/20 p-1.5 text-white/70 hover:border-white/40 hover:text-white"
        >
          <X className="h-4 w-4" />
        </Link>
      </div>
      <Music2 className="mb-3 h-12 w-12 text-violet-300" />
      <h1 className="font-display text-3xl font-bold">Conciertos</h1>
      <p className="mt-2 max-w-md text-sm text-white/70">
        Próximamente: agenda de conciertos, festivales y salas en directo de
        Alicante.
      </p>
      <Link
        to="/ocio"
        className="mt-6 rounded-full bg-violet-400 px-4 py-2 text-sm font-bold text-violet-950"
      >
        ← Volver a Ocio
      </Link>
    </div>
  );
}
