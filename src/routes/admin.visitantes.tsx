import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Search, User, UserX } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listVisitors, type AggregateRow } from "@/lib/admin/visitors.functions";

export const Route = createFileRoute("/admin/visitantes")({
  head: () => ({ meta: [{ title: "Admin · Visitantes" }] }),
  component: VisitantesPage,
});

function AggregateTable({ title, rows }: { title: string; rows: AggregateRow[] }) {
  const max = rows[0]?.visitors ?? 1;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span>{title}</span>
          <span className="text-xs text-muted-foreground font-normal">Visitantes únicos</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        {rows.length === 0 && <p className="text-xs text-muted-foreground py-4 text-center">Sin datos</p>}
        <ul className="space-y-1">
          {rows.map((r) => (
            <li key={r.key} className="relative flex items-center justify-between gap-2 text-sm py-1.5 px-2 rounded overflow-hidden">
              <div className="absolute inset-0 bg-primary/10 rounded" style={{ width: `${(r.visitors / max) * 100}%` }} />
              <span className="relative truncate">{r.key || "—"}</span>
              <span className="relative tabular-nums font-medium">{r.visitors}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function VisitantesPage() {
  const [search, setSearch] = useState("");
  const q = useQuery({
    queryKey: ["admin-visitors", search],
    queryFn: () => listVisitors({ data: { search, limit: 1000, days: 30 } }),
    staleTime: 60_000,
  });

  const agg = q.data?.aggregates;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Visitantes</h1>
        <p className="text-sm text-muted-foreground">
          Registro completo de eventos en orden cronológico. Las métricas agregadas excluyen al usuario interno (Leopoldo Cadavid) para reflejar tráfico real. Últimos 30 días.
        </p>
      </header>

      {agg && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Visitantes únicos</div><div className="text-2xl font-bold">{agg.total_unique_visitors}</div></CardContent></Card>
          <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Eventos totales</div><div className="text-2xl font-bold">{agg.total_events}</div></CardContent></Card>
        </div>
      )}

      {agg && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <AggregateTable title="Páginas" rows={agg.pages} />
          <AggregateTable title="Países" rows={agg.countries} />
          <AggregateTable title="Fuentes" rows={agg.sources} />
          <AggregateTable title="Dispositivos" rows={agg.devices} />
        </div>
      )}

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar email, nombre, país, ciudad, ruta…"
          className="pl-9"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {q.isLoading ? (
              <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</span>
            ) : (
              `${q.data?.visits.length ?? 0} de ${q.data?.total ?? 0} eventos`
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Identidad</th>
                <th className="px-3 py-2 text-right">Visita</th>
                <th className="px-3 py-2 text-left">Ubicación</th>
                <th className="px-3 py-2 text-left">Dispositivo</th>
                <th className="px-3 py-2 text-left">Ruta</th>
                <th className="px-3 py-2 text-left">Tipo</th>
                <th className="px-3 py-2 text-left">Fuente</th>
                <th className="px-3 py-2 text-left">Fecha</th>
                <th className="px-3 py-2 text-left">Hora</th>
              </tr>
            </thead>
            <tbody>
              {(q.data?.visits ?? []).map((s) => {
                const d = new Date(s.occurred_at);
                return (
                  <tr key={s.event_id} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2">
                      <Link to="/admin/visitantes/$id" params={{ id: s.identity_id }} className="flex items-center gap-2 hover:underline">
                        {s.kind === "user" ? <User className="h-3.5 w-3.5 text-primary" /> : <UserX className="h-3.5 w-3.5 text-muted-foreground" />}
                        <span className="font-medium truncate max-w-[220px]">{s.label}</span>
                        {s.email && <span className="text-xs text-muted-foreground truncate max-w-[180px]">· {s.email}</span>}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Badge variant="outline">{s.visit_index} / {s.total_visits}</Badge>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">
                      {[s.city, s.country].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">
                      {[s.browser, s.os, s.device].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="px-3 py-2 text-xs truncate max-w-[220px]">{s.path ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{s.type}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground truncate max-w-[140px]">{s.source ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">{d.toLocaleDateString("es-ES")}</td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">{d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</td>
                  </tr>
                );
              })}
              {!q.isLoading && (q.data?.visits.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                    Sin actividad registrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
