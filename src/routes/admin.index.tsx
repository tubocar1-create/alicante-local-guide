import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  Activity,
  UserPlus,
  Clock,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminUsersQueryOptions, fmtDateTime, fmtTimeOnly } from "@/lib/admin-shared";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Admin · Resumen" }] }),
  component: AdminOverview,
});

function AdminOverview() {
  const q = useQuery(adminUsersQueryOptions());
  const d = q.data;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Resumen</h1>
        <p className="text-sm text-muted-foreground">
          Estado general de la aplicación. Auto-refresco cada 30 minutos.
        </p>
      </header>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus className="h-4 w-4" /> Último registro
          </CardTitle>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>
              Datos {q.dataUpdatedAt ? `· ${fmtTimeOnly(q.dataUpdatedAt)}` : "—"}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => q.refetch()}
              disabled={q.isFetching}
            >
              {q.isFetching ? <Loader2 className="h-3 w-3 animate-spin" /> : "Refrescar"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {q.isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : d?.latest_signup_at ? (
            <div>
              <div className="text-2xl font-bold">
                {fmtDateTime(d.latest_signup_at)}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {d.latest_signup_email ?? "—"}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sin registros aún.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat icon={<Users className="h-4 w-4" />} label="Usuarios reales" value={d?.total} />
        <Stat icon={<UserPlus className="h-4 w-4" />} label="Nuevos 24h" value={d?.new_24h} highlight />
        <Stat icon={<UserPlus className="h-4 w-4" />} label="Nuevos 7d" value={d?.new_7d} highlight />
        <Stat icon={<Activity className="h-4 w-4" />} label="Activos 7d" value={d?.active_7d} />
        <Stat icon={<Activity className="h-4 w-4" />} label="Activos 30d" value={d?.active_30d} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <QuickLink to="/admin/usuarios" title="Ver todos los usuarios" desc="Listado completo con perfil y permisos" />
        <QuickLink to="/admin/metricas-internas" title="Métricas internas" desc="Analítica Lovable y uso de la app" />
        <QuickLink to="/admin/integraciones" title="Integraciones externas" desc="Scrapers, APIs y webhooks" />
        <QuickLink to="/admin/bases-datos" title="Bases de datos" desc="Tablas y a qué módulos alimentan" />
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | undefined;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? "border-primary/40" : ""}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {icon}
          {label}
        </div>
        <div className="mt-1 text-2xl font-bold">
          {value === undefined ? "—" : value.toLocaleString()}
        </div>
      </CardContent>
    </Card>
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
