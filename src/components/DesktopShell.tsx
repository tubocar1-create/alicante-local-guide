import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home,
  Waves,
  PartyPopper,
  Sparkles,
  BedDouble,
  ShoppingBag,
  TramFront,
  Plane,
  CloudSun,
  Map as MapIcon,
  User,
  MessageSquare,
  Utensils,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import vamosAlicanteLogo from "@/assets/vamos-alicante-logo.png";

/**
 * DesktopShell — Solo afecta a pantallas ≥ lg (1024px).
 * En móvil/PWA renderiza children sin tocar nada.
 *
 * No se aplica en rutas full-bleed (admin, business, auth, mapas, api).
 */

type NavItem = {
  to: string;
  label: string;
  icon: typeof Home;
  exact?: boolean;
  /** Activa el item solo cuando ?type=<match>. "none" = solo si NO hay ?type=L. */
  typeMatch?: "L" | "none";
};

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Inicio", icon: Home, exact: true },
  { to: "/restaurants", label: "Comer", icon: Utensils },
  { to: "/donde-dormir", label: "Dormir", icon: BedDouble },
  { to: "/playas", label: "Playas", icon: Waves },
  { to: "/comprar", label: "Comprar", icon: ShoppingBag },
  { to: "/ocio", label: "Ocio", icon: Sparkles },
  { to: "/fiestas", label: "Fiestas", icon: PartyPopper },
  { to: "/tram", label: "Tram", icon: TramFront },
  { to: "/vuelos", label: "Vuelos de salida", icon: Plane, typeMatch: "none" },
  { to: "/vuelos?type=L", label: "Vuelos de llegada", icon: Plane, typeMatch: "L" },
  { to: "/clima", label: "Clima", icon: CloudSun },
  { to: "/explore", label: "Explorar mapa", icon: MapIcon },
  { to: "/threads", label: "Mensajes", icon: MessageSquare },
  { to: "/perfil", label: "Perfil", icon: User },
];

const EXCLUDED_PREFIXES = [
  "/admin",
  "/business",
  "/auth",
  "/api",
  "/playas/mapa",
  "/tram/mapa",
  "/explore",
  "/bus/dashboard",
];

function isExcluded(pathname: string) {
  return EXCLUDED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p));
}

type PastelTheme = {
  bg: string;
  bgSoft: string;
  border: string;
  hover: string;
};

/**
 * Devuelve la paleta pastel del sidebar acorde al tema de cada página.
 * Solo afecta el menú izquierdo en desktop.
 */
function getPastelTheme(pathname: string): PastelTheme {
  // /ocio → rosa (acento #f472b6)
  if (pathname.startsWith("/ocio") || pathname.startsWith("/restaurants") || pathname.startsWith("/bares"))
    return {
      bg: "oklch(0.96 0.035 350)",
      bgSoft: "oklch(0.97 0.025 350)",
      border: "oklch(0.88 0.05 350)",
      hover: "oklch(0.92 0.06 350)",
    };
  // /fiestas → naranja/coral
  if (pathname.startsWith("/fiestas"))
    return {
      bg: "oklch(0.96 0.04 50)",
      bgSoft: "oklch(0.97 0.03 50)",
      border: "oklch(0.88 0.06 50)",
      hover: "oklch(0.92 0.07 50)",
    };
  // /donde-dormir, /hotel, /stay → azul navy pastel
  if (pathname.startsWith("/donde-dormir") || pathname.startsWith("/hotel") || pathname.startsWith("/stay"))
    return {
      bg: "oklch(0.95 0.03 245)",
      bgSoft: "oklch(0.97 0.02 245)",
      border: "oklch(0.86 0.05 245)",
      hover: "oklch(0.91 0.06 245)",
    };
  // /comprar → ámbar
  if (pathname.startsWith("/comprar"))
    return {
      bg: "oklch(0.96 0.04 80)",
      bgSoft: "oklch(0.97 0.03 80)",
      border: "oklch(0.88 0.06 80)",
      hover: "oklch(0.92 0.07 80)",
    };
  // /bus, /tram → slate/azul frío
  if (pathname.startsWith("/bus") || pathname.startsWith("/tram"))
    return {
      bg: "oklch(0.95 0.02 230)",
      bgSoft: "oklch(0.97 0.015 230)",
      border: "oklch(0.86 0.03 230)",
      hover: "oklch(0.91 0.04 230)",
    };
  // /vuelos, /clima → cielo
  if (pathname.startsWith("/vuelos") || pathname.startsWith("/clima"))
    return {
      bg: "oklch(0.95 0.035 220)",
      bgSoft: "oklch(0.97 0.025 220)",
      border: "oklch(0.86 0.05 220)",
      hover: "oklch(0.91 0.06 220)",
    };
  // /salud, /hospitales, /farmacias → verde menta/teal
  if (pathname.startsWith("/salud") || pathname.startsWith("/hospitales") || pathname.startsWith("/farmacias") || pathname.startsWith("/sistema-sanitario"))
    return {
      bg: "oklch(0.95 0.035 170)",
      bgSoft: "oklch(0.97 0.025 170)",
      border: "oklch(0.86 0.05 170)",
      hover: "oklch(0.91 0.06 170)",
    };
  // /playas → turquesa
  if (pathname.startsWith("/playas"))
    return {
      bg: "oklch(0.95 0.035 200)",
      bgSoft: "oklch(0.97 0.025 200)",
      border: "oklch(0.86 0.05 200)",
      hover: "oklch(0.91 0.06 200)",
    };
  // /threads, /perfil → lavanda neutra
  if (pathname.startsWith("/threads") || pathname.startsWith("/perfil"))
    return {
      bg: "oklch(0.95 0.03 290)",
      bgSoft: "oklch(0.97 0.02 290)",
      border: "oklch(0.86 0.05 290)",
      hover: "oklch(0.91 0.06 290)",
    };
  // default (home/index) → amarillo fuerte / ocre cálido
  return {
    bg: "oklch(0.88 0.13 85)",
    bgSoft: "oklch(0.92 0.10 82)",
    border: "oklch(0.74 0.14 75)",
    hover: "oklch(0.83 0.15 80)",
  };

}

