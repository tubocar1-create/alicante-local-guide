import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient, useIsFetching, useQuery } from "@tanstack/react-query";
import {
  Lock,
  ShieldCheck,
  ShieldAlert,
  LayoutDashboard,
  Users,
  Network,
  PlugZap,
  Database,
  BarChart3,
  Globe,
  Wrench,
  HeartPulse,
  MapPinned,
  Menu as MenuIcon,
  Bot,
  Activity,
  RefreshCw,
  EyeOff,
  ClipboardCheck,
  Loader2,
  Sparkles,
  Cloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { checkIsAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin (oculto)" },
      { name: "robots", content: "noindex,nofollow,noarchive,nosnippet" },
      { name: "apple-mobile-web-app-title", content: "Admin" },
    ],
  }),
  component: AdminLayout,
});

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

const SECTIONS = [
  { to: "/admin", label: "Resumen", icon: LayoutDashboard, exact: true },
  { to: "/admin/operations", label: "Centro Operativo", icon: Activity },
  { to: "/admin/usuarios", label: "Usuarios", icon: Users },
  { to: "/admin/arquitectura", label: "Arquitectura", icon: Network },
  { to: "/admin/integraciones", label: "Integraciones", icon: PlugZap },
  { to: "/admin/bases-datos", label: "Bases de datos", icon: Database },
  { to: "/admin/metricas-internas", label: "Métricas internas", icon: BarChart3 },
  { to: "/admin/metricas-externas", label: "Métricas externas", icon: Globe },
] as const;

const IA_SECTIONS = [
  { to: "/admin/ai/dialogos", label: "Diálogos", icon: Bot },
  { to: "/admin/ai/correcciones", label: "Correcciones", icon: Bot },
  { to: "/admin/ai/doctrina", label: "Doctrina", icon: Bot },
  { to: "/admin/ai/operacion", label: "Operación", icon: Bot },
  { to: "/admin/ai/dubious", label: "Dudosas", icon: Bot },
  { to: "/admin/ai/analytics", label: "Analítica IA", icon: Bot },
  { to: "/admin/ai/costs", label: "Costes IA", icon: Bot },
] as const;

const HERRAMIENTAS = [
  { to: "/admin/places", label: "Poblar sitios", icon: MapPinned },
  { to: "/admin/salud", label: "Poblar salud", icon: HeartPulse },
  { to: "/admin/botones-ocultos", label: "Botones ocultos", icon: EyeOff },
  { to: "/admin/auditoria", label: "Auditoría pre-lanzamiento", icon: ClipboardCheck },
  { to: "/admin/system", label: "Sistema", icon: Wrench },
] as const;

