import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Download, Lock, Loader2, Users, Activity, ShieldCheck } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listAdminUsers } from "@/lib/admin-users.functions";

const ADMIN_PIN = "7910511";
const PIN_KEY = "admin_home_pin_ok";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin (oculto)" },
      { name: "robots", content: "noindex,nofollow,noarchive,nosnippet" },
    ],
  }),
  component: AdminHome,
});

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function InstallAppButton() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "other">("other");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS
      window.navigator.standalone === true;
    if (isStandalone) setInstalled(true);

    const ua = window.navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua) && !/CriOS|FxiOS/.test(ua)) setPlatform("ios");

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    const installedHandler = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installedHandler);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const handleClick = async () => {
    if (deferred) {
      await deferred.prompt();
      await deferred.userChoice;
      return;
    }
    if (platform === "ios") {
      alert(
        "En iOS: pulsa Compartir en Safari → 'Añadir a pantalla de inicio'."
      );
      return;
    }
    alert(
      "Tu navegador no expone el diálogo de instalación. Usa el menú del navegador → 'Instalar app' / 'Añadir a pantalla de inicio'."
    );
  };

  if (installed) {
    return (
      <Button variant="outline" disabled className="gap-2">
        <Download className="h-4 w-4" /> App ya instalada
      </Button>
    );
  }
  return (
    <Button onClick={handleClick} className="gap-2">
      <Download className="h-4 w-4" /> Instalar como aplicación
    </Button>
  );
}

function AdminHome() {
  const [pin, setPin] = useState("");
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem(PIN_KEY) === "1") {
      setAuthed(true);
    }
  }, []);

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" /> Acceso restringido
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (pin === ADMIN_PIN) {
                  sessionStorage.setItem(PIN_KEY, "1");
                  setAuthed(true);
                  setError(null);
                } else {
                  setError("Contraseña incorrecta");
                }
              }}
              className="space-y-3"
            >
              <Input
                type="password"
                inputMode="numeric"
                autoFocus
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Contraseña"
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full">
                Entrar
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <AdminDashboard />;
}

function AdminDashboard() {
  const fetchUsers = useServerFn(listAdminUsers);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Awaited<ReturnType<typeof listAdminUsers>> | null>(
    null,
  );
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetchUsers({ data: { pin: ADMIN_PIN } });
        if (!cancel) setData(res);
      } catch (e) {
        if (!cancel) setErr(e instanceof Error ? e.message : "Error");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [fetchUsers]);

  const logout = () => {
    sessionStorage.removeItem(PIN_KEY);
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShieldCheck className="h-6 w-6" /> Panel de Administración
            </h1>
            <p className="text-sm text-muted-foreground">
              Página oculta · solo accesible con contraseña.
            </p>
          </div>
          <div className="flex gap-2">
            <InstallAppButton />
            <Button variant="ghost" onClick={logout}>
              Salir
            </Button>
          </div>
        </header>

        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando usuarios…
          </div>
        )}
        {err && <p className="text-destructive text-sm">Error: {err}</p>}

        {data && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard
                icon={<Users className="h-4 w-4" />}
                label="Usuarios reales"
                value={data.total}
              />
              <StatCard
                icon={<Activity className="h-4 w-4" />}
                label="Activos 7 días"
                value={data.active_7d}
              />
              <StatCard
                icon={<Activity className="h-4 w-4" />}
                label="Activos 30 días"
                value={data.active_30d}
              />
              <StatCard
                icon={<Users className="h-4 w-4" />}
                label="Total (con test)"
                value={data.total_with_test}
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Usuarios reales ({data.users.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">Email</th>
                      <th className="px-3 py-2 text-left">Proveedor</th>
                      <th className="px-3 py-2 text-left">Último acceso</th>
                      <th className="px-3 py-2 text-left">Registro</th>
                      <th className="px-3 py-2 text-left">Confirmado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.users.map((u) => (
                      <tr key={u.id} className="border-t">
                        <td className="px-3 py-2 truncate max-w-[240px]">
                          {u.email ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {u.provider ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {fmt(u.last_sign_in_at)}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {fmt(u.created_at)}
                        </td>
                        <td className="px-3 py-2">{u.confirmed ? "✓" : "—"}</td>
                      </tr>
                    ))}
                    {data.users.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-3 py-6 text-center text-muted-foreground"
                        >
                          No hay usuarios reales registrados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {icon}
          {label}
        </div>
        <div className="mt-1 text-2xl font-bold">{value.toLocaleString()}</div>
      </CardContent>
    </Card>
  );
}

function fmt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
