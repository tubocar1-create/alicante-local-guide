import { useEffect, useState } from "react";
import { createFileRoute, useSearch, Link } from "@tanstack/react-router";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const KEY = "beta_user_v1";
const EVT = "beta-user-changed";
const MAX_AGE_MS = 15 * 60 * 1000; // 15 min

export const Route = createFileRoute("/magic")({
  validateSearch: (s: Record<string, unknown>) => ({
    token: typeof s.token === "string" ? s.token : "",
    redirect: typeof s.redirect === "string" ? s.redirect : "/",
  }),
  head: () => ({ meta: [{ title: "Acceso — Alicante Friend" }] }),
  component: MagicPage,
});

function decodeToken(token: string): { email: string; ts: number } | null {
  try {
    const raw = atob(decodeURIComponent(token));
    const [email, tsStr] = raw.split("|");
    const ts = Number(tsStr);
    if (!email || !Number.isFinite(ts)) return null;
    return { email, ts };
  } catch {
    return null;
  }
}

function MagicPage() {
  const { token, redirect } = useSearch({ from: "/magic" });
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [msg, setMsg] = useState("Validando enlace…");

  useEffect(() => {
    (async () => {
      const decoded = decodeToken(token);
      if (!decoded) {
        setStatus("error");
        setMsg("Enlace inválido");
        return;
      }
      if (Date.now() - decoded.ts > MAX_AGE_MS) {
        setStatus("error");
        setMsg("Enlace caducado. Genera uno nuevo.");
        return;
      }
      const { data, error } = await supabase
        .from("test_users")
        .select("id, name, surname, email, created_at")
        .eq("email", decoded.email.toLowerCase())
        .maybeSingle();
      if (error || !data) {
        setStatus("error");
        setMsg("No encontramos esta cuenta.");
        return;
      }
      const user = {
        id: data.id,
        name: data.name,
        surname: data.surname ?? undefined,
        email: data.email ?? undefined,
        createdAt: data.created_at,
      };
      localStorage.setItem(KEY, JSON.stringify(user));
      window.dispatchEvent(new Event(EVT));
      setStatus("ok");
      setMsg(`¡Bienvenido/a, ${user.name}! Redirigiendo…`);
      setTimeout(() => window.location.assign(redirect || "/"), 800);
    })();
  }, [token, redirect]);

  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center bg-background px-6 text-center">
      {status === "loading" && (
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      )}
      {status === "ok" && <CheckCircle2 className="h-10 w-10 text-primary" />}
      {status === "error" && <XCircle className="h-10 w-10 text-destructive" />}
      <p className="mt-3 text-sm text-foreground">{msg}</p>
      {status === "error" && (
        <Link
          to="/login"
          className="mt-4 rounded-full bg-secondary px-4 py-2 text-xs font-semibold text-secondary-foreground"
        >
          Volver a entrar
        </Link>
      )}
    </div>
  );
}
