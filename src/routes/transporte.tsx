import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, Train, Bus, Plane, Car, Star } from "lucide-react";

export const Route = createFileRoute("/transporte")({
  head: () => ({
    meta: [
      { title: "Transporte en Alicante — TRAM, bus, vuelos y rent-a-car" },
      {
        name: "description",
        content:
          "Hub de movilidad en Alicante: TRAM (FGV), autobuses urbanos, vuelos del aeropuerto ALC y alquiler de coches.",
      },
      { property: "og:title", content: "Transporte en Alicante" },
      {
        property: "og:description",
        content: "Elige cómo moverte: TRAM, bus, vuelos o rent-a-car.",
      },
      { property: "og:url", content: "https://vamosalicante.com/transporte" },
    ],
    links: [{ rel: "canonical", href: "https://vamosalicante.com/transporte" }],
  }),
  component: TransporteHub,
});

type Option = {
  to: string;
  title: string;
  desc: string;
  Icon: React.ComponentType<{ className?: string }>;
};

const OPTIONS: Option[] = [
  { to: "/tram", title: "TRAM (FGV)", desc: "Líneas, estaciones y próximas salidas", Icon: Train },
  { to: "/bus", title: "Autobús urbano", desc: "Paradas, líneas y tiempos en vivo", Icon: Bus },
  { to: "/vuelos", title: "Vuelos · Aeropuerto ALC", desc: "Llegadas y salidas del aeropuerto", Icon: Plane },
  { to: "/rent-a-car", title: "Rent a car", desc: "Comparador de alquiler en el aeropuerto", Icon: Car },
  { to: "/transporte/parada-favorita", title: "Mi parada favorita", desc: "Acceso rápido a tu parada habitual", Icon: Star },
];

function TransporteHub() {
  const navigate = useNavigate();
  return (
    <main className="h-dvh overflow-y-auto overscroll-contain bg-background pb-24">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border/60 bg-background/90 px-3 py-2.5 backdrop-blur">
        <button
          type="button"
          onClick={() => navigate({ to: "/" })}
          className="flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium shadow-sm transition active:scale-95"
          aria-label="Volver al inicio"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Inicio
        </button>
        <h1 className="text-base font-semibold">Transporte</h1>
      </header>

      <section className="px-4 py-5">
        <p className="text-sm text-muted-foreground mb-4">
          ¿Cómo te quieres mover por Alicante?
        </p>
        <div className="grid gap-3">
          {OPTIONS.map(({ to, title, desc, Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm transition active:scale-[0.98] hover:bg-accent/40"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block font-medium leading-tight">{title}</span>
                <span className="block text-xs text-muted-foreground">{desc}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
