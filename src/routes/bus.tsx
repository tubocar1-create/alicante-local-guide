import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  X,
  Clock,
  ExternalLink,
  QrCode,
  AlertCircle,
  Smartphone,
  ChevronRight,
  Route as RouteIcon,
  Euro,
  Moon,
  Building2,
  MapPinned,
} from "lucide-react";
import { useBusGraph } from "@/hooks/useBusGraph";
import { classifyLine } from "@/components/BusKnownPicker";

export const Route = createFileRoute("/bus")({
  head: () => ({
    meta: [
      { title: "Bus Urbano Alicante — Líneas, horarios y paradas" },
      {
        name: "description",
        content:
          "Información del bus urbano de Alicante (Subus / Vectalia): líneas principales, horarios, tarifas y buscador de paradas.",
      },
      { property: "og:title", content: "Bus Urbano Alicante" },
      {
        property: "og:description",
        content:
          "Líneas, horarios y paradas del bus urbano de Alicante.",
      },
      { property: "og:url", content: "https://vamosalicante.com/bus" },
    ],
    links: [
      { rel: "canonical", href: "https://vamosalicante.com/bus" },
    ],
  }),
  component: BusRouteShell,
});

function BusRouteShell() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();

  if (pathname !== "/bus") return <Outlet />;

  return (
    <BusKnownPicker
      onClose={() => navigate({ to: "/" })}
      onUnknown={() => navigate({ to: "/transporte" })}
      onSelected={(pick) => {
        navigate({
          to: "/transporte/parada-favorita",
          search: { stop: pick.stopCode, line: pick.line },
        });
      }}
    />
  );
}

// Líneas reales se obtienen desde la base de datos vía useBusGraph().
// Se clasifican como urbanas / extraurbanas (TAM) / nocturnas y el origen-destino
// se deriva de la primera y última parada de cada sentido.

const RECURSOS = [
  {
    label: "Web oficial Vectalia Alicante",
    url: "https://alicante.vectalia.es/",
    desc: "Rutas, horarios y noticias del servicio",
  },
  {
    label: "App móvil Vectalia",
    url: "https://alicante.vectalia.es/app-movil/",
    desc: "Tiempo real y planificador de rutas",
  },
  {
    label: "Mapa interactivo de paradas",
    url: "https://qr.vectalia.es/Alicante/mapa.aspx",
    desc: "Encuentra paradas cercanas con QR",
  },
];

function isValidStopCode(code: string): boolean {
  return /^\d{3,5}$/.test(code.trim());
}

type LineEntry = {
  code: string;
  name: string;
  color: string;
  origin: string;
  destination: string;
  category: "urban" | "extraurban" | "night";
};

const CAT_COLOR: Record<LineEntry["category"], string> = {
  urban: "#DC2626",
  extraurban: "#1E3A8A",
  night: "#312E81",
};

