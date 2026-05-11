import { useEffect, useRef, useState } from "react";
import { Send, Mic, MapPin, Home, User as UserIcon, QrCode, X, Gift, Ticket, Sparkles, ShieldCheck } from "lucide-react";
import { Link } from "@tanstack/react-router";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { PlaceImage } from "@/components/PlaceImage";
import { PointsHud } from "@/components/PointsHud";
import { usePoints } from "@/hooks/usePoints";
import { useUserLocation, distanceKm } from "@/hooks/useUserLocation";
import ReferralDialog from "@/components/ReferralDialog";
import { useAuth } from "@/hooks/useAuth";
import { findPlaceOverride } from "@/data/places";
import heroImg from "@/assets/alicante-hero.jpg";
import vamosLogoImg from "@/assets/logo_vamos_d.png";
import tileComer from "@/assets/tile_comer.png";
import tileDormir from "@/assets/tile_dormir.png";
import tilePlaya from "@/assets/tile_playa.png";
import tileParque from "@/assets/tile_parque.png";
import tileComprar from "@/assets/tile_comprar.png";
import tileTomar from "@/assets/tile_tomar.png";
import tileTurismo from "@/assets/tile_turismo.png";
import tileMapa from "@/assets/tile_mapa.png";

const TILE_STYLES: Record<string, { img: string; bg: string }> = {
  Comer:        { img: tileComer,   bg: "oklch(0.95 0.06 70)" },
  Dormir:       { img: tileDormir,  bg: "oklch(0.94 0.05 280)" },
  Playa:        { img: tilePlaya,   bg: "oklch(0.93 0.07 220)" },
  Parque:       { img: tileParque,  bg: "oklch(0.94 0.07 145)" },
  Comprar:      { img: tileComprar, bg: "oklch(0.94 0.07 340)" },
  "Tomar algo": { img: tileTomar,   bg: "oklch(0.95 0.07 50)" },
  Turismo:      { img: tileTurismo, bg: "oklch(0.94 0.05 25)" },
  Mapa:         { img: tileMapa,    bg: "oklch(0.93 0.06 200)" },
};

type Msg = { role: "user" | "assistant"; content: string };
type GeoInfo = {
  lat: number;
  lng: number;
  area?: string;
  city?: string;
  distanceFromAlicanteKm?: number;
};
type GeoStatus = "idle" | "asking" | "ok" | "denied";
const ALICANTE_CENTER = { lat: 38.3452, lng: -0.481 };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
type Suggestion = {
  label: string;
  prompt?: string;
  submenu?: Suggestion[];
};
const SUGGESTIONS: Suggestion[] = [
  {
    label: "🍽️ Comer",
    submenu: [
      { label: "🥘 Cocina típica", prompt: "Recomiéndame un sitio de cocina típica alicantina abierto ahora" },
      { label: "🍤 Arroces y pescado", prompt: "Quiero un buen arroz o pescado fresco, ¿dónde voy ahora?" },
      { label: "🍕 Italiano", prompt: "Apetece italiano, ¿dónde puedo ir ahora?" },
      {
        label: "🍔 Comida rápida",
        submenu: [
          { label: "🍔 Hamburguesas", prompt: "Una buena hamburguesería abierta ahora (McDonald's, Burger King, TGB, Goiko, Five Guys…)" },
          { label: "🍕 Pizzas", prompt: "Una pizzería abierta ahora (Telepizza, Domino's…)" },
          { label: "🥖 Montaditos", prompt: "Un sitio de montaditos abierto ahora (100 Montaditos, Lizarrán…)" },
          { label: "🌯 Kebaps", prompt: "Un buen kebap abierto ahora" },
          { label: "🍗 Pollo frito", prompt: "Un sitio de pollo frito o pollos asados abierto ahora (KFC, Popeyes…)" },
          { label: "🌮 Comida mexicana", prompt: "Un mexicano abierto ahora (Taco Bell, tacos, burritos…)" },
        ],
      },
      { label: "🍣 Japonés / Asiático", prompt: "Un japonés o asiático rico abierto ahora" },
      { label: "🌱 Vegano / Saludable", prompt: "Un sitio vegano o saludable abierto ahora" },
      { label: "🥐 Desayuno / Brunch", prompt: "Un buen desayuno o brunch abierto ahora" },
      { label: "🍰 Postres / Cafetería", prompt: "Una cafetería con postres ricos abierta ahora" },
      { label: "💸 Barato y rico", prompt: "Algo barato y rico para comer ya, abierto ahora" },
      { label: "✨ Sorpréndeme", prompt: "Sorpréndeme con un sitio rico para comer abierto ahora" },
    ],
  },
  { label: "🏨 Dormir", prompt: "¿Dónde puedo dormir esta noche?" },
  { label: "🏖️ Playa", prompt: "¿Qué playa me recomiendas?" },
  { label: "🌳 Parque", prompt: "¿Qué parque o zona verde me recomiendas?" },
  { label: "🛍️ Comprar", prompt: "¿Dónde puedo ir de compras?" },
  { label: "🍹 Tomar algo", prompt: "¿Dónde voy a tomar algo abierto ahora?" },
];

