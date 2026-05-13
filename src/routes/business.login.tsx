import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Home } from "lucide-react";

export const Route = createFileRoute("/business/login")({
  head: () => ({
    meta: [
      { title: "Business login · Alicante Friend" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: BusinessLogin,
});

function BusinessLogin() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/business" });
    });
  }, [navigate]);

  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col justify-center bg-background px-4">
      <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
        <h1 className="text-lg font-semibold">Business · Alicante Friend</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Acceso privado para negocios partner. Próximamente.
        </p>

        <button
          onClick={() => navigate({ to: "/" })}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground"
        >
          <Home className="h-4 w-4" />
          Ir al menú principal
        </button>
      </div>
    </div>
  );
}