function BusUrbanoPage() {
  const [stopCode, setStopCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { data: graph, loading: graphLoading } = useBusGraph();

  const groupedLines = useMemo(() => {
    const groups: Record<LineEntry["category"], LineEntry[]> = {
      urban: [],
      extraurban: [],
      night: [],
    };
    if (!graph) return groups;
    for (const ln of graph.lines) {
      const dir1 = graph.stops
        .filter((s) => s.line_code === ln.code && s.direction === 1)
        .sort((a, b) => a.seq - b.seq);
      const origin = dir1[0]?.stop_name ?? "";
      const destination = dir1[dir1.length - 1]?.stop_name ?? "";
      const category = classifyLine(ln.code);
      groups[category].push({
        code: ln.code,
        name: ln.name,
        color: ln.color ?? CAT_COLOR[category],
        origin,
        destination,
        category,
      });
    }
    const byCode = (a: LineEntry, b: LineEntry) => {
      const na = parseInt(a.code, 10);
      const nb = parseInt(b.code, 10);
      if (isNaN(na) || isNaN(nb)) return a.code.localeCompare(b.code);
      return na - nb;
    };
    groups.urban.sort(byCode);
    groups.extraurban.sort(byCode);
    groups.night.sort(byCode);
    return groups;
  }, [graph]);


  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidStopCode(stopCode)) {
      setError("Introduce un código de parada válido (3-5 dígitos)");
      return;
    }
    setError(null);
    window.open(
      `http://www.subus.es/QR/Alicante/consulta.aspx?p=${stopCode.trim()}`,
      "_blank",
    );
  }

  return (
    <div
      className="fixed inset-0 z-[60] lg:relative lg:inset-auto lg:z-auto lg:min-h-[60vh] overflow-y-auto text-white"
      style={{
        background:
          "linear-gradient(180deg, #0f172a 0%, #1e293b 50%, #0a0f1c 100%)",
      }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-cyan-400/[0.08] blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[24rem] w-[24rem] rounded-full bg-blue-400/[0.06] blur-3xl" />
      </div>

      <main className="relative mx-auto max-w-4xl space-y-5 px-4 pb-24 pt-5">
        <header className="mb-1 flex items-center justify-between">
          <Link
            to="/"
            className="text-[11px] uppercase tracking-[0.25em] text-white/60 transition hover:text-white"
          >
            ← Volver al inicio
          </Link>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-400" />
            </span>
            <span className="text-[10px] uppercase tracking-[0.25em] text-cyan-300">
              Live · ALC
            </span>
            <Link
              to="/"
              aria-label="Cerrar"
              className="ml-2 rounded-full border border-white/20 p-1.5 text-white/70 hover:border-white/40 hover:text-white"
            >
              <X className="h-4 w-4" />
            </Link>
          </div>
        </header>

        <div className="mb-2">
          <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-300/90">
            Transporte Público
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-white md:text-4xl">
            Bus{" "}
            <span className="bg-gradient-to-r from-cyan-300 via-white to-blue-300 bg-clip-text text-transparent">
              Urbano
            </span>
          </h1>
          <p className="mt-1 text-xs text-white/70 md:text-sm">
            Subus Alicante — líneas, horarios y búsqueda de paradas en tiempo
            real.
          </p>
        </div>

        {/* Buscador de parada */}
        <section className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/[0.08] to-blue-500/[0.04] p-4 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <QrCode className="h-4 w-4 text-cyan-300" />
            <h2 className="text-sm font-bold text-white">
              Consultar parada
            </h2>
          </div>
          <p className="mt-1 text-[11px] text-white/60">
            Introduce el código numérico de la parada (3-5 dígitos) que verás
            en la marquesina o en el QR.
          </p>
          <form onSubmit={handleSearch} className="mt-3 flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              maxLength={5}
              placeholder="Ej: 1234"
              value={stopCode}
              onChange={(e) => {
                setStopCode(e.target.value.replace(/\D/g, ""));
                setError(null);
              }}
              className="flex-1 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-cyan-500/50"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-bold text-white shadow-lg hover:bg-cyan-400 active:scale-[0.97]"
            >
              <Clock className="h-4 w-4" />
              Ver tiempos
            </button>
          </form>
          {error && (
            <p className="mt-2 flex items-center gap-1 text-[11px] text-rose-300">
              <AlertCircle className="h-3 w-3" /> {error}
            </p>
          )}
        </section>

        {/* Líneas reales */}
        {(["urban", "extraurban", "night"] as const).map((cat) => {
          const items = groupedLines[cat];
          if (!items || items.length === 0) return null;
          const meta = {
            urban: {
              title: "Líneas urbanas",
              icon: <RouteIcon className="h-4 w-4 text-cyan-300" />,
            },
            extraurban: {
              title: "Líneas TAM (interurbanas)",
              icon: <MapPinned className="h-4 w-4 text-blue-300" />,
            },
            night: {
              title: "Líneas nocturnas",
              icon: <Moon className="h-4 w-4 text-indigo-300" />,
            },
          }[cat];
          return (
            <section key={cat}>
              <div className="mb-2 flex items-center gap-2">
                {meta.icon}
                <h2 className="text-sm font-bold text-white">{meta.title}</h2>
                <span className="text-[10px] text-white/40">· {items.length}</span>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {items.map((l) => (
                  <Link
                    key={l.code}
                    to="/bus/dashboard/$code"
                    params={{ code: l.code }}
                    className="group flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur-xl transition-all hover:border-cyan-400/40 hover:bg-white/[0.07] active:scale-[0.98]"
                  >
                    <div
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold text-white shadow-md"
                      style={{ background: l.color }}
                    >
                      {l.code}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-medium text-white">
                        {l.origin && l.destination
                          ? `${l.origin} ↔ ${l.destination}`
                          : l.name}
                      </p>
                      <p className="text-[10px] text-white/50">
                        Ver tiempos en vivo
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-white/30 group-hover:text-cyan-300" />
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
        {graphLoading && (
          <p className="text-center text-[11px] text-white/40">Cargando líneas…</p>
        )}
        {!graphLoading && graph && graph.lines.length === 0 && (
          <p className="text-center text-[11px] text-white/40">
            No hay líneas disponibles.
          </p>
        )}


        {/* Tarifas */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
          <div className="mb-3 flex items-center gap-2">
            <Euro className="h-4 w-4 text-emerald-300" />
            <h2 className="text-sm font-bold text-white">Tarifas 2025</h2>
          </div>
          <ul className="space-y-2 text-[11px] text-white/70">
            <li className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2">
              <span>Billete sencillo</span>
              <span className="font-mono font-semibold text-white">1,45 €</span>
            </li>
            <li className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2">
              <span>Bono 10 viajes (Bonobús)</span>
              <span className="font-mono font-semibold text-white">8,70 €</span>
            </li>
            <li className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2">
              <span>Bono 30 viajes</span>
              <span className="font-mono font-semibold text-white">23,40 €</span>
            </li>
            <li className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2">
              <span>Tarjeta transporte (recarga)</span>
              <span className="font-mono font-semibold text-white">0,72 €/viaje</span>
            </li>
          </ul>
          <p className="mt-2 text-[10px] text-white/40">
            Tarifas orientativas. Consulta precios actualizados en{" "}
            <a
              href="https://alicante.vectalia.es/"
              target="_blank"
              rel="noreferrer"
              className="text-cyan-300 underline"
            >
              vectalia.es
            </a>
            .
          </p>
        </section>

        {/* Recursos */}
        <section>
          <div className="mb-2 flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-cyan-300" />
            <h2 className="text-sm font-bold text-white">Recursos útiles</h2>
          </div>
          <div className="space-y-2">
            {RECURSOS.map((r) => (
              <a
                key={r.label}
                href={r.url}
                target="_blank"
                rel="noreferrer"
                className="group flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur-xl transition-all hover:border-white/25 hover:bg-white/[0.07] active:scale-[0.98]"
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                  <ExternalLink className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white">{r.label}</p>
                  <p className="text-[11px] text-white/50">{r.desc}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-white/30 group-hover:text-white/60" />
              </a>
            ))}
          </div>
        </section>

        <p className="pb-6 text-center text-[10px] text-white/30">
          Datos: Vectalia / Subus Alicante. No oficial.
        </p>
      </main>
    </div>
  );
}
