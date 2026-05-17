import { createFileRoute, Link } from "@tanstack/react-router";
import { Drama, X } from "lucide-react";

export const Route = createFileRoute("/ocio_/teatros")({
  head: () => ({
    meta: [{ title: "Teatros en Alicante · Próximamente" }],
  }),
  component: TeatrosPage,
});

function TeatrosPage() {
  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center px-6 text-center text-white"
      style={{
        background:
          "linear-gradient(180deg, #2a200a 0%, #4a3a12 50%, #1a1408 100%)",
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
      <Drama className="mb-3 h-12 w-12 text-amber-300" />
      <h1 className="font-display text-3xl font-bold">Teatros</h1>
      <p className="mt-2 max-w-md text-sm text-white/70">
        Estamos preparando la programación del Teatro Principal, Arniches, Aula
        CAM y otras salas alicantinas. Pronto disponible.
      </p>
      <Link
        to="/ocio"
        className="mt-6 rounded-full bg-amber-400 px-4 py-2 text-sm font-bold text-amber-950"
      >
        ← Volver a Ocio
      </Link>
    </div>
  );
}
