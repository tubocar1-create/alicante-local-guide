import { useEffect, useRef, useState } from "react";
import { Send, Mic, MapPin, Home, User as UserIcon, QrCode, X, Gift, Ticket, Sparkles, ShieldCheck, CalendarPlus, CalendarCheck, CalendarDays, Sun, Cloud, CloudRain, CloudSnow, CloudLightning, CloudFog, Bell, Heart, Bookmark, ChevronRight, Utensils, Bed, Umbrella, ShoppingBag, Martini, Bus, Stethoscope, type LucideIcon } from "lucide-react";
import { useWeather } from "@/hooks/useWeather";
import BookingDialog from "@/components/BookingDialog";
import { AdBanner } from "@/components/AdBanner";
import type { Listing } from "@/lib/overpass-listings";
import { Link } from "@tanstack/react-router";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { PlaceImage } from "@/components/PlaceImage";
import { PointsHud } from "@/components/PointsHud";
import { usePoints } from "@/hooks/usePoints";
import { useUserLocation, distanceKm } from "@/hooks/useUserLocation";
import ReferralDialog from "@/components/ReferralDialog";
import { LiveEta } from "@/components/LiveEta";
import { BusKnownPicker, type BusStopPick } from "@/components/BusKnownPicker";
import { FlightPicker } from "@/components/FlightPicker";
import { useAuth } from "@/hooks/useAuth";
import { findPlaceOverride } from "@/data/places";
import heroImg from "@/assets/alicante-hero.jpg";
import skylineImg from "@/assets/alicante-skyline.png";
import portadaImg from "@/assets/alicante-portada.jpg";
import tileComer from "@/assets/tile_comer.png";
import tileDormir from "@/assets/tile_dormir.png";
import tilePlaya from "@/assets/tile_playa.png";
import tileParque from "@/assets/tile_parque.png";
import tileComprar from "@/assets/tile_comprar.png";
import tileTomar from "@/assets/tile_tomar.png";
import tileTurismo from "@/assets/tile_turismo.png";
import tilePlayaAventura from "@/assets/tile_playa_aventura.png";
import tileMapa from "@/assets/tile_mapa.png";
import tileBus from "@/assets/tile_bus.png";

const TILE_STYLES: Record<string, { img: string; bg: string }> = {
  Comer:        { img: tileComer,   bg: "oklch(0.95 0.06 70)" },
  Dormir:       { img: tileDormir,  bg: "oklch(0.94 0.05 280)" },
  Playa:        { img: tilePlaya,   bg: "oklch(0.93 0.07 220)" },
  Parque:       { img: tileParque,  bg: "oklch(0.94 0.07 145)" },
  Comprar:      { img: tileComprar, bg: "oklch(0.94 0.07 340)" },
  "Tomar algo": { img: tileTomar,   bg: "oklch(0.95 0.07 50)" },
  Turismo:      { img: tileTurismo, bg: "oklch(0.94 0.05 25)" },
  "Turismo, playa y aventuras": { img: tilePlayaAventura, bg: "oklch(0.93 0.07 220)" },
  Mapa:         { img: tileMapa,    bg: "oklch(0.93 0.06 200)" },
  "Transporte público": { img: tileBus, bg: "oklch(0.93 0.06 190)" },
};

const TILE_SUBTITLES: Record<string, string> = {
  "Comer": "Restaurantes y tapas",
  "Dormir": "Hoteles y alojamientos",
  "Turismo, playa y aventuras": "Turismo, sol y planes",
  "Comprar": "Tiendas y mercados",
  "Tomar algo": "Bares y copas",
  "Transporte público": "Bus, TRAM, taxis",
  "Mapa": "Explora la ciudad",
  "Servicios sanitarios": "Farmacias y hospitales",
  "Eventos": "Conciertos y agenda",
};

