// Métricas internas: detalle por tipo de evento y serie diaria reales.
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, Users, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ADMIN_PIN, adminUsersQueryOptions } from "@/lib/admin-shared";
import { getVamosMetrics } from "@/lib/admin-metrics.functions";

export const Route = createFileRoute("/admin/metricas-internas")({
  head: () => ({ meta: [{ title: "Admin · Métricas internas" }] }),
  component: InternasPage,
});

function InternasPage() {
  const usersQ = useQuery(adminUsersQueryOptions());
  const fetchMetrics = useServerFn(getVamosMetrics);
  const metricsQ = useQuery({
    queryKey: ["vamos-metrics"],
    queryFn: () => fetchMetrics({ data: { pin: ADMIN_PIN } }),
    refetchInterval: 10 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
  });

  const u = usersQ.data;
  const m = metricsQ.data;
  const ev = m?.events;
  const series = ev?.series_30d ?? [];
  const max = Math.max(1, ...series.map((s) => s.count));

  const types = Object.keys(ev?.totals_30d ?? {}).sort((a, b) =>
    (ev?.totals_30d?.[b] ?? 0) - (ev?.totals_30d?.[a] ?? 0),
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Métricas internas</h1>
        <p className="text-sm text-muted-foreground">
          Uso real de VamosAlicante: usuarios, eventos y actividad propia.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" /> Usuarios autenticados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Stat label="Total" value={u?.total} />
            <Stat label="Nuevos 24h" value={u?.new_24h} />
            <Stat label="Nuevos 7d" value={u?.new_7d} />
            <Stat label="Activos 7d" value={u?.active_7d} />
            <Stat label="Activos 30d" value={u?.active_30d} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> Eventos por tipo · 30d
          </CardTitle>
        </CardHeader>
        <CardContent>
          {types.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin eventos en los últimos 30 días.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {types.map((t) => (
                <li
                  key={t}
                  className="flex justify-between border-b border-border/40 py-1"
                >
                  <span className="font-mono text-xs">{t}</span>
                  <span className="text-muted-foreground">
                    {ev?.totals_30d?.[t] ?? 0}
                    <span className="ml-2 text-[10px]">
                      (7d {ev?.totals_7d?.[t] ?? 0} · 24h {ev?.totals_24h?.[t] ?? 0})
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" /> Actividad diaria · 30d
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-32 items-end gap-1">
            {series.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin datos.</p>
            ) : (
              series.map((p) => (
                <div
                  key={p.date}
                  title={`${p.date}: ${p.count}`}
                  className="flex-1 rounded-t bg-primary/70"
                  style={{ height: `${(p.count / max) * 100}%` }}
                />
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fuentes</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>
            Eventos: tabla <code>interaction_events</code> capturada con{" "}
            <code>trackEvent()</code>.
          </p>
          <p>
            Dashboard por negocio: <code>/business/metrics</code>.
          </p>
          <p>
            Usuarios: <code>auth.users</code> + <code>profiles</code>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  valueStr,
}: {
  label: string;
  value?: number;
  valueStr?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-bold">
        {valueStr ?? (value === undefined ? "—" : value.toLocaleString())}
      </div>
    </div>
  );
}
