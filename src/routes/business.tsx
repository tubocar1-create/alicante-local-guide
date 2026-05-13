import { createFileRoute, Link, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useBusinessAuth } from "@/hooks/useBusinessAuth";
import { Loader2, LayoutDashboard, QrCode, Calendar, Users, BarChart3, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/business")({
  head: () => ({
    meta: [
      { title: "Business · Alicante Friend" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: BusinessLayout,
});

function BusinessLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loading, isAuthenticated, signOut } = useBusinessAuth();

  // Rutas públicas dentro del módulo business (no requieren sesión)
  const isPublicRoute =
    location.pathname === "/business/login" ||
    location.pathname === "/business/onboarding";

  if (isPublicRoute) {
    return (
      <div className="mx-auto min-h-svh max-w-md bg-background px-4 py-8">
        <Outlet />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-2xl flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <Link to="/business" className="text-sm font-semibold">
          Business <span className="text-muted-foreground">· Alicante Friend</span>
        </Link>
        <button
          onClick={async () => { await signOut(); navigate({ to: "/" }); }}
          className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground"
        >
          <LogOut className="h-3 w-3" /> Salir
        </button>
      </header>

      <main className="flex-1 px-4 py-4 pb-24">
        <Outlet />
      </main>

      <BottomNav />
    </div>
  );
}

function BottomNav() {
  const items = [
    { to: "/business", icon: LayoutDashboard, label: "Inicio" },
    { to: "/business/qr", icon: QrCode, label: "Validar" },
    { to: "/business/bookings", icon: Calendar, label: "Reservas" },
    { to: "/business/referrals", icon: Users, label: "Refer." },
    { to: "/business/metrics", icon: BarChart3, label: "Métricas" },
  ] as const;
  return (
    <nav className="fixed inset-x-0 bottom-0 mx-auto max-w-2xl border-t border-border bg-card/95 px-2 py-1.5 backdrop-blur">
      <ul className="flex items-center justify-around">
        {items.map((it) => (
          <li key={it.to}>
            <Link
              to={it.to}
              activeOptions={{ exact: it.to === "/business" }}
              activeProps={{ className: "text-primary" }}
              className={cn(
                "flex min-w-[56px] flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-[10px] text-muted-foreground",
              )}
            >
              <it.icon className="h-4 w-4" />
              {it.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
