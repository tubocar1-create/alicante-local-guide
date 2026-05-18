import { useState } from "react";
import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { ArrowLeft, User as UserIcon, Sparkles, Mail, KeyRound, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { signInOrSignUp } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

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
  const [welcomeNew, setWelcomeNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [recoverOpen, setRecoverOpen] = useState(false);
  const [recoverEmail, setRecoverEmail] = useState("");
  const [recoverLink, setRecoverLink] = useState<string | null>(null);
  const [recoverBusy, setRecoverBusy] = useState(false);

  async function handleRecover(e: React.FormEvent) {
    e.preventDefault();
    const em = recoverEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      toast.error("Email no válido");
      return;
    }
    setRecoverBusy(true);
    try {
      const { data, error } = await supabase
        .from("test_users")
        .select("email")
        .eq("email", em)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        toast.error("No encontramos esa cuenta");
        return;
      }
      const token = encodeURIComponent(btoa(`${em}|${Date.now()}`));
      const url = `${window.location.origin}/magic?token=${token}`;
      setRecoverLink(url);
      toast.success("Enlace generado", { description: "Válido 15 minutos" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setRecoverBusy(false);
    }
  }

  async function copyLink() {
    if (!recoverLink) return;
    try {
      await navigator.clipboard.writeText(recoverLink);
      toast.success("Enlace copiado");
    } catch {
      toast.error("No se pudo copiar");
    }
  }

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
        setWelcomeNew(true);
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
          {welcomeNew && !needsSignup ? "¡Hola!" : needsSignup ? "Crear cuenta" : "Entrar"}
        </h1>
        <span className="w-[64px]" />
      </header>

      {welcomeNew && !needsSignup ? (
        <section className="rounded-3xl gradient-warm p-6 text-primary-foreground shadow-soft">
          <p className="inline-flex items-center gap-1 rounded-full bg-white/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest">
            <Sparkles className="h-3 w-3" /> Nueva por aquí
          </p>
          <h2 className="mt-3 text-2xl font-semibold leading-tight">
            ¡Bienvenido/a a Alicante Friend! 👋
          </h2>
          <p className="mt-2 text-sm opacity-95">
            Aún no tienes cuenta con <span className="font-semibold">{email}</span>.
            Tardas menos de 10 segundos en crearla y empezamos a explorar Alicante juntos.
          </p>
          <button
            type="button"
            onClick={() => setNeedsSignup(true)}
            className="mt-5 w-full rounded-full bg-white py-3 text-sm font-semibold text-primary shadow-soft active:scale-95"
          >
            Crear mi cuenta
          </button>
          <button
            type="button"
            onClick={() => {
              setWelcomeNew(false);
              setEmail("");
            }}
            className="mt-2 w-full rounded-full bg-white/15 py-2.5 text-xs font-medium text-primary-foreground active:scale-95"
          >
            Usar otro email
          </button>
        </section>
      ) : (
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
              : "Si ya estás registrado, entrarás directamente. Si no, te damos la bienvenida."}
          </p>
        </section>
      )}

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

        {!needsSignup && (
          <button
            type="button"
            onClick={() => setRecoverOpen((v) => !v)}
            className="mx-auto block text-center text-xs font-medium text-primary underline-offset-2 hover:underline"
          >
            ¿Olvidaste tu acceso?
          </button>
        )}
      </form>

      {recoverOpen && !needsSignup && (
        <section className="mt-5 rounded-3xl border border-border bg-card p-4 shadow-soft">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <KeyRound className="h-4 w-4 text-primary" /> Recuperar acceso
          </h3>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Modo beta: generamos un enlace en pantalla (en producción se enviará por correo).
          </p>

          <form onSubmit={handleRecover} className="mt-3 space-y-2">
            <label className="flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2.5">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <input
                type="email"
                required
                maxLength={120}
                placeholder="Tu email registrado"
                value={recoverEmail}
                onChange={(e) => setRecoverEmail(e.target.value)}
                className="w-full bg-transparent text-sm outline-none"
              />
            </label>
            <button
              type="submit"
              disabled={recoverBusy}
              className="w-full rounded-full bg-primary py-2.5 text-xs font-semibold text-primary-foreground active:scale-95 disabled:opacity-60"
            >
              {recoverBusy ? "Generando…" : "Generar enlace de acceso"}
            </button>
          </form>

          {recoverLink && (
            <div className="mt-3 space-y-2 rounded-2xl bg-secondary/60 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Tu enlace (15 min)
              </p>
              <p className="break-all rounded-lg bg-background p-2 text-[11px]">
                {recoverLink}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={copyLink}
                  className="flex-1 inline-flex items-center justify-center gap-1 rounded-full bg-secondary py-2 text-xs font-semibold text-secondary-foreground active:scale-95"
                >
                  <Copy className="h-3.5 w-3.5" /> Copiar
                </button>
                <a
                  href={recoverLink}
                  className="flex-1 inline-flex items-center justify-center gap-1 rounded-full bg-primary py-2 text-xs font-semibold text-primary-foreground active:scale-95"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Abrir
                </a>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
