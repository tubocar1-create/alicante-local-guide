import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Bus, ExternalLink, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { liveStopUrl, isValidStopCode } from "@/lib/bus";

type Stop = {
  code: string;
  name: string | null;
  lines: string[] | null;
};

export const Route = createFileRoute("/bus")({
  head: () => ({
    meta: [
      { title: "Buses en vivo · Alicante" },
      {
        name: "description",
        content:
          "Consulta los próximos buses en tiempo real para las paradas de Alicante usando el código de 4 dígitos.",
      },
    ],
  }),
  component: BusPage,
});

function BusPage() {
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");

  useEffect(() => {
    supabase
      .from("bus_stops")
      .select("code,name,lines")
      .order("code")
      .then(({ data }) => {
        setStops((data ?? []) as Stop[]);
        setLoading(false);
      });
  }, []);

  const open = (c: string) => {
    if (!isValidStopCode(c)) return;
    window.open(liveStopUrl(c.trim()), "_blank", "noopener,noreferrer");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Link
            to="/"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
            aria-label="Volver"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-lg font-semibold">Buses en vivo</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 py-6">
        <Card className="p-4">
          <p className="mb-3 text-sm text-muted-foreground">
            Introduce el código de 4 dígitos de la parada (lo verás impreso junto al QR
            en la mampara) para ver los próximos buses en tiempo real.
          </p>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              open(code);
            }}
          >
            <Input
              inputMode="numeric"
              pattern="\d*"
              maxLength={5}
              placeholder="Ej. 4081"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
            <Button type="submit" disabled={!isValidStopCode(code)}>
              <Search className="mr-2 h-4 w-4" /> Ver
            </Button>
          </form>
        </Card>

        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Paradas guardadas
          </h2>

          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : stops.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay paradas guardadas.</p>
          ) : (
            <ul className="space-y-2">
              {stops.map((s) => (
                <li key={s.code}>
                  <a
                    href={liveStopUrl(s.code)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-lg border bg-card p-3 transition-colors hover:bg-accent"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Bus className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-medium">
                          {s.code}
                          {s.name ? ` · ${s.name}` : ""}
                        </div>
                        {s.lines && s.lines.length > 0 && (
                          <div className="text-xs text-muted-foreground">
                            Líneas: {s.lines.join(", ")}
                          </div>
                        )}
                      </div>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