const TILE_ICONS: Record<string, LucideIcon> = {
  "Comer": Utensils,
  "Dormir": Bed,
  "Turismo, playa y aventuras": Umbrella,
  "Comprar": ShoppingBag,
  "Tomar algo": Martini,
  "Transporte público": Bus,
  "Mapa": MapPin,
  "Servicios sanitarios": Stethoscope,
  "Eventos": CalendarDays,
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
  action?: "bus-picker" | "flight-picker";
  href?: string;
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
  {
    label: "🏖️ Turismo, playa y aventuras",
    submenu: [
      { label: "🏛️ Turismo", prompt: "¿Qué sitios turísticos imprescindibles puedo visitar en Alicante hoy?" },
      { label: "🏖️ Playa", prompt: "¿Qué playa me recomiendas?" },
      { label: "🌳 Parque", prompt: "¿Qué parque o zona verde me recomiendas?" },
      { label: "🧗 Aventuras", prompt: "¿Qué planes de aventura o actividades al aire libre puedo hacer hoy en Alicante o alrededores?" },
    ],
  },
  { label: "🛍️ Comprar", prompt: "¿Dónde puedo ir de compras?" },
  { label: "🍹 Tomar algo", prompt: "¿Dónde voy a tomar algo abierto ahora?" },
  {
    label: "🚆 Transporte público",
    submenu: [
      { label: "🚌 Buses urbanos", action: "bus-picker" },
      { label: "🚍 Buses extra urbanos", prompt: "¿Cómo me muevo en bus extraurbano desde Alicante? Líneas, compañías (ALSA, Vectalia…), estación de autobuses y destinos principales (Elche, Benidorm, Murcia, Valencia, pueblos del interior)." },
      { label: "🚊 Tram", prompt: "¿Cómo uso el TRAM de Alicante? Líneas, paradas principales y conexiones con la playa." },
      { label: "🚆 Tren", prompt: "¿Cómo me muevo en tren por Alicante y alrededores? Horarios, estaciones de Cercanías y Renfe." },
      {
        label: "✈️ Avión",
        submenu: [
          { label: "🛫 Vuelos de salida", href: "/vuelos?type=S" },
          { label: "🛬 Vuelos de llegada", href: "/vuelos?type=L" },
          { label: "🔎 Seleccione su vuelo", action: "flight-picker" },
        ],
      },
    ],
  },
];

const GREETING: Msg = {
  role: "assistant",
  content:
    "¡Hola! 👋 I'm your friend in Alicante. Tell me what you feel like — food, beach, a plan for today? I'll show you the spots locals actually love.",
};

