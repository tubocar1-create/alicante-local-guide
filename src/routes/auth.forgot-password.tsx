import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/forgot-password")({
  head: () => ({
    meta: [
      { title: "Recuperar contraseña · Alicante Friend" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ForgotPage,
});

function ForgotPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: window.location.origin + "/auth/reset-password",
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      setSent(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-svh bg-background px-4 py-6">
      <Link to="/auth/login" className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <ArrowLeft className="h-3 w-3" /> Volver
      </Link>
      <div className="mx-auto mt-4 max-w-md rounded-3xl border border-border bg-card p-6 shadow-soft">
        <h1 className="text-xl font-bold">Recuperar contraseña</h1>

        {sent ? (
          <div className="mt-4 space-y-3 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
            <p className="text-sm">
              📩 Te hemos enviado un enlace de recuperación a <strong>{email}</strong>.
            </p>
            <p className="text-xs text-muted-foreground">
              Revisa tu correo (y la carpeta de spam). El enlace caduca en 1 hora.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              Introduce tu email y te enviaremos un enlace para crear una nueva contraseña.
            </p>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="tu@email.com"
              required
            />
            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground active:scale-95 disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Enviar enlace
            </button>
          </form>
        )}
      </div>
      <style>{`.input{width:100%;border:1px solid hsl(var(--border));background:hsl(var(--background));border-radius:14px;padding:.65rem .75rem;font-size:.875rem;outline:none}`}</style>
    </div>
  );
}
