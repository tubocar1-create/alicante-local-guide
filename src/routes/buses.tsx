import { createFileRoute, Link } from "@tanstack/react-router";
import { Bus, ArrowLeft, MapPin } from "lucide-react";

export const Route = createFileRoute("/buses")({
  head: () => ({
    meta: [
      { title: "Buses de larga distancia desde Alicante" },
      {
        name: "description",
        content:
          "Buses interurbanos y de larga distancia desde la Estación de Autobuses de Alicante y el Aeropuerto Alicante-Elche.",
      },
      { property: "og:title", content: "Buses de larga distancia desde Alicante" },
      {
        property: "og:description",
        content: "Líneas, operadores y horarios desde Alicante y el aeropuerto.",
      },
    ],
  }),
  component: BusesIndex,
});

type Origin = {
  code: string;
  icon: string;
  city: string;
  station: string;
  description: string;
};

const ORIGINS: Origin[] = [
  {
    code: "ALC-BUS",
    icon: "🚍",
    city: "Alicante",
    station: "Estación de Autobuses",
    description: "Hub principal · ALSA, Vectalia, Baile, Beniconnect…",
  },
  {
    code: "ALC-APT",
    icon: "✈️",
    city: "Aeropuerto",
    station: "Alicante-Elche (ALC)",
    description: "Salidas directas a Benidorm, Murcia, Valencia y costa.",
  },
];

function BusesIndex() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Link
            to="/"
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
            aria-label="Volver"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2">
            <Bus className="h-5 w-5 text-primary" />
            <h1 className="text-base font-semibold">Buses larga distancia</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-5">
        <section>
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">
            Elige punto de salida
          </h2>
          <div className="grid gap-3">
            {ORIGINS.map((o) => (
              <Link
                key={o.code}
                to="/buses/$code"
                params={{ code: o.code }}
                className="flex items-start gap-3 rounded-2xl border bg-card p-4 transition hover:border-primary hover:shadow-sm"
              >
                <div className="text-2xl leading-none">{o.icon}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{o.city}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-mono uppercase">
                      {o.code}
                    </span>
                  </div>
                  <div className="text-sm text-foreground/80">{o.station}</div>
                  <div className="mt-1 flex items-start gap-1 text-xs text-muted-foreground">
                    <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                    <span>{o.description}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <p className="rounded-xl border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
          Próximamente: rutas frecuentes (Benidorm, Elche, Murcia, Valencia…) y
          horarios en vivo por operador.
        </p>
      </main>
    </div>
  );
}