function AdminLayout() {
  useAdminManifest();
  const [sessionUser, setSessionUser] = useState<{ id: string; email: string | null } | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [adminCheckTimedOut, setAdminCheckTimedOut] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const qc = useQueryClient();
  const isFetching = useIsFetching();

  // Hidratar sesión Supabase y suscribirse a cambios.
  useEffect(() => {
    let mounted = true;
    // Fallback: si getSession() no resuelve rápido, mostramos login/reintento
    // en vez de dejar al usuario colgado en el spinner.
    const timeout = window.setTimeout(() => {
      if (mounted) setAuthReady(true);
    }, 1500);
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        const u = data.session?.user;
        setSessionUser(u ? { id: u.id, email: u.email ?? null } : null);
        setAuthReady(true);
      })
      .catch(() => {
        if (!mounted) return;
        setSessionUser(null);
        setAuthReady(true);
      });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      const u = session?.user;
      setSessionUser(u ? { id: u.id, email: u.email ?? null } : null);
      setAuthReady(true);
    });
    return () => {
      mounted = false;
      window.clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const adminQuery = useQuery({
    queryKey: ["is-admin", sessionUser?.id ?? null],
    queryFn: () => checkIsAdmin(),
    enabled: !!sessionUser,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  useEffect(() => {
    setAdminCheckTimedOut(false);
    if (!sessionUser || !adminQuery.isLoading) return;
    const timeout = window.setTimeout(() => setAdminCheckTimedOut(true), 6000);
    return () => window.clearTimeout(timeout);
  }, [sessionUser, adminQuery.isLoading]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const refreshAll = () => {
    qc.invalidateQueries();
  };

  // Pantalla de carga inicial
  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // No autenticado -> login
  if (!sessionUser) {
    return <AdminLogin />;
  }

  // Autenticado pero comprobando rol
  if (adminQuery.isLoading && !adminCheckTimedOut) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-xs text-muted-foreground">Comprobando permisos…</p>
      </div>
    );
  }

  // Error verificando rol -> permitir reintento o cerrar sesión
  if (adminQuery.isError || adminCheckTimedOut) {
    return (
      <AdminCheckError
        email={sessionUser.email}
        error={adminQuery.error instanceof Error ? adminQuery.error : null}
        timedOut={adminCheckTimedOut && !adminQuery.isError}
        onRetry={() => {
          setAdminCheckTimedOut(false);
          adminQuery.refetch();
        }}
      />
    );
  }

  // Autenticado pero NO admin -> bloqueo
  if (!adminQuery.data?.isAdmin) {
    return <AdminForbidden email={sessionUser.email} />;
  }

  const logout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="h-[100dvh] flex bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 border-r bg-card overflow-y-auto transition-transform md:static md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="p-4 border-b">
          <div className="flex items-center gap-2 font-bold">
            <ShieldCheck className="h-5 w-5 text-primary" /> Admin
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 truncate">
            {sessionUser.email ?? "Sesión admin"}
          </p>
        </div>
        <nav className="p-2 space-y-0.5">
          {SECTIONS.map((s) => (
            <NavItem key={s.to} {...s} />
          ))}
          <div className="pt-3 pb-1 px-2 text-[10px] uppercase tracking-wide text-muted-foreground">
            Agente IA
          </div>
          {IA_SECTIONS.map((s) => (
            <NavItem key={s.to} {...s} />
          ))}
          <div className="pt-3 pb-1 px-2 text-[10px] uppercase tracking-wide text-muted-foreground">
            Herramientas
          </div>
          {HERRAMIENTAS.map((s) => (
            <NavItem key={s.to} {...s} />
          ))}
        </nav>
        <div className="p-3 border-t mt-2 space-y-1">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={refreshAll}
            disabled={isFetching > 0}
            title="Actualiza todos los datos visibles en el panel"
          >
            <RefreshCw
              className={cn("h-4 w-4 mr-2", isFetching > 0 && "animate-spin")}
            />
            {isFetching > 0 ? "Actualizando…" : "Actualizar todo"}
          </Button>
          <Button variant="ghost" size="sm" className="w-full" onClick={logout}>
            Cerrar sesión
          </Button>
        </div>
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="md:hidden sticky top-0 z-20 flex items-center gap-2 bg-card border-b px-3 py-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(true)}
          >
            <MenuIcon className="h-5 w-5" />
          </Button>
          <span className="text-sm font-semibold">Admin</span>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto"
            onClick={refreshAll}
            disabled={isFetching > 0}
            title="Actualizar todos los datos"
          >
            <RefreshCw className={cn("h-5 w-5", isFetching > 0 && "animate-spin")} />
          </Button>
        </div>
        <div className="p-4 md:p-8 max-w-6xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function NavItem({
  to,
  label,
  icon: Icon,
  exact,
}: {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
}) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: !!exact }}
      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors [&.active]:bg-primary/10 [&.active]:text-primary [&.active]:font-medium"
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) setError(error.message);
  };

  const onGoogle = async () => {
    setError(null);
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: typeof window !== "undefined" ? `${window.location.origin}/admin` : undefined,
    });
    if (result.error) {
      setError(result.error.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" /> Acceso administrador
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={onGoogle}
            disabled={loading}
          >
            Continuar con Google
          </Button>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            o con email
            <div className="h-px flex-1 bg-border" />
          </div>
          <form onSubmit={onEmailLogin} className="space-y-3">
            <Input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email"
              required
            />
            <Input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="contraseña"
              required
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Entrando…" : "Entrar"}
            </Button>
          </form>
          <p className="text-[11px] text-muted-foreground text-center">
            Solo cuentas autorizadas pueden acceder.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function AdminCheckError({
  email,
  error,
  timedOut,
  onRetry,
}: {
  email: string | null;
  error: Error | null;
  timedOut?: boolean;
  onRetry: () => void;
}) {
  const logout = async () => {
    await supabase.auth.signOut();
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="h-5 w-5" /> No se pudo verificar permisos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Hubo un problema comprobando los permisos de{" "}
            <span className="font-medium">{email ?? "tu cuenta"}</span>.
          </p>
          <p className="text-[11px] text-muted-foreground break-words">
            {timedOut
              ? "La comprobación tardó demasiado. Puedes reintentar o volver a iniciar sesión."
              : error?.message ?? "Error desconocido"}
          </p>
          <Button className="w-full" onClick={onRetry}>
            Reintentar
          </Button>
          <Button variant="outline" className="w-full" onClick={logout}>
            Cerrar sesión
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function AdminForbidden({ email }: { email: string | null }) {
  const logout = async () => {
    await supabase.auth.signOut();
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="h-5 w-5" /> Sin permisos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            La cuenta <span className="font-medium">{email ?? "actual"}</span> no
            tiene permisos de administrador.
          </p>
          <Button variant="outline" className="w-full" onClick={logout}>
            Cerrar sesión
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
