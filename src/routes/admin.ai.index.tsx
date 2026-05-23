// Resumen: KPIs globales + gráficas + cards destacadas.
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  DollarSign,
  Inbox,
  TrendingDown,
} from "lucide-react";
// Tablas en lugar de gráficas para mantener el bundle ligero.
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { aiOverviewQO, aiTimeseriesQO, FAILURE_REASON_LABEL, money, pct } from "@/lib/admin-ai-shared";

export const Route = createFileRoute("/admin/ai/")({
  component: OverviewPage,
});

function OverviewPage() {
  const o = useQuery(aiOverviewQO());
  const t = useQuery(aiTimeseriesQO(14));
  const d = o.data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi icon={<Activity className="h-4 w-4" />} label="Queries 30d" value={d?.total ?? "—"} />
        <Kpi
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Resolución"
          value={d ? pct(d.resolutionRate) : "—"}
          tone={d && d.resolutionRate > 0.7 ? "good" : "warn"}
        />
        <Kpi
          icon={<TrendingDown className="h-4 w-4" />}
          label="Fallback"
          value={d ? pct(d.fallbackRate) : "—"}
          tone={d && d.fallbackRate > 0.3 ? "bad" : "good"}
        />
        <Kpi
          icon={<Inbox className="h-4 w-4" />}
          label="Sin resolver pendientes"
          value={d?.unknownPending ?? "—"}
          tone={d && d.unknownPending > 0 ? "warn" : "good"}
        />
        <Kpi
          icon={<Clock className="h-4 w-4" />}
          label="Latencia media"
          value={d ? `${d.avgLatencyMs} ms` : "—"}
        />
        <Kpi
          icon={<DollarSign className="h-4 w-4" />}
          label="Coste 30d"
          value={d ? money(d.totalCost) : "—"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Queries por día (14d)</CardTitle>
          </CardHeader>
          <CardContent className="max-h-72 overflow-auto">
            {t.data ? (
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground sticky top-0 bg-background">
                  <tr>
                    <th className="text-left p-1">Día</th>
                    <th className="text-right p-1">Total</th>
                    <th className="text-right p-1">Resueltas</th>
                    <th className="text-right p-1">Fallback</th>
                  </tr>
                </thead>
                <tbody>
                  {t.data.days.map((row) => (
                    <tr key={row.date} className="border-t">
                      <td className="p-1">{row.date}</td>
                      <td className="p-1 text-right">{row.total}</td>
                      <td className="p-1 text-right text-emerald-600">{row.resolved}</td>
                      <td className="p-1 text-right text-amber-600">{row.fallback}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-muted-foreground">Cargando…</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top intents (30d)</CardTitle>
          </CardHeader>
          <CardContent className="max-h-72 overflow-auto">
            {d?.topIntents.length ? (
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground sticky top-0 bg-background">
                  <tr>
                    <th className="text-left p-1">Intent</th>
                    <th className="text-right p-1">Queries</th>
                  </tr>
                </thead>
                <tbody>
                  {d.topIntents.map((i) => (
                    <tr key={i.intent} className="border-t">
                      <td className="p-1">{i.intent}</td>
                      <td className="p-1 text-right font-medium">{i.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-muted-foreground">Sin datos.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Motivos de fallo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {d?.topFailures.length ? (
              <ul className="space-y-2 text-sm">
                {d.topFailures.map((f) => (
                  <li key={f.reason} className="flex justify-between">
                    <span>{FAILURE_REASON_LABEL[f.reason] ?? f.reason}</span>
                    <Badge variant="secondary">{f.count}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Sin fallos registrados.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Consultas repetidas sin resolver</CardTitle>
          </CardHeader>
          <CardContent>
            {d?.topRepeatedUnresolved.length ? (
              <ul className="space-y-2 text-sm">
                {d.topRepeatedUnresolved.map((q) => (
                  <li key={q.query} className="flex justify-between gap-2">
                    <span className="truncate">{q.query}</span>
                    <Badge variant="destructive">{q.count}×</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">¡Sin queries repetidas sin resolver! 🎉</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Estado general</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Resueltas" value={d?.resolved ?? "—"} />
            <Row label="Con fallback" value={d?.fallback ?? "—"} />
            <Row label="Pendientes de revisión" value={d?.unknownPending ?? "—"} />
            <p className="text-xs text-muted-foreground pt-2">
              Datos de los últimos 30 días. Auto-refresco cada 5 min.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  tone?: "good" | "warn" | "bad";
}) {
  const toneCls =
    tone === "good"
      ? "border-emerald-500/40"
      : tone === "warn"
        ? "border-amber-500/40"
        : tone === "bad"
          ? "border-destructive/40"
          : "";
  return (
    <Card className={toneCls}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {icon}
          {label}
        </div>
        <div className="mt-1 text-xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