export function DesktopShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const search = useRouterState({ select: (s) => s.location.search as Record<string, unknown> });
  const currentType = typeof search?.type === "string" ? (search.type as string) : "";

  if (isExcluded(pathname)) {
    return <>{children}</>;
  }

  const theme = getPastelTheme(pathname);

  return (
    <div
      className="min-h-[100dvh] w-full lg:flex lg:h-[100dvh]"
      style={{
        // El fondo general en desktop sigue el mismo tono pastel suave
        ["--ds-bg" as string]: theme.bg,
      }}
    >
      <div
        className="hidden lg:block lg:fixed lg:inset-0 lg:-z-10"
        style={{
          background: `linear-gradient(135deg, ${theme.bg} 0%, ${theme.bgSoft} 60%, ${theme.bg} 100%)`,
        }}
      />
      {/* Sidebar: solo desktop */}
      <aside
        className="hidden lg:flex lg:fixed lg:inset-y-0 lg:left-0 lg:w-64 lg:flex-col lg:border-r lg:backdrop-blur-xl lg:z-30"
        style={{
          backgroundColor: theme.bg,
          borderRightColor: theme.border,
        }}
      >
        <div className="px-4 pt-3 pb-2 flex flex-col items-center">
          <Link to="/" className="block w-full">
            <img
              src={vamosAlicanteLogo}
              alt="Vamos Alicante"
              className="w-full h-auto object-contain mix-blend-multiply"
            />
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 pb-2">
          <ul className="space-y-0.5">
            {NAV_ITEMS.map(({ to, label, icon: Icon, exact, typeMatch }) => {
              const basePath = to.split("?")[0];
              const pathActive = exact
                ? pathname === basePath
                : pathname === basePath || pathname.startsWith(basePath + "/");
              let active = pathActive;
              if (pathActive && typeMatch) {
                if (typeMatch === "L") active = currentType === "L";
                else if (typeMatch === "none") active = currentType !== "L";
              }
              return (
                <li key={to}>
                  <Link
                    to={basePath as string}
                    search={typeMatch === "L" ? ({ type: "L" } as Record<string, string>) : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                      "text-foreground/85 hover:text-foreground",
                    )}
                    style={active ? { backgroundColor: theme.hover } : undefined}
                    onMouseEnter={(e) => {
                      if (!active) e.currentTarget.style.backgroundColor = theme.hover;
                    }}
                    onMouseLeave={(e) => {
                      if (!active) e.currentTarget.style.backgroundColor = "";
                    }}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{label}</span>
                  </Link>
                </li>
              );
            })}
            <li>
              <button
                type="button"
                onClick={async () => {
                  await supabase.auth.signOut();
                  window.location.href = "/";
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-foreground/85 hover:text-foreground transition-colors"
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = theme.hover;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "";
                }}
              >
                <LogOut className="h-4 w-4 shrink-0" />
                <span className="truncate">Salir</span>
              </button>
            </li>
          </ul>
        </nav>

        <div
          className="border-t px-4 py-2 text-[10px] text-muted-foreground text-center"
          style={{ borderTopColor: theme.border }}
        >
          © {new Date().getFullYear()} Vamos Alicante
        </div>
      </aside>

      {/* Contenido principal */}
      <main className="w-full lg:ml-64 lg:flex-1 lg:h-[100dvh] lg:overflow-y-auto lg:overscroll-contain">
        <div className="mx-auto w-full lg:max-w-6xl lg:px-8 lg:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
