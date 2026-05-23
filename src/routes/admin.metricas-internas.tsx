import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, BarChart3, Users, Eye, MousePointerClick, Timer, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminUsersQueryOptions } from "@/lib/admin-shared";

export const Route = createFileRoute("/admin/metricas-internas")({
  head: () => ({ meta: [{ title: "Admin · Métricas internas" }] }),
  component: InternasPage,
});

const LOVABLE_ANALYTICS_URL =
  "https://lovable.dev/projects/a8ec37f9-59bf-4ebb-a372-974e51dc0567/settings/project-insights";

const ANALYTICS_SNAPSHOT = {
  updated_at: "2026-05-22",
  range: "Últimos 30 días",
  visitors: 157,
  pageviews: 1817,
  views_per_visit: 11.57,
  avg_session_sec: 1260,
  bounce_rate_pct: 33,
  top_pages: [
    { path: "/", views: 125 },
    { path: "/perfil", views: 19 },
    { path: "/ocio", views: 16 },
    { path: "/ocio/cartelera", views: 15 },
    { path: "/fiestas", views: 13 },
    { path: "/threads", views: 11 },
    { path: "/salud", views: 10 },
    { path: "/login", views: 10 },
    { path: "/donde-dormir", views: 9 },
    { path: "/ocio/cines", views: 8 },
  ],
  countries: [
    { code: "ES", visitors: 123 },
    { code: "VE", visitors: 4 },
    { code: "US", visitors: 4 },
  ],
  devices: [
    { type: "mobile", visitors: 150 },
    { type: "desktop", visitors: 5 },
  ],
};

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}m ${s}s`;
}

function InternasPage() {
  const q = useQuery(adminUsersQueryOptions());
  const a = ANALYTICS_SNAPSHOT;
  const d = q.data;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Métricas internas</h1>
        <p className="text-sm text-muted-foreground">
          Analítica Lovable, uso de la app y eventos propios.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Usuarios autenticados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Stat icon={<Users className="h-4 w-4" />} label="Total" value={d?.total} />
            <Stat icon={<Users className="h-4 w-4" />} label="Nuevos 24h" value={d?.new_24h} />
            <Stat icon={<Users className="h-4 w-4" />} label="Nuevos 7d" value={d?.new_7d} />
            <Stat icon={<Activity className="h-4 w-4" />} label="Activos 7d" value={d?.active_7d} />
            <Stat icon={<Activity className="h-4 w-4" />} label="Activos 30d" value={d?.active_30d} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> Lovable Analytics
            <span className="text-xs font-normal text-muted-foreground ml-2">
              {a.range} · snapshot {a.updated_at}
            </span>
          </CardTitle>
          <a
            href={LOVABLE_ANALYTICS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs inline-flex items-center gap-1 text-primary hover:underline"
          >
            Ver en vivo <ExternalLink className="h-3 w-3" />
          </a>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Stat icon={<Users className="h-4 w-4" />} label="Visitantes" value={a.visitors} />
            <Stat icon={<Eye className="h-4 w-4" />} label="Páginas vistas" value={a.pageviews} />
            <Stat icon={<MousePointerClick className="h-4 w-4" />} label="Vistas / visita" valueStr={a.views_per_visit.toFixed(2)} />
            <Stat icon={<Timer className="h-4 w-4" />} label="Duración media" valueStr={fmtDuration(a.avg_session_sec)} />
            <Stat icon={<Activity className="h-4 w-4" />} label="Bounce rate" valueStr={`${a.bounce_rate_pct}%`} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <h4 className="text-xs uppercase text-muted-foreground mb-2">Páginas más vistas</h4>
              <ul className="space-y-1 text-sm">
                {a.top_pages.map((p) => (
                  <li key={p.path} className="flex justify-between border-b border-border/40 py-1">
                    <span className="truncate mr-2">{p.path}</span>
                    <span className="text-muted-foreground">{p.views}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-xs uppercase text-muted-foreground mb-2">Países</h4>
              <ul className="space-y-1 text-sm">
                {a.countries.map((c) => (
                  <li key={c.code} className="flex justify-between border-b border-border/40 py-1">
                    <span>{c.code}</span>
                    <span className="text-muted-foreground">{c.visitors}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-xs uppercase text-muted-foreground mb-2">Dispositivos</h4>
              <ul className="space-y-1 text-sm">
                {a.devices.map((c) => (
                  <li key={c.type} className="flex justify-between border-b border-border/40 py-1">
                    <span className="capitalize">{c.type}</span>
                    <span className="text-muted-foreground">{c.visitors}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Eventos propios</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>Tabla <code>interaction_events</code> · eventos capturados con <code>trackEvent()</code>.</p>
          <p>Dashboards por negocio: <code>/business/metrics</code>.</p>
          <p className="text-xs">[Por construir] vista agregada de eventos en este panel.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  valueStr,
}: {
  icon: React.ReactNode;
  label: string;
  value?: number;
  valueStr?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {icon}
          {label}
        </div>
        <div className="mt-1 text-2xl font-bold">
          {valueStr ?? (value === undefined ? "—" : value.toLocaleString())}
        </div>
      </CardContent>
    </Card>
  );
}
