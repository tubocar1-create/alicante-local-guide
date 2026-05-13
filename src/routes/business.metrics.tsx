import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Eye, QrCode, ScanLine, Calendar } from "lucide-react";
import { listMyBusinesses } from "@/lib/business/business.functions";
import { getBusinessMetrics } from "@/lib/business/metrics.functions";

export const Route = createFileRoute("/business/metrics")({
  component: MetricsPage,
});

function MetricsPage() {
  const fetchBiz = useServerFn(listMyBusinesses);
  const fetchMetrics = useServerFn(getBusinessMetrics);

  const { data: bizData } = useQuery({
    queryKey: ["my-businesses"],
    queryFn: () => fetchBiz(),
  });
  const business = bizData?.businesses[0];

  const { data } = useQuery({
    queryKey: ["metrics", business?.id, 30],
    queryFn: () =>
      fetchMetrics({ data: { business_id: business!.id, days: 30 } }),
    enabled: !!business,
  });

  if (!business)
    return (
      <p className="text-sm text-muted-foreground">Crea primero un negocio.</p>
    );

  const max = Math.max(1, ...(data?.series ?? []).map((s) => s.count));
  const s = data?.summary;

  const funnel = [
    {
      key: "visit_viewed",
      label: "Visitas",
      hint: "Usuario vio tu negocio",
      icon: Eye,
      value: s?.visit_viewed ?? 0,
    },
    {
      key: "qr_created",
      label: "QR emitidos",
      hint: 'Usuario pulsó "VAMOS"',
      icon: QrCode,
      value: s?.qr_created ?? 0,
    },
    {
      key: "qr_validated",
      label: "Visitas validadas",
      hint: "QR escaneado en local",
      icon: ScanLine,
      value: s?.qr_validated ?? 0,
    },
  ];
  const peak = Math.max(1, ...funnel.map((f) => f.value));

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Métricas (30 días)</h1>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Embudo de interacción</h2>
        <ul className="mt-3 space-y-2">
          {funnel.map((f) => (
            <li key={f.key}>
              <div className="flex items-center justify-between text-sm">
                <span className="inline-flex items-center gap-2">
                  <f.icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">{f.label}</span>
                  <span className="text-[11px] text-muted-foreground">
                    · {f.hint}
                  </span>
                </span>
                <span className="font-semibold">{f.value}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${(f.value / peak) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg bg-muted/50 p-2">
            <p className="text-muted-foreground">Conversión total</p>
            <p className="text-base font-semibold">
              {s?.conversion_pct ?? 0}%
            </p>
            <p className="text-[10px] text-muted-foreground">
              visitas validadas / visitas
            </p>
          </div>
          <div className="rounded-lg bg-muted/50 p-2">
            <p className="text-muted-foreground">Canje de QR</p>
            <p className="text-base font-semibold">
              {s?.qr_redemption_pct ?? 0}%
            </p>
            <p className="text-[10px] text-muted-foreground">
              validados / emitidos
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold inline-flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5" /> Reservas
        </h2>
        <p className="mt-2 text-2xl font-semibold">{s?.bookings ?? 0}</p>
        <p className="text-[11px] text-muted-foreground">
          Canal independiente al embudo VAMOS
        </p>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Actividad diaria</h2>
        <div className="mt-3 flex h-32 items-end gap-1">
          {(data?.series ?? []).map((p) => (
            <div
              key={p.date}
              title={`${p.date}: ${p.count}`}
              className="flex-1 rounded-t bg-primary/70"
              style={{ height: `${(p.count / max) * 100}%` }}
            />
          ))}
          {data?.series.length === 0 && (
            <p className="text-xs text-muted-foreground">Sin datos aún.</p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Por tipo de evento</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {Object.entries(data?.totals ?? {}).map(([k, v]) => (
            <li key={k} className="flex justify-between">
              <span className="text-muted-foreground">{k}</span>
              <span className="font-medium">{v}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
