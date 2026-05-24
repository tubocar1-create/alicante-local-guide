import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, MailCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/verify-email")({
  validateSearch: (s: Record<string, unknown>) => ({
    email: typeof s.email === "string" ? s.email : "",
  }),
  head: () => ({
    meta: [
      { title: "Verifica tu email · Alicante Friend" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const { email } = Route.useSearch();
  const [busy, setBusy] = useState(false);

  async function resend() {
    if (!email) {
      toast.error("Falta el email");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: window.location.origin + "/auth/verify-email" },
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Correo reenviado");
  }

  return (
    <div className="min-h-svh bg-background px-4 py-6">
      <div className="mx-auto mt-8 max-w-md rounded-3xl border border-border bg-card p-6 text-center shadow-soft">
        <MailCheck className="mx-auto h-12 w-12 text-primary" />
        <h1 className="mt-3 text-xl font-bold">📩 Verifica tu email</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Hemos enviado un correo de verificación{email && <> a <strong>{email}</strong></>}.
          Haz clic en el enlace para activar tu cuenta.
        </p>
        <button
          onClick={resend}
          disabled={busy}
          className="mt-5 inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-xs font-semibold active:scale-95 disabled:opacity-60"
        >
          {busy && <Loader2 className="h-3 w-3 animate-spin" />}
          Reenviar correo
        </button>
        <p className="mt-6 text-xs text-muted-foreground">
          ¿Ya lo verificaste?{" "}
          <Link to="/auth/login" className="font-semibold text-primary">
            Iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
