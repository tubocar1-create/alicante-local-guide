import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Download,
  Lock,
  Loader2,
  Users,
  Activity,
  ShieldCheck,
  BarChart3,
  ExternalLink,
  Eye,
  MousePointerClick,
  Timer,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listAdminUsers, migrateTestUsersToAuth } from "@/lib/admin-users.functions";

const ADMIN_PIN = "7910511";
const PIN_KEY = "admin_home_pin_ok";
const LOVABLE_ANALYTICS_URL =
  "https://lovable.dev/projects/a8ec37f9-59bf-4ebb-a372-974e51dc0567/settings/project-insights";

// Snapshot de analíticas de Lovable (últimos 30 días, actualizado 2026-05-22).
// Para datos en vivo, abrir el panel de Lovable.
const ANALYTICS_SNAPSHOT = {
  updated_at: "2026-05-22",
  range: "Últimos 30 días",
  visitors: 157,
  pageviews: 1817,
  views_per_visit: 11.57,
  avg_session_sec: 1260,
  bounce_rate_pct: 33,
  top_pages: [
    { path: "/", views: 125 },
    { path: "/perfil", views: 19 },
    { path: "/ocio", views: 16 },
    { path: "/ocio/cartelera", views: 15 },
    { path: "/fiestas", views: 13 },
    { path: "/threads", views: 11 },
    { path: "/salud", views: 10 },
    { path: "/login", views: 10 },
    { path: "/donde-dormir", views: 9 },
    { path: "/ocio/cines", views: 8 },
  ],
  countries: [
    { code: "ES", visitors: 123 },
    { code: "VE", visitors: 4 },
    { code: "US", visitors: 4 },
  ],
  devices: [
    { type: "mobile", visitors: 150 },
    { type: "desktop", visitors: 5 },
  ],
};

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}m ${s}s`;
}

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin (oculto)" },
      { name: "robots", content: "noindex,nofollow,noarchive,nosnippet" },
      { name: "apple-mobile-web-app-title", content: "Admin" },
    ],
  }),
  component: AdminHome,
});

/** Swap the page manifest to the admin one so installing the PWA from this
 *  page creates a separate "Admin" shortcut pointing to /admin, instead of
 *  installing the public user app. */
function useAdminManifest() {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const existing = Array.from(
      document.querySelectorAll<HTMLLinkElement>('link[rel="manifest"]'),
    );
    const saved = existing.map((l) => ({ el: l, href: l.href }));
    existing.forEach((l) => l.remove());
    const link = document.createElement("link");
    link.rel = "manifest";
    link.href = "/admin-manifest.webmanifest";
    document.head.appendChild(link);
    return () => {
      link.remove();
      saved.forEach(({ el, href }) => {
        el.href = href;
        document.head.appendChild(el);
      });
    };
  }, []);
}

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
        "En iOS: abre esta página (/admin) en Safari → pulsa Compartir → 'Añadir a pantalla de inicio'. Se creará un icono 'Admin' independiente de la app de usuarios."
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
  useAdminManifest();
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
  const { data, error, isLoading, dataUpdatedAt, refetch, isFetching } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => fetchUsers({ data: { pin: ADMIN_PIN } }),
    refetchInterval: 30 * 60 * 1000, // cada 30 minutos
    refetchOnWindowFocus: true,
    staleTime: 30 * 60 * 1000,
  });
  const loading = isLoading;
  const err = error instanceof Error ? error.message : null;

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
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground hidden sm:inline">
              {dataUpdatedAt
                ? `Actualizado ${new Date(dataUpdatedAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })} · auto cada 30 min`
                : "—"}
            </span>
            <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refrescar"}
            </Button>
            <MigrateButton onDone={() => refetch()} />
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

        <AnalyticsSection />

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
                    {data.users.map((u: any) => (
                      <tr key={u.id} className="border-t">
                        <td className="px-3 py-2 truncate max-w-[240px]">
                          {u.name ? `${u.name} · ` : ""}
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

function AnalyticsSection() {
  const a = ANALYTICS_SNAPSHOT;
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4" /> Analíticas de Lovable
          <span className="text-xs font-normal text-muted-foreground ml-2">
            {a.range} · actualizado {a.updated_at}
          </span>
        </CardTitle>
        <a
          href={LOVABLE_ANALYTICS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs inline-flex items-center gap-1 text-primary hover:underline"
        >
          Ver en vivo <ExternalLink className="h-3 w-3" />
        </a>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard
            icon={<Users className="h-4 w-4" />}
            label="Visitantes"
            value={a.visitors}
          />
          <StatCard
            icon={<Eye className="h-4 w-4" />}
            label="Páginas vistas"
            value={a.pageviews}
          />
          <MiniStat
            icon={<MousePointerClick className="h-4 w-4" />}
            label="Vistas / visita"
            value={a.views_per_visit.toFixed(2)}
          />
          <MiniStat
            icon={<Timer className="h-4 w-4" />}
            label="Duración media"
            value={fmtDuration(a.avg_session_sec)}
          />
          <MiniStat
            icon={<Activity className="h-4 w-4" />}
            label="Bounce rate"
            value={`${a.bounce_rate_pct}%`}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <h4 className="text-xs uppercase text-muted-foreground mb-2">
              Páginas más vistas
            </h4>
            <ul className="space-y-1 text-sm">
              {a.top_pages.map((p) => (
                <li
                  key={p.path}
                  className="flex justify-between border-b border-border/40 py-1"
                >
                  <span className="truncate mr-2">{p.path}</span>
                  <span className="text-muted-foreground">{p.views}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-xs uppercase text-muted-foreground mb-2">
              Países
            </h4>
            <ul className="space-y-1 text-sm">
              {a.countries.map((c) => (
                <li
                  key={c.code}
                  className="flex justify-between border-b border-border/40 py-1"
                >
                  <span>{c.code}</span>
                  <span className="text-muted-foreground">{c.visitors}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-xs uppercase text-muted-foreground mb-2">
              Dispositivos
            </h4>
            <ul className="space-y-1 text-sm">
              {a.devices.map((d) => (
                <li
                  key={d.type}
                  className="flex justify-between border-b border-border/40 py-1"
                >
                  <span className="capitalize">{d.type}</span>
                  <span className="text-muted-foreground">{d.visitors}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {icon}
          {label}
        </div>
        <div className="mt-1 text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
