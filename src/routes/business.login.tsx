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
  const [mode, setMode] = useState<"sign_in" | "sign_up">("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/business" });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "sign_in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Sesión iniciada");
        navigate({ to: "/business" });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/business` },
        });
        if (error) throw error;
        toast.success("Cuenta creada. Revisa tu email para confirmar.");
        setMode("sign_in");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col justify-center bg-background px-4">
      <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
        <h1 className="text-lg font-semibold">Business · Alicante Friend</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Acceso privado para negocios partner.
        </p>

        <form onSubmit={submit} className="mt-5 space-y-3">
          <label className="flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2.5">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@negocio.com"
              className="w-full bg-transparent text-sm outline-none"
            />
          </label>
          <label className="flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2.5">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña (mín. 8)"
              className="w-full bg-transparent text-sm outline-none"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "sign_in" ? "Entrar" : "Crear cuenta"}
          </button>
        </form>

        <button
          onClick={() => setMode((m) => (m === "sign_in" ? "sign_up" : "sign_in"))}
          className="mt-4 w-full text-center text-xs text-muted-foreground underline"
        >
          {mode === "sign_in" ? "Crear cuenta nueva" : "Ya tengo cuenta"}
        </button>
      </div>
    </div>
  );
}
