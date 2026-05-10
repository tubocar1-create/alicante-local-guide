import { useEffect, useRef, useState } from "react";
import { Send, Mic, MapPin, Map as MapIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { PlaceImage } from "@/components/PlaceImage";
import heroImg from "@/assets/alicante-hero.jpg";

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
const SUGGESTIONS = [
  "Where should we eat tonight? 🍤",
  "Best beach near the centre?",
  "What to do tomorrow in Alicante?",
  "Nightlife tips please 🍹",
];

const GREETING: Msg = {
  role: "assistant",
  content:
    "¡Hola! 👋 I'm your friend in Alicante. Tell me what you feel like — food, beach, a plan for today? I'll show you the spots locals actually love.",
};

export function ChatScreen() {
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setError(null);
    const userMsg: Msg = { role: "user", content: trimmed };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);

    let assistantSoFar = "";
    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && last !== GREETING && prev.length > next.length) {
          return prev.map((m, i) =>
            i === prev.length - 1 ? { ...m, content: assistantSoFar } : m,
          );
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!resp.ok || !resp.body) {
        const data = await resp.json().catch(() => ({ error: "Something went wrong" }));
        throw new Error(data.error || "Failed to reach Alicante Friend");
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let done = false;

      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buffer += decoder.decode(value, { stream: true });

        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line || line.startsWith(":")) continue;
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") {
            done = true;
            break;
          }
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) upsert(content);
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection issue");
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  const isWelcome = messages.length === 1 && !loading;

  return (
    <div className="relative flex h-[100dvh] flex-col bg-background">
      {/* Persistent background photo of Puerto de Alicante */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <img
          src={heroImg}
          alt=""
          aria-hidden
          className="h-full w-full object-cover"
        />
        <div
          className={[
            "absolute inset-0 transition-colors duration-700",
            isWelcome
              ? "bg-gradient-to-b from-background/10 via-background/40 to-background/85"
              : "bg-background/85 backdrop-blur-sm",
          ].join(" ")}
        />
      </div>

      {/* Compact header (always visible) */}
      <header className="relative flex items-center gap-3 border-b border-border/60 bg-background/40 px-4 py-3 backdrop-blur">
        <div className="flex h-10 w-10 items-center justify-center rounded-full gradient-warm shadow-soft text-primary-foreground">
          <MapPin className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h1 className="text-base font-semibold leading-tight">Alicante Friend</h1>
          <p className="text-xs text-muted-foreground">
            <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-emerald-500 align-middle" />
            your local in Alicante
          </p>
        </div>
        <Link
          to="/explore"
          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-full bg-primary text-primary-foreground active:scale-95 transition shadow-soft"
        >
          <MapIcon className="h-3.5 w-3.5" />
          Mapa
        </Link>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="relative flex-1 overflow-y-auto px-4 py-5">
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          {/* Welcome hero — shows on first open, fades when chat starts */}
          {isWelcome && (
            <div className="mb-2 overflow-hidden rounded-3xl shadow-soft">
              <div className="relative aspect-[16/10] w-full">
                <img
                  src={heroImg}
                  alt="Puerto de Alicante al atardecer"
                  width={1536}
                  height={1024}
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                  <p className="text-xs uppercase tracking-widest opacity-90">
                    Puerto de Alicante
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold leading-tight drop-shadow">
                    Bienvenido a Alicante 🌅
                  </h2>
                  <p className="mt-1 text-sm opacity-90">
                    Soy tu amigo local. Cuéntame qué te apetece hoy.
                  </p>
                </div>
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <Bubble key={i} role={m.role} content={m.content} />
          ))}
          {loading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex justify-start">
              <div className="rounded-3xl rounded-bl-md bg-bubble-friend px-4 py-3 shadow-soft">
                <div className="flex items-end gap-1">
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </div>
              </div>
            </div>
          )}
          {error && (
            <div className="self-center rounded-full bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
              {error}
            </div>
          )}

          {isWelcome && (
            <div className="mt-2 flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-border bg-card/90 px-3 py-2 text-sm text-card-foreground shadow-sm backdrop-blur transition hover:bg-accent/40"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="relative border-t border-border/60 bg-background/70 px-3 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/50">
        <div className="mx-auto flex max-w-2xl items-end gap-2">
          <div className="flex flex-1 items-end gap-2 rounded-3xl border border-border bg-card/90 px-3 py-2 shadow-sm backdrop-blur">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={1}
              placeholder="Message your friend in Alicante…"
              className="max-h-32 flex-1 resize-none bg-transparent py-1.5 text-[15px] outline-none placeholder:text-muted-foreground"
            />
          </div>
          {input.trim() ? (
            <button
              onClick={() => send(input)}
              disabled={loading}
              aria-label="Send"
              className="flex h-12 w-12 items-center justify-center rounded-full gradient-warm text-primary-foreground shadow-soft transition active:scale-95 disabled:opacity-60"
            >
              <Send className="h-5 w-5" />
            </button>
          ) : (
            <button
              onClick={() => alert("Voice messages coming soon 🎙️")}
              aria-label="Voice"
              className="flex h-12 w-12 items-center justify-center rounded-full gradient-warm text-primary-foreground shadow-soft transition active:scale-95"
            >
              <Mic className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Bubble({ role, content }: { role: "user" | "assistant"; content: string }) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={[
          "max-w-[85%] rounded-3xl px-4 py-2.5 text-[15px] leading-relaxed shadow-soft",
          isUser
            ? "rounded-br-md bg-bubble-user text-bubble-user-foreground whitespace-pre-wrap"
            : "rounded-bl-md bg-bubble-friend text-bubble-friend-foreground",
        ].join(" ")}
      >
        {isUser ? (
          content
        ) : (
          <AssistantContent content={content} />
        )}
      </div>
    </div>
  );
}

const PLACE_RE = /\[\[place:\s*([^\]]+?)\]\]/i;

function AssistantContent({ content }: { content: string }) {
  const match = content.match(PLACE_RE);
  const placeName = match?.[1]?.trim();
  // Strip the marker (and any surrounding blank line) from the rendered text
  const cleaned = content.replace(/\n?\[\[place:[^\]]+\]\]\n?/i, "").trim();

  return (
    <div className="space-y-2 [&>p]:m-0 [&_strong]:font-semibold">
      {placeName && <PlaceImage name={placeName} />}
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          img: ({ src, alt }) => (
            <img
              src={src as string}
              alt={alt || ""}
              loading="lazy"
              className="my-1 h-44 w-full rounded-2xl object-cover shadow-soft"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline underline-offset-2"
            >
              {children}
            </a>
          ),
          p: ({ children }) => <p className="whitespace-pre-wrap">{children}</p>,
        }}
      >
        {cleaned}
      </ReactMarkdown>
    </div>
  );
}
