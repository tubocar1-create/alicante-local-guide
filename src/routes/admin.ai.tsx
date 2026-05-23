// Layout route for the AI observability & training center.
// All children share the admin PIN gate (enforced by /admin parent layout).
import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/ai")({
  head: () => ({ meta: [{ title: "Admin · Agente IA" }] }),
  component: AdminAiLayout,
});

const TABS = [
  { to: "/admin/ai", label: "Resumen", exact: true },
  { to: "/admin/ai/conversations", label: "Conversaciones" },
  { to: "/admin/ai/unknown-queries", label: "Sin resolver" },
  { to: "/admin/ai/dubious", label: "Dudosas" },
  { to: "/admin/ai/supervision", label: "Supervisión" },
  { to: "/admin/ai/intents", label: "Intents" },
  { to: "/admin/ai/entities", label: "Entidades" },
  { to: "/admin/ai/analytics", label: "Analítica" },
  { to: "/admin/ai/costs", label: "Costes" },
];

function AdminAiLayout() {
  const loc = useLocation();
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">Centro de control · Agente IA</h1>
        <p className="text-sm text-muted-foreground">
          Observa el comportamiento del agente, revisa consultas reales y corrige el
          sistema sin programar.
        </p>
      </header>

      <div className="flex flex-wrap gap-1 border-b">
        {TABS.map((t) => {
          const active = t.exact
            ? loc.pathname === t.to
            : loc.pathname.startsWith(t.to);
          return (
            <Link
              key={t.to}
              to={t.to}
              className={cn(
                "px-3 py-2 text-sm border-b-2 -mb-px transition-colors",
                active
                  ? "border-primary text-foreground font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      <Outlet />
    </div>
  );
}
