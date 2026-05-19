import { useEffect, useRef, useState, useCallback } from "react";
import {
  Sparkles,
  Send,
  X,
  Loader2,
  Mic,
  MicOff,
  Keyboard,
  Volume2,
  VolumeX,
  Pause,
  Play,
} from "lucide-react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

// Local intent router — no AI provider needed. Maps keywords to a friendly
// reply + optional navigation. Keeps the agent fully responsive offline.
type Intent = { keys: RegExp; reply: string; path?: string };
const INTENTS: Intent[] = [
  {
    keys: /\b(hotel|dormir|aloj|hostal|apartamento)\b/i,
    reply: "Te llevo a alojamientos cerca de Alicante.",
    path: "/donde-dormir",
  },
  {
    keys: /\b(comer|restaurante|tapas|cena|comida|gastronom)\b/i,
    reply: "Vamos a ver dónde comer.",
    path: "/eat",
  },
  {
    keys: /\b(playa|mar|arena|cala)\b/i,
    reply: "Estas son las playas. ¿Quieres verlas en el mapa?",
    path: "/playas",
  },
  {
    keys: /\bmapa\b.*\bplaya|playa.*mapa\b/i,
    reply: "Aquí tienes el mapa de playas.",
    path: "/playas/mapa",
  },
  { keys: /\b(explorar|mapa|ciudad)\b/i, reply: "Te abro el mapa de la ciudad.", path: "/explore" },
  { keys: /\b(bus|emt|autob)\b/i, reply: "Buses urbanos de Alicante.", path: "/bus" },
  {
    keys: /\b(planificar|ruta|c[oó]mo llego|llegar)\b/i,
    reply: "Vamos al planificador de rutas.",
    path: "/bus/planner",
  },
  {
    keys: /\b(vuelo|aeropuerto|aena|alc)\b/i,
    reply: "Vuelos del aeropuerto de Alicante.",
    path: "/vuelos",
  },
  {
    keys: /\b(clima|tiempo|llueve|sol|temperatura)\b/i,
    reply: "Mira la previsión.",
    path: "/clima",
  },
  {
    keys: /\b(cine|pel[ií]cula|cartelera)\b/i,
    reply: "Cartelera de cine.",
    path: "/ocio/cartelera",
  },
  { keys: /\b(teatro)\b/i, reply: "Teatros en la ciudad.", path: "/ocio/teatros" },
  {
    keys: /\b(concierto|m[uú]sica en vivo)\b/i,
    reply: "Conciertos por aquí.",
    path: "/ocio/conciertos",
  },
  { keys: /\b(ocio|plan|hacer)\b/i, reply: "Ideas para tu plan.", path: "/ocio" },
  {
    keys: /\b(fiesta|hoguera|moros|cristianos)\b/i,
    reply: "Programa de fiestas.",
    path: "/fiestas",
  },
  { keys: /\b(farmacia|guardia)\b/i, reply: "Farmacias de guardia.", path: "/farmacias" },
  { keys: /\b(hospital|urgencias)\b/i, reply: "Hospitales cercanos.", path: "/hospitales" },
  { keys: /\b(salud|m[eé]dico|sanitar)\b/i, reply: "Servicios sanitarios.", path: "/salud" },
  { keys: /\b(perfil|cuenta)\b/i, reply: "Tu perfil.", path: "/perfil" },
  {
    keys: /\b(hola|buenas|hey|saludos)\b/i,
    reply:
      "¡Hola! ¿En qué te ayudo? Puedes pedirme playa, comer, dormir, bus, vuelos, ocio o clima.",
  },
  { keys: /\b(gracias|grac)\b/i, reply: "¡A mandar! Si necesitas otra cosa, dímelo." },
];

function localResolve(text: string): { reply: string; path?: string } {
  for (const it of INTENTS) if (it.keys.test(text)) return { reply: it.reply, path: it.path };
  return {
    reply:
      "Puedo llevarte a: playas, dónde comer, dónde dormir, bus, vuelos, ocio, fiestas, clima o salud. ¿Qué prefieres?",
  };
}

type Msg = { role: "user" | "assistant"; content: string };
type Mode = "voice" | "text";

