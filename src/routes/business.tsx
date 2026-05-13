import { createFileRoute, Link, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useBusinessAuth } from "@/hooks/useBusinessAuth";
import { Loader2, LogOut } from "lucide-react";

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

      <main className="flex-1 px-4 py-4">
        <Outlet />
      </main>
    </div>
  );
}
