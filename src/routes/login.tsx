import { useState } from "react";
import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { ArrowLeft, User as UserIcon, Sparkles, Mail } from "lucide-react";
import { toast } from "sonner";
import { signInOrSignUp } from "@/hooks/useAuth";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" ? s.redirect : "/",
  }),
  head: () => ({
    meta: [{ title: "Entrar — Alicante Friend (Beta)" }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { redirect } = useSearch({ from: "/login" });
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [needsSignup, setNeedsSignup] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const em = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      toast.error("Email no válido");
      return;
    }
    if (needsSignup) {
      if (name.trim().length < 2) return toast.error("Nombre obligatorio");
      if (surname.trim().length < 2) return toast.error("Apellido obligatorio");
    }
    setBusy(true);
    try {
      const user = await signInOrSignUp({
        email: em,
        name: needsSignup ? name : undefined,
        surname: needsSignup ? surname : undefined,
      });
      toast.success(`¡Bienvenido/a, ${user.name}!`);
      window.location.assign(redirect);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error";
      if (msg === "SIGNUP_REQUIRED") {
        setNeedsSignup(true);
        toast.message("Cuenta nueva", {
          description: "Completa nombre y apellido para registrarte.",
        });
      } else {
        toast.error(msg);
      }
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
        <h1 className="text-base font-semibold">
          {needsSignup ? "Crear cuenta" : "Entrar"}
        </h1>
        <span className="w-[64px]" />
      </header>

      <section className="rounded-3xl gradient-warm p-5 text-primary-foreground shadow-soft">
        <p className="inline-flex items-center gap-1 rounded-full bg-white/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest">
          <Sparkles className="h-3 w-3" /> Beta
        </p>
        <h2 className="mt-2 text-lg font-semibold">
          {needsSignup ? "¡Bienvenido/a! Completa tus datos" : "Inicia sesión con tu email"}
        </h2>
        <p className="mt-1 text-sm opacity-95">
          {needsSignup
            ? "Tu email será tu usuario para futuros inicios de sesión. 🤙"
            : "Si ya estás registrado, entrarás directamente. Si no, te pediremos nombre y apellido."}
        </p>
      </section>

      <form onSubmit={handleSubmit} className="mt-5 space-y-3">
        <label className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2.5">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <input
            type="email"
            required
            maxLength={120}
            autoFocus
            placeholder="Email (tu usuario)"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (needsSignup) setNeedsSignup(false);
            }}
            className="w-full bg-transparent text-sm outline-none"
          />
        </label>

        {needsSignup && (
          <>
            <label className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2.5">
              <UserIcon className="h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                required
                minLength={2}
                maxLength={60}
                placeholder="Nombre"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-transparent text-sm outline-none"
              />
            </label>

            <label className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2.5">
              <UserIcon className="h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                required
                minLength={2}
                maxLength={60}
                placeholder="Apellido"
                value={surname}
                onChange={(e) => setSurname(e.target.value)}
                className="w-full bg-transparent text-sm outline-none"
              />
            </label>
          </>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full gradient-warm py-3 text-sm font-semibold text-primary-foreground shadow-soft active:scale-95 disabled:opacity-60"
        >
          {busy ? "Cargando…" : needsSignup ? "Crear cuenta" : "Continuar"}
        </button>

        <p className="text-center text-[11px] text-muted-foreground">
          Beta con usuarios de prueba. Al lanzar el dominio usaremos auth real.
        </p>
      </form>
    </div>
  );
}
