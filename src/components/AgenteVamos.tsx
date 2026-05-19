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
import { useServerFn } from "@tanstack/react-start";
import { agenteVamosChat } from "@/lib/agente.functions";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

const VOICE_ASSETS = import.meta.glob("../assets/agent-voice/*.mp3", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

// Local intent router — no AI provider needed. Maps keywords to a friendly
// reply + optional navigation. Keeps the agent fully responsive offline.
type VoiceClip =
  | "hotel"
  | "eat"
  | "beaches"
  | "beach_map"
  | "explore"
  | "bus"
  | "planner"
  | "flights"
  | "weather"
  | "cinema"
  | "theatre"
  | "concerts"
  | "leisure"
  | "fiestas"
  | "pharmacy"
  | "hospitals"
  | "health"
  | "profile"
  | "hello"
  | "thanks"
  | "fallback";
type GreetingClip = "greeting_morning" | "greeting_afternoon";
type AgentAudioClip = VoiceClip | GreetingClip;

type Intent = { keys: string[]; reply: string; path?: string; audio: VoiceClip };
const INTENTS: Intent[] = [
  {
    keys: ["tomar algo", "beber", "cerveza", "cervezas", "cerveceria", "cervecería", "copa", "copas", "pub", "discoteca", "bar de copas", "rooftop"],
    reply: "Abro el Dashboard Nocturno: bares, cervecerías, pubs y discotecas abiertos ahora.",
    path: "/",
    audio: "leisure",
  },
  {
    keys: ["hotel", "dormir", "alojamiento", "alojar", "hostal", "apartamento", "habitacion"],
    reply: "Te llevo a alojamientos cerca de Alicante.",
    path: "/donde-dormir",
    audio: "hotel",
  },
  {
    keys: ["playa", "mar", "arena", "cala", "bañar", "bano", "nadAr", "tabarca"],
    reply: "Estas son las playas. ¿Quieres verlas en el mapa?",
    path: "/playas",
    audio: "beaches",
  },
  {
    keys: ["mapa playa", "playas mapa", "mapa de playas"],
    reply: "Aquí tienes el mapa de playas.",
    path: "/playas/mapa",
    audio: "beach_map",
  },
  {
    keys: ["explorar", "mapa", "ciudad", "cerca", "sitios"],
    reply: "Te abro el mapa de la ciudad.",
    path: "/explore",
    audio: "explore",
  },
  {
    keys: ["bus", "emt", "autobus", "autobuses", "transporte"],
    reply: "Buses urbanos de Alicante.",
    path: "/bus",
    audio: "bus",
  },
  {
    keys: ["planificar", "ruta", "como llego", "llegar", "ir a", "llevarme"],
    reply: "Vamos al planificador de rutas.",
    path: "/bus/planner",
    audio: "planner",
  },
  {
    keys: ["vuelo", "vuelos", "aeropuerto", "aena", "avion", "alc"],
    reply: "Vuelos del aeropuerto de Alicante.",
    path: "/vuelos",
    audio: "flights",
  },
  {
    keys: ["clima", "tiempo", "llueve", "lluvia", "sol", "temperatura", "calor", "frio"],
    reply: "Mira la previsión.",
    path: "/clima",
    audio: "weather",
  },
  {
    keys: ["cine", "pelicula", "peliculas", "cartelera"],
    reply: "Cartelera de cine.",
    path: "/ocio/cartelera",
    audio: "cinema",
  },
  {
    keys: ["teatro", "teatros", "obra"],
    reply: "Teatros en la ciudad.",
    path: "/ocio/teatros",
    audio: "theatre",
  },
  {
    keys: ["concierto", "conciertos", "musica", "musica en vivo", "directo"],
    reply: "Conciertos por aquí.",
    path: "/ocio/conciertos",
    audio: "concerts",
  },
  {
    keys: ["ocio", "plan", "planes", "hacer", "que hago", "que hacer"],
    reply: "Ideas para tu plan.",
    path: "/ocio",
    audio: "leisure",
  },
  {
    keys: ["fiesta", "fiestas", "hoguera", "hogueras", "moros", "cristianos"],
    reply: "Programa de fiestas.",
    path: "/fiestas",
    audio: "fiestas",
  },
  {
    keys: ["farmacia", "farmacias", "guardia", "medicamento"],
    reply: "Farmacias de guardia.",
    path: "/farmacias",
    audio: "pharmacy",
  },
  {
    keys: ["hospital", "hospitales", "urgencia", "urgencias"],
    reply: "Hospitales cercanos.",
    path: "/hospitales",
    audio: "hospitals",
  },
  {
    keys: ["salud", "medico", "medica", "sanitario", "sanitaria"],
    reply: "Servicios sanitarios.",
    path: "/salud",
    audio: "health",
  },
  { keys: ["perfil", "cuenta", "usuario"], reply: "Tu perfil.", path: "/perfil", audio: "profile" },
  {
    keys: ["hola", "buenas", "hey", "saludos"],
    reply:
      "¡Hola! ¿En qué te ayudo? Puedes pedirme playa, comer, dormir, bus, vuelos, ocio o clima.",
    audio: "hello",
  },
  {
    keys: ["gracias", "gracia", "vale", "ok"],
    reply: "¡A mandar! Si necesitas otra cosa, dímelo.",
    audio: "thanks",
  },
];

function normalizeSpeech(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function localResolve(text: string): { reply: string; path?: string; audio: VoiceClip } {
  const query = normalizeSpeech(text);
  let best: Intent | null = null;
  let bestScore = 0;
  for (const it of INTENTS) {
    const score = it.keys.reduce((max, key) => {
      const normalizedKey = normalizeSpeech(key);
      return query.includes(normalizedKey) ? Math.max(max, normalizedKey.length) : max;
    }, 0);
    if (score > bestScore) {
      best = it;
      bestScore = score;
    }
  }
  if (best) return { reply: best.reply, path: best.path, audio: best.audio };
  return {
    reply:
      "Puedo llevarte a: playas, dónde comer, dónde dormir, bus, vuelos, ocio, fiestas, clima o salud. ¿Qué prefieres?",
    audio: "fallback",
  };
}

type Msg = { role: "user" | "assistant"; content: string };
type Mode = "voice" | "text";
type PendingSpeech = { text: string; audio?: AgentAudioClip };

const STORAGE_KEY = "va:agente-msgs";
const audioSrc = (clip: AgentAudioClip) =>
  VOICE_ASSETS[`../assets/agent-voice/${clip}.mp3`] ?? `/agent-voice/${clip}.mp3`;
function getGreetingClip(): GreetingClip {
  return new Date().getHours() < 14 ? "greeting_morning" : "greeting_afternoon";
}
function getGreetingText() {
  const h = new Date().getHours();
  const saludo = h < 14 ? "Buenos días" : "Buenas tardes";
  return `${saludo}, Leopoldo, ¿qué vamos a hacer hoy?`;
}
function makeGreeting(): Msg {
  return { role: "assistant", content: getGreetingText() };
}

function loadMsgs(): Msg[] {
  if (typeof window === "undefined") return [makeGreeting()];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [makeGreeting()];
    const arr = JSON.parse(raw);
    if (Array.isArray(arr) && arr.length) return arr;
  } catch {}
  return [makeGreeting()];
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
let __vaActiveAudio: HTMLAudioElement | null = null;
let __vaActiveAudioStartedAt = 0;
const __vaPrimedUtterances: SpeechSynthesisUtterance[] = [];
type MicWarmupState = "idle" | "pending" | "ready" | "denied" | "unavailable" | "error";
let __vaMicWarmupState: MicWarmupState = "idle";
let __vaMicWarmupPromise: Promise<MicWarmupState> | null = null;
let __vaMicWarmupMessage: string | null = null;
let __vaMicWarmupAttempt = 0;
const MIC_WARMUP_TIMEOUT_MS = 8000;

function micWarmupMessage(err: unknown) {
  const name = err instanceof DOMException ? err.name : err instanceof Error ? err.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Permiso de micrófono denegado. Habilítalo en el navegador.";
  }
  if (name === "NotFoundError") return "No encuentro ningún micrófono en este dispositivo.";
  if (name === "NotReadableError") return "El micrófono está ocupado por otra aplicación.";
  return "No pude activar el micrófono. Toca el micrófono para intentarlo otra vez.";
}

function requestMicWarmupFromUserGesture() {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    __vaMicWarmupState = "unavailable";
    __vaMicWarmupMessage = "Este navegador no permite usar el micrófono aquí.";
    return null;
  }
  if (__vaMicWarmupState === "ready") return null;
  if (__vaMicWarmupState === "pending") return __vaMicWarmupPromise;

  __vaMicWarmupState = "pending";
  __vaMicWarmupMessage = "Acepta el permiso del micrófono para poder hablar.";
  const attempt = ++__vaMicWarmupAttempt;
  const mediaRequest = navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then((stream) => {
      stream.getTracks().forEach((track) => track.stop());
      if (attempt === __vaMicWarmupAttempt) {
        __vaMicWarmupState = "ready";
        __vaMicWarmupMessage = null;
      }
      return __vaMicWarmupState;
    })
    .catch((err) => {
      if (attempt === __vaMicWarmupAttempt) {
        __vaMicWarmupMessage = micWarmupMessage(err);
        __vaMicWarmupState =
          err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "SecurityError")
            ? "denied"
            : "error";
      }
      return __vaMicWarmupState;
    });

  __vaMicWarmupPromise = new Promise<MicWarmupState>((resolve) => {
    const timeout = window.setTimeout(() => {
      if (attempt === __vaMicWarmupAttempt && __vaMicWarmupState === "pending") {
        __vaMicWarmupState = "error";
        __vaMicWarmupMessage =
          "No apareció el permiso del micrófono. Pulsa “activar micro” y acepta el permiso del navegador.";
      }
      if (attempt === __vaMicWarmupAttempt) __vaMicWarmupPromise = null;
      resolve(__vaMicWarmupState);
    }, MIC_WARMUP_TIMEOUT_MS);

    mediaRequest.then((state) => {
      window.clearTimeout(timeout);
      if (attempt === __vaMicWarmupAttempt) __vaMicWarmupPromise = null;
      resolve(state);
    });
  });
  return __vaMicWarmupPromise;
}

