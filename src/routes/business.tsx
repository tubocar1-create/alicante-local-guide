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
  const { loading, isAuthenticated, isBusinessUser, user, signOut } = useBusinessAuth();

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) navigate({ to: "/business/login" });
  }, [loading, isAuthenticated, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  if (!isBusinessUser) {
    return (
      <div className="mx-auto max-w-md px-4 py-10">
        <div className="rounded-2xl border border-border bg-card p-5 text-sm">
          <h1 className="text-base font-semibold">Cuenta sin acceso</h1>
          <p className="mt-2 text-muted-foreground">
            Tu cuenta ({user?.email}) no tiene rol de negocio. Pide acceso al administrador o solicita registro como negocio.
          </p>
          <div className="mt-4 flex gap-2">
            <Link
              to="/business/onboarding"
              className="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
            >
              Solicitar acceso
            </Link>
            <button
              onClick={() => signOut()}
              className="rounded-full border border-border px-3 py-1.5 text-xs"
            >
              Salir
            </button>
          </div>
        </div>
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
          onClick={() => signOut()}
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
    { to: "/business/qr", icon: QrCode, label: "QR" },
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
