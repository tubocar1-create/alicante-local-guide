import { useState } from "react";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { ArrowLeft, User as UserIcon, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { signInWithName } from "@/hooks/useAuth";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" ? s.redirect : "/",
  }),
  head: () => ({
    meta: [{ title: "Tu nombre — Alicante Friend (Beta)" }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { redirect } = useSearch({ from: "/login" });
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      toast.error("Pon al menos 2 letras 🙃");
      return;
    }
    setBusy(true);
    signInWithName(trimmed);
    toast.success(`¡Bienvenido/a, ${trimmed}!`);
    // Use a hard navigation so search params (?ref=...) reach the target route reliably.
    window.location.assign(redirect);
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
        <h1 className="text-base font-semibold">Tu nombre</h1>
        <span className="w-[64px]" />
      </header>

      <section className="rounded-3xl gradient-warm p-5 text-primary-foreground shadow-soft">
        <p className="inline-flex items-center gap-1 rounded-full bg-white/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest">
          <Sparkles className="h-3 w-3" /> Beta
        </p>
        <h2 className="mt-2 text-lg font-semibold">¡Hola! ¿Cómo te llamas?</h2>
        <p className="mt-1 text-sm opacity-95">
          De momento, en la versión beta nos basta con un nombre para identificarte y guardar tus
          QR. Cuando salgamos de beta, añadiremos autenticación real (Google, email…). 🤙
        </p>
      </section>

      <form onSubmit={handleSubmit} className="mt-5 space-y-3">
        <label className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2.5">
          <UserIcon className="h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            required
            minLength={2}
            maxLength={60}
            autoFocus
            placeholder="Tu nombre o apodo"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-transparent text-sm outline-none"
          />
        </label>

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full gradient-warm py-3 text-sm font-semibold text-primary-foreground shadow-soft active:scale-95 disabled:opacity-60"
        >
          Empezar
        </button>

        <p className="text-center text-[11px] text-muted-foreground">
          Al continuar aceptas que esto es una versión de prueba con usuarios ficticios.
        </p>
      </form>
    </div>
  );
}
