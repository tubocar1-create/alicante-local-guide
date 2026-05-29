import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Globe, Monitor, Clock, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getVisitorDetail } from "@/lib/admin/visitors.functions";
import { fmtDateTime } from "@/lib/admin-shared";

export const Route = createFileRoute("/admin/visitantes/$id")({
  head: () => ({ meta: [{ title: "Admin · Visitante" }] }),
  component: VisitorDetailPage,
});

function VisitorDetailPage() {
  const { id } = Route.useParams();
  const q = useQuery({
    queryKey: ["admin-visitor", id],
    queryFn: () => getVisitorDetail({ data: { id } }),
    staleTime: 30_000,
  });

  if (q.isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
      </div>
    );
  }

  if (q.isError || !q.data?.header) {
    return (
      <div className="space-y-3">
        <Link to="/admin/visitantes" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" /> Volver
        </Link>
        <p className="text-sm text-muted-foreground">Sin datos para este visitante.</p>
      </div>
    );
  }

  const { header, prefs, acquisition, events } = q.data;

  return (
    <div className="space-y-4">
      <Link to="/admin/visitantes" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ArrowLeft className="h-3.5 w-3.5" /> Volver a visitantes
      </Link>

      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">{header.label}</h1>
          <Badge variant={header.kind === "u" ? "default" : "secondary"}>
            {header.kind === "u" ? "Registrado" : "Anónimo"}
          </Badge>
        </div>
        {header.email && <p className="text-sm text-muted-foreground">{header.email}</p>}
        <p className="text-xs text-muted-foreground font-mono">{header.id}</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Clock} label="Primera visita" value={fmtDateTime(header.first_seen)} />
        <StatCard icon={Clock} label="Última visita" value={fmtDateTime(header.last_seen)} />
        <StatCard icon={Globe} label="Eventos / sesiones" value={`${header.total_events} · ${header.sessions_estimate}`} />
        <StatCard
          icon={MapPin}
          label="Ubicación"
          value={[header.city, header.region, header.country].filter(Boolean).join(", ") || "—"}
          sub={header.ip_trunc ? `IP ${header.ip_trunc}` : undefined}
        />
        <StatCard
          icon={Monitor}
          label="Dispositivo"
          value={[header.browser, header.os].filter(Boolean).join(" · ") || "—"}
          sub={header.device ?? undefined}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Preferencias inferidas</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <PrefList title="Secciones top" items={prefs?.top_sections ?? []} />
            <PrefList title="Tipos de evento" items={prefs?.top_event_types ?? []} />
            {prefs?.schedule && (
              <div>
                <div className="text-xs uppercase text-muted-foreground mb-1">Franja horaria</div>
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <ScheduleCell label="Mañana" value={prefs.schedule.morning} />
                  <ScheduleCell label="Tarde" value={prefs.schedule.afternoon} />
                  <ScheduleCell label="Noche" value={prefs.schedule.evening} />
                  <ScheduleCell label="Madrugada" value={prefs.schedule.night} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Adquisición</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Primera visita" value={fmtDateTime(acquisition?.first_seen ?? null)} />
            <Row label="Primera ruta" value={acquisition?.first_path ?? "—"} mono />
            <Row label="Referrer" value={acquisition?.referrer ?? "—"} mono />
            <div>
              <div className="text-xs uppercase text-muted-foreground mb-1">UTM</div>
              {acquisition?.utm && Object.keys(acquisition.utm).length > 0 ? (
                <pre className="text-xs bg-muted/50 p-2 rounded overflow-x-auto">
{JSON.stringify(acquisition.utm, null, 2)}
                </pre>
              ) : (
                <span className="text-muted-foreground">Sin UTM</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Timeline ({events.length} eventos)</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Fecha</th>
                <th className="px-3 py-2 text-left">Tipo</th>
                <th className="px-3 py-2 text-left">Ruta</th>
                <th className="px-3 py-2 text-left">Origen</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-t">
                  <td className="px-3 py-1.5 text-xs text-muted-foreground whitespace-nowrap">{fmtDateTime(e.occurred_at)}</td>
                  <td className="px-3 py-1.5"><Badge variant="outline" className="text-xs">{e.type}</Badge></td>
                  <td className="px-3 py-1.5 font-mono text-xs">{e.path ?? "—"}</td>
                  <td className="px-3 py-1.5 text-xs text-muted-foreground">{e.source ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4 space-y-1">
        <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
          <Icon className="h-3.5 w-3.5" /> {label}
        </div>
        <div className="text-sm font-medium">{value}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function PrefList({ title, items }: { title: string; items: Array<{ key: string; value: number }> }) {
  return (
    <div>
      <div className="text-xs uppercase text-muted-foreground mb-1">{title}</div>
      {items.length === 0 ? (
        <span className="text-muted-foreground">—</span>
      ) : (
        <ul className="space-y-1">
          {items.map((i) => (
            <li key={i.key} className="flex justify-between gap-2">
              <span className="font-mono text-xs truncate">{i.key}</span>
              <Badge variant="secondary" className="text-xs">{i.value}</Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ScheduleCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border p-2">
      <div className="font-semibold">{value}</div>
      <div className="text-muted-foreground">{label}</div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-xs uppercase text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono text-xs truncate max-w-[60%]" : "text-xs truncate max-w-[60%]"}>{value}</span>
    </div>
  );
}
