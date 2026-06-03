import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Bus, Plane } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Origin = {
  code: string;
  city: string;
  station: string;
};

type RouteRow = {
  id: string;
  destination_code: string;
  corridor: string | null;
  label: string | null;
  operators: string[];
  is_popular: boolean;
  sort_order: number;
  destination: { city: string; station: string } | null;
};

type CorridorMeta = {
  icon: string;
  name: string;
  product: string;
  tint: { section: string; list: string; border: string };
};

const CORRIDOR_META: Record<string, CorridorMeta> = {
  "nacional-alta-demanda": {
    icon: "🚌",
    name: "Nacionales de alta demanda",
    product: "Alsa · Avanza · Socibus",
    tint: {
      section: "bg-amber-500/[0.10]",
      list: "bg-amber-950/30",
      border: "border-amber-500/25",
    },
  },
  "castilla-la-mancha": {
    icon: "🚌",
    name: "Castilla-La Mancha",
    product: "Líneas regionales",
    tint: {
      section: "bg-emerald-500/[0.08]",
      list: "bg-emerald-950/30",
      border: "border-emerald-500/20",
    },
  },
};

const FALLBACK_META: CorridorMeta = {
  icon: "🚌",
  name: "Otras rutas",
  product: "",
  tint: {
    section: "bg-slate-500/[0.08]",
    list: "bg-slate-900/40",
    border: "border-slate-700/40",
  },
};

const OPERATOR_COLORS: Record<string, string> = {
  ALSA: "#f59e0b",
  AVANZA: "#ec4899",
  SOCIBUS: "#8b5cf6",
  MONBUS: "#10b981",
  ALACITY: "#06b6d4",
};

const originQueryOptions = (code: string) =>
  queryOptions({
    queryKey: ["bus-ld-origin", code],
    queryFn: async () => {
      const { data: origin, error: oErr } = await supabase
        .from("bus_ld_stations")
        .select("code, city, station")
        .eq("code", code)
        .maybeSingle();
      if (oErr) throw oErr;

      const { data: routes, error: rErr } = await supabase
        .from("bus_ld_routes")
        .select("id, destination_code, corridor, label, operators, is_popular, sort_order")
        .eq("origin_code", code)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (rErr) throw rErr;

      const destCodes = Array.from(new Set((routes ?? []).map((r) => r.destination_code)));
      const { data: dests, error: dErr } = destCodes.length
        ? await supabase
            .from("bus_ld_stations")
            .select("code, city, station")
            .in("code", destCodes)
        : { data: [], error: null };
      if (dErr) throw dErr;

      const destMap = new Map((dests ?? []).map((d) => [d.code, d]));
      const enriched: RouteRow[] = (routes ?? []).map((r) => ({
        ...r,
        destination: destMap.get(r.destination_code) ?? null,
      }));

      return { origin: origin as Origin | null, routes: enriched };
    },
  });


export const Route = createFileRoute("/buses_/$code")({
  loader: ({ params, context }) =>
    context.queryClient.ensureQueryData(originQueryOptions(params.code)),
  component: BusOriginPage,
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-red-300">No se pudieron cargar las rutas: {error.message}</div>
  ),
});

function BusOriginPage() {
  const { code } = Route.useParams();
  const { data } = useSuspenseQuery(originQueryOptions(code));
  const { origin, routes } = data;

  const OriginIcon = code === "ALC-APT" ? Plane : Bus;

  const groups = new Map<string, RouteRow[]>();
  for (const r of routes) {
    const key = r.corridor ?? "otros";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  return (
    <div
      className="h-dvh overflow-y-auto overscroll-contain text-slate-100 lg:min-h-screen lg:h-auto lg:overflow-visible"
      style={{
        background: "linear-gradient(180deg, #020617 0%, #06111f 50%, #020617 100%)",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-amber-500/[0.06] blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-3xl px-3 pb-10 pt-5 md:px-6">
        <header className="mb-4 flex items-center justify-between">
          <Link
            to="/buses"
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-[11px] text-slate-300 transition hover:border-amber-500/50 hover:text-amber-300"
          >
            <ArrowLeft className="h-3 w-3" />
            Volver
          </Link>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
            </span>
            <OriginIcon className="h-3.5 w-3.5 text-amber-300" />
            <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-amber-300">
              {code}
            </span>
          </div>
        </header>

        <div className="mb-5">
          <p className="text-[10px] uppercase tracking-[0.3em] text-amber-300/90">
            Dashboard de Buses
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-white md:text-4xl">
            Buses{" "}
            <span className="bg-gradient-to-r from-amber-300 via-white to-orange-300 bg-clip-text text-transparent">
              desde {origin?.station ?? code}
            </span>
          </h1>
          {origin && (
            <p className="mt-1 text-xs text-white/70 md:text-sm">
              {origin.city} — corredores larga distancia.
            </p>
          )}
        </div>

        {routes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-amber-500/30 bg-amber-950/20 p-4 text-sm text-slate-300">
            Sin rutas configuradas todavía para <strong className="text-amber-200">{code}</strong>.
          </div>
        ) : (
          <div className="space-y-2">
            {Array.from(groups.entries()).map(([corridor, items]) => {
              const meta = CORRIDOR_META[corridor] ?? FALLBACK_META;
              return (
                <section
                  key={corridor}
                  className={`overflow-hidden rounded-2xl border ${meta.tint.border} ${meta.tint.section}`}
                >
                  <div className="flex w-full items-center gap-3 px-3 py-3 text-left">
                    <span className="text-xl leading-none">{meta.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-white">
                        {meta.name}
                      </div>
                      {meta.product && (
                        <div className="truncate text-[11px] text-slate-400">
                          {meta.product}
                        </div>
                      )}
                    </div>
                    <span className="rounded-full border border-slate-700/70 px-2 py-0.5 text-[10px] text-slate-400">
                      {items.length}
                    </span>
                  </div>

                  <ul className={`border-t ${meta.tint.border} ${meta.tint.list} p-1.5`}>
                    {items.map((r) => (
                      <li key={r.id}>
                        <button
                          type="button"
                          className="group flex w-full items-center gap-2 rounded-lg border border-slate-800/70 bg-slate-950/40 px-2.5 py-1.5 text-left transition hover:border-amber-500/40 hover:bg-amber-500/5"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="truncate text-[12px] font-medium text-slate-200">
                              {r.destination?.station ?? r.destination?.city ?? r.destination_code}
                            </span>
                            {r.destination?.city && r.destination.city !== r.destination.station && (
                              <span className="ml-1.5 text-[10px] text-slate-500">
                                · {r.destination.city}
                              </span>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            {r.operators.map((op) => {
                              const key = op.toUpperCase();
                              const color = OPERATOR_COLORS[key] ?? "#94a3b8";
                              return (
                                <span
                                  key={op}
                                  className="rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                                  style={{ background: color + "22", color }}
                                >
                                  {op}
                                </span>
                              );
                            })}
                          </div>
                          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-amber-300" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
