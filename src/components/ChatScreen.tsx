import { useEffect, useRef, useState } from "react";
import { Send, Mic, Keyboard, MapPin, Map as MapIcon, Home, User as UserIcon, QrCode, X, Gift, Ticket, Sparkles, ShieldCheck, CalendarPlus, CalendarCheck, CalendarDays, Sun, Cloud, CloudRain, CloudSnow, CloudLightning, CloudFog, Bell, Heart, Bookmark, ChevronRight, Utensils, Bed, Umbrella, ShoppingBag, Martini, Bus, Plane, Stethoscope, type LucideIcon } from "lucide-react";
import { useWeather } from "@/hooks/useWeather";
import BookingDialog from "@/components/BookingDialog";
import { AdBanner } from "@/components/AdBanner";
import type { Listing } from "@/lib/overpass-listings";
import { isPreviewHost } from "@/lib/hidden-buttons";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { PlaceImage } from "@/components/PlaceImage";
import { useUserLocation, distanceKm } from "@/hooks/useUserLocation";
import ReferralDialog from "@/components/ReferralDialog";
import { LiveEta } from "@/components/LiveEta";
import { BusKnownPicker, type BusStopPick } from "@/components/BusKnownPicker";
import { FlightPicker } from "@/components/FlightPicker";
import { TramInline } from "@/components/TramInline";
import { useAppAuth } from "@/hooks/useAppAuth";
import { findPlaceOverride } from "@/data/places";
import { resolveOpeningStatus, getTodayClosingTime, getTodayOpeningTime } from "@/lib/opening-hours";
import { useServerFn } from "@tanstack/react-start";
import { getMapBeaches } from "@/lib/playas-map.functions";
import {
  getAsianPlaces,
  getDrinksPlaces,
  getTypicalPlaces,
  getRiceFishPlaces,
  getItalianPlaces,
  getBrunchPlaces,
  getPizzasPlaces,
  resolvePlaceByName,
  discoverNearbyPlaces,
  getPlacesByTag,
  getInternationalPlaces,
} from "@/lib/places.functions";
import heroImg from "@/assets/alicante-hero.jpg";
import portadaImg from "@/assets/alicante-portada.jpg";
import hoguerasIcon from "@/assets/hogueras-alicante.png";
import busAlicanteIcon from "@/assets/bus-alicante.png";
import asistenteIcon from "@/assets/asistente-icon.png";
import { VamosWord } from "@/components/VamosWord";
import { hablar, speakGreetingFromUserGesture } from "@/components/AgenteVamos";
import { FavoriteStopWidget } from "@/components/FavoriteStopWidget";

const TILE_SUBTITLES: Record<string, string> = {
  "Comer": "Restaurantes y tapas",
  "Dormir": "Hoteles y alojamientos",
  "Turismo, playa y aventuras": "Turismo, sol y planes",
  "Comprar": "Tiendas y mercados",
  "Tomar algo": "Bares y copas",
  "Transporte multimodal inteligente": "Bus, TRAM, taxis",
  "Vuelos": "Salidas y llegadas",
  "Servicios sanitarios": "Farmacias y hospitales",
  "Ocio": "Cines, teatros y conciertos",
  "Fiestas de Alicante": "Hogueras y mascletá",
};

const TILE_ICONS: Record<string, LucideIcon> = {
  "Comer": Utensils,
  "Dormir": Bed,
  "Turismo, playa y aventuras": Umbrella,
  "Comprar": ShoppingBag,
  "Tomar algo": Martini,
  "Transporte multimodal inteligente": Bus,
  "Vuelos": Plane,
  "Servicios sanitarios": Stethoscope,
  "Ocio": CalendarDays,
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
  action?: "bus-picker" | "flight-picker" | "tram-inline";
  href?: string;
  previewOnly?: boolean;
};
const BEACH_GUIDE_PROMPT = "Quiero una guía visual de las playas alrededor de Alicante, con mapa por zonas y muchas fotos reales.";
const BEACH_GUIDE_RE = /\b(playa|playas|cala|calas|costa blanca|postiguet|san juan|albufereta|urbanova|cabo de las huertas)\b/i;

function isBeachGuidePrompt(text: string) {
  return text === BEACH_GUIDE_PROMPT || (/charla\s+ia|gu[ií]a\s+visual|mapa|mapeo/i.test(text) && BEACH_GUIDE_RE.test(text));
}

function isShoppingPrompt(text: string) {
  return /(^|\s)(comprar|compras|compra|tienda|tiendas|comercio|comercios|shopping|mercado|mercadillo|boutique|boutiques)(\s|$)/i.test(text) ||
    /\b(ir de compras|quiero adquirir|necesito adquirir|centro comercial|centros comerciales|d[oó]nde comprar)\b/i.test(text);
}

const BEACH_GUIDE_RESPONSE = `La costa alicantina es un buffet libre: castillo arriba, calas con peces curiosos, kilómetros de arena y dunas al sur. Desliza las 17 playas y abre el mapa cuando una te enamore.

[Abrir mapa interactivo](/playas/mapa)`;

