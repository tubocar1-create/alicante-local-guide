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
} from "lucide-react";
import { cn } from "@/lib/utils";

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
};

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Inicio", icon: Home, exact: true },
  { to: "/playas", label: "Playas", icon: Waves },
  { to: "/ocio", label: "Ocio", icon: Sparkles },
  { to: "/fiestas", label: "Fiestas", icon: PartyPopper },
  { to: "/donde-dormir", label: "Dónde dormir", icon: BedDouble },
  { to: "/comprar", label: "Comprar", icon: ShoppingBag },
  { to: "/tram", label: "Tram", icon: TramFront },
  { to: "/vuelos", label: "Vuelos", icon: Plane },
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

export function DesktopShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (isExcluded(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-[100dvh] w-full lg:flex lg:h-[100dvh] lg:bg-gradient-to-br lg:from-[oklch(0.96_0.04_75)] lg:via-[oklch(0.97_0.025_60)] lg:to-[oklch(0.95_0.05_50)]">
      {/* Sidebar: solo desktop */}
      <aside className="hidden lg:flex lg:fixed lg:inset-y-0 lg:left-0 lg:w-64 lg:flex-col lg:border-r lg:border-[oklch(0.88_0.04_60)] lg:bg-[oklch(0.96_0.035_70)]/85 lg:backdrop-blur-xl lg:z-30">
        <div className="px-6 pt-6 pb-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="font-display text-2xl font-bold tracking-tight text-primary">
              Vamos
            </span>
            <span className="font-display text-2xl font-semibold text-foreground/80">
              Alicante
            </span>
          </Link>
          <p className="mt-1 text-xs text-muted-foreground">
            Tu amigo local en Alicante
          </p>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-6">
          <ul className="space-y-1">
            {NAV_ITEMS.map(({ to, label, icon: Icon, exact }) => {
              const active = exact
                ? pathname === to
                : pathname === to || pathname.startsWith(to + "/");
              return (
                <li key={to}>
                  <Link
                    to={to as string}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-foreground/75 hover:bg-[oklch(0.92_0.05_70)] hover:text-foreground",
                    )}
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" />
                    <span className="truncate">{label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-[oklch(0.88_0.04_60)] px-6 py-4 text-[11px] text-muted-foreground">
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
