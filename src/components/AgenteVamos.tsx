import { useEffect, useRef, useState } from "react";
import { Sparkles, Send, X, Loader2 } from "lucide-react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { agenteVamosChat } from "@/lib/agente.functions";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

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

export function AgenteVamosPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>(loadMsgs);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const callAgent = useServerFn(agenteVamosChat);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(msgs)); } catch {}
    }
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || loading) return;
    const next = [...msgs, { role: "user" as const, content: clean }];
    setMsgs(next);
    setInput("");
    setLoading(true);
    try {
      const res = await callAgent({ data: { messages: next, path } });
      if (res.ok) {
        const content = res.content || "Vale.";
        setMsgs((m) => [...m, { role: "assistant", content }]);
        if (res.navigate) {
          setTimeout(() => {
            try { navigate({ to: res.navigate as string }); } catch {}
          }, 350);
        }
      } else {
        setMsgs((m) => [...m, { role: "assistant", content: res.error || "Ahora mismo no puedo responder. Intenta otra vez en un momento." }]);
      }
    } catch {
      setMsgs((m) => [...m, { role: "assistant", content: "Algo ha fallado. ¿Lo intentamos de nuevo?" }]);
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-end sm:items-end sm:justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex h-[88vh] w-full flex-col overflow-hidden rounded-t-3xl bg-background shadow-2xl sm:m-4 sm:h-[80vh] sm:max-h-[720px] sm:w-[440px] sm:rounded-3xl">
        <header className="flex items-center justify-between border-b bg-gradient-to-r from-primary to-orange-500 px-4 py-3 text-primary-foreground">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-white/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold leading-tight">Agente Vamos</p>
              <p className="text-[11px] opacity-90">Tu concierge en Alicante</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="rounded-full p-1 hover:bg-white/20">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
          {msgs.map((m, i) => (
            <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
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
          onSubmit={(e) => { e.preventDefault(); send(input); }}
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
      </div>
    </div>
  );
}

export function AgenteVamosFab() {
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  // Hide on auth/onboarding routes
  const hidden = ["/login", "/magic", "/welcome"].includes(path) || path.startsWith("/business/login");
  if (hidden) return null;
  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir Agente Vamos"
          className="fixed bottom-5 right-5 z-[90] flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-orange-500 px-4 py-3 text-sm font-semibold text-primary-foreground shadow-2xl ring-4 ring-primary/20 transition hover:scale-105 active:scale-95"
        >
          <Sparkles className="h-5 w-5" />
          <span className="hidden sm:inline">Agente Vamos</span>
        </button>
      )}
      <AgenteVamosPanel open={open} onClose={() => setOpen(false)} />
    </>
  );
}
