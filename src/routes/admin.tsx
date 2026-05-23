import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Lock,
  ShieldCheck,
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ADMIN_PIN, PIN_KEY } from "@/lib/admin-shared";
import { cn } from "@/lib/utils";

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
  { to: "/admin/usuarios", label: "Usuarios", icon: Users },
  { to: "/admin/arquitectura", label: "Arquitectura", icon: Network },
  { to: "/admin/integraciones", label: "Integraciones", icon: PlugZap },
  { to: "/admin/bases-datos", label: "Bases de datos", icon: Database },
  { to: "/admin/metricas-internas", label: "Métricas internas", icon: BarChart3 },
  { to: "/admin/metricas-externas", label: "Métricas externas", icon: Globe },
] as const;

const HERRAMIENTAS = [
  { to: "/admin/places", label: "Poblar sitios", icon: MapPinned },
  { to: "/admin/salud", label: "Poblar salud", icon: HeartPulse },
  { to: "/admin/system", label: "Sistema", icon: Wrench },
] as const;

function AdminLayout() {
  useAdminManifest();
  const [pin, setPin] = useState("");
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem(PIN_KEY) === "1") {
      setAuthed(true);
    }
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

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

  const logout = () => {
    sessionStorage.removeItem(PIN_KEY);
    window.location.reload();
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
          <p className="text-[11px] text-muted-foreground mt-1">
            Panel privado · noindex
          </p>
        </div>
        <nav className="p-2 space-y-0.5">
          {SECTIONS.map((s) => (
            <NavItem key={s.to} {...s} />
          ))}
          <div className="pt-3 pb-1 px-2 text-[10px] uppercase tracking-wide text-muted-foreground">
            Herramientas
          </div>
          {HERRAMIENTAS.map((s) => (
            <NavItem key={s.to} {...s} />
          ))}
        </nav>
        <div className="p-3 border-t mt-2">
          <Button variant="ghost" size="sm" className="w-full" onClick={logout}>
            Salir
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