const GREETING: Msg = {
  role: "assistant",
  content:
    "¡Hola! 👋 I'm your friend in Alicante. Tell me what you feel like — food, beach, a plan for today? I'll show you the spots locals actually love.",
};

export function ChatScreen() {
  // Activa el sistema de puntos (también dispara el streak diario al montar).
  usePoints();
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submenuStack, setSubmenuStack] = useState<Suggestion[]>([]);
  const activeSubmenu = submenuStack[submenuStack.length - 1] ?? null;
  const setActiveSubmenu = (s: Suggestion | null) => setSubmenuStack(s ? [s] : []);
  const [geo, setGeo] = useState<GeoInfo | null>(null);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>("idle");
  const [referralName, setReferralName] = useState<string | null>(null);
  const [referralAuto, setReferralAuto] = useState(false);
  const [showQrInfo, setShowQrInfo] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { name?: string } | undefined;
      if (detail?.name) {
        setReferralAuto(false);
        setReferralName(detail.name);
      }
    };
    window.addEventListener("afp:wantgo", handler);
    // Pick up post-login redirect: /?ref=<placeName>
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get("ref");
      if (ref) {
        setReferralAuto(true);
        setReferralName(ref);
        params.delete("ref");
        const qs = params.toString();
        window.history.replaceState(
          null,
          "",
          window.location.pathname + (qs ? `?${qs}` : "")
        );
      }
    }
    return () => window.removeEventListener("afp:wantgo", handler);
  }, []);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { state: locState, request: requestLocation } = useUserLocation();

  // React to location state changes; reverse-geocode when we get coords.
  useEffect(() => {
    if (locState.status === "ready") {
      const { lat, lng } = locState.coords;
      const dKm = distanceKm({ lat, lng }, ALICANTE_CENTER);
      setGeo({ lat, lng, distanceFromAlicanteKm: Math.round(dKm * 10) / 10 });
      setGeoStatus("ok");
      // Reverse geocode (Nominatim) — best-effort, no key required.
      fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=16&accept-language=es`,
      )
        .then((r) => r.json())
        .then((d) => {
          const a = d?.address ?? {};
          const area =
            a.neighbourhood || a.suburb || a.quarter || a.city_district || a.village || a.town;
          const city = a.city || a.town || a.village || a.municipality;
          setGeo((prev) =>
            prev ? { ...prev, area, city } : { lat, lng, area, city, distanceFromAlicanteKm: dKm },
          );
        })
        .catch(() => {});
    } else if (locState.status === "error") {
      setGeoStatus("denied");
    } else if (locState.status === "loading") {
      setGeoStatus("asking");
    }
  }, [locState]);

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
          context: {
            maxOptions: 4,
            location: geo
              ? {
                  lat: geo.lat,
                  lng: geo.lng,
                  area: geo.area,
                  city: geo.city,
                  distanceFromAlicanteKm: geo.distanceFromAlicanteKm,
                }
              : null,
            locationStatus: geoStatus,
          },
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
    <div
      className={[
        "relative flex h-[100dvh] flex-col transition-colors duration-700",
        isWelcome ? "bg-[oklch(0.88_0.16_88)]" : "bg-background",
      ].join(" ")}
    >
      {/* Persistent background photo of Puerto de Alicante (only when chatting) */}
      {!isWelcome && (
        <div className="pointer-events-none absolute inset-0 -z-10">
          <img src={heroImg} alt="" aria-hidden className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-background/85 backdrop-blur-sm" />
        </div>
      )}

      {/* Compact header (always visible) */}
      <header className="relative flex items-center justify-end gap-1.5 border-b border-border/60 bg-background/40 px-4 py-3 backdrop-blur">
        <PointsHud compact />
        <ProfileButton />
        <button
          onClick={() => {
            setMessages([GREETING]);
            setActiveSubmenu(null);
            setError(null);
            setInput("");
          }}
          className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-full bg-secondary text-secondary-foreground active:scale-95"
          aria-label="Inicio"
        >
          <Home className="h-3 w-3" />
          Inicio
        </button>
        <Link
          to="/explore"
          className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-full bg-secondary text-secondary-foreground active:scale-95"
        >
          🗺️ Explorar
        </Link>
        <Link
          to="/stay"
          className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-full bg-secondary text-secondary-foreground active:scale-95"
        >
          🏨 Dormir
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
                <button
                  type="button"
                  onClick={() => setShowQrInfo(true)}
                  aria-label="Beneficios del QR VAMOS"
                  className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-[12px] font-extrabold text-primary-foreground shadow-soft ring-2 ring-white/70 backdrop-blur active:scale-95"
                >
                  <QrCode className="h-3.5 w-3.5" />
                  QR VAMOS
                </button>
                <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                  <p className="text-xs uppercase tracking-widest opacity-90">Puerto de Alicante</p>
                  <h2 className="mt-1 leading-none drop-shadow">
                    <span
                      className="italic font-black text-[44px] sm:text-[54px] tracking-tight text-[oklch(0.92_0.16_85)] drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)]"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      VAMOS
                    </span>
                    <span className="ml-2 align-middle text-2xl font-extrabold text-white">
                      a Alicante
                    </span>
                  </h2>
                  <p className="mt-2 text-sm opacity-95 drop-shadow">
                    Soy tu amigo local. Cuéntame qué te apetece hoy y te llevo a los rincones que adoramos los de aquí.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* (Tiles render below as Glovo-style row, replacing old chip suggestions) */}

          {messages.map((m, i) =>
            isWelcome && i === 0 ? null : <Bubble key={i} role={m.role} content={m.content} />,
          )}
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

          {isWelcome && !activeSubmenu && (
            <div className="mt-2 rounded-3xl bg-card/95 p-3 shadow-soft ring-1 ring-border/60 backdrop-blur sm:p-4">
              <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-8 sm:gap-3">
                {[
                  ...SUGGESTIONS.map((s) => {
                    const match = s.label.match(/^(\p{Extended_Pictographic}+)\s*(.*)$/u);
                    return {
                      key: s.label,
                      emoji: match?.[1] ?? "✨",
                      label: match?.[2] ?? s.label,
                      onClick: () => {
                        if (s.submenu) setActiveSubmenu(s);
                        else if (s.prompt) send(s.prompt);
                      },
                    };
                  }),
                  {
                    key: "turismo",
                    emoji: "🏛️",
                    label: "Turismo",
                    onClick: () =>
                      send(
                        "¿Qué sitios turísticos imprescindibles puedo visitar en Alicante hoy?",
                      ),
                  },
                  {
                    key: "mapa",
                    emoji: "🗺️",
                    label: "Mapa",
                    onClick: () => {
                      const url = geo
                        ? `https://www.google.com/maps/search/?api=1&query=${geo.lat},${geo.lng}`
                        : `https://www.google.com/maps/search/?api=1&query=Alicante`;
                      try {
                        (window.top ?? window).open(url, "_blank", "noopener,noreferrer");
                      } catch {
                        window.open(url, "_blank", "noopener,noreferrer");
                      }
                    },
                  },
                ].map((t) => {
                  const style = TILE_STYLES[t.label];
                  return (
                    <button
                      key={t.key}
                      onClick={t.onClick}
                      aria-label={t.label}
                      className="group flex flex-col items-center"
                    >
                      <div className="grid aspect-square w-full place-items-center rounded-2xl bg-white shadow-md ring-2 ring-[oklch(0.25_0.04_35)] transition group-hover:-translate-y-0.5 group-active:scale-95 overflow-hidden">
                        {style ? (
                          <img
                            src={style.img}
                            alt=""
                            aria-hidden
                            loading="lazy"
                            width={1024}
                            height={1024}
                            className="h-[82%] w-[82%] object-contain"
                          />
                        ) : (
                          <span className="text-[38px]">{t.emoji}</span>
                        )}
                      </div>
                      <span className="mt-1.5 block w-full text-[12px] font-semibold leading-tight tracking-tight text-foreground text-center">
                        {t.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {isWelcome && activeSubmenu && (
            <div className="mt-2 rounded-2xl border border-border bg-card/90 p-3 shadow-sm backdrop-blur">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium">{activeSubmenu.label} — ¿qué te apetece?</p>
                <button
                  onClick={() =>
                    setSubmenuStack((stack) => stack.slice(0, -1))
                  }
                  className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                >
                  ← Volver
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {activeSubmenu.submenu?.map((opt) => (
                  <button
                    key={opt.label}
                    onClick={() => {
                      if (opt.submenu) {
                        setSubmenuStack((stack) => [...stack, opt]);
                      } else if (opt.prompt) {
                        setSubmenuStack([]);
                        send(opt.prompt);
                      }
                    }}
                    className="rounded-full border border-border bg-background/80 px-3 py-2 text-sm shadow-sm transition hover:bg-accent/40"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="relative border-t border-border/60 bg-background/70 px-3 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/50">
        {geoStatus === "ok" && geo?.city && (
          <div className="mx-auto mb-2 max-w-2xl text-center text-[11px] text-muted-foreground">
            <MapPin className="mr-1 inline h-3 w-3 text-primary" />
            Te tengo en {geo.area ? `${geo.area}, ` : ""}
            {geo.city}
          </div>
        )}
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
      {referralName && (
        <ReferralDialog
          placeId={referralName}
          placeName={referralName}
          autoCelebrate={referralAuto}
          onClose={() => {
            setReferralName(null);
            setReferralAuto(false);
          }}
        />
      )}
      {showQrInfo && <QrVamosInfo onClose={() => setShowQrInfo(false)} />}
    </div>
  );
}

function VamosLogo() {
  return (
    <div
      aria-label="VAMOS"
      className="relative flex h-10 items-center justify-center rounded-2xl gradient-warm px-2.5 shadow-soft ring-2 ring-white/70"
    >
      <span className="text-[15px] font-black tracking-tight text-primary-foreground drop-shadow-sm">
        VAMOS
      </span>
      <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-background text-[10px] shadow ring-1 ring-border">
        🌅
      </span>
    </div>
  );
}

function QrVamosInfo({ onClose }: { onClose: () => void }) {
  const benefits = [
    { icon: Gift, title: "Descuentos reales", text: "Precios de amigo en bares, restaurantes y planes que de verdad merecen la pena." },
    { icon: Ticket, title: "Acceso a experiencias", text: "Catas, tours, rutas y eventos pensados para quienes viven Alicante como un local." },
    { icon: Sparkles, title: "Suma puntos AFP", text: "Cada QR validado en sitio te da puntos para canjear por más ventajas." },
    { icon: ShieldCheck, title: "Único e intransferible", text: "Tu QR, tu día, tu plan. Sin intermediarios, sin trampas, sin spam." },
  ];
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-3xl bg-background p-5 shadow-soft"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-secondary-foreground active:scale-95"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl gradient-warm text-primary-foreground shadow-soft">
            <QrCode className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-extrabold leading-tight">
              <span className="text-primary">QR VAMOS</span>
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Tu llave de amigo local en Alicante
            </p>
          </div>
        </div>

        <p className="mt-3 text-sm text-foreground/90">
          Con un <b>QR VAMOS</b> entras como un local, no como un turista. Esto es lo que te llevas:
        </p>

        <ul className="mt-3 space-y-2.5">
          {benefits.map((b) => (
            <li key={b.title} className="flex gap-3 rounded-2xl border border-border bg-card/60 p-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl gradient-warm text-primary-foreground shadow-soft">
                <b.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-bold leading-tight text-foreground">{b.title}</p>
                <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">{b.text}</p>
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-3 text-[11px] text-muted-foreground">
          ¿Cómo se consigue? Pulsa <b>VAMOS</b> en cualquier sitio que te recomiende tu amigo local y generas tu QR del día.
        </p>

        <button
          onClick={onClose}
          className="mt-4 w-full rounded-full gradient-warm py-2.5 text-sm font-bold text-primary-foreground shadow-soft active:scale-95"
        >
          ¡VAMOS!
        </button>
      </div>
    </div>
  );
}

function ProfileButton() {
  const { user, isAuthenticated } = useAuth();
  const initial = user?.name?.trim().charAt(0).toUpperCase();
  if (isAuthenticated) {
    return (
      <Link
        to="/perfil"
        aria-label="Mi perfil"
        className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-border bg-card text-xs font-bold text-primary shadow-sm active:scale-95"
      >
        {initial || <UserIcon className="h-4 w-4 text-muted-foreground" />}
      </Link>
    );
  }
  return (
    <Link
      to="/login"
      search={{ redirect: "/perfil" }}
      aria-label="Iniciar sesión"
      className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-border bg-card shadow-sm active:scale-95"
    >
      <UserIcon className="h-4 w-4 text-muted-foreground" />
    </Link>
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
        {isUser ? content : <AssistantContent content={content} />}
      </div>
    </div>
  );
}

const PLACE_RE = /\[\[place:\s*([^\]]+?)\]\]/i;
const CARD_RE = /\[\[card:([^\]]+)\]\]/g;

type PlaceCardData = {
  name: string;
  cuisine?: string | null;
  address?: string | null;
  closesAt?: string;
  lat?: number;
  lon?: number;
  vibe?: string;
  theme?: string;
};

const THEME_STYLES: Record<string, { bg: string; ring: string; badge: string }> = {
  sun:    { bg: "bg-gradient-to-br from-amber-200 via-orange-200 to-rose-300 dark:from-amber-800/60 dark:via-orange-800/50 dark:to-rose-800/60",  ring: "border-amber-400/70",  badge: "bg-amber-600 text-white" },
  sea:    { bg: "bg-gradient-to-br from-sky-200 via-cyan-200 to-blue-300 dark:from-sky-800/60 dark:via-cyan-800/50 dark:to-blue-800/60",          ring: "border-sky-400/70",    badge: "bg-sky-600 text-white" },
  citrus: { bg: "bg-gradient-to-br from-lime-200 via-yellow-200 to-amber-300 dark:from-lime-800/60 dark:via-yellow-800/50 dark:to-amber-800/60",  ring: "border-lime-400/70",   badge: "bg-lime-600 text-white" },
  rose:   { bg: "bg-gradient-to-br from-rose-200 via-pink-200 to-fuchsia-300 dark:from-rose-800/60 dark:via-pink-800/50 dark:to-fuchsia-800/60",   ring: "border-rose-400/70",   badge: "bg-rose-600 text-white" },
  mint:   { bg: "bg-gradient-to-br from-emerald-200 via-teal-200 to-cyan-300 dark:from-emerald-800/60 dark:via-teal-800/50 dark:to-cyan-800/60",   ring: "border-emerald-400/70",badge: "bg-emerald-600 text-white" },
  grape:  { bg: "bg-gradient-to-br from-violet-200 via-purple-200 to-indigo-300 dark:from-violet-800/60 dark:via-purple-800/50 dark:to-indigo-800/60", ring: "border-violet-400/70", badge: "bg-violet-600 text-white" },
};

function PlaceCard({ data }: { data: PlaceCardData }) {
  const mapsHref = data.lat && data.lon
    ? `https://www.google.com/maps/dir/?api=1&destination=${data.lat},${data.lon}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${data.name} Alicante`)}`;
  const reviewsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${data.name} Alicante`)}`;
  const override = findPlaceOverride(data.name);
  const theme = THEME_STYLES[data.theme ?? "sun"] ?? THEME_STYLES.sun;
  return (
    <div className={`my-2 overflow-hidden rounded-2xl border ${theme.ring} ${theme.bg} shadow-soft backdrop-blur`}>
      {override?.image && (
        <img
          src={override.image}
          alt={data.name}
          loading="lazy"
          className="h-32 w-full object-cover"
        />
      )}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="font-semibold leading-tight text-card-foreground truncate">{data.name}</h4>
            {data.cuisine && (
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground mt-0.5 truncate">
                {data.cuisine.replace(/;/g, ", ")}
              </p>
            )}
          </div>
          {data.closesAt && (
            <span className={`shrink-0 inline-flex items-center gap-1 text-[12px] font-bold px-2.5 py-1 rounded-full shadow-soft ring-1 ring-black/10 ${theme.badge}`}>
              ⏰ cierra {data.closesAt}
            </span>
          )}
        </div>
        {data.vibe && <p className="mt-2 text-sm font-bold text-foreground">{data.vibe}</p>}
        {data.address && (
          <p className="mt-1 text-xs text-muted-foreground flex items-start gap-1">
            <MapPin className="w-3 h-3 mt-0.5 shrink-0" /> <span>{data.address}</span>
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-1.5">
          <a
            href={mapsHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full bg-primary text-primary-foreground active:scale-95"
          >
            📍 Cómo llegar
          </a>
          <a
            href={reviewsHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground active:scale-95"
          >
            ⭐ Reseñas
          </a>
          <button
            type="button"
            onClick={() =>
              window.dispatchEvent(new CustomEvent("afp:wantgo", { detail: { name: data.name } }))
            }
            className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full gradient-warm text-primary-foreground shadow-soft active:scale-95"
          >
            🎟️ VAMOS
          </button>
        </div>
      </div>
    </div>
  );
}

function MarkdownText({ text }: { text: string }) {
  if (!text.trim()) return null;
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      urlTransform={(url) => url}
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
        a: ({ href, children }) => {
          const url = String(href ?? "");
          if (url.startsWith("qi:")) {
            const name = decodeURIComponent(url.slice(3));
            return (
              <button
                type="button"
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("afp:wantgo", { detail: { name } }))
                }
                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full gradient-warm text-primary-foreground shadow-soft active:scale-95 align-middle ml-1"
              >
                🎟️ VAMOS
              </button>
            );
          }
          return (
            <a href={url} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">
              {children}
            </a>
          );
        },
        p: ({ children }) => <p className="whitespace-pre-wrap">{children}</p>,
      }}
    >
      {text}
    </ReactMarkdown>
  );
}

function AssistantContent({ content }: { content: string }) {
  const match = content.match(PLACE_RE);
  const placeName = match?.[1]?.trim();
  const cleaned = content.replace(/\n?\[\[place:[^\]]+\]\]\n?/i, "").trim();

  const parts: Array<{ type: "text"; value: string } | { type: "card"; data: PlaceCardData }> = [];
  let lastIndex = 0;
  const re = /\[\[card:([\s\S]+?)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned)) !== null) {
    if (m.index > lastIndex) parts.push({ type: "text", value: cleaned.slice(lastIndex, m.index) });
    try {
      const data = JSON.parse(decodeURIComponent(m[1])) as PlaceCardData;
      parts.push({ type: "card", data });
    } catch (err) {
      console.warn("[card-parse-fail]", err, m[1]?.slice(0, 80));
      parts.push({ type: "text", value: m[0] });
    }
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < cleaned.length) parts.push({ type: "text", value: cleaned.slice(lastIndex) });
  if (parts.length === 0) parts.push({ type: "text", value: cleaned });

  return (
    <div className="space-y-2 [&>p]:m-0 [&_strong]:font-semibold">
      {placeName && <PlaceImage name={placeName} />}
      {parts.map((p, i) =>
        p.type === "card" ? (
          <PlaceCard key={i} data={p.data} />
        ) : (
          <MarkdownText key={i} text={p.value.replace(/^\n+|\n+$/g, "")} />
        ),
      )}
    </div>
  );
}
