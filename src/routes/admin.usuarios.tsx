import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Search, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { adminUsersQueryOptions, fmtDateTime, fmtTimeOnly, ADMIN_PIN } from "@/lib/admin-shared";
import { migrateTestUsersToAuth } from "@/lib/admin-users.functions";

export const Route = createFileRoute("/admin/usuarios")({
  head: () => ({ meta: [{ title: "Admin · Usuarios" }] }),
  component: UsuariosPage,
});

function UsuariosPage() {
  const q = useQuery(adminUsersQueryOptions());
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    if (!q.data) return [];
    const f = filter.trim().toLowerCase();
    if (!f) return q.data.users;
    return q.data.users.filter((u) => {
      const hay = [u.email, u.name, u.first_name, u.last_name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(f);
    });
  }, [q.data, filter]);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Usuarios</h1>
          <p className="text-sm text-muted-foreground">
            Datos {q.dataUpdatedAt ? `actualizados ${fmtTimeOnly(q.dataUpdatedAt)}` : "—"} · auto cada 30 min
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => q.refetch()} disabled={q.isFetching}>
            {q.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
          <MigrateButton onDone={() => q.refetch()} />
        </div>
      </header>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Buscar por email o nombre…"
          className="pl-9"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {filtered.length} {filtered.length === 1 ? "usuario" : "usuarios"}
            {q.data && filter && ` de ${q.data.users.length}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Nombre</th>
                <th className="px-3 py-2 text-left">Email</th>
                <th className="px-3 py-2 text-left">Proveedor</th>
                <th className="px-3 py-2 text-left">Registro</th>
                <th className="px-3 py-2 text-left">Último acceso</th>
                <th className="px-3 py-2 text-left">Marketing</th>
                <th className="px-3 py-2 text-left">Consentimientos</th>
                <th className="px-3 py-2 text-left">Preferencias</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const fullName = [u.first_name, u.last_name].filter(Boolean).join(" ") || u.name || "—";
                const consents = Object.keys(u.consents ?? {});
                const prefs = Object.keys(u.preferences ?? {});
                return (
                  <tr key={u.id} className="border-t align-top">
                    <td className="px-3 py-2 font-medium">{fullName}</td>
                    <td className="px-3 py-2 truncate max-w-[220px]">
                      {u.email ?? "—"} {u.confirmed && <span className="text-emerald-600">✓</span>}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{u.provider ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{fmtDateTime(u.created_at)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{fmtDateTime(u.last_sign_in_at)}</td>
                    <td className="px-3 py-2">
                      {u.marketing_opt_in ? (
                        <Badge variant="default">Sí</Badge>
                      ) : (
                        <Badge variant="outline">No</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground max-w-[200px]">
                      {consents.length === 0 ? "—" : consents.join(", ")}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground max-w-[200px]">
                      {prefs.length === 0 ? "—" : prefs.join(", ")}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
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

function MigrateButton({ onDone }: { onDone: () => void }) {
  const run = useServerFn(migrateTestUsersToAuth);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const handle = async () => {
    if (!confirm("Migrar test_users a usuarios autenticados?")) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await run({ data: { pin: ADMIN_PIN } });
      setMsg(`+${res.created_count} creados · ${res.skipped_count} ya existían · ${res.failed_count} fallidos`);
      onDone();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
      setTimeout(() => setMsg(null), 8000);
    }
  };
  return (
    <div className="flex items-center gap-2">
      {msg && <span className="text-[11px] text-muted-foreground">{msg}</span>}
      <Button variant="outline" size="sm" onClick={handle} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Migrar test→Auth"}
      </Button>
    </div>
  );
}