function BeachScrollGallery() {
  const navigate = useNavigate();
  const fetcher = useServerFn(getMapBeaches);
  const [beaches, setBeaches] = useState<Awaited<ReturnType<typeof getMapBeaches>>>([]);
  useEffect(() => {
    let cancelled = false;
    fetcher().then((res) => {
      if (!cancelled) setBeaches(res);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [fetcher]);
  if (beaches.length === 0) return null;
  return (
    <div className="-mx-3 flex snap-x snap-mandatory gap-2 overflow-x-auto px-3 pb-1">
      {beaches.map((b) => (
        <button
          key={b.slug}
          type="button"
          onClick={() => navigate({ to: "/playas/mapa" })}
          className="group relative h-40 w-32 flex-none snap-start overflow-hidden rounded-2xl bg-slate-200 shadow ring-1 ring-sky-100"
        >
          {b.photo ? (
            <img src={b.photo} alt={b.name} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-400 to-sky-600" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />
          <p className="absolute inset-x-0 bottom-0 p-2 text-left text-[11px] font-black leading-tight text-white">
            {b.name}
          </p>
        </button>
      ))}
    </div>
  );
}

const SUGGESTIONS: Suggestion[] = [
  {
    label: "🍽️ Comer",
    submenu: [
      { label: "🥘 Cocina típica", prompt: "Recomiéndame un sitio de cocina típica alicantina tradicional abierto ahora" },
      { label: "🍤 Arroces y pescado", prompt: "Quiero un buen arroz, paella o pescado fresco, ¿dónde voy ahora?" },
      { label: "🍕 Italiano", prompt: "Apetece italiano (pizza, pasta), ¿dónde puedo ir ahora?" },
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
      { label: "🥐 Desayuno / Brunch", prompt: "Necesito un buen desayuno o brunch en Alicante abierto ahora" },
      { label: "🍰 Postres / Cafetería", prompt: "Una cafetería con postres ricos abierta ahora" },
      { label: "💸 Barato y rico", prompt: "Algo barato y rico para comer ya, abierto ahora" },
      { label: "🌍 Internacional", prompt: "Quiero comida internacional (hindú, libanés, peruano, mexicano, latino, árabe…), ¿dónde voy ahora?" },
    ],
  },
  { label: "🏨 Dormir", href: "/donde-dormir" },
  { label: "🏖️ Turismo, playa y aventuras", prompt: BEACH_GUIDE_PROMPT },
  { label: "🛍️ Comprar", href: "/comprar" },
  { label: "🍹 Tomar algo", prompt: "¿Dónde voy a tomar algo abierto ahora?" },
  {
    label: "🚆 Transporte multimodal inteligente",
    submenu: [
      { label: "🚌 Buses urbanos", action: "bus-picker" },
      { label: "🚍 Buses larga distancia", previewOnly: true, prompt: "¿Cómo me muevo en bus de larga distancia desde Alicante? Líneas, compañías (ALSA, Vectalia…), estación de autobuses y destinos principales (Elche, Benidorm, Murcia, Valencia, pueblos del interior)." },
      { label: "🚊 Tram Alicante", action: "tram-inline" },
      { label: "🚆 Tren", previewOnly: true, prompt: "¿Cómo me muevo en tren por Alicante y alrededores? Horarios, estaciones de Cercanías y Renfe." },
      { label: "🚗 Rent a car", href: "/rent-a-car" },
      { label: "🚕 Taxis, Uber, Cabify", previewOnly: true, prompt: "¿Cómo pido un taxi, Uber o Cabify en Alicante? Paradas de taxi, apps disponibles, tarifas aproximadas y zonas de cobertura." },
    ],
  },
  {
    label: "✈️ Vuelos",
    submenu: [
      { label: "🛫 Vuelos de salida", href: "/vuelos?type=S" },
      { label: "🛬 Vuelos de llegada", href: "/vuelos?type=L" },
      { label: "🔎 Seleccione su vuelo", action: "flight-picker" },
    ],
  },
];

const GREETING: Msg = {
  role: "assistant",
  content:
    "¡Hola! 👋 I'm your friend in Alicante. Tell me what you feel like — food, beach, a plan for today? I'll show you the spots locals actually love.",
};

const CHAT_STATE_KEY = "afp:chat-messages";
const RESTAURANT_RETURN_KEY = "afp:return-to-gastro";

function readInitialMessages(): Msg[] {
  if (typeof window === "undefined") return [GREETING];
  if (window.sessionStorage.getItem(RESTAURANT_RETURN_KEY) !== "1") return [GREETING];
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(CHAT_STATE_KEY) ?? "[]");
    if (
      Array.isArray(stored) &&
      stored.every(
        (m) =>
          (m?.role === "user" || m?.role === "assistant") && typeof m?.content === "string",
      )
    ) {
      return stored.length ? stored : [GREETING];
    }
  } catch {
    // Ignore invalid session state.
  }
  return [GREETING];
}

function markRestaurantReturn() {
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(RESTAURANT_RETURN_KEY, "1");
  }
}

export function ChatScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile: authProfile } = useAppAuth();
  const [canShowPersonalName, setCanShowPersonalName] = useState(false);
  const displayName = authProfile?.full_name || authProfile?.display_name || "";
  const firstName = canShowPersonalName ? displayName.trim().split(" ")[0] : "";
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const restoredReturnRef = useRef(false);
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
  const [busPickerLine, setBusPickerLine] = useState<string | null>(null);
  const [showFlightPicker, setShowFlightPicker] = useState(false);
  const [showTramInline, setShowTramInline] = useState(false);
  const [composerMode, setComposerMode] = useState<"voice" | "text">("voice");
  const lastFoodSummaryRef = useRef<string | null>(null);

  useEffect(() => {
    setCanShowPersonalName(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const open = (ev: Event) => {
      const detail = (ev as CustomEvent<{ line?: string }>).detail;
      setBusPickerLine(detail?.line ?? null);
      setShowBusPicker(true);
    };
    window.addEventListener("agent:open-bus-picker", open as EventListener);
    // Si llegamos desde una ruta legacy (/bus/planner) con el flag puesto,
    // abrimos el picker en cuanto monta el Inicio.
    try {
      const openBusPickerParam = new URLSearchParams(window.location.search).get("openBusPicker");
      const shouldOpenFromUrl = openBusPickerParam === "1" || openBusPickerParam === '"1"' || openBusPickerParam === "true";
      if (sessionStorage.getItem("agent:open-bus-picker") === "1" || shouldOpenFromUrl) {
        sessionStorage.removeItem("agent:open-bus-picker");
        const storedLine = sessionStorage.getItem("agent:open-bus-picker-line");
        if (storedLine) {
          setBusPickerLine(storedLine);
          sessionStorage.removeItem("agent:open-bus-picker-line");
        }
        setShowBusPicker(true);
        if (shouldOpenFromUrl) window.history.replaceState(window.history.state, "", "/");
      }
    } catch {
      /* noop */
    }
    return () => window.removeEventListener("agent:open-bus-picker", open as EventListener);
  }, [location.search]);

  useEffect(() => {
    const restored = readInitialMessages();
    restoredReturnRef.current = true;
    if (restored.length > 1) setMessages(restored);
  }, []);

  useEffect(() => {
    if (!restoredReturnRef.current) return;
    if (typeof window === "undefined") return;
    if (messages.length <= 1) {
      window.sessionStorage.removeItem(CHAT_STATE_KEY);
      return;
    }
    window.sessionStorage.setItem(CHAT_STATE_KEY, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(RESTAURANT_RETURN_KEY);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => {
      setMessages([GREETING]);
      const comer = SUGGESTIONS.find((s) => s.label.includes("Comer"));
      setSubmenuStack(comer ? [comer] : []);
      window.sessionStorage.removeItem(CHAT_STATE_KEY);
    };
    window.addEventListener("comer:back-to-menu", handler);
    return () => window.removeEventListener("comer:back-to-menu", handler);
  }, []);

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

  // Reenvío de prompts desde AgenteVamos (p.ej. "tomar algo / cerveza")
  // El agente vocal escribe el prompt en sessionStorage y navega a "/";
  // aquí lo recogemos y lo enviamos para que se renderice el Dashboard inline.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = "afp:fwdPrompt";
    const submenuKey = "afp:openSubmenu";
    const tryConsume = (value?: string | null) => {
      const fwd = value ?? window.sessionStorage.getItem(key);
      if (!fwd || loading) return;
      window.sessionStorage.removeItem(key);
      // Si llega un forwardPrompt concreto (p.ej. mexicano, asiático…),
      // descartamos cualquier openSubmenu huérfano de una llamada anterior
      // para que las categorías queden totalmente aisladas.
      window.sessionStorage.removeItem(submenuKey);
      void send(fwd);
    };
    const tryOpenSubmenu = (value?: string | null) => {
      const path = value ?? window.sessionStorage.getItem(submenuKey);
      if (!path) return;
      window.sessionStorage.removeItem(submenuKey);
      // Si también hay un forwardPrompt pendiente, ese tiene prioridad
      // (categoría concreta) y el submenu se descarta.
      if (window.sessionStorage.getItem(key)) return;

      // Resolvemos el submenú real por su label en SUGGESTIONS, sin
      // hardcodear la respuesta: solo abrimos lo que ya existe en el menú.
      const SUBMENU_LABELS: Record<string, string> = {
        comer: "Comer",
        transporte: "Transporte",
        vuelos: "Vuelos",
      };
      const baseKey = path.split(".")[0];
      const labelHint = SUBMENU_LABELS[baseKey];
      if (!labelHint) return;
      const root = SUGGESTIONS.find((s) => s.label.includes(labelHint));
      if (!root) return;
      setMessages([GREETING]);
      window.sessionStorage.removeItem(CHAT_STATE_KEY);
      if (path === "comer.comida-rapida") {
        const fast = root.submenu?.find((s) => s.label.includes("Comida rápida"));
        setSubmenuStack(fast ? [root, fast] : [root]);
      } else {
        setSubmenuStack([root]);
      }
    };

    // NO consumimos sessionStorage en el mount ni en focus: solo reaccionamos
    // a los eventos del agente. Si quedó un valor obsoleto de una sesión
    // anterior, lo descartamos al iniciar.
    try {
      window.sessionStorage.removeItem(key);
      window.sessionStorage.removeItem(submenuKey);
    } catch {}
    const onForward = (e: Event) => {
      const detail = (e as CustomEvent).detail as { text?: string } | undefined;
      lastFoodSummaryRef.current = null;
      tryConsume(detail?.text);
    };
    const onOpenSubmenu = (e: Event) => {
      const detail = (e as CustomEvent).detail as { path?: string } | undefined;
      lastFoodSummaryRef.current = null;
      tryOpenSubmenu(detail?.path);
    };
    const onShowBusStop = (e: Event) => {
      const detail = (e as CustomEvent).detail as BusStopPick | undefined;
      const stored = (() => {
        try {
          const raw = window.sessionStorage.getItem("afp:showBusStop");
          if (!raw) return null;
          window.sessionStorage.removeItem("afp:showBusStop");
          return JSON.parse(raw) as BusStopPick;
        } catch {
          return null;
        }
      })();
      const pick = detail ?? stored;
      if (!pick) return;
      navigate({
        to: "/transporte/parada-favorita",
        search: { stop: pick.stopCode, line: pick.line },
      });
    };

    window.addEventListener("afp:forward-prompt", onForward);
    window.addEventListener("afp:open-submenu", onOpenSubmenu);
    window.addEventListener("afp:show-busstop", onShowBusStop);
    // Consume pending busstop from sessionStorage (in case event fired before mount)
    try {
      const raw = window.sessionStorage.getItem("afp:showBusStop");
      if (raw) {
        window.sessionStorage.removeItem("afp:showBusStop");
        const pick = JSON.parse(raw) as BusStopPick;
        navigate({
          to: "/transporte/parada-favorita",
          search: { stop: pick.stopCode, line: pick.line },
        });
      }
    } catch {}

    return () => {
      window.removeEventListener("afp:forward-prompt", onForward);
      window.removeEventListener("afp:open-submenu", onOpenSubmenu);
      window.removeEventListener("afp:show-busstop", onShowBusStop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // El agente reemplaza su "Abro el Dashboard…" con el resumen real
  // ("Te he conseguido N restaurantes X abiertos ahora") cuando el dashboard
  // termina de cargar los datos.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as
        | { count: number; openCount: number; label: string; pluralKind?: "restaurantes" | "sitios" }
        | undefined;
      if (!detail) return;
      const { openCount, count, label } = detail;
      const rawLabel = label.toLowerCase().trim();
      const summaryKey = `${rawLabel}|${count}|${openCount}`;
      if (lastFoodSummaryRef.current === summaryKey) return;
      lastFoodSummaryRef.current = summaryKey;
      const categoryLabel = rawLabel
        .replace(/^comida\s+/, "")
        .replace(/^cocina\s+/, "")
        .trim();
      const foodLabel = `comida ${categoryLabel || rawLabel}`;
      const text =
        openCount > 0
          ? `Te he conseguido ${openCount} restaurantes abiertos de ${foodLabel}.`
          : count > 0
            ? `No tengo restaurantes abiertos de ${foodLabel} ahora mismo, pero te dejo los ${count} del listado por si quieres reservar.`
            : `Ahora mismo no encuentro restaurantes de ${foodLabel} cercanos. ¿Probamos otra categoría?`;
      setMessages((prev) => {
        const lastAssistantIndex = (() => {
          for (let i = prev.length - 1; i >= 0; i--) {
            if (prev[i].role === "assistant") return i;
          }
          return -1;
        })();
        if (lastAssistantIndex < 0) return prev;
        const lastUser = (() => {
          for (let i = lastAssistantIndex - 1; i >= 0; i--) {
            if (prev[i].role === "user") return prev[i].content;
          }
          return "";
        })();
        const dashboardPrompt = /(comer|restaurante|cocina|arroz|pescado|italian|pizza|desayun|brunch|japon|asi[aá]tic|bar|caf[eé]|hamburgues|burger|taco|burrito|mexican|kebab|pollo|montadito|vegano|postre|barato|internacional)/i.test(lastUser);
        for (let i = prev.length - 1; i >= 0; i--) {
          const m = prev[i];
          if (m.role !== "assistant") continue;
          if (dashboardPrompt || /^Abro el Dashboard/i.test(m.content) || /Marchando/i.test(m.content) || /^Te he conseguido \d+ restaurantes abiertos/i.test(m.content)) {
            if (m.content === text) return prev;
            const copy = prev.slice();
            copy[i] = { ...m, content: text };
            return copy;
          }
        }
        return prev;
      });
      // Habla el resumen real si no viene de una conversación de voz: en ese
      // caso lo habla AgenteVamos para mantener continuidad de diálogo.
      try {
        if (window.sessionStorage.getItem("afp:voiceFoodSummaryPending") === "1") return;
        void hablar(text);
      } catch {}
    };
    window.addEventListener("vamos:food-summary", handler as EventListener);
    return () => window.removeEventListener("vamos:food-summary", handler as EventListener);
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

  const requestLocationForPrompt = (prompt: string) => {
    if (!/(comer|restaurante|cocina|arroz|pescado|italian|pizza|desayun|brunch|japon|asi[aá]tic|bar|tomar algo|copa|caf[eé])/i.test(prompt)) {
      return;
    }
    if (locState.status !== "ready" && locState.status !== "loading") {
      requestLocation();
    }
  };

  function sendBeachGuide() {
    if (loading) return;
    setError(null);
    setSubmenuStack([]);
    setInput("");
    setMode(null);
    setMessages([
      { role: "user", content: BEACH_GUIDE_PROMPT },
      { role: "assistant", content: BEACH_GUIDE_RESPONSE },
    ]);
  }

  async function send(text: string, opts?: { mode?: "transit" | "guide" | null }) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    if (opts?.mode === "guide" || isBeachGuidePrompt(trimmed)) {
      sendBeachGuide();
      return;
    }
    if (isShoppingPrompt(trimmed)) {
      const next = [
        ...messages,
        { role: "user" as const, content: trimmed },
      ];
      setMessages(next);
      setInput("");
      setError(null);
      setSubmenuStack([]);
      navigate({ to: "/comprar" });
      return;
    }
    // ---- Contexto conversacional persistente (activeDomain sticky) ----
    // Mientras exista un dominio activo (p.ej. TRANSPORTE/TRAM), las
    // entidades geográficas (Benidorm, Madrid…) deben interpretarse dentro
    // de ese dominio. Solo cambiamos de dominio si el usuario menciona
    // explícitamente otra intención (comer, hotel, playa, etc.).
    const TRANSIT_TRIGGER_RE = /\b(bus|autob[uú]s|tram|guagua|l[ií]nea\s*\d+|c[oó]mo\s+(?:voy|llego|ir)|qu[eé]\s+l[ií]nea|en\s+(?:bus|autob[uú]s|tram)|parada|transbordo|transporte\s+p[uú]blico|coger\s+(?:el\s+|la\s+)?(?:bus|tram|autob[uú]s|l[ií]nea))\b/i;
    const SWITCH_DOMAIN_RE = /\b(comer|comida|restaurante|cenar|almorzar|desayun|brunch|tapa|hotel|alojam|dormir|hospedaj|playa|cala|turismo|visitar|monumento|museo|copa|cerveza|tomar\s+algo|cine|pel[ií]cula|teatro|farmacia|hospital|m[eé]dico|comprar|tienda|fiesta|concierto)\b/i;
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    const assistantAskedTransit = lastAssistant
      ? /(parada|l[ií]nea|bus|tram|autob[uú]s|desde\s+d[oó]nde|a\s+d[oó]nde|destino|origen|transbordo)/i.test(lastAssistant.content)
      : false;
    let effectiveMode: "transit" | null;
    if (opts?.mode !== undefined) {
      effectiveMode = opts.mode === "transit" ? "transit" : null;
    } else {
      effectiveMode = mode;
      if (TRANSIT_TRIGGER_RE.test(trimmed)) {
        effectiveMode = "transit";
      } else if (effectiveMode === "transit" && SWITCH_DOMAIN_RE.test(trimmed)) {
        // El usuario cambia claramente de intención: cerramos el dominio transporte.
        effectiveMode = null;
      } else if (!effectiveMode && assistantAskedTransit) {
        // El asistente venía pidiendo origen/destino/parada: heredamos transporte
        // aunque el usuario solo mande una ciudad (p.ej. "Benidorm").
        effectiveMode = "transit";
      }
    }
    if (effectiveMode !== mode) setMode(effectiveMode);
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
        if (resp.status === 402) {
          upsert("Se han agotado los créditos de IA del proyecto. Añade créditos en Settings → Workspace → Usage para seguir chateando.");
          return;
        }
        if (resp.status === 429) {
          upsert("Demasiadas peticiones a la vez. Espera unos segundos e inténtalo de nuevo.");
          return;
        }
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
      // No re-enfocar el input automáticamente: en móvil abre el teclado
      // y empuja la respuesta hacia arriba antes de poder leerla.
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
          <img src={heroImg} alt="" aria-hidden loading="lazy" decoding="async" className="h-full w-full object-cover" />
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
                ¿Qué <VamosWord /> a descubrir hoy?
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <WeatherChip />
            {isPreviewHost() && (
              <Link
                to="/threads"
                aria-label="Notificaciones"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/70 ring-1 ring-border/60 text-foreground active:scale-95"
              >
                <Bell className="h-4 w-4" />
              </Link>
            )}
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
          <div className="flex-1" />
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
      <div ref={scrollRef} className={["relative min-h-0 flex-1 px-4 pt-3", isWelcome ? "overflow-hidden pb-0" : "overflow-y-auto pb-5"].join(" ")}>
        <div className={["mx-auto flex max-w-2xl flex-col gap-3", isWelcome ? "lg:max-w-5xl lg:flex-row lg:items-center lg:gap-10" : ""].join(" ")}>
          {isWelcome && (
            <div className="lg:flex lg:flex-col lg:items-center lg:gap-4 lg:flex-none">
              <div className="mx-auto w-full max-w-[320px] lg:mx-0 lg:max-w-[520px]">
                <h2
                  className="mb-1 text-center font-bold uppercase tracking-tight lg:text-left"
                  style={{
                    fontFamily: "'Quicksand', sans-serif",
                    color: "#4FC3F7",
                    fontSize: "clamp(1.75rem, 5vw, 2.5rem)",
                    lineHeight: 1,
                  }}
                >
                  ALICANTE
                </h2>
              </div>
              <div className="relative mx-auto mb-1 w-full max-w-[320px] overflow-visible rounded-xl lg:mx-0 lg:mb-0 lg:max-w-[520px] lg:flex-none lg:shadow-[0_20px_50px_-15px_oklch(0.55_0.14_70/0.45)]">
                <img
                  src={portadaImg}
                  alt="Vista aérea del puerto y la costa de Alicante al atardecer"
                  className="h-auto w-full rounded-xl object-cover lg:rounded-2xl"
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                />

              </div>
              {/* Desktop-only: asistente + Inicio + Perfil bajo la foto */}
              <div className="hidden lg:flex lg:items-center lg:gap-6 lg:mt-2">
                <button
                  type="button"
                  onClick={() => {
                    speakGreetingFromUserGesture();
                    window.dispatchEvent(new Event("vamos:open"));
                  }}
                  aria-label="Hablar con Agente Vamos"
                  className="group relative flex h-16 w-16 items-center justify-center rounded-full transition active:scale-95"
                  style={{
                    filter:
                      "drop-shadow(0 0 14px rgba(255,165,0,0.65)) drop-shadow(0 0 28px rgba(255,140,0,0.45))",
                  }}
                >
                  <span
                    aria-hidden
                    className="absolute inset-0 rounded-full animate-pulse"
                    style={{
                      background:
                        "radial-gradient(circle, rgba(255,180,60,0.45) 0%, rgba(255,140,0,0.15) 55%, transparent 75%)",
                    }}
                  />
                  <img
                    src={asistenteIcon}
                    alt="Asistente"
                    className="relative h-full w-full rounded-full object-cover"
                  />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMessages([GREETING]);
                    setActiveSubmenu(null);
                    setError(null);
                    setInput("");
                  }}
                  className="flex flex-col items-center gap-1 px-5 py-2 rounded-2xl bg-white/70 ring-1 ring-border/60 shadow-sm text-primary"
                  aria-label="Inicio"
                >
                  <Home className="h-6 w-6" />
                  <span className="text-[13px] font-bold">Inicio</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const url = geo
                      ? `https://www.google.com/maps/search/?api=1&query=${geo.lat},${geo.lng}`
                      : `https://www.google.com/maps/search/?api=1&query=Alicante`;
                    try {
                      (window.top ?? window).open(url, "_blank", "noopener,noreferrer");
                    } catch {
                      window.open(url, "_blank", "noopener,noreferrer");
                    }
                  }}
                  className="flex flex-col items-center gap-1 px-5 py-2 rounded-2xl bg-white/70 ring-1 ring-border/60 shadow-sm text-primary active:scale-95"
                  aria-label="Mapa"
                >
                  <MapIcon className="h-6 w-6" />
                  <span className="text-[13px] font-bold">Mapa</span>
                </button>
                <Link
                  to="/perfil"
                  className="flex flex-col items-center gap-1 px-5 py-2 rounded-2xl bg-white/70 ring-1 ring-border/60 shadow-sm text-primary active:scale-95"
                  aria-label="Perfil"
                >
                  <UserIcon className="h-6 w-6" />
                  <span className="text-[13px] font-bold">Perfil</span>
                </Link>
              </div>
            </div>
          )}

          {/* (Tiles render below as Glovo-style row, replacing old chip suggestions) */}

          {messages.map((m, i) => {
            if (m === GREETING || m.role === "user") return null;
            let prevUser = "";
            for (let j = i - 1; j >= 0; j--) {
              if (messages[j].role === "user") { prevUser = messages[j].content; break; }
            }
            return <Bubble key={i} role={m.role} content={m.content} userPrompt={prevUser} />;
          })}
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
              initialLineCode={busPickerLine}
              onClose={() => {
                setShowBusPicker(false);
                setBusPickerLine(null);
              }}
              onUnknown={() => {
                setShowBusPicker(false);
                setBusPickerLine(null);
                void send("Hola, quiero moverme en bus por Alicante.", { mode: "transit" });
              }}
              onSelected={(pick: BusStopPick) => {
                setShowBusPicker(false);
                setBusPickerLine(null);
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
            <div className="mt-1 px-1 lg:mt-0 lg:flex-1 lg:self-center">
              <div className="grid grid-cols-5 gap-x-1 gap-y-3 lg:grid-cols-3 lg:gap-x-4 lg:gap-y-6">

                {[
                  ...SUGGESTIONS.map((s) => {
                    const match = s.label.match(/^(\p{Extended_Pictographic}+)/u);
                    const cleanLabel = s.label.replace(/^[\p{Extended_Pictographic}\uFE0F\u200D\s]+/u, "");
                    return {
                      key: s.label,
                      emoji: match?.[1] ?? "✨",
                      label: cleanLabel || s.label,
                      onClick: () => {
                        if (s.label === "🏖️ Turismo, playa y aventuras") {
                          navigate({ to: "/playas" });
                        } else if (s.href) {
                          if (s.href.startsWith("/")) navigate({ to: s.href });
                          else window.location.href = s.href;
                        } else if (s.submenu) setActiveSubmenu(s);
                        else if (s.prompt) send(s.prompt, { mode: null });
                      },
                    };
                  }),
                  {
                    key: "servicios-sanitarios",
                    emoji: "🩺",
                    label: "Servicios sanitarios",
                    onClick: () => navigate({ to: "/salud" }),
                  },
                  {
                    key: "ocio",
                    emoji: "🎬",
                    label: "Ocio",
                    onClick: () => navigate({ to: "/ocio" }),
                  },
                  {
                    key: "fiestas",
                    emoji: "🎆",
                    label: "Fiestas de Alicante",
                    onClick: () => navigate({ to: "/fiestas" }),
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
                    "Transporte multimodal inteligente":  { bg: "oklch(0.93 0.07 190)", fg: "oklch(0.50 0.14 210)" },
                    "Vuelos":              { bg: "oklch(0.93 0.07 240)", fg: "oklch(0.48 0.16 250)" },
                    "Servicios sanitarios":{ bg: "oklch(0.94 0.06 25)",  fg: "oklch(0.55 0.18 25)" },
                    "Ocio":                { bg: "oklch(0.94 0.07 310)", fg: "oklch(0.50 0.18 315)" },
                    "Fiestas de Alicante": { bg: "oklch(0.93 0.08 55)",  fg: "oklch(0.55 0.18 50)" },
                  };
                  const pastel = PASTEL[t.label] ?? { bg: "oklch(0.95 0.02 80)", fg: "oklch(0.40 0.05 80)" };
                  const displayLabel =
                    t.label === "Turismo, playa y aventuras" ? "Playas"
                    : t.label === "Transporte multimodal inteligente" ? "Transporte"
                    : t.label === "Servicios sanitarios" ? "Salud"
                    : t.label === "Fiestas de Alicante" ? "Fiestas"
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
                        className="relative grid h-12 w-12 place-items-center rounded-full transition-transform duration-300 ease-out group-active:scale-90 overflow-hidden lg:h-16 lg:w-16"
                        style={{ backgroundColor: t.label === "Fiestas de Alicante" ? "transparent" : pastel.bg }}
                      >
                        {t.label === "Fiestas de Alicante" ? (
                          <img src={hoguerasIcon} alt="" className="h-full w-full rounded-full object-cover" />
                        ) : t.label === "Transporte multimodal inteligente" ? (
                          <img src={busAlicanteIcon} alt="" className="h-[78%] w-[78%] object-contain" />
                        ) : Icon ? (
                          <Icon className="h-5 w-5 lg:h-7 lg:w-7" strokeWidth={1.9} style={{ color: pastel.fg }} />
                        ) : (
                          <span className="text-[20px] lg:text-[26px]">{t.emoji}</span>
                        )}
                      </div>
                      <span className="mt-1 block text-[11px] font-extrabold leading-tight tracking-tight text-foreground lg:text-[13px]">
                        {displayLabel}
                      </span>
                      {subtitle && (
                        <span className="mt-0.5 block text-[9px] leading-tight text-muted-foreground lg:text-[11px]">
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
                <p className="text-sm font-medium">{activeSubmenu.label}</p>
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
                {activeSubmenu.submenu?.filter((opt) => {
                  if (!opt.previewOnly) return true;
                  if (typeof window === "undefined") return true;
                  const h = window.location.hostname;
                  // Preview = sandbox/localhost/lovable preview subdomain. Production = published .lovable.app o dominio propio.
                  return h.includes("preview") || h === "localhost" || h.startsWith("127.") || h.endsWith(".lovableproject.com") || h.endsWith(".lovable.dev");
                }).map((opt) => (
                  <button
                    key={opt.label}
                    onClick={() => {
                      // Si elegimos otro transporte distinto al TRAM, ocultar panel TRAM.
                      if (opt.action !== "tram-inline") setShowTramInline(false);
                      if (opt.action === "tram-inline") {
                        setSubmenuStack([]);
                        navigate({ to: "/tram" });
                      } else if (opt.submenu) {
                        setSubmenuStack((stack) => [...stack, opt]);
                      } else if (opt.action === "bus-picker") {
                        setSubmenuStack([]);
                        setShowBusPicker(true);
                      } else if (opt.action === "flight-picker") {
                        setSubmenuStack([]);
                        setShowFlightPicker(true);
                      } else if (opt.href) {
                        setSubmenuStack([]);
                        if (opt.href.startsWith("/")) {
                          navigate({ to: opt.href });
                        } else {
                          window.location.href = opt.href;
                        }
                      } else if (opt.prompt) {
                        setSubmenuStack([]);
                        requestLocationForPrompt(opt.prompt);
                        const isBeachGuide = opt.label === "🏖️ Playa";
                        isBeachGuide ? sendBeachGuide() : send(opt.prompt, { mode: null });
                      }
                    }}
                    className={`flex w-full items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left text-[12px] shadow-sm transition hover:bg-accent/40 ${
                      opt.action === "tram-inline" && showTramInline
                        ? "border-primary bg-primary/10"
                        : "border-border bg-background/80"
                    }`}
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
              {showTramInline && activeSubmenu.label.includes("Transporte") && <TramInline />}
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="relative border-t border-border/60 bg-background/70 px-3 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/50 lg:border-t-0 lg:bg-transparent lg:px-4 lg:py-2 lg:backdrop-blur-0">
        {geoStatus === "ok" && geo?.city && (
          <div className="mx-auto mb-2 max-w-2xl text-center text-[11px] text-muted-foreground lg:mb-0 lg:text-left">
            <MapPin className="mr-1 inline h-3 w-3 text-primary" />
            Te tengo en {geo.area ? `${geo.area}, ` : ""}
            {geo.city}
          </div>
        )}
        {composerMode === "voice" ? (
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 pl-1 pr-2 lg:hidden">
            <FavoriteStopWidget />
            <button
              onClick={() => {
                speakGreetingFromUserGesture();
                window.dispatchEvent(new Event("vamos:open"));
              }}
              aria-label="Hablar con Agente Vamos"
              className="group relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full transition active:scale-95"
              style={{
                filter:
                  "drop-shadow(0 0 14px rgba(255,165,0,0.65)) drop-shadow(0 0 28px rgba(255,140,0,0.45))",
              }}
            >
              <span
                aria-hidden
                className="absolute inset-0 rounded-full animate-pulse"
                style={{
                  background:
                    "radial-gradient(circle, rgba(255,180,60,0.45) 0%, rgba(255,140,0,0.15) 55%, transparent 75%)",
                }}
              />
              <img
                src={asistenteIcon}
                alt="Asistente"
                className="relative h-full w-full rounded-full object-cover"
              />
            </button>
          </div>


        ) : (
          <div className="mx-auto flex max-w-2xl items-end gap-2">
            <button
              type="button"
              onClick={() => {
                setInput("");
                setComposerMode("voice");
              }}
              aria-label="Volver a modo voz"
              title="Volver a modo voz"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border bg-card/90 text-muted-foreground shadow-sm transition hover:bg-muted active:scale-95"
            >
              <Mic className="h-5 w-5" />
            </button>
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
            <button
              onClick={() => send(input)}
              disabled={loading || !input.trim()}
              aria-label="Send"
              className="flex h-12 w-12 items-center justify-center rounded-full gradient-warm text-primary-foreground shadow-soft transition active:scale-95 disabled:opacity-60"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        )}
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
        <>
          <nav className="relative flex items-center justify-around border-t border-border/60 bg-[oklch(0.985_0.018_88)]/95 px-2 pt-2 pb-[max(0.25rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
            <button
              type="button"
              onClick={() => {
                setMessages([GREETING]);
                setActiveSubmenu(null);
                setError(null);
                setInput("");
              }}
              className="flex flex-col items-center gap-0.5 px-3 py-1 text-primary lg:gap-1 lg:px-5 lg:py-2 lg:rounded-2xl lg:bg-white/70 lg:ring-1 lg:ring-border/60 lg:shadow-sm"
              aria-label="Inicio"
            >
              <Home className="h-5 w-5 lg:h-6 lg:w-6" />
              <span className="text-[10px] font-bold lg:text-[13px]">Inicio</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const url = geo
                  ? `https://www.google.com/maps/search/?api=1&query=${geo.lat},${geo.lng}`
                  : `https://www.google.com/maps/search/?api=1&query=Alicante`;
                try {
                  (window.top ?? window).open(url, "_blank", "noopener,noreferrer");
                } catch {
                  window.open(url, "_blank", "noopener,noreferrer");
                }
              }}
              className="flex flex-col items-center gap-0.5 px-3 py-1 text-primary active:scale-95 lg:gap-1 lg:px-5 lg:py-2 lg:rounded-2xl lg:bg-white/70 lg:ring-1 lg:ring-border/60 lg:shadow-sm"
              aria-label="Mapa"
            >
              <MapIcon className="h-5 w-5 lg:h-6 lg:w-6" />
              <span className="text-[10px] font-bold lg:text-[13px]">Mapa</span>
            </button>
            <Link
              to="/perfil"
              className="flex flex-col items-center gap-0.5 px-3 py-1 text-primary active:scale-95 lg:gap-1 lg:px-5 lg:py-2 lg:rounded-2xl lg:bg-white/70 lg:ring-1 lg:ring-border/60 lg:shadow-sm"
              aria-label="Perfil"
            >
              <UserIcon className="h-5 w-5 lg:h-6 lg:w-6" />
              <span className="text-[10px] font-bold lg:text-[13px]">Perfil</span>
            </Link>
          </nav>

        </>)}
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
      className="flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-1 ring-1 ring-border/60 active:scale-95 transition lg:gap-2 lg:px-4 lg:py-2 lg:ring-2"
    >
      <Icon className="h-4 w-4 text-[oklch(0.78_0.16_70)] lg:h-6 lg:w-6" />
      <p className="text-[12px] font-bold text-foreground leading-tight lg:text-[18px]">
        {loading || !data ? "—" : `${data.tempC}°`}
      </p>
    </Link>
  );
}


function QrVamosInfo({ onClose }: { onClose: () => void }) {
  const benefits = [
    { icon: Gift, title: "Descuentos reales", text: "Precios de amigo en bares, restaurantes y planes que de verdad merecen la pena." },
    { icon: Ticket, title: "Acceso a experiencias", text: "Catas, tours, rutas y eventos pensados para quienes viven Alicante como un local." },
    { icon: Sparkles, title: "Trato de amigo local", text: "Detalles, sorpresas y atención preferente en los sitios que recomienda tu amigo local." },
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
              QR <VamosWord />
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Tu llave de amigo local en Alicante
            </p>
          </div>
        </div>

        <p className="mt-3 text-sm text-foreground/90">
          Con un <b>QR <VamosWord /></b> entras como un local, no como un turista. Esto es lo que te llevas:
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
          ¿Cómo se consigue? Pulsa <VamosWord /> en cualquier sitio que te recomiende tu amigo local y generas tu QR del día.
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
  const { profile, user, isAuthenticated } = useAppAuth();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const name = profile?.full_name || profile?.display_name || user?.email || "";
  const initial = name.trim().charAt(0).toUpperCase();
  const sizeCls = large
    ? "h-11 w-11 text-base bg-primary text-primary-foreground border-0"
    : "h-8 w-8 text-xs bg-card text-primary border border-border";
  if (mounted && isAuthenticated) {
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
      to="/auth/login"
      search={{ redirect: "/perfil" } as never}
      aria-label="Iniciar sesión"
      className={`flex items-center justify-center overflow-hidden rounded-full shadow-sm active:scale-95 ${sizeCls}`}
    >
      <UserIcon className={large ? "h-5 w-5" : "h-4 w-4 text-muted-foreground"} />
    </Link>
  );
}

function isAsianBroadcast(content: string): boolean {
  if (!ASIAN_RE.test(content)) return false;
  const cardCount = (content.match(/\[\[card:/g) ?? []).length;
  return cardCount >= 2;
}

function isDrinksBroadcast(content: string): boolean {
  if (!DRINKS_RE.test(content)) return false;
  if (ASIAN_RE.test(content)) return false;
  return true;
}

function Bubble({ role, content, userPrompt = "" }: { role: "user" | "assistant"; content: string; userPrompt?: string }) {
  const isUser = role === "user";
  const promptHasDrinks = !isUser && DRINKS_RE.test(userPrompt);
  const promptHasAsian = !isUser && ASIAN_RE.test(userPrompt);
  const promptHasTypical = !isUser && TYPICAL_RE.test(userPrompt);
  const promptHasRiceFish = !isUser && RICE_FISH_RE.test(userPrompt);
  const promptHasItalian = !isUser && ITALIAN_RE.test(userPrompt);
  const promptHasPizzas = !isUser && PIZZAS_RE.test(userPrompt);
  const promptHasBrunch = !isUser && BRUNCH_RE.test(userPrompt);
  if (!isUser && (isAsianBroadcast(content) || isDrinksBroadcast(content) || promptHasDrinks || promptHasAsian || promptHasTypical || promptHasRiceFish || promptHasItalian || promptHasPizzas || promptHasBrunch)) {
    return (
      <div className="-mx-4 sm:mx-0">
        <AssistantContent content={content} userPrompt={userPrompt} />
      </div>
    );
  }
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={[
          "max-w-[96%] rounded-3xl px-4 py-2.5 text-[15px] leading-relaxed shadow-soft",
          isUser
            ? "rounded-br-md bg-bubble-user text-bubble-user-foreground whitespace-pre-wrap"
            : "rounded-bl-md bg-bubble-friend text-bubble-friend-foreground",
        ].join(" ")}
      >
        {isUser ? content : <AssistantContent content={content} userPrompt={userPrompt} />}
      </div>
    </div>
  );
}


const PLACE_RE = /\[\[place:\s*([^\]]+?)\]\]/i;
const CARD_RE = /\[\[card:([^\]]+)\]\]/g;

type PlaceCardData = {
  placeId?: string | null;
  name: string;
  cuisine?: string | null;
  address?: string | null;
  closesAt?: string;
  openingHours?: string | null;
  lat?: number;
  lon?: number;
  vibe?: string;
  theme?: string;
  priceLevel?: string | null;
  priceRangeMin?: number | null;
  priceRangeMax?: number | null;
  rating?: number | null;
  openNow?: boolean | null;
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
    ? `https://www.google.com/maps/dir/?api=1&destination=${data.lat},${data.lon}&travelmode=walking`
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
    <div className={`my-1.5 w-full max-w-[240px] overflow-hidden rounded-xl border ${theme.ring} ${theme.bg} shadow-soft backdrop-blur`}>
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
  const navigate = useNavigate();
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
          if (url.startsWith("/")) {
            return (
              <button
                type="button"
                onClick={() => {
                  if (["/bus", "/bus/", "/bus/planner", "/buses-en-vivo", "/"].includes(url)) {
                    try {
                      sessionStorage.setItem("agent:open-bus-picker", "1");
                    } catch {
                      /* noop */
                    }
                    navigate({ href: "/?openBusPicker=1", replace: true } as any);
                    window.dispatchEvent(new Event("agent:open-bus-picker"));
                  } else if (url === "/playas/mapa") navigate({ to: "/playas/mapa" });
                  else if (url === "/playas") navigate({ to: "/playas" });
                  else window.location.assign(url);
                }}
                className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground shadow-soft active:scale-95"
              >
                {children}
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
    <Link
      to="/transporte/parada-favorita"
      search={{ stop: data.stopCode, line: data.line }}
      className="my-3 block overflow-hidden rounded-[28px] border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card shadow-xl backdrop-blur transition active:scale-[0.99]"
      aria-label={`Ver parada ${data.stopName} en directo`}
    >
      {/* Header band */}
      <div className="flex items-center gap-3 border-b border-primary/15 bg-primary/5 px-5 py-4">
        <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-2xl font-black text-primary-foreground shadow-lg ring-4 ring-primary/20">
          {data.line}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-primary/80">
            <span>🚌 Línea {data.line}</span>
            <span className="text-muted-foreground/60">·</span>
            <span className="text-muted-foreground">#{data.stopCode}</span>
          </div>
          <h3 className="mt-0.5 text-lg font-extrabold leading-tight text-foreground break-words">
            {data.stopName}
          </h3>

          {data.lineName && (
            <p className="mt-0.5 truncate text-[11px] font-medium text-muted-foreground">
              {data.lineName}
            </p>
          )}
        </div>
        {data.distanceM != null && (
          <span className="shrink-0 rounded-full bg-background/80 px-3 py-1.5 text-xs font-bold text-foreground shadow-sm">
            📍 {data.distanceM} m
          </span>
        )}
      </div>

      {/* Big ETA hero */}
      <div className="px-5 py-5">
        <BigLiveEta line={data.line} stop={data.stopCode} />
      </div>
    </Link>

  );
}

function BigLiveEta({ line, stop }: { line: string; stop: string }) {
  const [eta, setEta] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number>(Date.now());
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/public/bus-eta?stop=${stop}&line=${line}`, { cache: "no-store" });
        if (r.ok) {
          const j = await r.json();
          if (!cancelled) {
            setEta(typeof j.etaMin === "number" ? j.etaMin : null);
            setUpdatedAt(Date.now());
          }
        }
      } catch { /* noop */ }
      finally {
        if (!cancelled) setLoading(false);
        if (!cancelled) timer = setTimeout(tick, 30000);
      }
    };
    tick();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [line, stop]);

  const arrival = eta != null ? new Date(updatedAt + Math.max(0, eta) * 60_000) : null;
  const liveMin = arrival ? Math.max(0, Math.round((arrival.getTime() - now) / 60000)) : null;
  const isImminent = liveMin != null && liveMin <= 3;
  const hh = arrival ? arrival.getHours().toString().padStart(2, "0") : "--";
  const mm = arrival ? arrival.getMinutes().toString().padStart(2, "0") : "--";

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border-2 p-5 transition-colors ${
        isImminent
          ? "border-primary bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 animate-blink"
          : arrival
            ? "border-border bg-muted/40"
            : "border-dashed border-border bg-muted/20"
      }`}
    >
      {/* Decorative pulse */}
      {isImminent && (
        <span className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/20 blur-2xl" />
      )}

      <div className="relative flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        <span
          className={`h-2 w-2 rounded-full ${
            loading ? "bg-amber-500 animate-pulse" : arrival ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/50"
          }`}
        />
        Tiempo real · en directo
      </div>

      {/* Hora estimada — bloque grande centrado */}
      <div className="relative mt-3 text-center">
        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Hora estimada de llegada
        </div>
        <div className={`mt-1 flex items-baseline justify-center font-black leading-none tabular-nums ${isImminent ? "text-primary" : "text-foreground"}`}>
          <span className="text-6xl sm:text-7xl">{hh}</span>
          <span className="text-5xl sm:text-6xl opacity-70">:</span>
          <span className="text-6xl sm:text-7xl">{mm}</span>
        </div>
      </div>

      {/* Faltan — pill debajo, ocupa todo el ancho */}
      <div className="relative mt-4 flex items-center justify-center">
        <div
          className={`inline-flex items-baseline gap-2 rounded-2xl px-5 py-2.5 ${
            isImminent ? "bg-primary text-primary-foreground" : "bg-background/80 text-foreground border border-border"
          }`}
        >
          <span className="text-[11px] font-bold uppercase tracking-widest opacity-80">
            Faltan
          </span>
          {liveMin == null ? (
            <span className="text-2xl font-bold">—</span>
          ) : liveMin <= 0 ? (
            <span className="text-2xl font-black uppercase tracking-tight">¡Llegando!</span>
          ) : (
            <>
              <span className="text-3xl font-black tabular-nums">{liveMin}</span>
              <span className="text-sm font-bold uppercase opacity-80">min</span>
            </>
          )}
        </div>
      </div>

      {!arrival && !loading && (
        <p className="relative mt-3 text-xs text-muted-foreground">
          Sin próximas salidas ahora mismo.
        </p>
      )}
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

// Puerta del Mar (Alicante) — fallback de cercanía cuando no hay geolocalización
const ALC_CENTER = { lat: 38.3414, lon: -0.481 };

function openStatusRank(hours?: string | null) {
  const s = resolveOpeningStatus(hours ?? undefined).status;
  return s === "open" ? 0 : s === "unknown" ? 1 : 2;
}
const ASIAN_RE = /asian|japanese|sushi|ramen|chinese|china|thai|tailand|vietnam|korean|coreano|wok|noodle|asiat|japon/i;
const DRINKS_RE = /\b(tomar algo|copa|copas|coctel|cóctel|cocktail|cerveza|cervezas|cerveceria|cervecería|vinoteca|wine bar|pub|pubs|discoteca|discotecas|night ?club|nightclub|club nocturno|sala de fiestas|karaoke|karaokes|brewery|rooftop|gin tonic|vermut|terraceo|bar de copas)\b/i;
const TYPICAL_RE = /\b(cocina típica|cocina tipica|típic[oa]|tipic[oa]|alicantin[oa]|mediterrane[oa]|mediterráne[oa]|tradicional|tasca|tapas tradicionales|cocina española|cocina espanola)\b/i;
const RICE_FISH_RE = /\b(arroz|arroces|arrocer[ií]a|paella|pescado|pescados|marisco|mariscos|marisquer[ií]a|seafood)\b/i;
const ITALIAN_RE = /\b(italian[oa]|italianos|pasta|trattoria|ristorante)\b/i;
const PIZZAS_RE = /\b(telepizza|domino'?s|papa john'?s?|pizza hut|pizza m[oó]vil|pizza a domicilio|una pizzer[ií]a|pizzer[ií]a abierta|pizzer[ií]a r[aá]pida)\b/i;
const BRUNCH_RE = /\b(brunch|desayun[oa]s?|breakfast|tortitas|pancakes|waffles?|gofres?|huevos benedictinos|eggs benedict|cafeter[ií]a|caf[eé] especialidad|specialty coffee|bolleria|boller[ií]a|cruasanes?|croissants?)\b/i;
const FAST_FOOD_RE = /\b(comida r[aá]pida|fast ?food|hamburgues[ae]r?[ií]as?|hamburguesas?|burger|smash ?burger|mcdonald|burger king|goiko|five guys|tgb|kfc|popeyes|pollo frito|pollos asados|montaditos?|100 montaditos|lizarr[aá]n|kebaps?|kebab|d[oö]ner|shawarma|taco bell|tacos?|burritos?|mexican[oa])\b/i;
const BURGERS_RE = /\b(hamburgues[ae]r?[ií]as?|hamburguesas?|burger|smash ?burger|mcdonald|burger king|goiko|five guys|tgb)\b/i;
const MONTADITOS_RE = /\b(montaditos?|100 montaditos|lizarr[aá]n)\b/i;
const KEBAB_RE = /\b(kebaps?|kebab|d[oö]ner|shawarma)\b/i;
const FRIED_CHICKEN_RE = /\b(kfc|popeyes|pollo frito|pollos asados|poller[ií]a)\b/i;
const MEXICAN_RE = /\b(mexican[oa]s?|taco bell|tacos?|burritos?|tex.?mex|taquer[ií]a)\b/i;
const VEGAN_RE = /\b(vegano[as]?|vegan[a]?|vegetarian[oa]s?|saludable|healthy|poke|bowl|veggie|plant[\s-]?based)\b/i;
const DESSERTS_RE = /\b(postres?|heladeri?as?|helader[ií]as?|helados?|gelater[ií]as?|pasteler[ií]as?|chocolater[ií]as?|gofres?|waffles?|crepes?|cr[eê]pes?|tartas?|reposter[ií]a|dulce[s]?|cafeter[ií]a con postres)\b/i;
const CHEAP_RE = /\b(barato|baratos?|baratit[oa]s?|econ[oó]mic[oa]s?|low cost|menu del d[ií]a|men[uú] del d[ií]a|menu diario|men[uú] diario|comer barato|sin gastar)\b/i;
const INTERNATIONAL_RE = /\b(internacional|hind[uú]e?s?|hindi|indi[oa]s?|india|libanes[ae]?|libano|árabe|arabe|peruan[oa]s?|peru|latino[as]?|latinoameric[oa]n[oa]s?|venezolan[oa]s?|colombian[oa]s?|argentin[oa]s?|cuban[oa]s?|brasil|tex.?mex|marroqu[ií]|griego|griega|turco de mesa|sorpr[eé]ndeme)\b/i;

function isAsianCard(c: PlaceCardData): boolean {
  const hay = `${c.cuisine ?? ""} ${c.name ?? ""} ${c.vibe ?? ""}`;
  return ASIAN_RE.test(hay);
}

function priceLabel(p?: string | null): { sym: string; avg: string } {
  switch (p) {
    case "PRICE_LEVEL_FREE":
    case "PRICE_LEVEL_INEXPENSIVE":
      return { sym: "€", avg: "~10–15 €" };
    case "PRICE_LEVEL_MODERATE":
      return { sym: "€€", avg: "~15–25 €" };
    case "PRICE_LEVEL_EXPENSIVE":
      return { sym: "€€€", avg: "~25–45 €" };
    case "PRICE_LEVEL_VERY_EXPENSIVE":
      return { sym: "€€€€", avg: "45 €+" };
    default:
      return { sym: "—", avg: "s/d" };
  }
}

function distKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function useFoodListOrigin() {
  const { state: locState, request: requestLocation } = useUserLocation({ watch: true });
  useEffect(() => {
    if (locState.status === "idle") requestLocation();
  }, [locState.status, requestLocation]);
  return {
    locState,
    origin: locState.status === "ready" ? { lat: locState.coords.lat, lon: locState.coords.lng } : ALC_CENTER,
    originLabel: (locState.status === "ready" ? "tu ubicación" : "Puerta del Mar") as
      | "tu ubicación"
      | "Puerta del Mar",
  };
}

// Track which (category, coarse-location) combos we've already enriched this session
const discoveredCategoryZones = new Set<string>();
function useNearbyDiscovery(
  category: "asian" | "drinks" | "typical" | "rice_fish" | "italian" | "brunch" | "pizzas",
  origin: { lat: number; lon: number },
  isUserLocation: boolean,
  onDiscovered: () => void,
) {
  const discoverFn = useServerFn(discoverNearbyPlaces);
  useEffect(() => {
    if (!isUserLocation) return;
    // Coarse-grain coords to ~250 m to avoid re-querying on every GPS jitter
    const key = `${category}:${origin.lat.toFixed(3)}:${origin.lon.toFixed(3)}`;
    if (discoveredCategoryZones.has(key)) return;
    discoveredCategoryZones.add(key);
    discoverFn({ data: { lat: origin.lat, lng: origin.lon, category } })
      .then((res) => {
        if ((res?.added ?? 0) > 0) onDiscovered();
      })
      .catch((e) => console.error(`discoverNearbyPlaces ${category} failed`, e));
  }, [category, origin.lat, origin.lon, isUserLocation, discoverFn, onDiscovered]);
}

function asianEmoji(c: PlaceCardData): string {
  const hay = `${c.cuisine ?? ""} ${c.name ?? ""} ${c.vibe ?? ""}`.toLowerCase();
  if (/ramen|noodle/.test(hay)) return "🍜";
  if (/sushi|japon|japanese/.test(hay)) return "🍣";
  if (/thai|tailand/.test(hay)) return "🌶️";
  if (/korean|coreano/.test(hay)) return "🍱";
  if (/viet/.test(hay)) return "🍲";
  if (/chin|wok/.test(hay)) return "🥢";
  return "🥡";
}

function guessAsianPrice(c: PlaceCardData): string {
  const hay = `${c.cuisine ?? ""} ${c.name ?? ""}`.toLowerCase();
  if (/sushi|japan|izakaya|omakase/.test(hay)) return "~22 €";
  if (/ramen|noodle|udon|pho/.test(hay)) return "~14 €";
  if (/korean|coreano|kbbq/.test(hay)) return "~20 €";
  if (/thai|tailand|viet/.test(hay)) return "~16 €";
  if (/chin|wok|dim\s?sum/.test(hay)) return "~12 €";
  return "~15 €";
}

async function fetchAlicanteAsian(): Promise<PlaceCardData[]> {
  const radius = 6000; // ~6km around Puerta del Mar
  const cuisines = "asian|japanese|sushi|ramen|chinese|thai|vietnamese|korean|noodle|wok|izakaya";
  const q = `[out:json][timeout:25];
(
  nwr["amenity"~"^(restaurant|fast_food)$"]["cuisine"~"${cuisines}",i](around:${radius},${ALC_CENTER.lat},${ALC_CENTER.lon});
);
out center 400;`;
  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ];
  for (const url of endpoints) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "data=" + encodeURIComponent(q),
      });
      if (!r.ok) continue;
      const json = (await r.json()) as { elements: Array<{ lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }> };
      const seen = new Set<string>();
      const out: PlaceCardData[] = [];
      for (const el of json.elements) {
        const t = el.tags ?? {};
        const name = t.name || t["name:es"] || t["name:en"];
        if (!name) continue;
        const lat = el.lat ?? el.center?.lat;
        const lon = el.lon ?? el.center?.lon;
        if (lat == null || lon == null) continue;
        const k = `${name.toLowerCase()}|${lat.toFixed(4)}|${lon.toFixed(4)}`;
        if (seen.has(k)) continue;
        seen.add(k);
        const addr = [t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(" ");
        out.push({
          name,
          cuisine: t.cuisine ?? null,
          address: addr || null,
          openingHours: t.opening_hours ?? null,
          lat,
          lon,
          priceLevel: null,
        });
      }
      return out;
    } catch {
      // try next endpoint
    }
  }
  return [];
}

