import { useEffect, useState } from "react";
import { Download, Share, Plus, Check, X, ChevronRight, ChevronLeft, Smartphone } from "lucide-react";
import iconUrl from "/icon-192.png?url";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "vamos-pwa-install-dismissed";
const INSTALLED_KEY = "vamos-pwa-installed";

export function InstallPWA() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [open, setOpen] = useState(false);
  const [showButton, setShowButton] = useState(false);
  const [platform, setPlatform] = useState<"android" | "ios" | "desktop">("desktop");
  const [step, setStep] = useState(0);
  const [installing, setInstalling] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Detect standalone (already installed)
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS
      window.navigator.standalone === true;
    if (isStandalone) return;

    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    const ua = window.navigator.userAgent;
    const isIOS = /iPhone|iPad|iPod/.test(ua) && !/CriOS|FxiOS/.test(ua);
    const isAndroid = /Android/.test(ua);
    setPlatform(isIOS ? "ios" : isAndroid ? "android" : "desktop");

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setShowButton(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const installedHandler = () => {
      localStorage.setItem(INSTALLED_KEY, "1");
      setShowButton(false);
      setOpen(false);
    };
    window.addEventListener("appinstalled", installedHandler);

    // iOS has no beforeinstallprompt → show button anyway
    if (isIOS) setShowButton(true);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  if (!showButton) return null;

  const steps =
    platform === "ios"
      ? [
          { icon: Share, title: "Pulsa el botón Compartir", desc: "Está en la barra inferior de Safari." },
          { icon: Plus, title: "Selecciona “Añadir a pantalla de inicio”", desc: "Desplázate hacia abajo en el menú." },
          { icon: Check, title: "Confirma “Añadir”", desc: "Vamos Alicante aparecerá como una app más." },
        ]
      : platform === "android"
      ? [
          { icon: Download, title: "Pulsa “Instalar”", desc: "Aceptarás el cuadro de diálogo del navegador." },
          { icon: Smartphone, title: "Espera la descarga", desc: "Tu móvil añadirá Vamos Alicante en segundos." },
          { icon: Check, title: "Ábrela desde el escritorio", desc: "Funciona como una app nativa, sin pestañas." },
        ]
      : [
          { icon: Download, title: "Pulsa “Instalar”", desc: "El navegador mostrará un cuadro de confirmación." },
          { icon: Check, title: "Confirma la instalación", desc: "Se añadirá a tus aplicaciones." },
          { icon: Smartphone, title: "Ábrela cuando quieras", desc: "Tendrás Vamos Alicante en un clic." },
        ];

  const isLast = step === steps.length - 1;

  const triggerInstall = async () => {
    if (!deferred) return;
    setInstalling(true);
    await deferred.prompt();
    const choice = await deferred.userChoice;
    setInstalling(false);
    if (choice.outcome === "accepted") {
      setDone(true);
      setTimeout(() => setOpen(false), 1600);
    }
  };

  const close = () => {
    setOpen(false);
    localStorage.setItem(DISMISS_KEY, "1");
    setShowButton(false);
  };

  return (
    <>
      {/* Floating launcher */}
      <button
        onClick={() => {
          setOpen(true);
          setStep(0);
          setDone(false);
        }}
        className="fixed bottom-20 right-4 z-[60] flex items-center gap-2 rounded-full bg-[#F39021] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-500/30 ring-1 ring-white/20 hover:bg-[#e57f10] md:bottom-6"
        aria-label="Instalar app"
      >
        <Download className="h-4 w-4" />
        Instalar app
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 backdrop-blur-sm md:items-center">
          <div className="w-full max-w-md overflow-hidden rounded-t-3xl bg-[#FDF6E8] shadow-2xl animate-in slide-in-from-bottom md:rounded-3xl">
            <div className="flex items-center justify-between p-4 pb-2">
              <div className="flex items-center gap-3">
                <img src={iconUrl} alt="Vamos Alicante" className="h-11 w-11 rounded-xl shadow-sm" />
                <div>
                  <div className="text-base font-bold text-[#7a3d05]">Vamos Alicante</div>
                  <div className="text-xs text-[#a0703a]">Instala la app · Sin tienda</div>
                </div>
              </div>
              <button
                onClick={close}
                className="rounded-full p-2 text-[#7a3d05]/60 hover:bg-black/5"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {done ? (
              <div className="flex flex-col items-center px-6 py-10 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg">
                  <Check className="h-8 w-8" />
                </div>
                <h3 className="mt-4 text-lg font-bold text-[#7a3d05]">¡Instalada!</h3>
                <p className="mt-1 text-sm text-[#a0703a]">Búscala en tu escritorio o cajón de apps.</p>
              </div>
            ) : (
              <>
                {/* Progress dots */}
                <div className="flex items-center justify-center gap-1.5 pb-3">
                  {steps.map((_, i) => (
                    <span
                      key={i}
                      className={`h-1.5 rounded-full transition-all ${
                        i === step ? "w-6 bg-[#F39021]" : "w-1.5 bg-[#F39021]/30"
                      }`}
                    />
                  ))}
                </div>

                {/* Step content */}
                <div className="px-6 pb-2">
                  <div className="flex flex-col items-center text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F39021]/15 text-[#F39021]">
                      {(() => {
                        const I = steps[step].icon;
                        return <I className="h-8 w-8" />;
                      })()}
                    </div>
                    <div className="mt-4 text-xs font-semibold uppercase tracking-wider text-[#F39021]">
                      Paso {step + 1} de {steps.length}
                    </div>
                    <h3 className="mt-1 text-lg font-bold text-[#7a3d05]">{steps[step].title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-[#a0703a]">{steps[step].desc}</p>
                  </div>
                </div>

                {/* Footer actions */}
                <div className="flex items-center justify-between gap-2 p-4 pt-5">
                  <button
                    onClick={() => setStep((s) => Math.max(0, s - 1))}
                    disabled={step === 0}
                    className="flex items-center gap-1 rounded-full px-4 py-2.5 text-sm font-medium text-[#7a3d05] disabled:opacity-30"
                  >
                    <ChevronLeft className="h-4 w-4" /> Atrás
                  </button>

                  {isLast && deferred && platform !== "ios" ? (
                    <button
                      onClick={triggerInstall}
                      disabled={installing}
                      className="flex items-center gap-2 rounded-full bg-[#F39021] px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-[#e57f10] disabled:opacity-60"
                    >
                      <Download className="h-4 w-4" />
                      {installing ? "Instalando…" : "Instalar ahora"}
                    </button>
                  ) : isLast ? (
                    <button
                      onClick={close}
                      className="flex items-center gap-2 rounded-full bg-[#F39021] px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-[#e57f10]"
                    >
                      <Check className="h-4 w-4" /> Entendido
                    </button>
                  ) : (
                    <button
                      onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
                      className="flex items-center gap-1 rounded-full bg-[#F39021] px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-[#e57f10]"
                    >
                      Siguiente <ChevronRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
