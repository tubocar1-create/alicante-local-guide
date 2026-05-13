import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyBusinesses } from "@/lib/business/business.functions";
import { getBusinessMetrics } from "@/lib/business/metrics.functions";
import { Plus, QrCode, Calendar, Users } from "lucide-react";

export const Route = createFileRoute("/business/")({
  component: BusinessDashboard,
});

function BusinessDashboard() {
  const fetchBiz = useServerFn(listMyBusinesses);
  const { data, isLoading } = useQuery({
    queryKey: ["my-businesses"],
    queryFn: () => fetchBiz(),
  });

  const businesses = data?.businesses ?? [];
  const primary = businesses[0];

  const fetchMetrics = useServerFn(getBusinessMetrics);
  const { data: metrics } = useQuery({
    queryKey: ["metrics", primary?.id],
    queryFn: () => fetchMetrics({ data: { business_id: primary!.id, days: 7 } }),
    enabled: !!primary,
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;

  if (!primary) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Bienvenido</h1>
        <p className="text-sm text-muted-foreground">
          Aún no tienes ningún negocio creado. Crea el primero para empezar a generar QR, recibir reservas y medir referrals.
        </p>
        <Link
          to="/business/onboarding"
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> Crear negocio
        </Link>
      </div>
    );
  }

  const s = metrics?.summary;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Negocio</p>
        <h1 className="text-xl font-semibold">{primary.name}</h1>
        <p className="text-xs text-muted-foreground">{primary.sector}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Visitas (7d)" value={s?.visits ?? 0} />
        <Stat label="Reservas" value={s?.bookings ?? 0} />
        <Stat label="QR creados" value={s?.qr_created ?? 0} />
        <Stat label="Referrals" value={s?.referrals ?? 0} />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Quick to="/business/qr" icon={QrCode} label="Nuevo QR" />
        <Quick to="/business/bookings" icon={Calendar} label="Reservas" />
        <Quick to="/business/referrals" icon={Users} label="Refer." />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function Quick({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: typeof QrCode;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-card px-3 py-3 text-xs"
    >
      <Icon className="h-5 w-5 text-primary" />
      {label}
    </Link>
  );
}