function AsianTableInner({ ranked, loading, originLabel, onClose }: {
  ranked: { c: PlaceCardData; d: number }[];
  loading: boolean;
  originLabel: string;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const resolvePlace = useServerFn(resolvePlaceByName);
  const [resolving, setResolving] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    const openCount = ranked.filter(({ c }) => {
      const s = resolveOpeningStatus(c.openingHours ?? undefined);
      return s.status === "open" || (s.status === "unknown" && c.openNow === true);
    }).length;
    window.dispatchEvent(
      new CustomEvent("vamos:food-summary", {
        detail: { count: ranked.length, openCount, label: "comida asiática", pluralKind: "sitios" },
      }),
    );
  }, [loading, ranked]);

  const openDashboard = async (c: PlaceCardData) => {
    if (c.placeId) {
        markRestaurantReturn();
      navigate({ to: "/restaurants/$placeId", params: { placeId: c.placeId } });
      return;
    }
    if (resolving) return;
    setResolving(c.name);
    try {
      const { placeId } = await resolvePlace({
        data: { name: c.name, lat: c.lat ?? null, lon: c.lon ?? null },
      });
      if (placeId) {
        markRestaurantReturn();
        navigate({ to: "/restaurants/$placeId", params: { placeId } });
      } else {
        const href =
          c.lat && c.lon
            ? `https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lon}&travelmode=walking`
            : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(c.name + " Alicante")}&travelmode=walking`;
        window.open(href, "_blank", "noreferrer");
      }
    } catch (e) {
      console.error("resolvePlaceByName failed", e);
    } finally {
      setResolving(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] overflow-y-auto text-slate-100"
      style={{
        background:
          "linear-gradient(180deg, #020617 0%, #06111f 50%, #020617 100%)",
      }}
    >
      {/* ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-cyan-500/[0.06] blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[24rem] w-[24rem] rounded-full bg-violet-500/[0.05] blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-5xl px-4 pb-10 pt-5 md:px-6">
        <header className="mb-5 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(new Event("comer:back-to-menu"));
              onClose();
            }}
            className="text-[11px] uppercase tracking-[0.25em] text-slate-500 transition hover:text-cyan-300"
          >
            ← Volver al menú
          </button>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span className="text-[10px] uppercase tracking-[0.25em] text-emerald-300/80">
              Live · ALC
            </span>
            <button
              type="button"
              onClick={() => {
                window.dispatchEvent(new Event("comer:back-to-menu"));
                onClose();
              }}
              aria-label="Cerrar"
              className="ml-2 rounded-full border border-slate-700 p-1.5 text-slate-400 hover:border-cyan-500/50 hover:text-cyan-300"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="mb-5">
          <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-400/70">
            Dashboard gastro
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight md:text-4xl">
            Restaurantes asiáticos{" "}
            <span className="bg-gradient-to-r from-cyan-300 via-white to-violet-300 bg-clip-text text-transparent">
              en Alicante
            </span>
          </h1>
          <p className="mt-1 text-xs text-cyan-300/80 md:text-sm">
            Listado completo · ordenados por cercanía a {originLabel}.
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[rgba(8,12,22,0.7)] p-2 backdrop-blur-xl md:p-4">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <p className="text-[12px] font-semibold text-slate-100">
              {loading ? "Cargando…" : `${ranked.length} restaurantes`}
            </p>
            <p className="text-[9px] uppercase tracking-[0.18em] text-cyan-400/70">
              estado · cierre · precio · dist.
            </p>
          </div>

          <table className="w-full table-fixed border-separate border-spacing-y-0.5 text-left text-[11px] text-slate-200">
            <colgroup>
              <col />
              <col className="w-[58px]" />
              <col className="w-[42px]" />
              <col className="w-[46px]" />
              <col className="w-[54px]" />
            </colgroup>
            <thead>
              <tr className="text-[9px] uppercase tracking-[0.12em] text-slate-500">
                <th className="px-1 py-1 font-medium">Restaurante</th>
                <th className="px-1 py-1 font-medium">Estado</th>
                <th className="px-1 py-1 font-medium">Cierra</th>
                <th className="px-1 py-1 text-right font-medium">€/pers</th>
                <th className="px-1 py-1 text-right font-medium">Dist.</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map(({ c, d }, i) => {
                const status = resolveOpeningStatus(c.openingHours ?? undefined);
                const closesAt =
                  (status.status === "open" ? status.closesAt : null) ??
                  getTodayClosingTime(c.openingHours ?? undefined) ??
                  c.closesAt ??
                  null;
                // Trust parsed schedule first; only fall back to API openNow when schedule is unknown
                const isOpen =
                  status.status === "open" ||
                  (status.status === "unknown" && c.openNow === true);
                const isClosed =
                  status.status === "closed" ||
                  (status.status === "unknown" && c.openNow === false);
                const price = priceLabel(c.priceLevel);
                const priceFromRange =
                  c.priceRangeMin && c.priceRangeMax
                    ? `${c.priceRangeMin}–${c.priceRangeMax} €`
                    : c.priceRangeMin
                      ? `~${c.priceRangeMin} €`
                      : null;
                const priceAvg =
                  priceFromRange ??
                  (price.avg !== "s/d" ? price.avg : guessAsianPrice(c));
                const priceShort = priceAvg.replace(/[~\s€]/g, "").replace("–", "-") + "€";
                const meters = Number.isFinite(d) ? Math.round(d * 1000) : null;
                const distLabel =
                  meters == null
                    ? "—"
                    : meters >= 1000
                      ? `${(meters / 1000).toFixed(1)}km`
                      : `${meters}m`;
                
                const nameNode = (
                  <span className="flex items-center gap-1 text-white hover:text-cyan-300">
                    <span className="text-[13px] leading-none">{asianEmoji(c)}</span>
                    <span className="min-w-0 truncate text-[11px] font-medium">
                      {c.name}
                    </span>
                  </span>
                );
                return (
                  <tr key={i} className="bg-white/[0.02]">
                    <td className="rounded-l-md px-1.5 py-1 align-middle">
                      {c.placeId ? (
                        <Link
                          to="/restaurants/$placeId"
                          params={{ placeId: c.placeId }}
                          onClick={markRestaurantReturn}
                          className="block"
                        >
                          {nameNode}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openDashboard(c)}
                          disabled={resolving === c.name}
                          className="block w-full text-left disabled:opacity-60"
                        >
                          {nameNode}
                        </button>
                      )}
                    </td>
                    <td className="px-1 py-1 align-middle">
                      {isOpen ? (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/15 px-1 py-0.5 text-[9px] font-semibold text-emerald-300">
                          ● Abre
                        </span>
                      ) : isClosed ? (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-rose-500/15 px-1 py-0.5 text-[9px] font-semibold text-rose-300">
                          ● Cerr
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-slate-500/15 px-1 py-0.5 text-[9px] font-semibold text-slate-400">
                          s/d
                        </span>
                      )}
                    </td>
                    <td className="px-1 py-1 text-center align-middle font-mono text-[10px] text-slate-300">
                      {closesAt ?? "—"}
                    </td>
                    <td className="px-1 py-1 text-right align-middle font-mono text-[10px] text-slate-200">
                      {priceShort}
                    </td>
                    <td className="rounded-r-md px-1 py-1 text-right align-middle font-mono text-[11px] font-semibold tabular-nums text-white">
                      {distLabel}
                    </td>
                  </tr>
                );
              })}
              {!loading && ranked.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-2 py-4 text-center text-xs text-slate-500">
                    Sin datos disponibles.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AsianTable({ cards }: { cards: PlaceCardData[] }) {
  const extraRef = useRef<PlaceCardData[]>([]);
  const [extra, setExtra] = useState<PlaceCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const { locState, origin, originLabel } = useFoodListOrigin();

  const fetchAsian = useServerFn(getAsianPlaces);
  useEffect(() => {
    let cancelled = false;
    fetchAsian()
      .then((res) => {
        if (cancelled) return;
        const mapped: PlaceCardData[] = (res.places ?? []).map((p) => ({
          placeId: p.google_place_id,
          name: p.name,
          cuisine: p.cuisine,
          address: p.address,
          openingHours: p.opening_hours_text,
          lat: p.lat ?? undefined,
          lon: p.lng ?? undefined,
          priceLevel: p.price_level,
          priceRangeMin: p.price_range_min,
          priceRangeMax: p.price_range_max,
          rating: p.rating,
          openNow: p.open_now,
        }));
        extraRef.current = mapped;
        setExtra(mapped);
      })
      .catch((e) => console.error("getAsianPlaces failed", e))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fetchAsian, reloadKey]);
  useNearbyDiscovery("asian", origin, locState.status === "ready", () => setReloadKey((k) => k + 1));

  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const byKey = new Map<string, PlaceCardData>();
  for (const c of cards) byKey.set(norm(c.name), c);
  for (const c of extra) {
    const k = norm(c.name);
    if (!byKey.has(k)) byKey.set(k, c);
    else {
      const prev = byKey.get(k)!;
      byKey.set(k, { ...prev, openingHours: prev.openingHours ?? c.openingHours, lat: prev.lat ?? c.lat, lon: prev.lon ?? c.lon });
    }
  }
  const ranked = Array.from(byKey.values())
    .map((c) => ({
      c,
      d: c.lat != null && c.lon != null ? distKm(origin, { lat: c.lat, lon: c.lon }) : Number.POSITIVE_INFINITY,
    }))
    .sort((a, b) => {
      const sa = openStatusRank(a.c.openingHours);
      const sb = openStatusRank(b.c.openingHours);
      if (sa !== sb) return sa - sb;
      return a.d - b.d;
    });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="my-2 w-full rounded-2xl border border-cyan-400/30 bg-cyan-400/5 px-4 py-3 text-[12px] font-semibold uppercase tracking-[0.18em] text-cyan-300 transition hover:bg-cyan-400/10"
      >
        Reabrir dashboard asiático ({ranked.length})
      </button>
    );
  }

  return <AsianTableInner ranked={ranked} loading={loading} originLabel={originLabel} onClose={() => setOpen(false)} />;
}


function isDrinksCard(c: PlaceCardData): boolean {
  const hay = `${c.cuisine ?? ""} ${c.name ?? ""} ${c.vibe ?? ""}`;
  return DRINKS_RE.test(hay) || /\bbar\b|\bpub\b|cocktail|brewery|cerveceria|cervecería|vinoteca|wine_bar/i.test(hay);
}

function drinksEmoji(c: PlaceCardData): string {
  const hay = `${c.cuisine ?? ""} ${c.name ?? ""} ${c.vibe ?? ""}`.toLowerCase();
  if (/coctel|cóctel|cocktail|gin/.test(hay)) return "🍸";
  if (/vino|wine|vinoteca/.test(hay)) return "🍷";
  if (/cerveza|cerveceria|cervecería|brewery|beer/.test(hay)) return "🍺";
  if (/discoteca|club|night/.test(hay)) return "🕺";
  if (/rooftop|terraza/.test(hay)) return "🌇";
  if (/vermut/.test(hay)) return "🍹";
  return "🍻";
}

function guessDrinksPrice(c: PlaceCardData): string {
  const hay = `${c.cuisine ?? ""} ${c.name ?? ""}`.toLowerCase();
  if (/coctel|cóctel|cocktail|gin|rooftop/.test(hay)) return "~10 €";
  if (/vino|wine|vinoteca/.test(hay)) return "~6 €";
  if (/discoteca|club/.test(hay)) return "~12 €";
  if (/cerveza|cerveceria|cervecería|brewery|pub/.test(hay)) return "~4 €";
  return "~6 €";
}

function DrinksTableInner({ ranked, loading, originLabel, onClose }: {
  ranked: { c: PlaceCardData; d: number }[];
  loading: boolean;
  originLabel: string;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const resolvePlace = useServerFn(resolvePlaceByName);
  const [resolving, setResolving] = useState<string | null>(null);

  const openDashboard = async (c: PlaceCardData) => {
    if (c.placeId) {
      markRestaurantReturn();
      navigate({ to: "/restaurants/$placeId", params: { placeId: c.placeId } });
      return;
    }
    if (resolving) return;
    setResolving(c.name);
    try {
      const { placeId } = await resolvePlace({
        data: { name: c.name, lat: c.lat ?? null, lon: c.lon ?? null },
      });
      if (placeId) {
        markRestaurantReturn();
        navigate({ to: "/restaurants/$placeId", params: { placeId } });
      } else {
        const href =
          c.lat && c.lon
            ? `https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lon}&travelmode=walking`
            : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(c.name + " Alicante")}&travelmode=walking`;
        window.open(href, "_blank", "noreferrer");
      }
    } catch (e) {
      console.error("resolvePlaceByName failed", e);
    } finally {
      setResolving(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] overflow-y-auto text-amber-50"
      style={{
        background:
          "linear-gradient(180deg, #1a0f05 0%, #2a1607 50%, #120800 100%)",
      }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-amber-500/[0.08] blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[24rem] w-[24rem] rounded-full bg-rose-500/[0.06] blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-5xl px-4 pb-10 pt-5 md:px-6">
        <header className="mb-5 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="text-[11px] uppercase tracking-[0.25em] text-amber-200/60 transition hover:text-amber-300"
          >
            ← Volver al chat
          </button>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
            </span>
            <span className="text-[10px] uppercase tracking-[0.25em] text-amber-300/80">
              Live · ALC
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="ml-2 rounded-full border border-amber-900/60 p-1.5 text-amber-200/70 hover:border-amber-500/50 hover:text-amber-300"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="mb-5">
          <p className="text-[10px] uppercase tracking-[0.3em] text-amber-400/80">
            Dashboard nocturno
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-amber-50 md:text-4xl">
            Para tomar algo{" "}
            <span className="bg-gradient-to-r from-amber-300 via-white to-rose-300 bg-clip-text text-transparent">
              en Alicante
            </span>
          </h1>
          <p className="mt-1 text-xs text-amber-200/80 md:text-sm">
            Bares, copas y cervecerías · ordenados por cercanía a {originLabel}.
          </p>
        </div>

        <div className="rounded-2xl border border-amber-100/[0.08] bg-[rgba(20,10,4,0.7)] p-2 backdrop-blur-xl md:p-4">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <p className="text-[12px] font-semibold text-amber-50">
              {loading ? "Cargando…" : `${ranked.length} sitios`}
            </p>
            <p className="text-[9px] uppercase tracking-[0.18em] text-amber-400/70">
              estado · cierre · precio · dist.
            </p>
          </div>

          <table className="w-full table-fixed border-separate border-spacing-y-0.5 text-left text-[11px] text-amber-50">
            <colgroup>
              <col />
              <col className="w-[58px]" />
              <col className="w-[42px]" />
              <col className="w-[46px]" />
              <col className="w-[54px]" />
            </colgroup>
            <thead>
              <tr className="text-[9px] uppercase tracking-[0.12em] text-amber-200/50">
                <th className="px-1 py-1 font-medium">Local</th>
                <th className="px-1 py-1 font-medium">Estado</th>
                <th className="px-1 py-1 font-medium">Cierra</th>
                <th className="px-1 py-1 text-right font-medium">€/copa</th>
                <th className="px-1 py-1 text-right font-medium">Dist.</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map(({ c, d }, i) => {
                const status = resolveOpeningStatus(c.openingHours ?? undefined);
                const closesAt =
                  (status.status === "open" ? status.closesAt : null) ??
                  getTodayClosingTime(c.openingHours ?? undefined) ??
                  c.closesAt ??
                  null;
                const isOpen =
                  status.status === "open" ||
                  (status.status === "unknown" && c.openNow === true);
                const isClosed =
                  status.status === "closed" ||
                  (status.status === "unknown" && c.openNow === false);
                const price = priceLabel(c.priceLevel);
                const priceFromRange =
                  c.priceRangeMin && c.priceRangeMax
                    ? `${c.priceRangeMin}–${c.priceRangeMax} €`
                    : c.priceRangeMin
                      ? `~${c.priceRangeMin} €`
                      : null;
                const priceAvg =
                  priceFromRange ??
                  (price.avg !== "s/d" ? price.avg : guessDrinksPrice(c));
                const priceShort = priceAvg.replace(/[~\s€]/g, "").replace("–", "-") + "€";
                const meters = Number.isFinite(d) ? Math.round(d * 1000) : null;
                const distLabel =
                  meters == null
                    ? "—"
                    : meters >= 1000
                      ? `${(meters / 1000).toFixed(1)}km`
                      : `${meters}m`;

                const nameNode = (
                  <span className="flex items-center gap-1 text-amber-50 hover:text-amber-300">
                    <span className="text-[13px] leading-none">{drinksEmoji(c)}</span>
                    <span className="min-w-0 truncate text-[11px] font-medium">
                      {c.name}
                    </span>
                  </span>
                );
                return (
                  <tr key={i} className="bg-white/[0.02]">
                    <td className="rounded-l-md px-1.5 py-1 align-middle">
                      {c.placeId ? (
                        <Link
                          to="/restaurants/$placeId"
                          params={{ placeId: c.placeId }}
                          onClick={markRestaurantReturn}
                          className="block"
                        >
                          {nameNode}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openDashboard(c)}
                          disabled={resolving === c.name}
                          className="block w-full text-left disabled:opacity-60"
                        >
                          {nameNode}
                        </button>
                      )}
                    </td>
                    <td className="px-1 py-1 align-middle">
                      {isOpen ? (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/15 px-1 py-0.5 text-[9px] font-semibold text-emerald-300">
                          ● Abre
                        </span>
                      ) : isClosed ? (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-rose-500/15 px-1 py-0.5 text-[9px] font-semibold text-rose-300">
                          ● Cerr
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/15 px-1 py-0.5 text-[9px] font-semibold text-amber-300/80">
                          s/d
                        </span>
                      )}
                    </td>
                    <td className="px-1 py-1 text-center align-middle font-mono text-[10px] text-amber-100/80">
                      {closesAt ?? "—"}
                    </td>
                    <td className="px-1 py-1 text-right align-middle font-mono text-[10px] text-amber-50">
                      {priceShort}
                    </td>
                    <td className="rounded-r-md px-1 py-1 text-right align-middle font-mono text-[11px] font-semibold tabular-nums text-amber-50">
                      {distLabel}
                    </td>
                  </tr>
                );
              })}
              {!loading && ranked.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-2 py-4 text-center text-xs text-amber-200/50">
                    Sin datos disponibles.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function DrinksTable({ cards }: { cards: PlaceCardData[] }) {
  const [extra, setExtra] = useState<PlaceCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const { locState, origin, originLabel } = useFoodListOrigin();

  const fetchDrinks = useServerFn(getDrinksPlaces);
  useEffect(() => {
    let cancelled = false;
    fetchDrinks()
      .then((res) => {
        if (cancelled) return;
        const mapped: PlaceCardData[] = (res.places ?? []).map((p) => ({
          placeId: p.google_place_id,
          name: p.name,
          cuisine: p.cuisine,
          address: p.address,
          openingHours: p.opening_hours_text,
          lat: p.lat ?? undefined,
          lon: p.lng ?? undefined,
          priceLevel: p.price_level,
          priceRangeMin: p.price_range_min,
          priceRangeMax: p.price_range_max,
          rating: p.rating,
          openNow: p.open_now,
        }));
        setExtra(mapped);
      })
      .catch((e) => console.error("getDrinksPlaces failed", e))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fetchDrinks, reloadKey]);
  useNearbyDiscovery("drinks", origin, locState.status === "ready", () => setReloadKey((k) => k + 1));

  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const byKey = new Map<string, PlaceCardData>();
  for (const c of cards) byKey.set(norm(c.name), c);
  for (const c of extra) {
    const k = norm(c.name);
    if (!byKey.has(k)) byKey.set(k, c);
    else {
      const prev = byKey.get(k)!;
      byKey.set(k, { ...prev, openingHours: prev.openingHours ?? c.openingHours, lat: prev.lat ?? c.lat, lon: prev.lon ?? c.lon });
    }
  }
  const ranked = Array.from(byKey.values())
    .map((c) => ({
      c,
      d: c.lat && c.lon ? distKm(origin, { lat: c.lat, lon: c.lon }) : Number.POSITIVE_INFINITY,
    }))
    .filter((r) => r.d <= 10)
    .sort((a, b) => {
      const sa = openStatusRank(a.c.openingHours);
      const sb = openStatusRank(b.c.openingHours);
      if (sa !== sb) return sa - sb;
      return a.d - b.d;
    });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="my-2 w-full rounded-2xl border border-amber-400/30 bg-amber-400/5 px-4 py-3 text-[12px] font-semibold uppercase tracking-[0.18em] text-amber-300 transition hover:bg-amber-400/10"
      >
        Reabrir dashboard de copas ({ranked.length})
      </button>
    );
  }

  return <DrinksTableInner ranked={ranked} loading={loading} originLabel={originLabel} onClose={() => setOpen(false)} />;
}


