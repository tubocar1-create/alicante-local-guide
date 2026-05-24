import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/auth/signup")({
  head: () => ({
    meta: [
      { title: "Crear cuenta · Alicante Friend" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SignupPage,
});

const Schema = z
  .object({
    full_name: z.string().trim().min(2, "Mínimo 2 caracteres").max(80),
    email: z.string().trim().email("Email inválido").max(255),
    password: z.string().min(8, "Mínimo 8 caracteres").max(72),
    confirm: z.string(),
    terms: z.literal(true, { errorMap: () => ({ message: "Debes aceptar los términos" }) }),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Las contraseñas no coinciden",
    path: ["confirm"],
  });

function SignupPage() {
  const nav = useNavigate();
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    confirm: "",
    terms: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    const parsed = Schema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        errs[issue.path.join(".")] = issue.message;
      }
      setErrors(errs);
      return;
    }
    setBusy(true);
    try {
      const redirectTo = window.location.origin + "/auth/verify-email";
      const { data, error } = await supabase.auth.signUp({
        email: parsed.data.email.toLowerCase(),
        password: parsed.data.password,
        options: {
          emailRedirectTo: redirectTo,
          data: { full_name: parsed.data.full_name },
        },
      });
      if (error) {
        if (/already/i.test(error.message)) {
          toast.error("Ese email ya está registrado. Inicia sesión.");
        } else {
          toast.error(error.message);
        }
        return;
      }
      // Consent + profile fields
      if (data.user) {
        await supabase.from("user_consents").insert({
          user_id: data.user.id,
          consent_type: "terms_and_privacy",
          version: "v1",
        });
        await supabase
          .from("profiles")
          .update({
            full_name: parsed.data.full_name,
            terms_accepted_at: new Date().toISOString(),
            login_method: "email",
          })
          .eq("id", data.user.id);
      }
      nav({ to: "/auth/verify-email", search: { email: parsed.data.email } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setBusy(true);
    try {
      const res = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (res.error) toast.error("No se pudo iniciar con Google");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-svh bg-background px-4 py-6">
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> Inicio
      </Link>
      <div className="mx-auto mt-4 max-w-md rounded-3xl border border-border bg-card p-6 shadow-soft">
        <h1 className="text-xl font-bold">Crear cuenta</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Únete a Alicante Friend en menos de un minuto.
        </p>

        <button
          type="button"
          onClick={google}
          disabled={busy}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-full border border-border bg-background py-3 text-sm font-semibold active:scale-95 disabled:opacity-60"
        >
          <GoogleIcon /> Continuar con Google
        </button>

        <div className="my-4 flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
          <span className="h-px flex-1 bg-border" />o<span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={submit} className="space-y-3">
          <Field label="Nombre visible" error={errors.full_name}>
            <input
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              className="input"
              autoComplete="name"
            />
          </Field>
          <Field label="Email" error={errors.email}>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="input"
              autoComplete="email"
            />
          </Field>
          <Field label="Contraseña" error={errors.password}>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="input"
              autoComplete="new-password"
            />
          </Field>
          <Field label="Confirmar contraseña" error={errors.confirm}>
            <input
              type="password"
              value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
              className="input"
              autoComplete="new-password"
            />
          </Field>
          <label className="flex items-start gap-2 text-xs">
            <input
              type="checkbox"
              checked={form.terms}
              onChange={(e) => setForm({ ...form, terms: e.target.checked })}
              className="mt-0.5"
            />
            <span>
              Acepto los{" "}
              <Link to="/legal/terminos" className="underline">
                términos
              </Link>{" "}
              y la{" "}
              <Link to="/legal/privacidad" className="underline">
                política de privacidad
              </Link>
              .
            </span>
          </label>
          {errors.terms && <p className="text-xs text-destructive">{errors.terms}</p>}

          <button
            type="submit"
            disabled={busy}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground active:scale-95 disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Crear cuenta
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          ¿Ya tienes cuenta?{" "}
          <Link to="/auth/login" className="font-semibold text-primary">
            Iniciar sesión
          </Link>
        </p>
      </div>
      <style>{`.input{width:100%;border:1px solid hsl(var(--border));background:hsl(var(--background));border-radius:14px;padding:.65rem .75rem;font-size:.875rem;outline:none}.input:focus{border-color:hsl(var(--primary))}`}</style>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-destructive">{error}</span>}
    </label>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.4-1.6 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.4 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z" />
    </svg>
  );
}
