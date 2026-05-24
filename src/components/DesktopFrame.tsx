// Marco "desktop" — solo visible en ≥ md. En móvil/PWA no se monta nada.
// No envuelve el contenido: se superpone como dos paneles laterales que
// enmascaran lo que hay fuera de la columna central de ~420px y añaden
// branding + navegación lateral. Así no rompemos los layouts internos que
// usan 100dvh.
import { Link, useRouterState } from "@tanstack/react-router";
import portada from "@/assets/alicante-portada.jpg";
import { Bus, Waves, Calendar, Hotel, Sparkles, Film } from "lucide-react";

const SECTIONS = [
  { to: "/bus", label: "Bus urbano", icon: Bus },
  { to: "/playas", label: "Playas", icon: Waves },
  { to: "/fiestas", label: "Fiestas", icon: Calendar },
  { to: "/donde-dormir", label: "Dónde dormir", icon: Hotel },
  { to: "/ocio", label: "Ocio", icon: Film },
] as const;

export function DesktopFrame() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // No aplicar en zonas que tienen su propio layout completo
  if (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/business") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/api")
  ) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className="hidden md:block fixed inset-0 z-40 pointer-events-none"
    >
      {/* Panel izquierdo: fondo + branding (NO cubre el centro) */}
      <div
        className="absolute inset-y-0 left-0 overflow-hidden"
        style={{ right: "calc(50% + 220px)" }}
      >
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${portada})` }}
        />
        <div className="absolute inset-0 bg-background/75 backdrop-blur-2xl" />
      </div>
      {/* Panel derecho: fondo (NO cubre el centro) */}
      <div
        className="absolute inset-y-0 right-0 overflow-hidden"
        style={{ left: "calc(50% + 220px)" }}
      >
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${portada})` }}
        />
        <div className="absolute inset-0 bg-background/75 backdrop-blur-2xl" />
      </div>


      {/* Panel izquierdo: branding */}
      <aside
        className="absolute inset-y-0 left-0 flex flex-col justify-between p-10 lg:p-14 pointer-events-auto"
        style={{ right: "calc(50% + 210px)" }}
      >
        <div>
          <Link
            to="/"
            className="inline-flex items-center gap-2 group"
          >
            <span
              className="text-3xl lg:text-4xl font-bold tracking-tight"
              style={{ fontFamily: "'Fraunces', serif" }}
            >
              Vamos
              <span className="text-primary">Alicante</span>
            </span>
          </Link>
          <p className="mt-4 text-sm lg:text-base text-muted-foreground max-w-xs leading-relaxed">
            Tu guía local con IA. Pregunta lo que quieras hacer en Alicante y
            te llevamos directo: bus, playa, restaurantes, fiestas, ocio.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-xs text-primary font-medium">
            <Sparkles className="h-3.5 w-3.5" />
            Sin spam, sin trampas turísticas
          </div>
        </div>

        <div className="text-[11px] text-muted-foreground/80 space-y-1">
          <p>vamosalicante.com</p>
          <p>
            <Link to="/legal/privacidad" className="hover:underline">
              Privacidad
            </Link>
            {" · "}
            <Link to="/legal/terminos" className="hover:underline">
              Términos
            </Link>
          </p>
        </div>
      </aside>

      {/* Panel derecho: navegación rápida */}
      <aside
        className="absolute inset-y-0 right-0 flex flex-col justify-center gap-2 p-10 lg:p-14 pointer-events-auto"
        style={{ left: "calc(50% + 210px)" }}
      >
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70 mb-2">
          Atajos
        </p>
        {SECTIONS.map((s) => (
          <Link
            key={s.to}
            to={s.to}
            className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-foreground/80 hover:bg-card hover:text-foreground hover:shadow-sm transition-all"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-card/60 text-primary group-hover:bg-primary/10">
              <s.icon className="h-4 w-4" />
            </span>
            <span className="font-medium">{s.label}</span>
          </Link>
        ))}
      </aside>

      {/* Borde "device" alrededor de la columna central */}
      <div
        className="absolute top-4 bottom-4 left-1/2 -translate-x-1/2 w-[420px] rounded-[2.25rem] ring-1 ring-border/60 shadow-2xl shadow-black/20"
        style={{
          boxShadow:
            "0 30px 60px -20px rgba(0,0,0,0.35), 0 0 0 8px rgba(0,0,0,0.04)",
        }}
      />
    </div>
  );
}