// ============= Generic category dashboard (typical, rice_fish, italian) =============

type CategoryTheme = {
  bgGradient: string;
  glow1: string;
  glow2: string;
  accentText: string;
  borderHover: string;
  liveText: string;
  liveDot: string;
  borderBtn: string;
  eyebrow: string;
  eyebrowText: string;
  title: string;
  titleHighlight: string;
  titleGradient: string;
  subtitle: string;
  cardBg: string;
  cardBorder: string;
  countText: string;
  hint: string;
  thText: string;
  rowText: string;
  hoverName: string;
  closesText: string;
  priceText: string;
  distText: string;
  emptyText: string;
  reopenLabel: string;
  reopenCls: string;
  priceHeader: string;
  rowLabel: string;
};

type CategoryTableOriginLabel = "tu ubicación" | "Puerta del Mar";

type ExtendedCategory =
  | "typical"
  | "rice_fish"
  | "italian"
  | "brunch"
  | "pizzas"
  | "fast_food"
  | "burgers"
  | "montaditos"
  | "kebab"
  | "fried_chicken"
  | "mexican"
  | "vegan"
  | "desserts"
  | "cheap"
  | "international";

const CATEGORY_THEMES: Record<ExtendedCategory, CategoryTheme & {
  emoji: (c: PlaceCardData) => string;
  guessPrice: (c: PlaceCardData) => string;
  title1: string;
  title2: string;
  subtitleText: string;
  eyebrowLabel: string;
  rowLabelText: string;
  priceHeaderText: string;
}> = {
  typical: {
    bgGradient: "linear-gradient(180deg, #1a1410 0%, #2a1f17 50%, #100b07 100%)",
    glow1: "bg-orange-500/[0.07]",
    glow2: "bg-yellow-500/[0.05]",
    accentText: "text-orange-200/70",
    borderHover: "hover:text-orange-300",
    liveText: "text-orange-300/80",
    liveDot: "bg-orange-400",
    borderBtn: "border-orange-900/60 text-orange-200/70 hover:border-orange-500/50 hover:text-orange-300",
    eyebrow: "text-orange-400/80",
    eyebrowText: "Dashboard tradición",
    title: "text-orange-50",
    titleHighlight: "Cocina típica",
    titleGradient: "from-orange-300 via-white to-yellow-300",
    subtitle: "text-orange-200/80",
    cardBg: "bg-[rgba(22,14,8,0.7)]",
    cardBorder: "border-orange-100/[0.08]",
    countText: "text-orange-50",
    hint: "text-orange-400/70",
    thText: "text-orange-200/50",
    rowText: "text-orange-50",
    hoverName: "text-orange-50 hover:text-orange-300",
    closesText: "text-orange-100/80",
    priceText: "text-orange-50",
    distText: "text-orange-50",
    emptyText: "text-orange-200/50",
    reopenLabel: "Reabrir dashboard típico",
    reopenCls: "border-orange-400/30 bg-orange-400/5 text-orange-300 hover:bg-orange-400/10",
    priceHeader: "€/pers",
    rowLabel: "Restaurante",
    emoji: (c) => {
      const hay = `${c.cuisine ?? ""} ${c.name ?? ""}`.toLowerCase();
      if (/tapa/.test(hay)) return "🥘";
      if (/tasca|taberna/.test(hay)) return "🍷";
      return "🥘";
    },
    guessPrice: () => "~20 €",
    title1: "Cocina típica",
    title2: "en Alicante",
    subtitleText: "Tradicional · ordenados por cercanía a Puerta del Mar.",
    eyebrowLabel: "Dashboard tradición",
    rowLabelText: "Restaurante",
    priceHeaderText: "€/pers",
  },
  rice_fish: {
    bgGradient: "linear-gradient(180deg, #04101a 0%, #0a1f2e 50%, #020a14 100%)",
    glow1: "bg-sky-500/[0.07]",
    glow2: "bg-teal-500/[0.05]",
    accentText: "text-sky-200/70",
    borderHover: "hover:text-sky-300",
    liveText: "text-sky-300/80",
    liveDot: "bg-sky-400",
    borderBtn: "border-sky-900/60 text-sky-200/70 hover:border-sky-500/50 hover:text-sky-300",
    eyebrow: "text-sky-400/80",
    eyebrowText: "Dashboard marinero",
    title: "text-sky-50",
    titleHighlight: "Arroces y pescado",
    titleGradient: "from-sky-300 via-white to-teal-300",
    subtitle: "text-sky-200/80",
    cardBg: "bg-[rgba(6,16,26,0.7)]",
    cardBorder: "border-sky-100/[0.08]",
    countText: "text-sky-50",
    hint: "text-sky-400/70",
    thText: "text-sky-200/50",
    rowText: "text-sky-50",
    hoverName: "text-sky-50 hover:text-sky-300",
    closesText: "text-sky-100/80",
    priceText: "text-sky-50",
    distText: "text-sky-50",
    emptyText: "text-sky-200/50",
    reopenLabel: "Reabrir dashboard de arroces",
    reopenCls: "border-sky-400/30 bg-sky-400/5 text-sky-300 hover:bg-sky-400/10",
    priceHeader: "€/pers",
    rowLabel: "Restaurante",
    emoji: (c) => {
      const hay = `${c.cuisine ?? ""} ${c.name ?? ""}`.toLowerCase();
      if (/paella|arroz|arrocer/.test(hay)) return "🥘";
      if (/marisc/.test(hay)) return "🦐";
      if (/pescado|seafood|fish/.test(hay)) return "🐟";
      return "🍤";
    },
    guessPrice: (c) => {
      const hay = `${c.cuisine ?? ""} ${c.name ?? ""}`.toLowerCase();
      if (/marisc/.test(hay)) return "~35 €";
      if (/arroz|paella/.test(hay)) return "~22 €";
      return "~25 €";
    },
    title1: "Arroces y pescado",
    title2: "en Alicante",
    subtitleText: "Paella, marisco y pescado fresco · cercanía a Puerta del Mar.",
    eyebrowLabel: "Dashboard marinero",
    rowLabelText: "Restaurante",
    priceHeaderText: "€/pers",
  },
  italian: {
    bgGradient: "linear-gradient(180deg, #0a1410 0%, #14271e 50%, #050d09 100%)",
    glow1: "bg-emerald-500/[0.07]",
    glow2: "bg-red-500/[0.06]",
    accentText: "text-emerald-200/70",
    borderHover: "hover:text-emerald-300",
    liveText: "text-emerald-300/80",
    liveDot: "bg-emerald-400",
    borderBtn: "border-emerald-900/60 text-emerald-200/70 hover:border-emerald-500/50 hover:text-emerald-300",
    eyebrow: "text-emerald-400/80",
    eyebrowText: "Dashboard italiano",
    title: "text-emerald-50",
    titleHighlight: "Italiano",
    titleGradient: "from-emerald-300 via-white to-red-300",
    subtitle: "text-emerald-200/80",
    cardBg: "bg-[rgba(10,20,16,0.7)]",
    cardBorder: "border-emerald-100/[0.08]",
    countText: "text-emerald-50",
    hint: "text-emerald-400/70",
    thText: "text-emerald-200/50",
    rowText: "text-emerald-50",
    hoverName: "text-emerald-50 hover:text-emerald-300",
    closesText: "text-emerald-100/80",
    priceText: "text-emerald-50",
    distText: "text-emerald-50",
    emptyText: "text-emerald-200/50",
    reopenLabel: "Reabrir dashboard italiano",
    reopenCls: "border-emerald-400/30 bg-emerald-400/5 text-emerald-300 hover:bg-emerald-400/10",
    priceHeader: "€/pers",
    rowLabel: "Restaurante",
    emoji: (c) => {
      const hay = `${c.cuisine ?? ""} ${c.name ?? ""}`.toLowerCase();
      if (/pizza/.test(hay)) return "🍕";
      if (/pasta|spagh|carbon/.test(hay)) return "🍝";
      if (/gelat|helad/.test(hay)) return "🍨";
      return "🍕";
    },
    guessPrice: (c) => {
      const hay = `${c.cuisine ?? ""} ${c.name ?? ""}`.toLowerCase();
      if (/pizza/.test(hay)) return "~14 €";
      return "~18 €";
    },
    title1: "Cocina italiana",
    title2: "en Alicante",
    subtitleText: "Pizza, pasta y trattorias · ordenados por cercanía a Puerta del Mar.",
    eyebrowLabel: "Dashboard italiano",
    rowLabelText: "Restaurante",
    priceHeaderText: "€/pers",
  },
  brunch: {
    bgGradient: "linear-gradient(180deg, #1a1208 0%, #2a1d10 50%, #0f0a05 100%)",
    glow1: "bg-amber-400/[0.08]",
    glow2: "bg-rose-400/[0.05]",
    accentText: "text-amber-200/70",
    borderHover: "hover:text-amber-300",
    liveText: "text-amber-300/80",
    liveDot: "bg-amber-400",
    borderBtn: "border-amber-900/60 text-amber-200/70 hover:border-amber-500/50 hover:text-amber-300",
    eyebrow: "text-amber-400/80",
    eyebrowText: "Dashboard brunch",
    title: "text-amber-50",
    titleHighlight: "Desayunos & brunch",
    titleGradient: "from-amber-300 via-white to-rose-300",
    subtitle: "text-amber-200/80",
    cardBg: "bg-[rgba(20,14,8,0.7)]",
    cardBorder: "border-amber-100/[0.08]",
    countText: "text-amber-50",
    hint: "text-amber-400/70",
    thText: "text-amber-200/50",
    rowText: "text-amber-50",
    hoverName: "text-amber-50 hover:text-amber-300",
    closesText: "text-amber-100/80",
    priceText: "text-amber-50",
    distText: "text-amber-50",
    emptyText: "text-amber-200/50",
    reopenLabel: "Reabrir dashboard de brunch",
    reopenCls: "border-amber-400/30 bg-amber-400/5 text-amber-300 hover:bg-amber-400/10",
    priceHeader: "€/pers",
    rowLabel: "Cafetería",
    emoji: (c) => {
      const hay = `${c.cuisine ?? ""} ${c.name ?? ""}`.toLowerCase();
      if (/coffee|caf[eé]|specialty/.test(hay)) return "☕";
      if (/bake|panad|boller|crois|crus/.test(hay)) return "🥐";
      if (/pancake|tortita|waffle|gofre/.test(hay)) return "🥞";
      if (/brunch|huevos|eggs/.test(hay)) return "🍳";
      return "🥐";
    },
    guessPrice: (c) => {
      const hay = `${c.cuisine ?? ""} ${c.name ?? ""}`.toLowerCase();
      if (/brunch/.test(hay)) return "~16 €";
      if (/coffee|caf[eé]|bake/.test(hay)) return "~8 €";
      return "~12 €";
    },
    title1: "Desayunos & brunch",
    title2: "en Alicante",
    subtitleText: "Cafeterías y brunch · ordenados por cercanía a Puerta del Mar.",
    eyebrowLabel: "Dashboard brunch",
    rowLabelText: "Cafetería",
    priceHeaderText: "€/pers",
  },
  pizzas: {
    bgGradient: "linear-gradient(180deg, #1a0a08 0%, #2a120c 50%, #100604 100%)",
    glow1: "bg-red-500/[0.10]",
    glow2: "bg-yellow-500/[0.07]",
    accentText: "text-red-200/70",
    borderHover: "hover:text-red-300",
    liveText: "text-red-300/80",
    liveDot: "bg-red-400",
    borderBtn: "border-red-900/60 text-red-200/70 hover:border-red-500/50 hover:text-red-300",
    eyebrow: "text-red-400/80",
    eyebrowText: "Dashboard pizza",
    title: "text-red-50",
    titleHighlight: "Pizzas",
    titleGradient: "from-red-300 via-yellow-200 to-orange-300",
    subtitle: "text-red-200/80",
    cardBg: "bg-[rgba(20,10,8,0.7)]",
    cardBorder: "border-red-100/[0.08]",
    countText: "text-red-50",
    hint: "text-red-400/70",
    thText: "text-red-200/50",
    rowText: "text-red-50",
    hoverName: "text-red-50 hover:text-red-300",
    closesText: "text-red-100/80",
    priceText: "text-red-50",
    distText: "text-red-50",
    emptyText: "text-red-200/50",
    reopenLabel: "Reabrir dashboard pizzas",
    reopenCls: "border-red-400/30 bg-red-400/5 text-red-300 hover:bg-red-400/10",
    priceHeader: "€/pers",
    rowLabel: "Pizzería",
    emoji: (c) => {
      const hay = `${c.cuisine ?? ""} ${c.name ?? ""}`.toLowerCase();
      if (/telepizza|domino|papa john|pizza hut|móvil|movil|domicilio/.test(hay)) return "🛵";
      if (/napole|napoli|nap\b/.test(hay)) return "🇮🇹";
      return "🍕";
    },
    guessPrice: (c) => {
      const hay = `${c.cuisine ?? ""} ${c.name ?? ""}`.toLowerCase();
      if (/telepizza|domino|papa john|pizza hut|móvil|movil/.test(hay)) return "~12 €";
      if (/grosso|napole|napoli|nap\b/.test(hay)) return "~15 €";
      return "~13 €";
    },
    title1: "Pizzas",
    title2: "en Alicante",
    subtitleText: "Telepizza, Domino's y pizzerías rápidas · ordenados por cercanía a Puerta del Mar.",
    eyebrowLabel: "Dashboard pizza",
    rowLabelText: "Pizzería",
    priceHeaderText: "€/pers",
  },
  fast_food: {
    bgGradient: "linear-gradient(180deg, #1a0f08 0%, #2a1810 50%, #100804 100%)",
    glow1: "bg-orange-500/[0.10]",
    glow2: "bg-yellow-500/[0.06]",
    accentText: "text-orange-200/70",
    borderHover: "hover:text-orange-300",
    liveText: "text-orange-300/80",
    liveDot: "bg-orange-400",
    borderBtn: "border-orange-900/60 text-orange-200/70 hover:border-orange-500/50 hover:text-orange-300",
    eyebrow: "text-orange-400/80",
    eyebrowText: "Dashboard fast food",
    title: "text-orange-50",
    titleHighlight: "Comida rápida",
    titleGradient: "from-orange-300 via-yellow-200 to-red-300",
    subtitle: "text-orange-200/80",
    cardBg: "bg-[rgba(20,12,8,0.7)]",
    cardBorder: "border-orange-100/[0.08]",
    countText: "text-orange-50",
    hint: "text-orange-400/70",
    thText: "text-orange-200/50",
    rowText: "text-orange-50",
    hoverName: "text-orange-50 hover:text-orange-300",
    closesText: "text-orange-100/80",
    priceText: "text-orange-50",
    distText: "text-orange-50",
    emptyText: "text-orange-200/50",
    reopenLabel: "Reabrir dashboard fast food",
    reopenCls: "border-orange-400/30 bg-orange-400/5 text-orange-300 hover:bg-orange-400/10",
    priceHeader: "€/pers",
    rowLabel: "Sitio",
    emoji: (c) => {
      const hay = `${c.cuisine ?? ""} ${c.name ?? ""}`.toLowerCase();
      if (/burger|hamburgu|goiko|five guys|tgb|mcdonald|burger king|smash/.test(hay)) return "🍔";
      if (/kebab|kebap|d[oö]ner|shawarma/.test(hay)) return "🌯";
      if (/kfc|popeyes|pollo/.test(hay)) return "🍗";
      if (/taco|burrito|mexic/.test(hay)) return "🌮";
      if (/montadit|lizarr|100 mont/.test(hay)) return "🥖";
      if (/pizza|telepizza|domino/.test(hay)) return "🍕";
      return "🍟";
    },
    guessPrice: () => "~10 €",
    title1: "Comida rápida",
    title2: "en Alicante",
    subtitleText: "Hamburguesas, kebaps, montaditos, pollo, mexicano · cercanía a Puerta del Mar.",
    eyebrowLabel: "Dashboard fast food",
    rowLabelText: "Sitio",
    priceHeaderText: "€/pers",
  },
  vegan: {
    bgGradient: "linear-gradient(180deg, #06140d 0%, #0c2418 50%, #030a06 100%)",
    glow1: "bg-green-500/[0.10]",
    glow2: "bg-lime-500/[0.06]",
    accentText: "text-green-200/70",
    borderHover: "hover:text-green-300",
    liveText: "text-green-300/80",
    liveDot: "bg-green-400",
    borderBtn: "border-green-900/60 text-green-200/70 hover:border-green-500/50 hover:text-green-300",
    eyebrow: "text-green-400/80",
    eyebrowText: "Dashboard vegano",
    title: "text-green-50",
    titleHighlight: "Vegano & saludable",
    titleGradient: "from-green-300 via-lime-200 to-emerald-300",
    subtitle: "text-green-200/80",
    cardBg: "bg-[rgba(6,18,12,0.7)]",
    cardBorder: "border-green-100/[0.08]",
    countText: "text-green-50",
    hint: "text-green-400/70",
    thText: "text-green-200/50",
    rowText: "text-green-50",
    hoverName: "text-green-50 hover:text-green-300",
    closesText: "text-green-100/80",
    priceText: "text-green-50",
    distText: "text-green-50",
    emptyText: "text-green-200/50",
    reopenLabel: "Reabrir dashboard vegano",
    reopenCls: "border-green-400/30 bg-green-400/5 text-green-300 hover:bg-green-400/10",
    priceHeader: "€/pers",
    rowLabel: "Sitio",
    emoji: (c) => {
      const hay = `${c.cuisine ?? ""} ${c.name ?? ""}`.toLowerCase();
      if (/poke|bowl/.test(hay)) return "🥗";
      if (/vegan/.test(hay)) return "🌱";
      if (/vegeta/.test(hay)) return "🥬";
      return "🥗";
    },
    guessPrice: () => "~14 €",
    title1: "Vegano & saludable",
    title2: "en Alicante",
    subtitleText: "Vegano, vegetariano, bowls y poke · cercanía a Puerta del Mar.",
    eyebrowLabel: "Dashboard vegano",
    rowLabelText: "Sitio",
    priceHeaderText: "€/pers",
  },
  desserts: {
    bgGradient: "linear-gradient(180deg, #1a0a16 0%, #2a1224 50%, #100610 100%)",
    glow1: "bg-pink-500/[0.10]",
    glow2: "bg-fuchsia-500/[0.06]",
    accentText: "text-pink-200/70",
    borderHover: "hover:text-pink-300",
    liveText: "text-pink-300/80",
    liveDot: "bg-pink-400",
    borderBtn: "border-pink-900/60 text-pink-200/70 hover:border-pink-500/50 hover:text-pink-300",
    eyebrow: "text-pink-400/80",
    eyebrowText: "Dashboard postres",
    title: "text-pink-50",
    titleHighlight: "Postres & helados",
    titleGradient: "from-pink-300 via-fuchsia-200 to-rose-300",
    subtitle: "text-pink-200/80",
    cardBg: "bg-[rgba(20,8,18,0.7)]",
    cardBorder: "border-pink-100/[0.08]",
    countText: "text-pink-50",
    hint: "text-pink-400/70",
    thText: "text-pink-200/50",
    rowText: "text-pink-50",
    hoverName: "text-pink-50 hover:text-pink-300",
    closesText: "text-pink-100/80",
    priceText: "text-pink-50",
    distText: "text-pink-50",
    emptyText: "text-pink-200/50",
    reopenLabel: "Reabrir dashboard de postres",
    reopenCls: "border-pink-400/30 bg-pink-400/5 text-pink-300 hover:bg-pink-400/10",
    priceHeader: "€/pers",
    rowLabel: "Sitio",
    emoji: (c) => {
      const hay = `${c.cuisine ?? ""} ${c.name ?? ""}`.toLowerCase();
      if (/helad|gelat|ice ?cream/.test(hay)) return "🍨";
      if (/chocolat/.test(hay)) return "🍫";
      if (/gofre|waffle/.test(hay)) return "🧇";
      if (/crep|crêp/.test(hay)) return "🥞";
      if (/pastel|tarta|reposter|bakery|panad/.test(hay)) return "🍰";
      return "🍮";
    },
    guessPrice: () => "~6 €",
    title1: "Postres & helados",
    title2: "en Alicante",
    subtitleText: "Heladerías, pastelerías y cafés con postres · cercanía a Puerta del Mar.",
    eyebrowLabel: "Dashboard postres",
    rowLabelText: "Sitio",
    priceHeaderText: "€/pers",
  },
  cheap: {
    bgGradient: "linear-gradient(180deg, #0d1308 0%, #18230f 50%, #060a04 100%)",
    glow1: "bg-yellow-500/[0.10]",
    glow2: "bg-lime-500/[0.06]",
    accentText: "text-yellow-200/70",
    borderHover: "hover:text-yellow-300",
    liveText: "text-yellow-300/80",
    liveDot: "bg-yellow-400",
    borderBtn: "border-yellow-900/60 text-yellow-200/70 hover:border-yellow-500/50 hover:text-yellow-300",
    eyebrow: "text-yellow-400/80",
    eyebrowText: "Dashboard low cost",
    title: "text-yellow-50",
    titleHighlight: "Barato y rico",
    titleGradient: "from-yellow-300 via-lime-200 to-amber-300",
    subtitle: "text-yellow-200/80",
    cardBg: "bg-[rgba(12,16,6,0.7)]",
    cardBorder: "border-yellow-100/[0.08]",
    countText: "text-yellow-50",
    hint: "text-yellow-400/70",
    thText: "text-yellow-200/50",
    rowText: "text-yellow-50",
    hoverName: "text-yellow-50 hover:text-yellow-300",
    closesText: "text-yellow-100/80",
    priceText: "text-yellow-50",
    distText: "text-yellow-50",
    emptyText: "text-yellow-200/50",
    reopenLabel: "Reabrir dashboard barato",
    reopenCls: "border-yellow-400/30 bg-yellow-400/5 text-yellow-300 hover:bg-yellow-400/10",
    priceHeader: "€/pers",
    rowLabel: "Sitio",
    emoji: () => "💸",
    guessPrice: () => "~10 €",
    title1: "Barato y rico",
    title2: "en Alicante",
    subtitleText: "Sitios económicos para comer ya · cercanía a Puerta del Mar.",
    eyebrowLabel: "Dashboard low cost",
    rowLabelText: "Sitio",
    priceHeaderText: "€/pers",
  },
  international: {
    bgGradient: "linear-gradient(180deg, #0d0820 0%, #1a1238 50%, #06040f 100%)",
    glow1: "bg-violet-500/[0.10]",
    glow2: "bg-fuchsia-500/[0.06]",
    accentText: "text-violet-200/70",
    borderHover: "hover:text-violet-300",
    liveText: "text-violet-300/80",
    liveDot: "bg-violet-400",
    borderBtn: "border-violet-900/60 text-violet-200/70 hover:border-violet-500/50 hover:text-violet-300",
    eyebrow: "text-violet-400/80",
    eyebrowText: "Dashboard internacional",
    title: "text-violet-50",
    titleHighlight: "Internacional",
    titleGradient: "from-violet-300 via-fuchsia-200 to-pink-300",
    subtitle: "text-violet-200/80",
    cardBg: "bg-[rgba(12,8,28,0.7)]",
    cardBorder: "border-violet-100/[0.08]",
    countText: "text-violet-50",
    hint: "text-violet-400/70",
    thText: "text-violet-200/50",
    rowText: "text-violet-50",
    hoverName: "text-violet-50 hover:text-violet-300",
    closesText: "text-violet-100/80",
    priceText: "text-violet-50",
    distText: "text-violet-50",
    emptyText: "text-violet-200/50",
    reopenLabel: "Reabrir dashboard internacional",
    reopenCls: "border-violet-400/30 bg-violet-400/5 text-violet-300 hover:bg-violet-400/10",
    priceHeader: "€/pers",
    rowLabel: "Restaurante",
    emoji: (c) => {
      const hay = `${c.cuisine ?? ""} ${c.name ?? ""}`.toLowerCase();
      if (/indi|hind/.test(hay)) return "🇮🇳";
      if (/liban|árabe|arabe|marroq/.test(hay)) return "🥙";
      if (/peruan|peru/.test(hay)) return "🇵🇪";
      if (/mexican|tex.?mex/.test(hay)) return "🌮";
      if (/venezolan|colombian|argentin|cuban|brasil|latino/.test(hay)) return "🌎";
      return "🌍";
    },
    guessPrice: () => "~20 €",
    title1: "Internacional",
    title2: "en Alicante",
    subtitleText: "Cocinas del mundo · ordenados por cercanía a Puerta del Mar.",
    eyebrowLabel: "Dashboard internacional",
    rowLabelText: "Restaurante",
    priceHeaderText: "€/pers",
  },
  ...buildFastFoodSubThemes(),
};

