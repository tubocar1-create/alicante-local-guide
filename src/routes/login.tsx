import { useState } from "react";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { ArrowLeft, Mail, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" ? s.redirect : "/",
  }),
  head: () => ({
    meta: [{ title: "Iniciar sesión — Alicante Friend" }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { redirect } = useSearch({ from: "/login" });
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleGoogle() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + redirect,
    });
    if (result.error) {
      toast.error("No se pudo iniciar sesión con Google");
      setBusy(false);
    }
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + redirect },
        });
        if (error) throw error;
        toast.success("¡Cuenta creada! Ya puedes seguir.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("¡Hola de nuevo!");
      }
      navigate({ to: redirect });
    } catch (err: any) {
      toast.error(err.message ?? "Error de autenticación");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col bg-background px-4 pb-16 pt-4">
      <header className="mb-6 flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-xs text-secondary-foreground active:scale-95"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Volver
        </Link>
        <h1 className="text-base font-semibold">Tu cuenta</h1>
        <span className="w-[64px]" />
      </header>

      <section className="rounded-3xl gradient-warm p-5 text-primary-foreground shadow-soft">
        <h2 className="text-lg font-semibold">¡Bienvenida/o!</h2>
        <p className="mt-1 text-sm opacity-95">
          Inicia sesión para generar tus QR de referencia y guardarlos en tu perfil.
        </p>
      </section>

      <button
        onClick={handleGoogle}
        disabled={busy}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-full border border-border bg-background py-3 text-sm font-semibold shadow-soft active:scale-95 disabled:opacity-60"
      >
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"/>
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 18.9 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34 7.6 29.3 5.5 24 5.5c-7.7 0-14.4 4.4-17.7 10.7z"/>
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.5-5.2l-6.2-5.2c-2 1.4-4.5 2.4-7.3 2.4-5.3 0-9.7-3.1-11.3-7.4l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.2 5.2C40.7 36 44 30.6 44 24c0-1.2-.1-2.3-.4-3.5z"/>
        </svg>
        Continuar con Google
      </button>

      <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-widest text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        o con email
        <div className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handleEmail} className="space-y-2">
        <label className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2.5">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="tu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-transparent text-sm outline-none"
          />
        </label>
        <label className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2.5">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <input
            type="password"
            required
            minLength={6}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-transparent text-sm outline-none"
          />
        </label>

        <button
          type="submit"
          disabled={busy}
          className="mt-2 w-full rounded-full gradient-warm py-3 text-sm font-semibold text-primary-foreground shadow-soft active:scale-95 disabled:opacity-60"
        >
          {mode === "signup" ? "Crear cuenta" : "Entrar"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => setMode((m) => (m === "signup" ? "signin" : "signup"))}
        className="mt-3 text-center text-xs text-muted-foreground underline"
      >
        {mode === "signup" ? "¿Ya tienes cuenta? Inicia sesión" : "¿Nuevo aquí? Crea una cuenta"}
      </button>
    </div>
  );
}
