import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink, Globe, Search, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/metricas-externas")({
  head: () => ({ meta: [{ title: "Admin · Métricas externas" }] }),
  component: ExternasPage,
});

type Source = {
  name: string;
  status: "conectado" | "por construir";
  url?: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
};

const SOURCES: Source[] = [
  {
    name: "Google Analytics 4",
    status: "conectado",
    url: "https://analytics.google.com",
    desc: "Tráfico web, fuentes, conversiones, audiencia.",
    icon: Globe,
  },
  {
    name: "Lovable Insights",
    status: "conectado",
    url: "https://lovable.dev/projects/a8ec37f9-59bf-4ebb-a372-974e51dc0567/settings/project-insights",
    desc: "Visitas, top pages, países y dispositivos.",
    icon: TrendingUp,
  },
  {
    name: "Google Search Console",
    status: "por construir",
    desc: "Impresiones, clics, posición media en SERP.",
    icon: Search,
  },
  {
    name: "Semrush",
    status: "por construir",
    desc: "Análisis competitivo, backlinks, keywords. Conector disponible.",
    icon: TrendingUp,
  },
];

function ExternasPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Métricas externas</h1>
        <p className="text-sm text-muted-foreground">
          Fuentes de analítica fuera de la app. Atajos y estado de integración.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {SOURCES.map((s) => {
          const Icon = s.icon;
          const connected = s.status === "conectado";
          return (
            <Card key={s.name} className={connected ? "" : "opacity-70"}>
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Icon className="h-4 w-4" /> {s.name}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">{s.desc}</p>
                </div>
                <Badge variant={connected ? "default" : "outline"}>
                  {s.status}
                </Badge>
              </CardHeader>
              <CardContent>
                {s.url ? (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    Abrir panel externo <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Pendiente de conectar. Pídelo cuando quieras y lo integro.
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Métricas propuestas</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>• <strong>SEO</strong>: posicionamiento de páginas clave (/, /tram, /playas, /donde-dormir).</p>
          <p>• <strong>Tráfico orgánico</strong>: evolución semanal vs mes anterior.</p>
          <p>• <strong>Backlinks</strong>: dominios referentes nuevos.</p>
          <p>• <strong>Brand search</strong>: búsquedas de marca y volumen.</p>
          <p>• <strong>Conversión a registro</strong>: visitas → signups.</p>
        </CardContent>
      </Card>
    </div>
  );
}