type FastFoodSubKey = "burgers" | "montaditos" | "kebab" | "fried_chicken" | "mexican";

function buildFastFoodSubThemes(): Record<FastFoodSubKey, (typeof CATEGORY_THEMES)[ExtendedCategory]> {
  type Spec = {
    color: string; // tailwind hue
    bg: [string, string, string]; // bg gradient stops
    cardBg: string;
    title1: string;
    titleHighlight: string;
    titleGradient: string;
    emoji: (c: PlaceCardData) => string;
    guessPrice: (c: PlaceCardData) => string;
    subtitleText: string;
    eyebrowText: string;
    reopenLabel: string;
    rowLabel: string;
  };
  const specs: Record<FastFoodSubKey, Spec> = {
    burgers: {
      color: "amber",
      bg: ["#1a0f06", "#2a1a0c", "#100804"],
      cardBg: "bg-[rgba(20,12,6,0.7)]",
      title1: "Hamburguesas",
      titleHighlight: "Hamburguesas",
      titleGradient: "from-amber-300 via-yellow-200 to-orange-300",
      emoji: () => "🍔",
      guessPrice: (c) => {
        const hay = `${c.cuisine ?? ""} ${c.name ?? ""}`.toLowerCase();
        if (/goiko|five guys|tgb|smash/.test(hay)) return "~14 €";
        if (/mcdonald|burger king/.test(hay)) return "~9 €";
        return "~11 €";
      },
      subtitleText: "Smash, premium y cadenas · cercanía a Puerta del Mar.",
      eyebrowText: "Dashboard burger",
      reopenLabel: "Reabrir dashboard hamburguesas",
      rowLabel: "Hamburguesería",
    },
    montaditos: {
      color: "yellow",
      bg: ["#1a1408", "#2a200c", "#100a04"],
      cardBg: "bg-[rgba(20,16,8,0.7)]",
      title1: "Montaditos",
      titleHighlight: "Montaditos",
      titleGradient: "from-yellow-300 via-amber-200 to-orange-300",
      emoji: () => "🥖",
      guessPrice: () => "~8 €",
      subtitleText: "100 Montaditos, Lizarrán y similares · cercanía a Puerta del Mar.",
      eyebrowText: "Dashboard montaditos",
      reopenLabel: "Reabrir dashboard montaditos",
      rowLabel: "Cervecería",
    },
    kebab: {
      color: "lime",
      bg: ["#0c1408", "#16240c", "#060a04"],
      cardBg: "bg-[rgba(12,20,8,0.7)]",
      title1: "Kebaps",
      titleHighlight: "Kebaps",
      titleGradient: "from-lime-300 via-yellow-200 to-orange-300",
      emoji: () => "🌯",
      guessPrice: () => "~7 €",
      subtitleText: "Kebap, döner y shawarma · cercanía a Puerta del Mar.",
      eyebrowText: "Dashboard kebap",
      reopenLabel: "Reabrir dashboard kebap",
      rowLabel: "Kebap",
    },
    fried_chicken: {
      color: "rose",
      bg: ["#1a0a0c", "#2a1014", "#100406"],
      cardBg: "bg-[rgba(20,10,12,0.7)]",
      title1: "Pollo frito",
      titleHighlight: "Pollo frito",
      titleGradient: "from-rose-300 via-yellow-200 to-orange-300",
      emoji: () => "🍗",
      guessPrice: (c) => {
        const hay = `${c.cuisine ?? ""} ${c.name ?? ""}`.toLowerCase();
        if (/kfc|popeyes/.test(hay)) return "~10 €";
        return "~12 €";
      },
      subtitleText: "KFC, Popeyes y pollos asados · cercanía a Puerta del Mar.",
      eyebrowText: "Dashboard pollo",
      reopenLabel: "Reabrir dashboard pollo frito",
      rowLabel: "Pollería",
    },
    mexican: {
      color: "emerald",
      bg: ["#06140d", "#0c2418", "#030a06"],
      cardBg: "bg-[rgba(6,20,12,0.7)]",
      title1: "Comida mexicana",
      titleHighlight: "Mexicano",
      titleGradient: "from-emerald-300 via-yellow-200 to-red-300",
      emoji: () => "🌮",
      guessPrice: (c) => {
        const hay = `${c.cuisine ?? ""} ${c.name ?? ""}`.toLowerCase();
        if (/taco bell/.test(hay)) return "~9 €";
        return "~13 €";
      },
      subtitleText: "Taco Bell, taquerías y tex-mex · cercanía a Puerta del Mar.",
      eyebrowText: "Dashboard mexicano",
      reopenLabel: "Reabrir dashboard mexicano",
      rowLabel: "Mexicano",
    },
  };
  // Literal class strings per color so Tailwind v4 can detect them.
  // Keep all classes as full literal strings (no template interpolation).
  const palettes: Record<string, Omit<CategoryTheme, "eyebrowText" | "titleHighlight" | "titleGradient" | "cardBg" | "bgGradient" | "reopenLabel" | "rowLabel">> = {
    amber: {
      glow1: "bg-amber-500/[0.10]", glow2: "bg-amber-500/[0.06]",
      accentText: "text-amber-200/70", borderHover: "hover:text-amber-300",
      liveText: "text-amber-300/80", liveDot: "bg-amber-400",
      borderBtn: "border-amber-900/60 text-amber-200/70 hover:border-amber-500/50 hover:text-amber-300",
      eyebrow: "text-amber-400/80", title: "text-amber-50",
      subtitle: "text-amber-200/80", cardBorder: "border-amber-100/[0.08]",
      countText: "text-amber-50", hint: "text-amber-400/70",
      thText: "text-amber-200/50", rowText: "text-amber-50",
      hoverName: "text-amber-50 hover:text-amber-300", closesText: "text-amber-100/80",
      priceText: "text-amber-50", distText: "text-amber-50", emptyText: "text-amber-200/50",
      reopenCls: "border-amber-400/30 bg-amber-400/5 text-amber-300 hover:bg-amber-400/10",
      priceHeader: "€/pers",
    },
    yellow: {
      glow1: "bg-yellow-500/[0.10]", glow2: "bg-yellow-500/[0.06]",
      accentText: "text-yellow-200/70", borderHover: "hover:text-yellow-300",
      liveText: "text-yellow-300/80", liveDot: "bg-yellow-400",
      borderBtn: "border-yellow-900/60 text-yellow-200/70 hover:border-yellow-500/50 hover:text-yellow-300",
      eyebrow: "text-yellow-400/80", title: "text-yellow-50",
      subtitle: "text-yellow-200/80", cardBorder: "border-yellow-100/[0.08]",
      countText: "text-yellow-50", hint: "text-yellow-400/70",
      thText: "text-yellow-200/50", rowText: "text-yellow-50",
      hoverName: "text-yellow-50 hover:text-yellow-300", closesText: "text-yellow-100/80",
      priceText: "text-yellow-50", distText: "text-yellow-50", emptyText: "text-yellow-200/50",
      reopenCls: "border-yellow-400/30 bg-yellow-400/5 text-yellow-300 hover:bg-yellow-400/10",
      priceHeader: "€/pers",
    },
    lime: {
      glow1: "bg-lime-500/[0.10]", glow2: "bg-lime-500/[0.06]",
      accentText: "text-lime-200/70", borderHover: "hover:text-lime-300",
      liveText: "text-lime-300/80", liveDot: "bg-lime-400",
      borderBtn: "border-lime-900/60 text-lime-200/70 hover:border-lime-500/50 hover:text-lime-300",
      eyebrow: "text-lime-400/80", title: "text-lime-50",
      subtitle: "text-lime-200/80", cardBorder: "border-lime-100/[0.08]",
      countText: "text-lime-50", hint: "text-lime-400/70",
      thText: "text-lime-200/50", rowText: "text-lime-50",
      hoverName: "text-lime-50 hover:text-lime-300", closesText: "text-lime-100/80",
      priceText: "text-lime-50", distText: "text-lime-50", emptyText: "text-lime-200/50",
      reopenCls: "border-lime-400/30 bg-lime-400/5 text-lime-300 hover:bg-lime-400/10",
      priceHeader: "€/pers",
    },
    rose: {
      glow1: "bg-rose-500/[0.10]", glow2: "bg-rose-500/[0.06]",
      accentText: "text-rose-200/70", borderHover: "hover:text-rose-300",
      liveText: "text-rose-300/80", liveDot: "bg-rose-400",
      borderBtn: "border-rose-900/60 text-rose-200/70 hover:border-rose-500/50 hover:text-rose-300",
      eyebrow: "text-rose-400/80", title: "text-rose-50",
      subtitle: "text-rose-200/80", cardBorder: "border-rose-100/[0.08]",
      countText: "text-rose-50", hint: "text-rose-400/70",
      thText: "text-rose-200/50", rowText: "text-rose-50",
      hoverName: "text-rose-50 hover:text-rose-300", closesText: "text-rose-100/80",
      priceText: "text-rose-50", distText: "text-rose-50", emptyText: "text-rose-200/50",
      reopenCls: "border-rose-400/30 bg-rose-400/5 text-rose-300 hover:bg-rose-400/10",
      priceHeader: "€/pers",
    },
    emerald: {
      glow1: "bg-emerald-500/[0.10]", glow2: "bg-emerald-500/[0.06]",
      accentText: "text-emerald-200/70", borderHover: "hover:text-emerald-300",
      liveText: "text-emerald-300/80", liveDot: "bg-emerald-400",
      borderBtn: "border-emerald-900/60 text-emerald-200/70 hover:border-emerald-500/50 hover:text-emerald-300",
      eyebrow: "text-emerald-400/80", title: "text-emerald-50",
      subtitle: "text-emerald-200/80", cardBorder: "border-emerald-100/[0.08]",
      countText: "text-emerald-50", hint: "text-emerald-400/70",
      thText: "text-emerald-200/50", rowText: "text-emerald-50",
      hoverName: "text-emerald-50 hover:text-emerald-300", closesText: "text-emerald-100/80",
      priceText: "text-emerald-50", distText: "text-emerald-50", emptyText: "text-emerald-200/50",
      reopenCls: "border-emerald-400/30 bg-emerald-400/5 text-emerald-300 hover:bg-emerald-400/10",
      priceHeader: "€/pers",
    },
  };
  const out = {} as Record<FastFoodSubKey, (typeof CATEGORY_THEMES)[ExtendedCategory]>;
  (Object.keys(specs) as FastFoodSubKey[]).forEach((k) => {
    const s = specs[k];
    const p = palettes[s.color];
    out[k] = {
      ...p,
      bgGradient: `linear-gradient(180deg, ${s.bg[0]} 0%, ${s.bg[1]} 50%, ${s.bg[2]} 100%)`,
      eyebrowText: s.eyebrowText,
      titleHighlight: s.titleHighlight,
      titleGradient: s.titleGradient,
      cardBg: s.cardBg,
      reopenLabel: s.reopenLabel,
      rowLabel: s.rowLabel,
      emoji: s.emoji,
      guessPrice: s.guessPrice,
      title1: s.title1,
      title2: "en Alicante",
      subtitleText: s.subtitleText,
      eyebrowLabel: s.eyebrowText,
      rowLabelText: s.rowLabel,
      priceHeaderText: "€/pers",
    };
  });
  return out;
}

