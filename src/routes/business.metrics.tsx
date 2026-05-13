import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
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
    return <p className="text-sm text-muted-foreground">Crea primero un negocio.</p>;

  const max = Math.max(1, ...(data?.series ?? []).map((s) => s.count));

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Métricas (30 días)</h1>
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Eventos totales" value={data?.summary.total ?? 0} />
        <Stat label="Visitas QR" value={data?.summary.visits ?? 0} />
        <Stat label="Reservas" value={data?.summary.bookings ?? 0} />
        <Stat label="Referrals" value={data?.summary.referrals ?? 0} />
      </div>

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
        <h2 className="text-sm font-semibold">Por tipo</h2>
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
