import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Download, Share, Plus, Check, Smartphone, ArrowRight, Sparkles } from "lucide-react";
import { toast } from "sonner";
import iconUrl from "/icon-512.png?url";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const WELCOMED_KEY = "vamos-welcomed-v1";
const INSTALLED_KEY = "vamos-pwa-installed";

export const Route = createFileRoute("/welcome")({
  head: () => ({
    meta: [{ title: "Bienvenido — Alicante Friend" }],
  }),
  component: WelcomePage,
});

function WelcomePage() {
  const navigate = useNavigate();
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [platform, setPlatform] = useState<"android" | "ios" | "desktop">("desktop");
  const [installed, setInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS
      window.navigator.standalone === true;

    if (isStandalone) {
      // Ya está abierta como app instalada → al login directamente.
      localStorage.setItem(WELCOMED_KEY, "1");
      navigate({ to: "/login", replace: true });
      return;
    }

    const ua = window.navigator.userAgent;
    const isIOS = /iPhone|iPad|iPod/.test(ua) && !/CriOS|FxiOS/.test(ua);
    const isAndroid = /Android/.test(ua);
    setPlatform(isIOS ? "ios" : isAndroid ? "android" : "desktop");

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const installedHandler = () => {
      localStorage.setItem(INSTALLED_KEY, "1");
      setInstalled(true);
    };
    window.addEventListener("appinstalled", installedHandler);

    if (localStorage.getItem(INSTALLED_KEY) === "1") setInstalled(true);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, [navigate]);

  const onInstall = async () => {
    if (platform === "ios") {
      setShowIosHelp(true);
      return;
    }
    if (!deferred) {
      toast.info("Tu navegador no soporta instalación directa", {
        description: "Usa el menú del navegador → Instalar app",
      });
      return;
    }
    setInstalling(true);
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") {
        localStorage.setItem(INSTALLED_KEY, "1");
        setInstalled(true);
      }
    } finally {
      setInstalling(false);
    }
  };

  const goLogin = () => {
    localStorage.setItem(WELCOMED_KEY, "1");
    navigate({ to: "/login", replace: true });
  };

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-between overflow-hidden bg-background px-6 py-10 text-center">
      {/* Fondo cálido */}
      <div className="pointer-events-none absolute inset-0 -z-10 gradient-warm opacity-95" />
      <div className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-white/20 blur-3xl" />

      <div className="w-full pt-6 text-primary-foreground/90">
        <span className="inline-flex items-center gap-1 rounded-full bg-white/25 px-3 py-1 text-[10px] font-bold uppercase tracking-widest">
          <Sparkles className="h-3 w-3" /> Bienvenido
        </span>
      </div>

      {/* Icono a pantalla completa */}
      <div className="flex flex-1 flex-col items-center justify-center">
        <img
          src={iconUrl}
          alt="Alicante Friend"
          className="h-44 w-44 rounded-[36px] shadow-2xl ring-4 ring-white/30 sm:h-56 sm:w-56"
        />
        <h1 className="mt-8 font-display text-3xl font-bold text-primary-foreground drop-shadow-sm sm:text-4xl">
          Alicante Friend
        </h1>
        <p className="mt-2 max-w-xs text-sm text-primary-foreground/90">
          Tu guía local con IA. Instálala en tu móvil para tenerla siempre a un toque.
        </p>
      </div>

      <div className="w-full max-w-sm space-y-3 pb-2">
        {!installed ? (
          <button
            onClick={onInstall}
            disabled={installing}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-white py-4 text-base font-semibold text-primary shadow-xl active:scale-95 disabled:opacity-60"
          >
            <Download className="h-5 w-5" />
            {installing ? "Instalando…" : "Descargar la app"}
          </button>
        ) : (
          <button
            onClick={goLogin}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-white py-4 text-base font-semibold text-primary shadow-xl active:scale-95"
          >
            <Smartphone className="h-5 w-5" />
            Abrir la app
          </button>
        )}

        <button
          onClick={goLogin}
          className="flex w-full items-center justify-center gap-1 rounded-full bg-white/15 py-2.5 text-xs font-medium text-primary-foreground active:scale-95"
        >
          Continuar sin instalar <ArrowRight className="h-3.5 w-3.5" />
        </button>

        <p className="text-[11px] text-primary-foreground/80">
          Sin tienda · Se añade a tu pantalla de inicio
        </p>
      </div>

      {/* iOS helper */}
      {showIosHelp && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-4 pb-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-background p-5 shadow-2xl">
            <h2 className="text-base font-semibold">Instalar en iPhone</h2>
            <ol className="mt-3 space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Share className="h-4 w-4" />
                </span>
                <span>Pulsa el botón <b>Compartir</b> en la barra de Safari.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Plus className="h-4 w-4" />
                </span>
                <span>Elige <b>Añadir a pantalla de inicio</b>.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Check className="h-4 w-4" />
                </span>
                <span>Confirma <b>Añadir</b>. Ábrela desde tu escritorio.</span>
              </li>
            </ol>
            <button
              onClick={() => setShowIosHelp(false)}
              className="mt-5 w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground active:scale-95"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