function CategoryTableInner({
  ranked,
  loading,
  onClose,
  theme,
  originLabel,
}: {
  ranked: { c: PlaceCardData; d: number }[];
  loading: boolean;
  onClose: () => void;
  theme: (typeof CATEGORY_THEMES)[keyof typeof CATEGORY_THEMES];
  originLabel: CategoryTableOriginLabel;
}) {
  const navigate = useNavigate();
  const resolvePlace = useServerFn(resolvePlaceByName);
  const [resolving, setResolving] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    const openCount = ranked.filter(({ c }) => {
      const s = resolveOpeningStatus(c.openingHours ?? undefined);
      return s.status === "open" || (s.status === "unknown" && c.openNow === true);
    }).length;
    // theme.title1 ej.: "Cocina típica", "Comida italiana", "Vegano", "Postres".
    const label = (theme.title1 || "").toLowerCase().trim();
    window.dispatchEvent(
      new CustomEvent("vamos:food-summary", {
        detail: { count: ranked.length, openCount, label, pluralKind: "sitios" },
      }),
    );
  }, [loading, ranked, theme.title1]);

  const openDashboard = async (c: PlaceCardData) => {
    if (c.placeId) {
      markRestaurantReturn();
      navigate({ to: "/restaurants/$placeId", params: { placeId: c.placeId } });
      return;
    }
    if (resolving) return;
    setResolving(c.name);
    try {
      const { placeId } = await resolvePlace({
        data: { name: c.name, lat: c.lat ?? null, lon: c.lon ?? null },
      });
      if (placeId) {
        markRestaurantReturn();
        navigate({ to: "/restaurants/$placeId", params: { placeId } });
      } else {
        const href =
          c.lat && c.lon
            ? `https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lon}&travelmode=walking`
            : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(c.name + " Alicante")}&travelmode=walking`;
        window.open(href, "_blank", "noreferrer");
      }
    } catch (e) {
      console.error("resolvePlaceByName failed", e);
    } finally {
      setResolving(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] overflow-y-auto"
      style={{ background: theme.bgGradient }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className={`absolute -top-40 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full ${theme.glow1} blur-3xl`} />
        <div className={`absolute bottom-0 right-0 h-[24rem] w-[24rem] rounded-full ${theme.glow2} blur-3xl`} />
      </div>

      <div className="relative mx-auto max-w-5xl px-4 pb-10 pt-5 md:px-6">
        <header className="mb-5 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(new Event("comer:back-to-menu"));
              onClose();
            }}
            className={`text-[11px] uppercase tracking-[0.25em] ${theme.accentText} transition ${theme.borderHover}`}
          >
            ← Volver al menú
          </button>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${theme.liveDot} opacity-60`} />
              <span className={`relative inline-flex h-2 w-2 rounded-full ${theme.liveDot}`} />
            </span>
            <span className={`text-[10px] uppercase tracking-[0.25em] ${theme.liveText}`}>
              Live · ALC
            </span>
            <button
              type="button"
              onClick={() => {
                window.dispatchEvent(new Event("comer:back-to-menu"));
                onClose();
              }}
              aria-label="Cerrar"
              className={`ml-2 rounded-full border p-1.5 ${theme.borderBtn}`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="mb-5">
          <p className={`text-[10px] uppercase tracking-[0.3em] ${theme.eyebrow}`}>
            {theme.eyebrowLabel}
          </p>
          <h1 className={`mt-1 font-display text-2xl font-bold tracking-tight ${theme.title} md:text-4xl`}>
            {theme.title1}{" "}
            <span className={`bg-gradient-to-r ${theme.titleGradient} bg-clip-text text-transparent`}>
              {theme.title2}
            </span>
          </h1>
          <p className={`mt-1 text-xs ${theme.subtitle} md:text-sm`}>
            {theme.subtitleText.replace("Puerta del Mar", originLabel)}
          </p>
        </div>

        <div className={`rounded-2xl border ${theme.cardBorder} ${theme.cardBg} p-2 backdrop-blur-xl md:p-4`}>
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <p className={`text-[12px] font-semibold ${theme.countText}`}>
              {loading ? "Cargando…" : `${ranked.length} sitios`}
            </p>
            <p className={`text-[9px] uppercase tracking-[0.18em] ${theme.hint}`}>
              estado · cierre · precio · dist.
            </p>
          </div>

          <table className={`w-full table-fixed border-separate border-spacing-y-0.5 text-left text-[11px] ${theme.rowText}`}>
            <colgroup>
              <col />
              <col className="w-[58px]" />
              <col className="w-[42px]" />
              <col className="w-[46px]" />
              <col className="w-[54px]" />
            </colgroup>
            <thead>
              <tr className={`text-[9px] uppercase tracking-[0.12em] ${theme.thText}`}>
                <th className="px-1 py-1 font-medium">{theme.rowLabelText}</th>
                <th className="px-1 py-1 font-medium">Estado</th>
                <th className="px-1 py-1 font-medium">Cierra</th>
                <th className="px-1 py-1 text-right font-medium">{theme.priceHeaderText}</th>
                <th className="px-1 py-1 text-right font-medium">Dist.</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map(({ c, d }, i) => {
                const status = resolveOpeningStatus(c.openingHours ?? undefined);
                const closesAt =
                  (status.status === "open" ? status.closesAt : null) ??
                  getTodayClosingTime(c.openingHours ?? undefined) ??
                  c.closesAt ??
                  null;
                const isOpen =
                  status.status === "open" ||
                  (status.status === "unknown" && c.openNow === true);
                const isClosed =
                  status.status === "closed" ||
                  (status.status === "unknown" && c.openNow === false);
                const price = priceLabel(c.priceLevel);
                const priceFromRange =
                  c.priceRangeMin && c.priceRangeMax
                    ? `${c.priceRangeMin}–${c.priceRangeMax} €`
                    : c.priceRangeMin
                      ? `~${c.priceRangeMin} €`
                      : null;
                const priceAvg =
                  priceFromRange ??
                  (price.avg !== "s/d" ? price.avg : theme.guessPrice(c));
                const priceShort = priceAvg.replace(/[~\s€]/g, "").replace("–", "-") + "€";
                const meters = Number.isFinite(d) ? Math.round(d * 1000) : null;
                const distLabel =
                  meters == null
                    ? "—"
                    : meters >= 1000
                      ? `${(meters / 1000).toFixed(1)}km`
                      : `${meters}m`;

                const nameNode = (
                  <span className={`flex items-center gap-1 ${theme.hoverName}`}>
                    <span className="text-[13px] leading-none">{theme.emoji(c)}</span>
                    <span className="min-w-0 truncate text-[11px] font-medium">
                      {c.name}
                    </span>
                  </span>
                );
                return (
                  <tr key={i} className="bg-white/[0.02]">
                    <td className="rounded-l-md px-1.5 py-1 align-middle">
                      {c.placeId ? (
                        <Link
                          to="/restaurants/$placeId"
                          params={{ placeId: c.placeId }}
                          onClick={markRestaurantReturn}
                          className="block"
                        >
                          {nameNode}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openDashboard(c)}
                          disabled={resolving === c.name}
                          className="block w-full text-left disabled:opacity-60"
                        >
                          {nameNode}
                        </button>
                      )}
                    </td>
                    <td className="px-1 py-1 align-middle">
                      {isOpen ? (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/15 px-1 py-0.5 text-[9px] font-semibold text-emerald-300">
                          ● Abre
                        </span>
                      ) : isClosed ? (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-rose-500/15 px-1 py-0.5 text-[9px] font-semibold text-rose-300">
                          ● Cerr
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-slate-500/15 px-1 py-0.5 text-[9px] font-semibold text-slate-400">
                          s/d
                        </span>
                      )}
                    </td>
                    <td className={`px-1 py-1 text-center align-middle font-mono text-[10px] ${theme.closesText}`}>
                      {closesAt ?? "—"}
                    </td>
                    <td className={`px-1 py-1 text-right align-middle font-mono text-[10px] ${theme.priceText}`}>
                      {priceShort}
                    </td>
                    <td className={`rounded-r-md px-1 py-1 text-right align-middle font-mono text-[11px] font-semibold tabular-nums ${theme.distText}`}>
                      {distLabel}
                    </td>
                  </tr>
                );
              })}
              {!loading && ranked.length === 0 && (
                <tr>
                  <td colSpan={5} className={`px-2 py-4 text-center text-xs ${theme.emptyText}`}>
                    Sin datos disponibles.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const DISCOVERABLE = new Set(["typical", "rice_fish", "italian", "brunch", "pizzas", "asian", "drinks"]);

function CategoryTable({
  cards,
  category,
  fetcher,
}: {
  cards: PlaceCardData[];
  category: ExtendedCategory;
  fetcher: () => Promise<{ places: Array<{ google_place_id: string; name: string; cuisine: string | null; address: string | null; opening_hours_text: string | null; lat: number | null; lng: number | null; price_level: string | null; price_range_min: number | null; price_range_max: number | null; rating: number | null; open_now: boolean | null }> }>;
}) {
  const [extra, setExtra] = useState<PlaceCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const theme = CATEGORY_THEMES[category];
  const { locState, origin, originLabel } = useFoodListOrigin();

  useEffect(() => {
    let cancelled = false;
    fetcher()
      .then((res) => {
        if (cancelled) return;
        const mapped: PlaceCardData[] = (res.places ?? []).map((p) => ({
          placeId: p.google_place_id,
          name: p.name,
          cuisine: p.cuisine,
          address: p.address,
          openingHours: p.opening_hours_text,
          lat: p.lat ?? undefined,
          lon: p.lng ?? undefined,
          priceLevel: p.price_level,
          priceRangeMin: p.price_range_min,
          priceRangeMax: p.price_range_max,
          rating: p.rating,
          openNow: p.open_now,
        }));
        setExtra(mapped);
      })
      .catch((e) => console.error(`get ${category} places failed`, e))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fetcher, category, reloadKey]);
  // Only the 7 google-backed categories trigger nearby discovery; virtual AI
  // tag-based categories reuse what's already in the cache.
  const discoverableCategory = DISCOVERABLE.has(category)
    ? (category as "typical" | "rice_fish" | "italian" | "brunch" | "pizzas" | "asian" | "drinks")
    : null;
  useNearbyDiscovery(
    discoverableCategory ?? "typical",
    origin,
    discoverableCategory != null && locState.status === "ready",
    () => setReloadKey((k) => k + 1),
  );

  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const byKey = new Map<string, PlaceCardData>();
  for (const c of cards) byKey.set(norm(c.name), c);
  for (const c of extra) {
    const k = norm(c.name);
    if (!byKey.has(k)) byKey.set(k, c);
    else {
      const prev = byKey.get(k)!;
      byKey.set(k, { ...prev, openingHours: prev.openingHours ?? c.openingHours, lat: prev.lat ?? c.lat, lon: prev.lon ?? c.lon });
    }
  }
  const isInternational = category === "international";
  let ranked = Array.from(byKey.values())
    .map((c) => ({
      c,
      d: c.lat && c.lon ? distKm(origin, { lat: c.lat, lon: c.lon }) : Number.POSITIVE_INFINITY,
    }))
    .filter((r) => (isInternational ? true : r.d <= 10))
    .filter((r) => {
      if (category !== "brunch") return true;
      const open = getTodayOpeningTime(r.c.openingHours ?? undefined);
      if (!open) return true;
      const [h, m] = open.split(":").map(Number);
      return h * 60 + m <= 11 * 60;
    })
    .sort((a, b) => {
      const sa = openStatusRank(a.c.openingHours);
      const sb = openStatusRank(b.c.openingHours);
      if (sa !== sb) return sa - sb;
      return a.d - b.d;
    });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`my-2 w-full rounded-2xl border px-4 py-3 text-[12px] font-semibold uppercase tracking-[0.18em] transition ${theme.reopenCls}`}
      >
        {theme.reopenLabel} ({ranked.length})
      </button>
    );
  }

  return <CategoryTableInner ranked={ranked} loading={loading} onClose={() => setOpen(false)} theme={theme} originLabel={originLabel} />;
}