function getMicWarmupSnapshot() {
  return {
    state: __vaMicWarmupState,
    message: __vaMicWarmupMessage,
    promise: __vaMicWarmupPromise,
  };
}

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
  if (typeof window === "undefined" || typeof SpeechSynthesisUtterance === "undefined") return;
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
  const [tapToSpeak, setTapToSpeak] = useState<PendingSpeech | null>(null);
  const [micReady, setMicReady] = useState(__vaMicWarmupState === "ready");

  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const askAgent = useServerFn(agenteVamosChat);
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
  const turnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const IDLE_MS = 60_000;
  const bumpIdle = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (!openRef.current) return;
    idleTimerRef.current = setTimeout(() => {
      // Sólo cerramos si no hay actividad en curso
      if (speakingRef.current || loadingRef.current) {
        bumpIdle();
        return;
      }
      onClose();
    }, IDLE_MS);
  }, [onClose]);
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
    if (turnTimerRef.current) {
      clearTimeout(turnTimerRef.current);
      turnTimerRef.current = null;
    }
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
      __vaActiveAudio?.pause();
      if (__vaActiveAudio) __vaActiveAudio.currentTime = 0;
    } catch {}
    __vaActiveAudio = null;
    __vaActiveAudioStartedAt = 0;
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

  const playAudioClip = useCallback(
    (clip: AgentAudioClip, text: string, onEnd?: () => void) => {
      if (typeof window === "undefined" || mutedRef.current) {
        onEnd?.();
        if (shouldAutoListen()) startListeningRef.current();
        return true;
      }
      try {
        __vaActiveAudio?.pause();
        const audio = new Audio(audioSrc(clip));
        audio.preload = "auto";
        audio.volume = 1;
        __vaActiveAudio = audio;
        __vaActiveAudioStartedAt = Date.now();
        setTapToSpeak(null);
        speakingRef.current = true;
        setSpeaking(true);
        const finish = () => {
          if (__vaActiveAudio === audio) __vaActiveAudio = null;
          __vaActiveAudioStartedAt = 0;
          speakingRef.current = false;
          setSpeaking(false);
          onEnd?.();
          if (shouldAutoListen()) startListeningRef.current();
        };
        audio.onended = finish;
        audio.onerror = () => {
          if (__vaActiveAudio === audio) __vaActiveAudio = null;
          __vaActiveAudioStartedAt = 0;
          speakingRef.current = false;
          setSpeaking(false);
          setTapToSpeak({ text, audio: clip });
          onEnd?.();
          if (shouldAutoListen()) startListeningRef.current();
        };
        const started = audio.play();
        if (started && typeof started.catch === "function") {
          started.catch(() => {
            if (__vaActiveAudio === audio) __vaActiveAudio = null;
            __vaActiveAudioStartedAt = 0;
            speakingRef.current = false;
            setSpeaking(false);
            setTapToSpeak({ text, audio: clip });
            onEnd?.();
            if (shouldAutoListen()) startListeningRef.current();
          });
        }
        return true;
      } catch {
        setTapToSpeak({ text, audio: clip });
        return false;
      }
    },
    [shouldAutoListen],
  );

  const speak = useCallback(
    (text: string, audio?: AgentAudioClip, onEnd?: () => void) => {
      if (audio && playAudioClip(audio, text, onEnd)) return;
      if (mutedRef.current || typeof window === "undefined" || !window.speechSynthesis) {
        if (!mutedRef.current) setTapToSpeak({ text, audio });
        onEnd?.();
        if (shouldAutoListen()) startListeningRef.current();
        return;
      }
      const synth = window.speechSynthesis;
      try {
        synth.cancel();
        synth.resume();
        const u = makeSpanishUtterance(text);
        setTapToSpeak(null);
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
          setTapToSpeak({ text });
          onEnd?.();
          if (shouldAutoListen()) startListeningRef.current();
        };
        synth.speak(u);
      } catch {
        setTapToSpeak({ text });
        onEnd?.();
        if (shouldAutoListen()) startListeningRef.current();
      }
    },
    [playAudioClip, shouldAutoListen],
  );

  const send = useCallback(
    async (text: string, viaVoice = false) => {
      const clean = text.trim();
      if (!clean || loadingRef.current) return;
      bumpIdle();
      stopListening();
      const next = [...msgs, { role: "user" as const, content: clean }];
      setMsgs(next);
      setInput("");
      setInterim("");
      setLoading(true);
      try {
        // Limpia estado obsoleto de la llamada anterior para que ninguna
        // categoría se contamine con un forwardPrompt/openSubmenu antiguo.
        if (typeof window !== "undefined") {
          try {
            window.sessionStorage.removeItem("afp:fwdPrompt");
            window.sessionStorage.removeItem("afp:openSubmenu");
          } catch {}
        }
        const fallback = localResolve(clean);
        let reply = fallback.reply;
        let target: string | undefined = fallback.path;
        let forwardPrompt: string | undefined =
          fallback.path === "/" && fallback.reply.includes("Dashboard Nocturno") ? clean : undefined;
        if (forwardPrompt && typeof window !== "undefined") {
          try {
            window.sessionStorage.setItem("afp:fwdPrompt", forwardPrompt);
          } catch {}
        }

        try {
          const res = await askAgent({
            data: {
              messages: next.map((m) => ({ role: m.role, content: m.content })),
              path,
            },
          });
          if (res && (res as any).ok) {
            const ai = res as { ok: true; content: string; navigate: string | null; forwardPrompt?: string; openSubmenu?: string };
            if (ai.content && ai.content.trim()) reply = ai.content.trim();
            if (ai.navigate) target = ai.navigate;
            if (ai.forwardPrompt && typeof window !== "undefined") {
              forwardPrompt = ai.forwardPrompt;
              try {
                window.sessionStorage.setItem("afp:fwdPrompt", ai.forwardPrompt);
              } catch {}
            }
            if (ai.openSubmenu && typeof window !== "undefined") {
              try {
                window.sessionStorage.setItem("afp:openSubmenu", ai.openSubmenu);
              } catch {}
            }
          }
        } catch {
          // si falla el servidor, nos quedamos con la respuesta local
        }

        setMsgs((m) => [...m, { role: "assistant", content: reply }]);
        const pendingSubmenu = typeof window !== "undefined" ? window.sessionStorage.getItem("afp:openSubmenu") : null;

        // Navegación tolerante: acepta paths con query string y rutas dinámicas
        // de BD (p.ej. /hotel/<uuid>, /vuelos?destino=amsterdam). Si TanStack
        // falla, caemos a window.location para no quedarnos atascados.
        const goTo = (raw: string) => {
          try {
            const qIdx = raw.indexOf("?");
            const pathname = qIdx >= 0 ? raw.slice(0, qIdx) : raw;
            const search: Record<string, string> = {};
            if (qIdx >= 0) {
              const sp = new URLSearchParams(raw.slice(qIdx + 1));
              sp.forEach((v, k) => (search[k] = v));
            }
            const hotelMatch = pathname.match(/^\/hotel\/([^/]+)$/);
            const restMatch = pathname.match(/^\/restaurants\/([^/]+)$/);
            const vueloMatch = pathname.match(/^\/vuelos\/([^/]+)$/);
            if (hotelMatch) {
              return navigate({ to: "/hotel/$id", params: { id: hotelMatch[1] } });
            }
            if (restMatch) {
              return navigate({ to: "/restaurants/$placeId", params: { placeId: restMatch[1] } });
            }
            if (vueloMatch) {
              return navigate({
                to: "/vuelos/$iata",
                params: { iata: vueloMatch[1] },
                search: search as any,
              });
            }
            if (Object.keys(search).length > 0) {
              return navigate({ to: pathname as any, search: search as any });
            }
            return navigate({ to: pathname as any });
          } catch {
            try { window.location.assign(raw); } catch {}
          }
        };

        if (forwardPrompt || pendingSubmenu) {
          setTimeout(() => {
            try {
              const done = target && target !== path ? goTo(target) : undefined;
              Promise.resolve(done).finally(() => {
                if (forwardPrompt) {
                  window.dispatchEvent(new CustomEvent("afp:forward-prompt", { detail: { text: forwardPrompt } }));
                }
                if (pendingSubmenu) {
                  window.dispatchEvent(new CustomEvent("afp:open-submenu", { detail: { path: pendingSubmenu } }));
                }
                onClose();
              });
            } catch {}
          }, 350);
        } else if (target && target !== path) {
          setTimeout(() => {
            goTo(target);
          }, 350);
        }
        if (viaVoice || modeRef.current === "voice") speak(reply, fallback.audio);
      } finally {
        setLoading(false);
      }
    },
    [msgs, path, navigate, speak, stopListening, bumpIdle, askAgent, onClose],
  );

  const sendRef = useRef(send);
  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  const startListening = useCallback(() => {
    if (!openRef.current || modeRef.current !== "voice") return;
    if (pausedRef.current || loadingRef.current || speakingRef.current) return;
    if (__vaMicWarmupState !== "ready") {
      const { message, promise } = getMicWarmupSnapshot();
      setListening(false);
      setMicReady(false);
      if (message) setVoiceError(message);
      if (promise) {
        promise.then((state) => {
          setMicReady(state === "ready");
          if (state === "ready") {
            setVoiceError(null);
            if (shouldAutoListen()) startListeningRef.current();
          } else if (__vaMicWarmupMessage) {
            setVoiceError(__vaMicWarmupMessage);
            setPaused(true);
          }
        });
      } else if (__vaMicWarmupState === "denied" || __vaMicWarmupState === "error") {
        setPaused(true);
      }
      return;
    }
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
      rec.continuous = true;
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
        if (lastTranscript) {
          bumpIdle();
          if (turnTimerRef.current) clearTimeout(turnTimerRef.current);
          turnTimerRef.current = setTimeout(() => finishTurn(), 950);
        }
      };
      const finishTurn = () => {
        if (handled) return true;
        if (turnTimerRef.current) {
          clearTimeout(turnTimerRef.current);
          turnTimerRef.current = null;
        }
        const t = (finalText || lastTranscript).trim();
        if (!t) return false;
        handled = true;
        setInterim("");
        try {
          rec.stop?.();
        } catch {}
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
          setTimeout(() => {
            if (shouldAutoListen()) startListeningRef.current();
          }, 700);
        }
      };
      recogRef.current = rec;
      setVoiceError(null);
      setMicReady(true);
      setListening(true);
      rec.start();
    } catch (err) {
      setListening(false);
      const message = err instanceof Error ? err.message : "";
      setVoiceError(
        message.includes("not-allowed") || message.includes("denied")
          ? "Permiso de micrófono denegado. Pulsa reanudar y acepta el permiso."
          : "No pude iniciar el micrófono. Pulsa reanudar para intentarlo otra vez.",
      );
      setPaused(true);
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
      bumpIdle();
    }
    if (!open && wasOpenRef.current) {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    }
    wasOpenRef.current = open;
  }, [open, bumpIdle]);

  // Hands-free bootstrap: when opening in voice mode, ensure we end up listening.
  // The greeting is spoken synchronously by the FAB onClick (so the browser
  // accepts it as a user-gesture action). Here we just kick off listening
  // once any in-flight speech finishes.
  const greetedRef = useRef(__vaGetGreetingSpoken());
  useEffect(() => {
    if (!open || mode !== "voice") return;
    if (__vaGetGreetingSpoken()) greetedRef.current = true;
    const SRClass = getSpeechRecognition();
    if (!SRClass) {
      setVoiceError("Tu navegador no soporta reconocimiento de voz. Cambia a modo texto.");
      return;
    }
    const synth = window.speechSynthesis;
    let cancelled = false;

    const tryStart = () => {
      if (cancelled) return;
      const mic = getMicWarmupSnapshot();
      setMicReady(mic.state === "ready");
      if (mic.message && mic.state !== "ready") setVoiceError(mic.message);
      // Refleja si aún suena el saludo, pero NO bloquea el inicio de escucha:
      // el reconocedor arranca en paralelo para que el usuario pueda hablar
      // inmediatamente (barge-in). Mucho mejor percepción de latencia.
      const stillSpeaking = Boolean(
        (synth && (synth.speaking || synth.pending || __vaActiveUtterance)) ||
          __vaActiveAudio,
      );
      setSpeaking(stillSpeaking);
      if (mic.state === "pending" && mic.promise) {
        mic.promise.then(() => {
          if (!cancelled && shouldAutoListen()) startListening();
        });
        return;
      }
      if (shouldAutoListen()) startListening();
    };

    // Arrancamos en el siguiente tick para no pisar el gesto de click.
    const t = setTimeout(tryStart, 0);
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
                  primeSpanishUtterances();
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
              {tapToSpeak && (
                <button
                  onClick={() => speak(tapToSpeak.text, tapToSpeak.audio)}
                  className="rounded-full border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
                >
                  tocar para oír respuesta
                </button>
              )}

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
                      primeSpanishUtterances();
                      const warmup = requestMicWarmupFromUserGesture();
                      setVoiceError(null);
                      setPaused(false);
                      if (warmup) {
                        warmup.then((state) => {
                          setMicReady(state === "ready");
                          if (state === "ready") startListeningRef.current();
                          else if (__vaMicWarmupMessage) setVoiceError(__vaMicWarmupMessage);
                        });
                      } else {
                        setMicReady(__vaMicWarmupState === "ready");
                        setTimeout(() => startListeningRef.current(), 100);
                      }
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
                {!micReady && (
                  <button
                    onClick={() => {
                      const warmup = requestMicWarmupFromUserGesture();
                      setVoiceError(__vaMicWarmupMessage);
                      warmup?.then((state) => {
                        setMicReady(state === "ready");
                        if (state === "ready") {
                          setVoiceError(null);
                          setPaused(false);
                          startListeningRef.current();
                        } else if (__vaMicWarmupMessage) {
                          setVoiceError(__vaMicWarmupMessage);
                        }
                      });
                    }}
                    className="flex items-center gap-1 rounded-full border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
                  >
                    <Mic className="h-3 w-3" /> activar micro
                  </button>
                )}
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

  const playGreetingAfterPermission = () => {
    try {
      const greetText = getGreetingText();
      const greetAudio = new Audio(audioSrc(getGreetingClip()));
      greetAudio.preload = "auto";
      greetAudio.volume = 1;
      __vaActiveAudio = greetAudio;
      __vaActiveAudioStartedAt = Date.now();
      __vaSetGreetingSpoken(true);
      greetAudio.onended = () => {
        if (__vaActiveAudio === greetAudio) __vaActiveAudio = null;
        __vaActiveAudioStartedAt = 0;
      };
      greetAudio.onerror = () => {
        if (__vaActiveAudio === greetAudio) __vaActiveAudio = null;
        __vaActiveAudioStartedAt = 0;
      };
      const audioStarted = greetAudio.play();
      if (audioStarted && typeof audioStarted.catch === "function") {
        audioStarted.catch(() => {
          if (__vaActiveAudio === greetAudio) __vaActiveAudio = null;
          __vaActiveAudioStartedAt = 0;
          const synth = window.speechSynthesis;
          if (!synth) return;
          const u = new SpeechSynthesisUtterance(greetText);
          u.lang = "es-ES";
          u.rate = 1.05;
          u.pitch = 1;
          const voice = pickSpanishVoice(synth);
          if (voice) u.voice = voice;
          __vaActiveUtterance = u;
          u.onend = () => { __vaActiveUtterance = null; };
          u.onerror = () => { __vaActiveUtterance = null; };
          synth.cancel();
          synth.resume();
          synth.speak(u);
        });
      }
      if (window.speechSynthesis) window.speechSynthesis.resume();
      primeSpanishUtterances();
    } catch {
      /* noop */
    }
  };

  const startGreetingFromUserGesture = () => {
    if (voiceBootStartedRef.current) return;
    voiceBootStartedRef.current = true;
    // Pedimos el permiso del micrófono ANTES de empezar la conversación.
    // getUserMedia debe llamarse de forma síncrona dentro del gesto del usuario.
    const warmup = requestMicWarmupFromUserGesture();
    const snap = getMicWarmupSnapshot();
    if (snap.state === "ready") {
      playGreetingAfterPermission();
      return;
    }
    if (!warmup) {
      // No hay API de micrófono; abrimos igualmente y saludamos.
      playGreetingAfterPermission();
      return;
    }
    warmup.then((state) => {
      if (state === "ready") {
        playGreetingAfterPermission();
      } else {
        // Permiso denegado o error: no iniciamos conversación, mostramos aviso en el panel.
        voiceBootStartedRef.current = false;
      }
    });
  };

  // Permitir abrir el agente desde otros botones (p.ej. el micro del chat)
  // El listener corre síncrono dentro del click handler externo, así que
  // sigue siendo un gesto de usuario válido para getUserMedia.
  useEffect(() => {
    const handler = () => {
      if (!voiceBootStartedRef.current) startGreetingFromUserGesture();
      setOpen(true);
    };
    window.addEventListener("vamos:open", handler);
    return () => window.removeEventListener("vamos:open", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {!open && (
        <button
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
