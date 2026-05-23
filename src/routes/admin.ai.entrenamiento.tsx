// Wrapper de Entrenamiento: agrupa Intents y Entidades (proper nouns)
// como sub-pestañas internas. Reutiliza las rutas existentes vía Link
// + Outlet pattern, sin duplicar lógica.
import { createFileRoute, Link, Outlet, useLocation, redirect } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/ai/entrenamiento")({
  beforeLoad: ({ location }) => {
    if (location.pathname === "/admin/ai/entrenamiento") {
      throw redirect({ to: "/admin/ai/intents" });
    }
  },
  component: TrainingLayout,
});

const SUB_TABS = [
  { to: "/admin/ai/intents", label: "Intents" },
  { to: "/admin/ai/entities", label: "Entidades / nombres propios" },
];

function TrainingLayout() {
  const loc = useLocation();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 border-b">
        {SUB_TABS.map((t) => {
          const active = loc.pathname.startsWith(t.to);
          return (
            <Link
              key={t.to}
              to={t.to}
              className={cn(
                "px-3 py-1.5 text-xs rounded-t-md transition-colors",
                active
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground",
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