function TypicalTable({ cards }: { cards: PlaceCardData[] }) {
  const fetcher = useServerFn(getTypicalPlaces);
  return <CategoryTable cards={cards} category="typical" fetcher={fetcher} />;
}
function RiceFishTable({ cards }: { cards: PlaceCardData[] }) {
  const fetcher = useServerFn(getRiceFishPlaces);
  return <CategoryTable cards={cards} category="rice_fish" fetcher={fetcher} />;
}
function ItalianTable({ cards }: { cards: PlaceCardData[] }) {
  const fetcher = useServerFn(getItalianPlaces);
  return <CategoryTable cards={cards} category="italian" fetcher={fetcher} />;
}
function BrunchTable({ cards }: { cards: PlaceCardData[] }) {
  const fetcher = useServerFn(getBrunchPlaces);
  return <CategoryTable cards={cards} category="brunch" fetcher={fetcher} />;
}
function PizzasTable({ cards }: { cards: PlaceCardData[] }) {
  const fetcher = useServerFn(getPizzasPlaces);
  return <CategoryTable cards={cards} category="pizzas" fetcher={fetcher} />;
}
function useTagFetcher(tag: string) {
  const fn = useServerFn(getPlacesByTag);
  return () => fn({ data: { tag } });
}
function FastFoodTable({ cards }: { cards: PlaceCardData[] }) {
  const fetcher = useTagFetcher("fast_food");
  return <CategoryTable cards={cards} category="fast_food" fetcher={fetcher} />;
}
function useFastFoodSubFetcher(pattern: RegExp) {
  const fn = useServerFn(getPlacesByTag);
  return async () => {
    const res = await fn({ data: { tag: "fast_food" } });
    const places = (res.places ?? []).filter((p) =>
      pattern.test(`${p.name ?? ""} ${p.cuisine ?? ""}`.toLowerCase()),
    );
    return { places };
  };
}
function BurgersTable({ cards }: { cards: PlaceCardData[] }) {
  const fetcher = useFastFoodSubFetcher(/burger|hamburgu|goiko|five guys|tgb|mcdonald|burger king|smash/i);
  return <CategoryTable cards={cards} category="burgers" fetcher={fetcher} />;
}
function MontaditosTable({ cards }: { cards: PlaceCardData[] }) {
  const fetcher = useFastFoodSubFetcher(/montadit|lizarr|100 mont/i);
  return <CategoryTable cards={cards} category="montaditos" fetcher={fetcher} />;
}
function KebabTable({ cards }: { cards: PlaceCardData[] }) {
  const fetcher = useFastFoodSubFetcher(/kebab|kebap|d[oö]ner|shawarma/i);
  return <CategoryTable cards={cards} category="kebab" fetcher={fetcher} />;
}
function FriedChickenTable({ cards }: { cards: PlaceCardData[] }) {
  const fetcher = useFastFoodSubFetcher(/kfc|popeyes|pollo frito|pollos asados|poller/i);
  return <CategoryTable cards={cards} category="fried_chicken" fetcher={fetcher} />;
}
function MexicanTable({ cards }: { cards: PlaceCardData[] }) {
  const fetcher = useFastFoodSubFetcher(/taco|burrito|mexic|tex.?mex|taquer/i);
  return <CategoryTable cards={cards} category="mexican" fetcher={fetcher} />;
}
function VeganTable({ cards }: { cards: PlaceCardData[] }) {
  const fetcher = useTagFetcher("vegan");
  return <CategoryTable cards={cards} category="vegan" fetcher={fetcher} />;
}
function DessertsTable({ cards }: { cards: PlaceCardData[] }) {
  const fetcher = useTagFetcher("desserts");
  return <CategoryTable cards={cards} category="desserts" fetcher={fetcher} />;
}
function CheapTable({ cards }: { cards: PlaceCardData[] }) {
  const fetcher = useTagFetcher("cheap");
  return <CategoryTable cards={cards} category="cheap" fetcher={fetcher} />;
}
function InternationalTable({ cards }: { cards: PlaceCardData[] }) {
  const fetcher = useServerFn(getInternationalPlaces);
  return <CategoryTable cards={cards} category="international" fetcher={fetcher} />;
}

