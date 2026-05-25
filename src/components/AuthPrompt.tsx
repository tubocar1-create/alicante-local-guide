import { useEffect, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

/**
 * Sistema de solicitud contextual de registro.
 *
 * El modo invitado puede navegar libremente. Cuando una función requiere
 * persistencia (favoritos, historial, reservas, perfil...), se llama a
 * `requestAuth({ feature, message })` para abrir este diálogo.
 */

const EVT = "vamos-auth-prompt";

export type AuthPromptOptions = {
  /** Identificador de la función que disparó el prompt (analítica). */
  feature?: string;
  /** Mensaje contextual mostrado al usuario. */
  message?: string;
  /** Ruta a la que volver tras el login. Por defecto, la actual. */
  redirect?: string;
};

/**
 * Lanza el diálogo de registro contextual desde cualquier parte de la app.
 * No bloquea la navegación: solo invita al registro cuando aparece valor real.
 */
export function requestAuth(_opts: AuthPromptOptions = {}) {
  // MODO LIBRE: no-op. Navegación anónima sin prompts.
  // Para reactivar: window.dispatchEvent(new CustomEvent(EVT, { detail: _opts }));
  return;
}

export function AuthPromptDialog() {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<AuthPromptOptions>({});

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<AuthPromptOptions>).detail ?? {};
      setOpts(detail);
      setOpen(true);
    };
    window.addEventListener(EVT, handler);
    return () => window.removeEventListener(EVT, handler);
  }, []);

  const redirect =
    opts.redirect ??
    (typeof window !== "undefined"
      ? window.location.pathname + window.location.search
      : "/");
  const redirectParam = `?redirect=${encodeURIComponent(redirect)}`;

  const close = useCallback(() => setOpen(false), []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">
            Crea una cuenta para continuar
          </DialogTitle>
          <DialogDescription className="text-center">
            {opts.message ??
              "Necesitas una cuenta para guardar y sincronizar esta función entre tus dispositivos."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-col gap-2 sm:flex-col sm:space-x-0">
          <Button asChild className="w-full">
            <Link to="/auth/signup" search={{ redirect } as never} onClick={close}>
              Crear cuenta gratis
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link to="/auth/login" search={{ redirect } as never} onClick={close}>
              Ya tengo cuenta
            </Link>
          </Button>
          <button
            type="button"
            onClick={close}
            className="mt-1 text-xs text-muted-foreground hover:text-foreground"
          >
            Seguir explorando como invitado
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