export function ChatScreen() {
  // Activa el sistema de puntos (también dispara el streak diario al montar).
  usePoints();
  const { user: authUser } = useAuth();
  const firstName = authUser?.name?.trim().split(" ")[0];
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
  const [mode, setMode] = useState<"transit" | null>(null);
  const [showBusPicker, setShowBusPicker] = useState(false);
  const [showFlightPicker, setShowFlightPicker] = useState(false);

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

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { text?: string } | undefined;
      if (detail?.text) {
        void send(detail.text, { mode: "transit" });
      }
    };
    window.addEventListener("bus:choose", handler);
    return () => window.removeEventListener("bus:choose", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, loading]);
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

  async function send(text: string, opts?: { mode?: "transit" | null }) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    const effectiveMode = opts?.mode !== undefined ? opts.mode : mode;
    if (opts?.mode !== undefined) setMode(opts.mode);
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
            mode: effectiveMode,
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
        "ring-2 ring-[oklch(0.78_0.05_85)]/80 ring-inset",
        isWelcome ? "bg-[oklch(0.985_0.018_88)] text-foreground" : "bg-background",
      ].join(" ")}
    >
      {/* Persistent background photo of Puerto de Alicante (only when chatting) */}
      {!isWelcome && (
        <div className="pointer-events-none absolute inset-0 -z-10">
          <img src={heroImg} alt="" aria-hidden className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-background/85 backdrop-blur-sm" />
        </div>
      )}

      {/* Header — formato cabecera tipo app: avatar + saludo + tiempo + campana */}
      {isWelcome ? (
        <header className="relative flex items-center justify-between gap-3 px-4 pt-4 pb-2">
          <div className="flex items-center gap-3 min-w-0">
            <ProfileButton large />
            <div className="min-w-0">
              <p className="text-[15px] font-extrabold leading-tight text-foreground truncate">
                ¡Hola{firstName ? `, ${firstName}` : ""}!
              </p>
              <p className="text-[12px] leading-tight text-muted-foreground truncate">
                ¿Qué vas a descubrir hoy?
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <WeatherChip />
            <Link
              to="/threads"
              aria-label="Mis reservas"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/70 ring-1 ring-border/60 text-foreground active:scale-95"
            >
              <Bell className="h-4 w-4" />
            </Link>
          </div>
        </header>
      ) : (
        <header className="relative flex items-center justify-between gap-1.5 border-b border-border/60 bg-background/40 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-2">
            <ProfileButton />
            <Link
              to="/threads"
              aria-label="Mis reservas"
              className="flex h-8 items-center gap-1 rounded-full border border-border bg-card px-2.5 text-[11px] font-semibold text-foreground shadow-sm active:scale-95"
            >
              <CalendarCheck className="h-3.5 w-3.5 text-primary" />
              <span>Mis reservas</span>
            </Link>
          </div>
          <div className="flex-1 flex justify-center">
            <PointsHud compact />
          </div>
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
        </header>
      )}

      {isWelcome && <div className="mb-2"><AdBanner /></div>}

      {/* Messages */}
      <div ref={scrollRef} className={["relative flex-1 px-4 pt-3 pb-5", isWelcome ? "overflow-hidden" : "overflow-y-auto"].join(" ")}>
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          {isWelcome && (
            <div className="mx-auto mb-1 w-full max-w-[320px] overflow-hidden rounded-xl">
              <img
                src={portadaImg}
                alt="Alicante"
                className="h-auto w-full object-cover rounded-xl"
                loading="eager"
              />
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

          {showBusPicker && (
            <BusKnownPicker
              onClose={() => setShowBusPicker(false)}
              onUnknown={() => {
                setShowBusPicker(false);
                void send("Hola, quiero moverme en bus por Alicante.", { mode: "transit" });
              }}
              onSelected={(pick: BusStopPick) => {
                setShowBusPicker(false);
                setMode("transit");
                const userText = `Quiero coger la línea ${pick.line} en la parada ${pick.stopName} (${pick.stopCode}).`;
                const payload = encodeURIComponent(JSON.stringify(pick));
                const reply = `¡Perfecto! Te muestro el tiempo de llegada en tu parada.\n\n[[busstop:${payload}]]`;
                setMessages((prev) => [
                  ...prev,
                  { role: "user", content: userText },
                  { role: "assistant", content: reply },
                ]);
              }}
            />
          )}

          {showFlightPicker && (
            <FlightPicker onClose={() => setShowFlightPicker(false)} />
          )}

          {isWelcome && !activeSubmenu && (
            <div className="mt-1 px-1">
              <div className="grid grid-cols-5 gap-x-1 gap-y-3">
                {[
                  ...SUGGESTIONS.map((s) => {
                    const match = s.label.match(/^(\p{Extended_Pictographic}+)/u);
                    const cleanLabel = s.label.replace(/^[\p{Extended_Pictographic}\uFE0F\u200D\s]+/u, "");
                    return {
                      key: s.label,
                      emoji: match?.[1] ?? "✨",
                      label: cleanLabel || s.label,
                      onClick: () => {
                        if (s.submenu) setActiveSubmenu(s);
                        else if (s.prompt) send(s.prompt, { mode: null });
                      },
                    };
                  }),
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
                  {
                    key: "servicios-sanitarios",
                    emoji: "🩺",
                    label: "Servicios sanitarios",
                    onClick: () =>
                      send(
                        "¿Dónde encuentro servicios sanitarios cercanos en Alicante? Farmacias de guardia, centros de salud y hospitales abiertos ahora.",
                        { mode: null },
                      ),
                  },
                  {
                    key: "eventos",
                    emoji: "🎉",
                    label: "Eventos",
                    onClick: () =>
                      send(
                        "¿Qué eventos, conciertos, festivales o actividades hay hoy y los próximos días en Alicante?",
                        { mode: null },
                      ),
                  },
                ].map((t, idx) => {
                  const subtitle = TILE_SUBTITLES[t.label];
                  const Icon = TILE_ICONS[t.label];
                  const PASTEL: Record<string, { bg: string; fg: string }> = {
                    "Comer":               { bg: "oklch(0.94 0.07 60)",  fg: "oklch(0.55 0.16 50)" },
                    "Dormir":              { bg: "oklch(0.93 0.06 280)", fg: "oklch(0.50 0.18 285)" },
                    "Turismo, playa y aventuras": { bg: "oklch(0.93 0.07 220)", fg: "oklch(0.50 0.16 230)" },
                    "Comprar":             { bg: "oklch(0.94 0.07 340)", fg: "oklch(0.55 0.18 350)" },
                    "Tomar algo":          { bg: "oklch(0.94 0.08 40)",  fg: "oklch(0.58 0.18 35)" },
                    "Transporte público":  { bg: "oklch(0.93 0.07 190)", fg: "oklch(0.50 0.14 210)" },
                    "Mapa":                { bg: "oklch(0.93 0.07 160)", fg: "oklch(0.48 0.14 165)" },
                    "Servicios sanitarios":{ bg: "oklch(0.94 0.06 25)",  fg: "oklch(0.55 0.18 25)" },
                    "Eventos":             { bg: "oklch(0.94 0.07 310)", fg: "oklch(0.50 0.18 315)" },
                  };
                  const pastel = PASTEL[t.label] ?? { bg: "oklch(0.95 0.02 80)", fg: "oklch(0.40 0.05 80)" };
                  const displayLabel =
                    t.label === "Turismo, playa y aventuras" ? "Playas"
                    : t.label === "Transporte público" ? "Transporte"
                    : t.label === "Servicios sanitarios" ? "Salud"
                    : t.label;
                  return (
                    <button
                      key={t.key}
                      onClick={t.onClick}
                      aria-label={t.label}
                      className="group flex flex-col items-center text-center animate-tile-in"
                      style={{ animationDelay: `${(idx % 9) * 60}ms` }}
                    >
                      <div
                        className="relative grid h-12 w-12 place-items-center rounded-full transition-transform duration-300 ease-out group-active:scale-90"
                        style={{ backgroundColor: pastel.bg }}
                      >
                        {Icon ? (
                          <Icon className="h-5 w-5" strokeWidth={1.9} style={{ color: pastel.fg }} />
                        ) : (
                          <span className="text-[20px]">{t.emoji}</span>
                        )}
                      </div>
                      <span className="mt-1 block text-[11px] font-extrabold leading-tight tracking-tight text-foreground">
                        {displayLabel}
                      </span>
                      {subtitle && (
                        <span className="mt-0.5 block text-[9px] leading-tight text-muted-foreground">
                          {subtitle}
                        </span>
                      )}
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
              <div className="grid grid-cols-2 gap-1.5">
                {activeSubmenu.submenu?.map((opt) => (
                  <button
                    key={opt.label}
                    onClick={() => {
                      if (opt.submenu) {
                        setSubmenuStack((stack) => [...stack, opt]);
                      } else if (opt.action === "bus-picker") {
                        setSubmenuStack([]);
                        setShowBusPicker(true);
                      } else if (opt.action === "flight-picker") {
                        setSubmenuStack([]);
                        setShowFlightPicker(true);
                      } else if (opt.href) {
                        setSubmenuStack([]);
                        window.location.href = opt.href;
                      } else if (opt.prompt) {
                        setSubmenuStack([]);
                        send(opt.prompt, { mode: null });
                      }
                    }}
                    className="flex w-full items-center gap-1.5 rounded-lg border border-border bg-background/80 px-2 py-1.5 text-left text-[12px] shadow-sm transition hover:bg-accent/40"
                  >
                    {(() => {
                      const m = opt.label.match(/^(\p{Extended_Pictographic}(?:\u200d\p{Extended_Pictographic})*\uFE0F?)\s*(.*)$/u);
                      const icon = m?.[1];
                      const text = m?.[2] ?? opt.label;
                      return (
                        <>
                          {icon && (
                            <span className="text-sm leading-none" aria-hidden>
                              {icon}
                            </span>
                          )}
                          <span className="flex-1 truncate">{text}</span>
                        </>
                      );
                    })()}
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
      {isWelcome && (
        <nav className="relative flex items-center justify-around border-t border-border/60 bg-[oklch(0.985_0.018_88)]/95 px-2 pt-2 pb-3 backdrop-blur">
          <button
            type="button"
            onClick={() => {
              setMessages([GREETING]);
              setActiveSubmenu(null);
              setError(null);
              setInput("");
            }}
            className="flex flex-col items-center gap-0.5 px-3 py-1 text-primary"
            aria-label="Inicio"
          >
            <Home className="h-5 w-5" />
            <span className="text-[10px] font-bold">Inicio</span>
          </button>
          <Link
            to="/threads"
            className="flex flex-col items-center gap-0.5 px-3 py-1 text-muted-foreground active:scale-95"
            aria-label="Favoritos"
          >
            <Heart className="h-5 w-5" />
            <span className="text-[10px] font-semibold">Favoritos</span>
          </Link>
          <button
            type="button"
            onClick={() => setShowQrInfo(true)}
            aria-label="QR VAMOS"
            className="-mt-7 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-[oklch(0.985_0.018_88)] active:scale-95"
          >
            <QrCode className="h-6 w-6" />
          </button>
          <Link
            to="/threads"
            className="flex flex-col items-center gap-0.5 px-3 py-1 text-muted-foreground active:scale-95"
            aria-label="Guardado"
          >
            <Bookmark className="h-5 w-5" />
            <span className="text-[10px] font-semibold">Guardado</span>
          </Link>
          <Link
            to="/perfil"
            className="flex flex-col items-center gap-0.5 px-3 py-1 text-muted-foreground active:scale-95"
            aria-label="Perfil"
          >
            <UserIcon className="h-5 w-5" />
            <span className="text-[10px] font-semibold">Perfil</span>
          </Link>
        </nav>
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

function weatherIconFor(code: number): LucideIcon {
  if ([0, 1].includes(code)) return Sun;
  if ([2, 3].includes(code)) return Cloud;
  if ([45, 48].includes(code)) return CloudFog;
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return CloudRain;
  if ([71, 73, 75].includes(code)) return CloudSnow;
  if ([95, 96, 99].includes(code)) return CloudLightning;
  return Sun;
}

function WeatherChip() {
  const { data, loading } = useWeather();
  const Icon = data ? weatherIconFor(data.code) : Sun;
  return (
    <Link
      to="/clima"
      aria-label="Ver clima en Alicante"
      className="flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-1 ring-1 ring-border/60 active:scale-95 transition"
    >
      <Icon className="h-4 w-4 text-[oklch(0.78_0.16_70)]" />
      <div className="leading-tight text-left">
        <p className="text-[12px] font-bold text-foreground">
          {loading || !data ? "—" : `${data.tempC}°`}
        </p>
        <p className="text-[9px] -mt-0.5 text-muted-foreground truncate max-w-[80px]">
          {data?.label ?? "Cargando…"}
        </p>
      </div>
    </Link>
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

function ProfileButton({ large = false }: { large?: boolean }) {
  const { user, isAuthenticated } = useAuth();
  const initial = user?.name?.trim().charAt(0).toUpperCase();
  const sizeCls = large
    ? "h-11 w-11 text-base bg-primary text-primary-foreground border-0"
    : "h-8 w-8 text-xs bg-card text-primary border border-border";
  if (isAuthenticated) {
    return (
      <Link
        to="/perfil"
        aria-label="Mi perfil"
        className={`flex items-center justify-center overflow-hidden rounded-full font-bold shadow-sm active:scale-95 ${sizeCls}`}
      >
        {initial || <UserIcon className={large ? "h-5 w-5" : "h-4 w-4 text-muted-foreground"} />}
      </Link>
    );
  }
  return (
    <Link
      to="/login"
      search={{ redirect: "/perfil" }}
      aria-label="Iniciar sesión"
      className={`flex items-center justify-center overflow-hidden rounded-full shadow-sm active:scale-95 ${sizeCls}`}
    >
      <UserIcon className={large ? "h-5 w-5" : "h-4 w-4 text-muted-foreground"} />
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

type BusLegData = {
  line: string;
  fromName: string;
  fromCode: string;
  toName: string;
  toCode: string;
  nextMin?: number | null;
  walkM?: number | null;
};
type BusOptionData = {
  legs: BusLegData[];
  travelMin?: number | null;
  km?: number | null;
  label?: string;
};

type BusStopCardData = {
  line: string;
  lineName?: string;
  stopCode: string;
  stopName: string;
  distanceM?: number | null;
};

type AssistantPart =
  | { type: "text"; value: string }
  | { type: "card"; data: PlaceCardData }
  | { type: "busopt"; data: BusOptionData }
  | { type: "busstop"; data: BusStopCardData };

const CARD_FALLBACK_THEMES = ["sun", "sea", "citrus", "rose", "mint", "grape"];

function parseRecommendationListCards(text: string): AssistantPart[] | null {
  const itemRe = /^\s*\d+\.\s+\*\*([^*]+)\*\*\s*(?:[—–-]\s*)?([\s\S]*?)(?=\n\s*\n\s*\d+\.\s+\*\*|\n\s*\n(?!\s*\d+\.\s+\*\*)|\s*$)/gm;
  const parts: AssistantPart[] = [];
  let lastIndex = 0;
  let found = false;
  let cardIndex = 0;
  let m: RegExpExecArray | null;

  while ((m = itemRe.exec(text)) !== null) {
    found = true;
    if (m.index > lastIndex) parts.push({ type: "text", value: text.slice(lastIndex, m.index) });

    const name = m[1].trim();
    const bodyBlock = m[2].split(/\n{2,}/)[0] ?? m[2];
    const body = bodyBlock
      .replace(/\s*·\s*\[🎟️[^\]]*\]\(qi:[^)]+\)/g, "")
      .replace(/\[🎟️[^\]]*\]\(qi:[^)]+\)/g, "")
      .replace(/\[⭐[^\]]*\]\([^)]+\)/g, "")
      .trim();
    const closesAt = body.match(/cierra(?:\s+a\s+las)?\s+(\d{1,2}:\d{2})/i)?.[1];
    const vibe = body
      .replace(/abierto ahora,?\s*/i, "")
      .replace(/cierra(?:\s+a\s+las)?\s+\d{1,2}:\d{2}\.?/i, "")
      .replace(/\s+/g, " ")
      .trim();

    parts.push({
      type: "card",
      data: {
        name,
        closesAt,
        vibe: vibe || undefined,
        theme: CARD_FALLBACK_THEMES[cardIndex % CARD_FALLBACK_THEMES.length],
      },
    });
    cardIndex += 1;
    lastIndex = itemRe.lastIndex;
  }

  if (!found) return null;
  if (lastIndex < text.length) parts.push({ type: "text", value: text.slice(lastIndex) });
  return parts;
}

function parseOpenStatusCards(text: string): AssistantPart[] | null {
  const statusRe = /✅\s*Sí:\s*\*\*([^*]+)\*\*\s+está abierto ahora(?:\s+y)?\s+cierra a las\s+(\d{1,2}:\d{2})\.?(?:\s*\[⭐[^\]]*\]\([^)]+\))?/g;
  const parts: AssistantPart[] = [];
  let lastIndex = 0;
  let cardIndex = 0;
  let found = false;
  let m: RegExpExecArray | null;

  while ((m = statusRe.exec(text)) !== null) {
    found = true;
    if (m.index > lastIndex) parts.push({ type: "text", value: text.slice(lastIndex, m.index) });
    parts.push({
      type: "card",
      data: {
        name: m[1].trim(),
        closesAt: m[2],
        vibe: "Está abierto ahora mismo.",
        theme: CARD_FALLBACK_THEMES[cardIndex % CARD_FALLBACK_THEMES.length],
      },
    });
    cardIndex += 1;
    lastIndex = statusRe.lastIndex;
  }

  if (!found) return null;
  if (lastIndex < text.length) parts.push({ type: "text", value: text.slice(lastIndex) });
  return parts;
}

const THEME_STYLES: Record<string, { bg: string; ring: string; badge: string }> = {
  sun:    { bg: "bg-gradient-to-br from-amber-200 via-orange-200 to-rose-300 dark:from-amber-800/60 dark:via-orange-800/50 dark:to-rose-800/60",  ring: "border-amber-400/70",  badge: "bg-amber-600 text-white" },
  sea:    { bg: "bg-gradient-to-br from-sky-200 via-cyan-200 to-blue-300 dark:from-sky-800/60 dark:via-cyan-800/50 dark:to-blue-800/60",          ring: "border-sky-400/70",    badge: "bg-sky-600 text-white" },
  citrus: { bg: "bg-gradient-to-br from-lime-200 via-yellow-200 to-amber-300 dark:from-lime-800/60 dark:via-yellow-800/50 dark:to-amber-800/60",  ring: "border-lime-400/70",   badge: "bg-lime-600 text-white" },
  rose:   { bg: "bg-gradient-to-br from-rose-200 via-pink-200 to-fuchsia-300 dark:from-rose-800/60 dark:via-pink-800/50 dark:to-fuchsia-800/60",   ring: "border-rose-400/70",   badge: "bg-rose-600 text-white" },
  mint:   { bg: "bg-gradient-to-br from-emerald-200 via-teal-200 to-cyan-300 dark:from-emerald-800/60 dark:via-teal-800/50 dark:to-cyan-800/60",   ring: "border-emerald-400/70",badge: "bg-emerald-600 text-white" },
  grape:  { bg: "bg-gradient-to-br from-violet-200 via-purple-200 to-indigo-300 dark:from-violet-800/60 dark:via-purple-800/50 dark:to-indigo-800/60", ring: "border-violet-400/70", badge: "bg-violet-600 text-white" },
};

function PlaceCard({ data }: { data: PlaceCardData }) {
  const [booking, setBooking] = useState(false);
  const mapsHref = data.lat && data.lon
    ? `https://www.google.com/maps/dir/?api=1&destination=${data.lat},${data.lon}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${data.name} Alicante`)}`;
  const reviewsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${data.name} Alicante`)}`;
  const override = findPlaceOverride(data.name);
  const theme = THEME_STYLES[data.theme ?? "sun"] ?? THEME_STYLES.sun;
  const synthListing: Listing = {
    id: `chat-${data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60)}`,
    name: data.name,
    lat: data.lat ?? 0,
    lon: data.lon ?? 0,
    kind: "restaurant",
    address: data.address ?? undefined,
    cuisine: data.cuisine ?? undefined,
    tags: {},
  };
  return (
    <div className={`my-1.5 overflow-hidden rounded-xl border ${theme.ring} ${theme.bg} shadow-soft backdrop-blur`}>
      {override?.image && (
        <img
          src={override.image}
          alt={data.name}
          loading="lazy"
          className="h-20 w-full object-cover"
        />
      )}
      <div className="px-2.5 py-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="font-semibold text-[14px] leading-tight text-card-foreground truncate">{data.name}</h4>
            {data.cuisine && (
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5 truncate">
                {data.cuisine.replace(/;/g, ", ")}
              </p>
            )}
          </div>
          {data.closesAt && (
            <span className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-soft ring-1 ring-black/10 ${theme.badge}`}>
              ⏰ {data.closesAt}
            </span>
          )}
        </div>
        {data.vibe && <p className="mt-1 text-[12px] font-medium text-foreground line-clamp-2">{data.vibe}</p>}
        {data.address && (
          <p className="mt-0.5 text-[10px] text-muted-foreground flex items-start gap-1">
            <MapPin className="w-2.5 h-2.5 mt-0.5 shrink-0" /> <span className="truncate">{data.address}</span>
          </p>
        )}
        <div className="mt-1.5 flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setBooking(true)}
            className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary text-primary-foreground active:scale-95"
          >
            <CalendarPlus className="w-2.5 h-2.5" /> Reservar
          </button>
          <a
            href={mapsHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground active:scale-95"
          >
            📍 Llegar
          </a>
          <a
            href={reviewsHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground active:scale-95"
          >
            ⭐ Reseñas
          </a>
          <button
            type="button"
            onClick={() =>
              window.dispatchEvent(new CustomEvent("afp:wantgo", { detail: { name: data.name } }))
            }
            className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full gradient-warm text-primary-foreground shadow-soft active:scale-95"
          >
            🎟️ VAMOS
          </button>
        </div>
      </div>
      {booking && <BookingDialog listing={synthListing} onClose={() => setBooking(false)} />}
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
          if (url.startsWith("eta:")) {
            // formato: eta:LINEA:STOP[:INITIAL]
            const parts = url.slice(4).split(":");
            const line = parts[0] || "";
            const stop = parts[1] || "";
            const initial = parts[2] != null ? parseInt(parts[2], 10) : NaN;
            if (line && stop) {
              return (
                <LiveEta
                  line={line}
                  stop={stop}
                  initialMin={Number.isFinite(initial) ? initial : null}
                  size="sm"
                />
              );
            }
          }
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

const BUSOPT_RE = /\[\[busopt:([\s\S]+?)\]\]/g;

function parseBusOptParts(text: string): AssistantPart[] | null {
  const parts: AssistantPart[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  let found = false;
  const re = new RegExp(BUSOPT_RE.source, "g");
  while ((m = re.exec(text)) !== null) {
    found = true;
    if (m.index > lastIndex) parts.push({ type: "text", value: text.slice(lastIndex, m.index) });
    try {
      const data = JSON.parse(decodeURIComponent(m[1])) as BusOptionData;
      if (data && Array.isArray(data.legs) && data.legs.length > 0) {
        parts.push({ type: "busopt", data });
      } else {
        parts.push({ type: "text", value: m[0] });
      }
    } catch (err) {
      console.warn("[busopt-parse-fail]", err, m[1]?.slice(0, 80));
      parts.push({ type: "text", value: m[0] });
    }
    lastIndex = m.index + m[0].length;
  }
  if (!found) return null;
  if (lastIndex < text.length) parts.push({ type: "text", value: text.slice(lastIndex) });
  return parts;
}

const BUSSTOP_RE = /\[\[busstop:([\s\S]+?)\]\]/g;

function parseBusStopParts(text: string): AssistantPart[] | null {
  const parts: AssistantPart[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  let found = false;
  const re = new RegExp(BUSSTOP_RE.source, "g");
  while ((m = re.exec(text)) !== null) {
    found = true;
    if (m.index > lastIndex) parts.push({ type: "text", value: text.slice(lastIndex, m.index) });
    try {
      const data = JSON.parse(decodeURIComponent(m[1])) as BusStopCardData;
      if (data && data.line && data.stopCode) {
        parts.push({ type: "busstop", data });
      } else {
        parts.push({ type: "text", value: m[0] });
      }
    } catch (err) {
      console.warn("[busstop-parse-fail]", err);
      parts.push({ type: "text", value: m[0] });
    }
    lastIndex = m.index + m[0].length;
  }
  if (!found) return null;
  if (lastIndex < text.length) parts.push({ type: "text", value: text.slice(lastIndex) });
  return parts;
}

function BusStopCard({ data }: { data: BusStopCardData }) {
  return (
    <div className="my-2 overflow-hidden rounded-3xl border border-border bg-card/95 p-4 shadow-soft backdrop-blur">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-primary px-2 text-sm font-bold text-primary-foreground">
              {data.line}
            </span>
            <span className="truncate text-sm font-semibold">
              {data.stopName}
              <span className="ml-1 text-[11px] font-medium text-muted-foreground">
                #{data.stopCode}
              </span>
            </span>
          </div>
          {data.lineName && (
            <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">
              {data.lineName}
            </p>
          )}
        </div>
        {data.distanceM != null && (
          <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-[11px] font-bold text-foreground/80">
            📍 {data.distanceM} m
          </span>
        )}
      </div>
      <LiveEta line={data.line} stop={data.stopCode} size="lg" />
    </div>
  );
}

function BusOptionCard({ data }: { data: BusOptionData }) {
  const isTransfer = data.legs.length > 1;
  const choose = () => {
    const first = data.legs[0];
    const last = data.legs[data.legs.length - 1];
    let text: string;
    if (!isTransfer) {
      text = `Voy con la Línea ${first.line}: subo en ${first.fromName} [parada ${first.fromCode}] y bajo en ${last.toName} [parada ${last.toCode}].`;
    } else {
      const second = data.legs[1];
      text =
        `Voy con: Línea ${first.line} subo en ${first.fromName} [parada ${first.fromCode}] y bajo en ${first.toName} [parada ${first.toCode}], ` +
        `transbordo a la Línea ${second.line} subo en ${second.fromName} [parada ${second.fromCode}] y bajo en ${second.toName} [parada ${second.toCode}].`;
    }
    window.dispatchEvent(new CustomEvent("bus:choose", { detail: { text } }));
  };
  return (
    <div className="my-2 overflow-hidden rounded-2xl border border-primary/20 bg-card shadow-soft">
      <div className="p-3 space-y-2">
        {isTransfer && (
          <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-600">
            ↻ Con transbordo
          </div>
        )}
        {data.legs.map((leg, idx) => (
          <div key={idx} className="space-y-1.5">
            {idx > 0 && (
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                ↻ Transbordo en {leg.fromName}{" "}
                <span className="font-mono normal-case text-foreground/70">
                  [parada {leg.fromCode}]
                </span>
                {typeof leg.walkM === "number" && leg.walkM > 0 && (
                  <span className="ml-1 normal-case font-normal text-amber-600">
                    · 🚶 ~{leg.walkM} m a pie
                  </span>
                )}
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center min-w-[2.25rem] h-7 px-2 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                {leg.line}
              </span>
              <span className="text-xs text-muted-foreground">Línea {leg.line}</span>
            </div>
            {idx === 0 ? (
              <LiveEta
                line={leg.line}
                stop={leg.fromCode}
                initialMin={typeof leg.nextMin === "number" ? leg.nextMin : null}
                size="lg"
              />
            ) : (
              <div className="text-sm text-card-foreground bg-muted/40 rounded-lg px-3 py-2">
                Toma la <span className="font-semibold">Línea {leg.line}</span> en la parada{" "}
                <span className="font-semibold">{leg.fromName}</span>{" "}
                <span className="font-mono text-xs text-muted-foreground">[{leg.fromCode}]</span>.
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Sin hora aquí: depende de cuándo te deje el primer bus.
                </div>
              </div>
            )}
            <div className="text-sm text-card-foreground">
              <span className="text-muted-foreground">Sube en </span>
              <span className="font-semibold">{leg.fromName}</span>{" "}
              <span className="font-mono text-xs text-muted-foreground">[parada {leg.fromCode}]</span>
              <span className="text-muted-foreground"> → baja en </span>
              <span className="font-semibold">{leg.toName}</span>{" "}
              <span className="font-mono text-xs text-muted-foreground">[parada {leg.toCode}]</span>
            </div>
          </div>
        ))}
        {(data.travelMin != null || data.km != null) && (
          <div className="text-xs text-muted-foreground">
            ⏱️ Trayecto{data.travelMin != null ? ` ${data.travelMin} min` : ""}
            {data.km != null ? ` (~${data.km} km)` : ""}
          </div>
        )}
        <div className="pt-1">
          <button
            type="button"
            onClick={choose}
            className="w-full inline-flex items-center justify-center gap-1 text-sm font-semibold px-3 py-2 rounded-full gradient-warm text-primary-foreground shadow-soft active:scale-95"
          >
            🚌 VAMOS
          </button>
        </div>
      </div>
    </div>
  );
}

function AssistantContent({ content }: { content: string }) {
  const match = content.match(PLACE_RE);
  const placeName = match?.[1]?.trim();
  const cleaned = content.replace(/\n?\[\[place:[^\]]+\]\]\n?/i, "").trim();

  // Bus stop card takes precedence (UI-injected, no AI involved)
  const stopParts = parseBusStopParts(cleaned);
  if (stopParts) {
    return (
      <div className="space-y-2 [&>p]:m-0 [&_strong]:font-semibold">
        {stopParts.map((p, i) =>
          p.type === "busstop" ? (
            <BusStopCard key={i} data={p.data} />
          ) : p.type === "text" ? (
            <MarkdownText key={i} text={p.value.replace(/^\n+|\n+$/g, "")} />
          ) : null,
        )}
      </div>
    );
  }

  // Bus options take precedence in transit mode
  const busParts = parseBusOptParts(cleaned);
  if (busParts) {
    return (
      <div className="space-y-2 [&>p]:m-0 [&_strong]:font-semibold">
        {busParts.map((p, i) =>
          p.type === "busopt" ? (
            <BusOptionCard key={i} data={p.data} />
          ) : p.type === "card" ? (
            <PlaceCard key={i} data={p.data} />
          ) : p.type === "text" ? (
            <MarkdownText key={i} text={p.value.replace(/^\n+|\n+$/g, "")} />
          ) : null,
        )}
      </div>
    );
  }

  const parts: AssistantPart[] = [];
  let lastIndex = 0;
  const re = /\[\[card:([\s\S]+?)\]\]/g;
  let m: RegExpExecArray | null;
  let hasEncodedCards = false;
  while ((m = re.exec(cleaned)) !== null) {
    hasEncodedCards = true;
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
  const renderedParts = hasEncodedCards
    ? parts
    : parseRecommendationListCards(cleaned) ?? parseOpenStatusCards(cleaned) ?? [{ type: "text", value: cleaned }];

  return (
    <div className="space-y-2 [&>p]:m-0 [&_strong]:font-semibold">
      {placeName && <PlaceImage name={placeName} />}
      {renderedParts.map((p, i) =>
        p.type === "card" ? (
          <PlaceCard key={i} data={p.data} />
        ) : p.type === "busopt" ? (
          <BusOptionCard key={i} data={p.data} />
        ) : p.type === "busstop" ? (
          <BusStopCard key={i} data={p.data} />
        ) : (
          <MarkdownText key={i} text={p.value.replace(/^\n+|\n+$/g, "")} />
        ),
      )}
    </div>
  );
}
