import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Search, User, UserX } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listVisitors } from "@/lib/admin/visitors.functions";

function formatGap(ms: number | null | undefined): string {
  if (ms == null) return "—";
  if (ms < 1000) return "<1s";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export const Route = createFileRoute("/admin/visitantes")({
  head: () => ({ meta: [{ title: "Admin · Visitantes" }] }),
  component: VisitantesPage,
});

function VisitantesPage() {
  const [search, setSearch] = useState("");
  const q = useQuery({
    queryKey: ["admin-visitors", search],
    queryFn: () => listVisitors({ data: { search, limit: 500 } }),
    staleTime: 60_000,
  });

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Visitantes</h1>
        <p className="text-sm text-muted-foreground">
          Registro completo de visitas. Cada fila es una sesión individual (gap &gt; 30 min = nueva entrada). El contador muestra cuántas veces ha entrado esa identidad. Últimos 30 días. El Dashboard de métricas llegará en otro paso.
        </p>
      </header>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar email, nombre, país, ciudad…"
          className="pl-9"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {q.isLoading ? (
              <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</span>
            ) : (
              `${q.data?.visits.length ?? 0} de ${q.data?.total ?? 0} visitas`
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
                <th className="px-3 py-2 text-right">Desde anterior</th>
                <th className="px-3 py-2 text-left">Fecha</th>
                <th className="px-3 py-2 text-left">Hora</th>
              </tr>
            </thead>
            <tbody>
              {(q.data?.visits ?? []).map((s) => {
                const d = new Date(s.occurred_at);
                const fecha = d.toLocaleDateString("es-ES");
                const hora = d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
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
                    <td className="px-3 py-2 text-muted-foreground">
                      {[s.city, s.country].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">
                      {[s.browser, s.os, s.device].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="px-3 py-2 text-xs truncate max-w-[220px]">{s.path ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{s.type}</td>
                    <td className="px-3 py-2 text-right text-xs text-muted-foreground">{formatGap(s.gap_ms)}</td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">{fecha}</td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">{hora}</td>
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

