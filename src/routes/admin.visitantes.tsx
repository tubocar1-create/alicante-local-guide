import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Search, User, UserX } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listVisitors } from "@/lib/admin/visitors.functions";
import { fmtDateTime } from "@/lib/admin-shared";

function formatDuration(ms: number | null | undefined): string {
  if (!ms || ms < 1000) return "—";
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
    queryFn: () => listVisitors({ data: { search, limit: 200 } }),
    staleTime: 60_000,
  });

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Visitantes</h1>
        <p className="text-sm text-muted-foreground">
          Actividad de últimos 30 días. Agrupa usuarios registrados y visitantes anónimos por cookie.
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
              `${q.data?.visitors.length ?? 0} de ${q.data?.total ?? 0}`
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Identidad</th>
                <th className="px-3 py-2 text-left">Ubicación</th>
                <th className="px-3 py-2 text-left">Dispositivo</th>
                <th className="px-3 py-2 text-left">Sección top</th>
                <th className="px-3 py-2 text-right">Visitas</th>
                <th className="px-3 py-2 text-right">Eventos</th>
                <th className="px-3 py-2 text-right">Duración</th>
                <th className="px-3 py-2 text-left">Fecha</th>
                <th className="px-3 py-2 text-left">Hora</th>
              </tr>
            </thead>
            <tbody>
              {(q.data?.visitors ?? []).map((v) => {
                const d = new Date(v.last_seen);
                const fecha = d.toLocaleDateString("es-ES");
                const hora = d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
                return (
                <tr key={v.id} className="border-t hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <Link to="/admin/visitantes/$id" params={{ id: v.id }} className="flex items-center gap-2 hover:underline">
                      {v.kind === "user" ? <User className="h-3.5 w-3.5 text-primary" /> : <UserX className="h-3.5 w-3.5 text-muted-foreground" />}
                      <span className="font-medium truncate max-w-[220px]">{v.label}</span>
                      {v.email && <span className="text-xs text-muted-foreground truncate max-w-[180px]">· {v.email}</span>}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {[v.city, v.country].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground text-xs">
                    {[v.browser, v.os, v.device].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="px-3 py-2 text-xs">{v.top_path ?? "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <Badge variant="outline">{v.visits}</Badge>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Badge variant="secondary">{v.events}</Badge>
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-muted-foreground">{formatDuration(v.duration_ms)}</td>
                  <td className="px-3 py-2 text-muted-foreground text-xs">{fecha}</td>
                  <td className="px-3 py-2 text-muted-foreground text-xs">{hora}</td>
                </tr>
                );
              })}
              {!q.isLoading && (q.data?.visitors.length ?? 0) === 0 && (
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