function AssistantContent({ content, userPrompt = "" }: { content: string; userPrompt?: string }) {

  const match = content.match(PLACE_RE);
  const placeName = match?.[1]?.trim();
  const cleaned = content.replace(/\n?\[\[place:[^\]]+\]\]\n?/i, "").trim();

  if (isBeachGuidePrompt(userPrompt) || (BEACH_GUIDE_RE.test(userPrompt) && BEACH_GUIDE_RE.test(cleaned))) {
    return <BeachScrollGallery />;
  }

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

  const cardData = renderedParts
    .filter((p): p is Extract<AssistantPart, { type: "card" }> => p.type === "card")
    .map((p) => p.data);
  // Intención del usuario (prompt) — tiene prioridad sobre lo que diga la IA en la respuesta
  const pTypical = TYPICAL_RE.test(userPrompt);
  const pRiceFish = RICE_FISH_RE.test(userPrompt);
  const pItalian = ITALIAN_RE.test(userPrompt);
  const pPizzas = PIZZAS_RE.test(userPrompt);
  const pBrunch = BRUNCH_RE.test(userPrompt);
  const pAsian = ASIAN_RE.test(userPrompt);
  const pDrinks = DRINKS_RE.test(userPrompt);
  const pFastFood = FAST_FOOD_RE.test(userPrompt);
  const pBurgers = BURGERS_RE.test(userPrompt);
  const pMontaditos = MONTADITOS_RE.test(userPrompt);
  const pKebab = KEBAB_RE.test(userPrompt);
  const pFriedChicken = FRIED_CHICKEN_RE.test(userPrompt);
  const pMexican = MEXICAN_RE.test(userPrompt);
  const pVegan = VEGAN_RE.test(userPrompt);
  const pDesserts = DESSERTS_RE.test(userPrompt);
  const pCheap = CHEAP_RE.test(userPrompt);
  const pInternational = INTERNATIONAL_RE.test(userPrompt);
  const promptLocked =
    pTypical || pRiceFish || pItalian || pPizzas || pBrunch || pAsian || pDrinks ||
    pFastFood || pBurgers || pMontaditos || pKebab || pFriedChicken || pMexican ||
    pVegan || pDesserts || pCheap || pInternational;

  // Si el prompt ya fijó intención, ignoramos las pistas de la respuesta de la IA
  const textHasAsian = pAsian || (!promptLocked && ASIAN_RE.test(cleaned));
  const textHasDrinks = pDrinks || (!promptLocked && DRINKS_RE.test(cleaned));
  const textHasTypical = pTypical || (!promptLocked && TYPICAL_RE.test(cleaned));
  const textHasRiceFish = pRiceFish || (!promptLocked && RICE_FISH_RE.test(cleaned));
  const textHasItalian = pItalian || (!promptLocked && ITALIAN_RE.test(cleaned));
  const textHasPizzas = pPizzas || (!promptLocked && PIZZAS_RE.test(cleaned));
  const textHasBrunch = pBrunch || (!promptLocked && BRUNCH_RE.test(cleaned));
  const textHasFastFood = pFastFood || (!promptLocked && FAST_FOOD_RE.test(cleaned));
  const textHasBurgers = pBurgers;
  const textHasMontaditos = pMontaditos;
  const textHasKebab = pKebab;
  const textHasFriedChicken = pFriedChicken;
  const textHasMexican = pMexican;
  const textHasVegan = pVegan || (!promptLocked && VEGAN_RE.test(cleaned));
  const textHasDesserts = pDesserts || (!promptLocked && DESSERTS_RE.test(cleaned));
  const textHasCheap = pCheap || (!promptLocked && CHEAP_RE.test(cleaned));
  const textHasInternational = pInternational || (!promptLocked && INTERNATIONAL_RE.test(cleaned));
  const asianMode =
    textHasAsian ||
    (cardData.length >= 2 && cardData.every((c) => isAsianCard(c)));
  const drinksMode =
    !asianMode &&
    (textHasDrinks ||
      (cardData.length >= 2 && cardData.every((c) => isDrinksCard(c))));
  const internationalMode = !asianMode && !drinksMode && textHasInternational;
  // Subcategorías de comida rápida — se evalúan ANTES que fast_food para abrir su propio dashboard
  const burgersMode = !asianMode && !drinksMode && !internationalMode && textHasBurgers;
  const montaditosMode = !asianMode && !drinksMode && !internationalMode && !burgersMode && textHasMontaditos;
  const kebabMode = !asianMode && !drinksMode && !internationalMode && !burgersMode && !montaditosMode && textHasKebab;
  const friedChickenMode = !asianMode && !drinksMode && !internationalMode && !burgersMode && !montaditosMode && !kebabMode && textHasFriedChicken;
  const mexicanMode = !asianMode && !drinksMode && !internationalMode && !burgersMode && !montaditosMode && !kebabMode && !friedChickenMode && textHasMexican;
  const anySubFastFood = burgersMode || montaditosMode || kebabMode || friedChickenMode || mexicanMode;
  const fastFoodMode = !asianMode && !drinksMode && !internationalMode && !anySubFastFood && textHasFastFood;
  const veganMode = !asianMode && !drinksMode && !internationalMode && !fastFoodMode && !anySubFastFood && textHasVegan;
  const dessertsMode = !asianMode && !drinksMode && !internationalMode && !fastFoodMode && !anySubFastFood && !veganMode && textHasDesserts;
  const cheapMode = !asianMode && !drinksMode && !internationalMode && !fastFoodMode && !anySubFastFood && !veganMode && !dessertsMode && textHasCheap;
  const pizzasMode = !asianMode && !drinksMode && !internationalMode && !fastFoodMode && !anySubFastFood && !veganMode && !dessertsMode && !cheapMode && textHasPizzas;
  const italianMode = !asianMode && !drinksMode && !internationalMode && !fastFoodMode && !anySubFastFood && !veganMode && !dessertsMode && !cheapMode && !pizzasMode && textHasItalian;
  const riceFishMode = !asianMode && !drinksMode && !internationalMode && !fastFoodMode && !anySubFastFood && !veganMode && !dessertsMode && !cheapMode && !pizzasMode && !italianMode && textHasRiceFish;
  const brunchMode = !asianMode && !drinksMode && !internationalMode && !fastFoodMode && !anySubFastFood && !veganMode && !dessertsMode && !cheapMode && !pizzasMode && !italianMode && !riceFishMode && textHasBrunch;
  const typicalMode = !asianMode && !drinksMode && !internationalMode && !fastFoodMode && !anySubFastFood && !veganMode && !dessertsMode && !cheapMode && !pizzasMode && !italianMode && !riceFishMode && !brunchMode && textHasTypical;
  let tableInjected = false;

  const renderCategoryTable = (key: number, cd: PlaceCardData[]) => {
    if (asianMode) return <AsianTable key={key} cards={cd} />;
    if (drinksMode) return <DrinksTable key={key} cards={cd} />;
    if (internationalMode) return <InternationalTable key={key} cards={cd} />;
    if (burgersMode) return <BurgersTable key={key} cards={cd} />;
    if (montaditosMode) return <MontaditosTable key={key} cards={cd} />;
    if (kebabMode) return <KebabTable key={key} cards={cd} />;
    if (friedChickenMode) return <FriedChickenTable key={key} cards={cd} />;
    if (mexicanMode) return <MexicanTable key={key} cards={cd} />;
    if (fastFoodMode) return <FastFoodTable key={key} cards={cd} />;
    if (veganMode) return <VeganTable key={key} cards={cd} />;
    if (dessertsMode) return <DessertsTable key={key} cards={cd} />;
    if (cheapMode) return <CheapTable key={key} cards={cd} />;
    if (pizzasMode) return <PizzasTable key={key} cards={cd} />;
    if (italianMode) return <ItalianTable key={key} cards={cd} />;
    if (riceFishMode) return <RiceFishTable key={key} cards={cd} />;
    if (brunchMode) return <BrunchTable key={key} cards={cd} />;
    if (typicalMode) return <TypicalTable key={key} cards={cd} />;
    return null;
  };
  const anyCategoryMode = asianMode || drinksMode || internationalMode || fastFoodMode || anySubFastFood || veganMode || dessertsMode || cheapMode || pizzasMode || italianMode || riceFishMode || brunchMode || typicalMode;

  return (
    <div className="space-y-2 [&>p]:m-0 [&_strong]:font-semibold">
      {placeName && <PlaceImage name={placeName} />}
      {anyCategoryMode && cardData.length === 0 && renderCategoryTable(-1, [])}
      {renderedParts.map((p, i) => {
        if (p.type === "card") {
          if (anyCategoryMode) {
            if (tableInjected) return null;
            tableInjected = true;
            return renderCategoryTable(i, cardData);
          }
          return <PlaceCard key={i} data={p.data} />;
        }
        if (p.type === "busopt") return <BusOptionCard key={i} data={p.data} />;
        if (p.type === "busstop") return <BusStopCard key={i} data={p.data} />;
        return <MarkdownText key={i} text={p.value.replace(/^\n+|\n+$/g, "")} />;
      })}
    </div>
  );
}

