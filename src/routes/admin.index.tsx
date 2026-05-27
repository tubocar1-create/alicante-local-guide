// Panel principal de admin: KPIs reales de VamosAlicante.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  Activity,
  UserPlus,
  Clock,
  Loader2,
  ArrowRight,
  Building2,
  Hotel,
  Calendar,
  QrCode,
  ScanLine,
  Eye,
  Bot,
  HelpCircle,
  Bus,
  HeartPulse,
  Film,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useServerFn } from "@tanstack/react-start";
import {
  ADMIN_PIN,
  adminUsersQueryOptions,
  fmtDateTime,
  fmtTimeOnly,
} from "@/lib/admin-shared";
import { getVamosMetrics } from "@/lib/admin-metrics.functions";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Admin · VamosAlicante" }] }),
  component: AdminOverview,
});

function AdminOverview() {
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

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Panel VamosAlicante</h1>
          <p className="text-sm text-muted-foreground">
            Métricas reales de la app · auto-refresco cada 10 min.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{metricsQ.dataUpdatedAt ? fmtTimeOnly(metricsQ.dataUpdatedAt) : "—"}</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              usersQ.refetch();
              metricsQ.refetch();
            }}
            disabled={metricsQ.isFetching || usersQ.isFetching}
          >
            {metricsQ.isFetching || usersQ.isFetching ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              "Refrescar"
            )}
          </Button>
        </div>
      </header>

      {/* Usuarios */}
      <Section title="Usuarios reales" icon={<Users className="h-4 w-4" />}>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Stat label="Total" value={u?.total} />
          <Stat label="Nuevos 24h" value={u?.new_24h} highlight />
          <Stat label="Nuevos 7d" value={u?.new_7d} highlight />
          <Stat label="Activos 7d" value={u?.active_7d} />
          <Stat label="Activos 30d" value={u?.active_30d} />
        </div>
        {u?.latest_signup_at && (
          <p className="mt-3 text-xs text-muted-foreground">
            Último alta · {fmtDateTime(u.latest_signup_at)} ·{" "}
            <span className="font-medium">{u.latest_signup_email ?? "—"}</span>
          </p>
        )}
      </Section>

      {/* Embudo VAMOS */}
      <Section
        title="Embudo VAMOS · últimos 30 días"
        icon={<Activity className="h-4 w-4" />}
      >
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Stat
            icon={<Eye className="h-4 w-4" />}
            label="Visitas a ficha"
            value={ev?.totals_30d?.visit_viewed}
          />
          <Stat
            icon={<QrCode className="h-4 w-4" />}
            label="QR emitidos"
            value={ev?.totals_30d?.qr_created}
          />
          <Stat
            icon={<ScanLine className="h-4 w-4" />}
            label="QR validados"
            value={ev?.totals_30d?.qr_validated}
          />
          <Stat
            icon={<Calendar className="h-4 w-4" />}
            label="Reservas"
            value={ev?.totals_30d?.booking_created ?? m?.bookings?.new_7d}
          />
          <Stat
            icon={<Users className="h-4 w-4" />}
            label="Referidos"
            value={ev?.totals_30d?.referral_created}
          />
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          24h: {sumEvents(ev?.totals_24h)} eventos · 7d: {sumEvents(ev?.totals_7d)}{" "}
          eventos · 30d: {sumEvents(ev?.totals_30d)} eventos.
        </p>
      </Section>

      {/* Agente IA */}
      <Section title="Agente IA · 30 días" icon={<Bot className="h-4 w-4" />}>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Stat label="Consultas" value={m?.agent?.total_30d} />
          <Stat label="24h" value={m?.agent?.new_24h} />
          <Stat label="Resolución" valueStr={`${m?.agent?.resolution_pct ?? 0}%`} />
          <Stat label="Fallback" valueStr={`${m?.agent?.fallback_pct ?? 0}%`} />
          <Stat
            icon={<HelpCircle className="h-4 w-4" />}
            label="Sin respuesta"
            value={m?.agent?.unknown_pending}
            highlight={(m?.agent?.unknown_pending ?? 0) > 0}
          />
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Latencia media {m?.agent?.avg_latency_ms ?? 0} ms · {m?.agent?.unknown_total ?? 0}{" "}
          consultas no resueltas históricas.
        </p>
      </Section>

      {/* Reservas */}
      <Section title="Reservas" icon={<Calendar className="h-4 w-4" />}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Stat label="Total" value={m?.bookings?.total} />
          <Stat label="Últimos 7d" value={m?.bookings?.new_7d} highlight />
          <Stat label="Pendientes" value={m?.bookings?.pending} />
        </div>
      </Section>

      {/* Contenido */}
      <Section title="Contenido en base de datos" icon={<Building2 className="h-4 w-4" />}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Stat icon={<Building2 className="h-4 w-4" />} label="Negocios activos" value={m?.content?.businesses} />
          <Stat icon={<Hotel className="h-4 w-4" />} label="Hoteles" value={m?.content?.hotels} />
          <Stat icon={<MapPin className="h-4 w-4" />} label="Lugares (Google)" value={m?.content?.places} />
          <Stat icon={<Bus className="h-4 w-4" />} label="Líneas bus" value={m?.content?.bus_lines} />
          <Stat icon={<Bus className="h-4 w-4" />} label="Paradas bus" value={m?.content?.bus_stops} />
          <Stat icon={<Film className="h-4 w-4" />} label="Películas" value={m?.content?.films} />
          <Stat icon={<Film className="h-4 w-4" />} label="Cines" value={m?.content?.cinemas} />
          <Stat icon={<HeartPulse className="h-4 w-4" />} label="Salud" value={m?.content?.health} />
          <Stat icon={<HeartPulse className="h-4 w-4" />} label="Farmacias" value={m?.content?.pharmacies} />
        </div>
      </Section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <QuickLink to="/admin/operations" title="Centro Operativo" desc="Eventos en directo, errores, latencia" />
        <QuickLink to="/admin/usuarios" title="Usuarios" desc="Listado con perfil, consentimientos y origen" />
        <QuickLink to="/admin/ai/operacion" title="Agente IA · operación" desc="Logs, costes y aprendizaje" />
        <QuickLink to="/admin/ai/dialogos" title="Agente IA · diálogos" desc="Conversaciones completas con tiempos e intents" />
        <QuickLink to="/admin/bases-datos" title="Bases de datos" desc="Tablas y a qué módulos alimentan" />
      </div>
    </div>
  );
}

function sumEvents(t?: Record<string, number>): number {
  if (!t) return 0;
  return Object.values(t).reduce((a, b) => a + b, 0);
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          {icon} {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Stat({
  icon,
  label,
  value,
  valueStr,
  highlight,
}: {
  icon?: React.ReactNode;
  label: string;
  value?: number;
  valueStr?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        "rounded-lg border bg-card p-3 " +
        (highlight ? "border-primary/40" : "")
      }
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-xl font-bold">
        {valueStr ?? (value === undefined ? "—" : value.toLocaleString())}
      </div>
    </div>
  );
}

function QuickLink({ to, title, desc }: { to: string; title: string; desc: string }) {
  return (
    <Link
      to={to}
      className="group flex items-center justify-between rounded-lg border bg-card p-4 hover:border-primary/50 transition-colors"
    >
      <div>
        <div className="font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
    </Link>
  );
}

// silence unused imports for icons referenced indirectly via Stat icon prop
void UserPlus;