const STORAGE_KEY = "va:agente-msgs";
const GREETING: Msg = {
  role: "assistant",
  content:
    "¡Hola! Soy **Agente Vamos**, tu concierge en Alicante. ¿Qué te apetece hacer — comer, dormir, playa, moverte, un plan?",
};

function loadMsgs(): Msg[] {
  if (typeof window === "undefined") return [GREETING];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [GREETING];
    const arr = JSON.parse(raw);
    if (Array.isArray(arr) && arr.length) return arr;
  } catch {}
  return [GREETING];
}

function plainText(md: string): string {
  return md
    .replace(/`{1,3}[^`]*`{1,3}/g, "")
    .replace(/\*\*?([^*]+)\*\*?/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^[#>\-*]\s+/gm, "")
    .replace(/\n{2,}/g, ". ")
    .trim();
}

type SR = any;
function getSpeechRecognition(): any {
  if (typeof window === "undefined") return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

// Set true by the FAB after speaking the greeting synchronously (inside the
// click handler — required by browser autoplay rules). The panel reads it to
// avoid double-greeting.
let __vaGreetingSpoken = false;
export const __vaGetGreetingSpoken = () => __vaGreetingSpoken;
export const __vaSetGreetingSpoken = (v: boolean) => {
  __vaGreetingSpoken = v;
};
let __vaActiveUtterance: SpeechSynthesisUtterance | null = null;
const __vaPrimedUtterances: SpeechSynthesisUtterance[] = [];

function pickSpanishVoice(synth: SpeechSynthesis) {
  const voices = synth.getVoices();
  return (
    voices.find((v) => v.lang?.toLowerCase().startsWith("es-es")) ||
    voices.find((v) => v.lang?.toLowerCase().startsWith("es")) ||
    null
  );
}

function configureSpanishUtterance(u: SpeechSynthesisUtterance, text: string) {
  u.text = plainText(text);
  u.lang = "es-ES";
  u.rate = 1.05;
  u.pitch = 1;
  const synth = window.speechSynthesis;
  const voice = synth ? pickSpanishVoice(synth) : null;
  if (voice) u.voice = voice;
  __vaActiveUtterance = u;
  return u;
}

function makeSpanishUtterance(text: string) {
  const u = __vaPrimedUtterances.shift() || new SpeechSynthesisUtterance("");
  return configureSpanishUtterance(u, text);
}

function primeSpanishUtterances(count = 8) {
  if (typeof window === "undefined") return;
  while (__vaPrimedUtterances.length < count) {
    const u = new SpeechSynthesisUtterance("");
    u.lang = "es-ES";
    u.rate = 1.05;
    u.pitch = 1;
    __vaPrimedUtterances.push(u);
  }
}

export function AgenteVamosPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>(loadMsgs);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("voice");
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const scrollRef = useRef<HTMLDivElement>(null);
  const recogRef = useRef<SR | null>(null);

  // Refs to avoid stale closures inside speech callbacks
  const modeRef = useRef(mode);
  const pausedRef = useRef(paused);
  const mutedRef = useRef(muted);
  const loadingRef = useRef(loading);
  const speakingRef = useRef(speaking);
  const openRef = useRef(open);
  const wasOpenRef = useRef(open);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);
  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);
  useEffect(() => {
    speakingRef.current = speaking;
  }, [speaking]);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(msgs));
      } catch {}
    }
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const stopListening = useCallback(() => {
    try {
      recogRef.current?.abort?.();
    } catch {}
    try {
      recogRef.current?.stop?.();
    } catch {}
    setListening(false);
  }, []);

  const stopSpeaking = useCallback(() => {
    try {
      window.speechSynthesis?.cancel();
    } catch {}
    __vaActiveUtterance = null;
    speakingRef.current = false;
    setSpeaking(false);
  }, []);

  const shouldAutoListen = useCallback(() => {
    return (
      openRef.current &&
      modeRef.current === "voice" &&
      !pausedRef.current &&
      !loadingRef.current &&
      !speakingRef.current
    );
  }, []);

  // Forward declaration via ref so callbacks can call latest startListening
  const startListeningRef = useRef<() => void>(() => {});

  const speak = useCallback(
    (text: string, onEnd?: () => void) => {
      if (mutedRef.current || typeof window === "undefined" || !window.speechSynthesis) {
        onEnd?.();
        if (shouldAutoListen()) startListeningRef.current();
        return;
      }
      const synth = window.speechSynthesis;
      const doSpeak = () => {
        try {
          synth.cancel();
          synth.resume();
          const u = makeSpanishUtterance(text);
          u.onstart = () => {
            speakingRef.current = true;
            setSpeaking(true);
          };
          u.onend = () => {
            __vaActiveUtterance = null;
            speakingRef.current = false;
            setSpeaking(false);
            onEnd?.();
            if (shouldAutoListen()) startListeningRef.current();
          };
          u.onerror = () => {
            __vaActiveUtterance = null;
            speakingRef.current = false;
            setSpeaking(false);
            onEnd?.();
            if (shouldAutoListen()) startListeningRef.current();
          };
          synth.speak(u);
        } catch {
          onEnd?.();
          if (shouldAutoListen()) startListeningRef.current();
        }
      };
      // Ensure voices are loaded (some browsers populate async)
      if (synth.getVoices().length === 0) {
        const handler = () => {
          synth.removeEventListener("voiceschanged", handler);
          doSpeak();
        };
        synth.addEventListener("voiceschanged", handler);
        // Fallback in case event never fires
        setTimeout(() => {
          synth.removeEventListener("voiceschanged", handler);
          doSpeak();
        }, 800);
      } else {
        doSpeak();
      }
    },
    [shouldAutoListen],
  );

  const send = useCallback(
    async (text: string, viaVoice = false) => {
      const clean = text.trim();
      if (!clean || loadingRef.current) return;
      stopListening();
      const next = [...msgs, { role: "user" as const, content: clean }];
      setMsgs(next);
      setInput("");
      setInterim("");
      setLoading(true);
      try {
        const { reply, path: target } = localResolve(clean);
        const content = target && target !== path ? reply : reply;
        setMsgs((m) => [...m, { role: "assistant", content }]);
        if (target && target !== path) {
          setTimeout(() => {
            try {
              navigate({ to: target });
            } catch {}
          }, 350);
        }
        if (viaVoice || modeRef.current === "voice") speak(content);
      } finally {
        setLoading(false);
      }
    },
    [msgs, path, navigate, speak, stopListening],
  );

  const sendRef = useRef(send);
  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  const startListening = useCallback(() => {
    if (!openRef.current || modeRef.current !== "voice") return;
    if (pausedRef.current || loadingRef.current || speakingRef.current) return;
    const SRClass = getSpeechRecognition();
    if (!SRClass) {
      setVoiceError("Tu navegador no soporta reconocimiento de voz. Cambia a modo texto.");
      return;
    }
    // Stop any previous instance
    try {
      recogRef.current?.abort?.();
    } catch {}
    try {
      const rec = new SRClass();
      rec.lang = "es-ES";
      rec.continuous = false;
      rec.interimResults = true;
      let finalText = "";
      let lastTranscript = "";
      let handled = false;
      rec.onresult = (e: any) => {
        let interimText = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript;
          if (e.results[i].isFinal) finalText += t;
          else interimText += t;
        }
        lastTranscript = (finalText || interimText || lastTranscript).trim();
        setInterim(interimText);
      };
      const finishTurn = () => {
        if (handled) return true;
        const t = (finalText || lastTranscript).trim();
        if (!t) return false;
        handled = true;
        setInterim("");
        sendRef.current(t, true);
        return true;
      };
      rec.onspeechend = () => {
        finishTurn();
      };
      rec.onerror = (e: any) => {
        setListening(false);
        if (e?.error === "not-allowed" || e?.error === "service-not-allowed") {
          setVoiceError("Permiso de micrófono denegado. Habilítalo o cambia a modo texto.");
          setPaused(true);
        } else if (e?.error === "no-speech" || e?.error === "aborted") {
          // benign — will auto-restart on end if conditions allow
        }
      };
      rec.onend = () => {
        setListening(false);
        if (finishTurn()) {
          return;
        }
        // Silence — restart listening automatically
        if (shouldAutoListen()) {
          setTimeout(() => startListeningRef.current(), 300);
        }
      };
      recogRef.current = rec;
      setVoiceError(null);
      setListening(true);
      rec.start();
    } catch {
      setListening(false);
      // Try again shortly
      if (shouldAutoListen()) setTimeout(() => startListeningRef.current(), 500);
    }
  }, [shouldAutoListen]);

  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);

  // Cleanup on close
  useEffect(() => {
    if (!open) {
      stopListening();
      stopSpeaking();
      setPaused(false);
      setInterim("");
    }
  }, [open, stopListening, stopSpeaking]);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setMode("voice");
      setPaused(false);
      setVoiceError(null);
    }
    wasOpenRef.current = open;
  }, [open]);

  // Hands-free bootstrap: when opening in voice mode, ensure we end up listening.
  // The greeting is spoken synchronously by the FAB onClick (so the browser
  // accepts it as a user-gesture action). Here we just kick off listening
  // once any in-flight speech finishes.
  const greetedRef = useRef(__vaGetGreetingSpoken());
  useEffect(() => {
    if (!open || mode !== "voice") return;
    const SRClass = getSpeechRecognition();
    if (!SRClass) {
      setVoiceError("Tu navegador no soporta reconocimiento de voz. Cambia a modo texto.");
      return;
    }
    const synth = window.speechSynthesis;
    let cancelled = false;

    const tryStart = () => {
      if (cancelled) return;
      if (synth && (synth.speaking || synth.pending || __vaActiveUtterance)) {
        // Do not cancel or replace the click-started greeting while it is
        // queued/playing; otherwise mobile browsers may drop audio entirely.
        setSpeaking(synth.speaking || Boolean(__vaActiveUtterance));
        setTimeout(tryStart, 250);
        return;
      }
      setSpeaking(false);
      if (!greetedRef.current && !pausedRef.current) {
        // No external greeting played (e.g. switched from text to voice).
        greetedRef.current = true;
        speak(GREETING.content);
        return;
      }
      if (shouldAutoListen()) startListening();
    };

    // Small initial delay so the FAB-initiated utterance has a chance to start.
    const t = setTimeout(tryStart, 150);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode]);

  if (!open) return null;
  const isVoice = mode === "voice";

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex justify-center sm:inset-auto sm:bottom-4 sm:right-4 sm:justify-end">
      <div className="pointer-events-auto relative flex max-h-[58vh] w-full flex-col overflow-hidden rounded-t-3xl border bg-background shadow-2xl sm:max-h-[560px] sm:w-[380px] sm:rounded-3xl">
        <header className="flex items-center justify-between border-b bg-gradient-to-r from-primary to-orange-500 px-4 py-3 text-primary-foreground">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-white/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold leading-tight">Agente Vamos</p>
              <p className="text-[11px] opacity-90">
                {isVoice
                  ? paused
                    ? "en pausa"
                    : speaking
                      ? "hablando…"
                      : listening
                        ? "te escucho…"
                        : loading
                          ? "pensando…"
                          : "modo voz"
                  : "modo texto"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() =>
                setMuted((v) => {
                  if (!v) stopSpeaking();
                  return !v;
                })
              }
              aria-label={muted ? "Activar voz" : "Silenciar voz"}
              className="rounded-full p-2 hover:bg-white/20"
              title={muted ? "Activar voz" : "Silenciar voz"}
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <button
              onClick={() => {
                if (isVoice) {
                  stopListening();
                  stopSpeaking();
                  setMode("text");
                } else {
                  setMode("voice");
                  greetedRef.current = true; // don't re-greet on switch
                }
              }}
              aria-label={isVoice ? "Cambiar a texto" : "Cambiar a voz"}
              className="rounded-full p-2 hover:bg-white/20"
              title={isVoice ? "Cambiar a texto" : "Cambiar a voz"}
            >
              {isVoice ? <Keyboard className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="rounded-full p-2 hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        {isVoice ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 overflow-hidden px-6 py-6">
            {/* Voice-only — no message history rendered. Show just live transcript. */}
            <div className="min-h-[2.5rem] w-full text-center">
              {interim ? (
                <p className="text-sm italic text-foreground/80">"{interim}…"</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {speaking
                    ? "VA está hablando…"
                    : listening
                      ? "Habla cuando quieras"
                      : loading
                        ? "Pensando una respuesta…"
                        : paused
                          ? "Conversación en pausa"
                          : "Preparando…"}
                </p>
              )}
            </div>

            <div className="flex w-full flex-col items-center gap-3 pb-2">
              {voiceError && <p className="text-center text-xs text-destructive">{voiceError}</p>}

              {/* Animated orb — visual only, no interaction required */}
              <div
                className={cn(
                  "relative grid h-20 w-20 place-items-center rounded-full text-primary-foreground shadow-2xl transition",
                  paused
                    ? "bg-muted text-muted-foreground"
                    : listening
                      ? "bg-red-500 ring-8 ring-red-500/30 animate-pulse"
                      : speaking
                        ? "bg-orange-500 ring-8 ring-orange-500/30"
                        : loading
                          ? "bg-primary ring-4 ring-primary/30"
                          : "bg-gradient-to-br from-primary to-orange-500 ring-4 ring-primary/20",
                )}
              >
                {loading ? (
                  <Loader2 className="h-8 w-8 animate-spin" />
                ) : paused ? (
                  <MicOff className="h-8 w-8" />
                ) : (
                  <Mic className="h-8 w-8" />
                )}
              </div>

              <p className="text-center text-xs text-muted-foreground">
                {paused
                  ? "conversación en pausa"
                  : loading
                    ? "pensando…"
                    : speaking
                      ? "hablando — puedes interrumpir hablando"
                      : listening
                        ? "te escucho · habla cuando quieras"
                        : "preparando micrófono…"}
              </p>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (paused) {
                      setPaused(false);
                      setTimeout(() => startListeningRef.current(), 100);
                    } else {
                      setPaused(true);
                      stopListening();
                      stopSpeaking();
                    }
                  }}
                  className="flex items-center gap-1 rounded-full border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
                >
                  {paused ? (
                    <>
                      <Play className="h-3 w-3" /> reanudar
                    </>
                  ) : (
                    <>
                      <Pause className="h-3 w-3" /> pausar
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    stopListening();
                    stopSpeaking();
                    setMode("text");
                  }}
                  className="rounded-full border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
                >
                  modo texto
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
              {msgs.map((m, i) => (
                <div
                  key={i}
                  className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                      m.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground",
                    )}
                  >
                    <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-a:text-primary">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl bg-muted px-3 py-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> pensando…
                  </div>
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="flex items-center gap-2 border-t bg-background p-3"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Escribe a Agente Vamos…"
                className="flex-1 rounded-full border bg-background px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
                aria-label="Enviar"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export function AgenteVamosFab() {
  const [open, setOpen] = useState(false);
  const voiceBootStartedRef = useRef(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const hidden =
    ["/login", "/magic", "/welcome"].includes(path) || path.startsWith("/business/login");
  if (hidden) return null;

  const startGreetingFromUserGesture = () => {
    if (voiceBootStartedRef.current) return;
    voiceBootStartedRef.current = true;
    try {
      primeSpanishUtterances();
      const synth = window.speechSynthesis;
      if (synth) {
        __vaSetGreetingSpoken(false);
        synth.cancel();
        synth.resume();
        const greetText =
          "¡Hola! Soy Agente Vamos, tu concierge en Alicante. ¿Qué te apetece hacer? ¿Comer, dormir, playa, moverte, un plan?";
        const u = makeSpanishUtterance(greetText);
        u.onstart = () => __vaSetGreetingSpoken(true);
        u.onend = () => {
          __vaActiveUtterance = null;
          __vaSetGreetingSpoken(true);
        };
        u.onerror = () => {
          __vaActiveUtterance = null;
          __vaSetGreetingSpoken(false);
        };
        synth.speak(u);
      }
    } catch {
      voiceBootStartedRef.current = false;
    }
  };

  return (
    <>
      {!open && (
        <button
          onTouchStart={startGreetingFromUserGesture}
          onMouseDown={startGreetingFromUserGesture}
          onPointerDown={startGreetingFromUserGesture}
          onClick={() => {
            startGreetingFromUserGesture();
            setOpen(true);
          }}
          aria-label="Abrir Agente Vamos"
          className="fixed bottom-5 right-5 z-[90] flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-orange-500 px-4 py-3 text-sm font-semibold text-primary-foreground shadow-2xl ring-4 ring-primary/20 transition hover:scale-105 active:scale-95"
        >
          <Mic className="h-5 w-5" />
          <span className="hidden sm:inline">Agente Vamos</span>
        </button>
      )}
      <AgenteVamosPanel
        open={open}
        onClose={() => {
          voiceBootStartedRef.current = false;
          setOpen(false);
        }}
      />
    </>
  );
}
