import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Search, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listAuthUsers } from "@/lib/admin/users-auth.functions";

export const Route = createFileRoute("/admin/usuarios-auth")({
  head: () => ({ meta: [{ title: "Admin · Usuarios autenticados" }] }),
  component: Page,
});

function fmt(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Page() {
  const fetcher = useServerFn(listAuthUsers);
  const q = useQuery({
    queryKey: ["admin", "auth-users"],
    queryFn: () => fetcher(),
    refetchInterval: 1000 * 60 * 5,
  });
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    if (!q.data) return [];
    const f = filter.trim().toLowerCase();
    if (!f) return q.data.users;
    return q.data.users.filter((u) =>
      [u.email, u.full_name, u.display_name, u.city]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(f),
    );
  }, [q.data, filter]);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <ShieldCheck className="h-5 w-5 text-primary" /> Usuarios autenticados
          </h1>
          <p className="text-sm text-muted-foreground">
            Cuentas reales con Supabase Auth · {q.data?.total ?? 0} totales
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => q.refetch()} disabled={q.isFetching}>
          {q.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </header>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Buscar por email, nombre o ciudad…"
          className="pl-9"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {filtered.length} {filtered.length === 1 ? "usuario" : "usuarios"}
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Email</th>
                <th className="px-3 py-2 text-left">Nombre</th>
                <th className="px-3 py-2 text-left">Método</th>
                <th className="px-3 py-2 text-left">Verificado</th>
                <th className="px-3 py-2 text-left">Registro</th>
                <th className="px-3 py-2 text-left">Último login</th>
                <th className="px-3 py-2 text-left">Última vez</th>
                <th className="px-3 py-2 text-left">Permisos</th>
                <th className="px-3 py-2 text-left">Rol</th>
                <th className="px-3 py-2 text-left">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-t align-top">
                  <td className="max-w-[220px] truncate px-3 py-2">{u.email ?? "—"}</td>
                  <td className="px-3 py-2">{u.full_name ?? u.display_name ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{u.provider ?? "email"}</td>
                  <td className="px-3 py-2">
                    {u.email_confirmed ? (
                      <Badge>✓</Badge>
                    ) : (
                      <Badge variant="outline">Pendiente</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{fmt(u.created_at)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{fmt(u.last_sign_in_at)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{fmt(u.last_seen_at)}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {u.permissions.length === 0 ? "—" : u.permissions.join(", ")}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {u.roles.length === 0 ? "—" : u.roles.join(", ")}
                  </td>
                  <td className="px-3 py-2">
                    {u.blocked ? (
                      <Badge variant="destructive">Bloqueado</Badge>
                    ) : (
                      <Badge variant="outline">Activo</Badge>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-6 text-center text-muted-foreground">
                    {q.isLoading ? "Cargando…" : "Sin resultados."}
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
