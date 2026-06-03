import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Bus, Plane, MapPin } from "lucide-react";
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

const CORRIDOR_LABELS: Record<string, string> = {
  "nacional-alta-demanda": "Nacionales de alta demanda",
  "castilla-la-mancha": "Castilla-La Mancha",
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

  // Group by corridor
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
            <OriginIcon className="h-4 w-4 text-amber-300" />
            <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-amber-300">
              {code}
            </span>
          </div>
        </header>

        <div className="mb-5">
          <p className="text-[10px] uppercase tracking-[0.3em] text-amber-300/90">
            Buses larga distancia
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-white md:text-4xl">
            Rutas desde{" "}
            <span className="bg-gradient-to-r from-amber-300 via-white to-orange-300 bg-clip-text text-transparent">
              {origin?.station ?? code}
            </span>
          </h1>
          {origin && (
            <p className="mt-1 text-xs text-slate-400">{origin.city}</p>
          )}
        </div>

        {routes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-amber-500/30 bg-amber-950/20 p-4 text-sm text-slate-300">
            Sin rutas configuradas todavía para <strong className="text-amber-200">{code}</strong>.
          </div>
        ) : (
          <div className="space-y-5">
            {Array.from(groups.entries()).map(([corridor, items]) => (
              <section key={corridor}>
                <h2 className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-amber-300/80">
                  {CORRIDOR_LABELS[corridor] ?? corridor}
                </h2>
                <div className="space-y-2">
                  {items.map((r) => (
                    <Link
                      key={r.id}
                      to="/buses/$code"
                      params={{ code }}
                      className="group flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3 transition hover:border-amber-500/40 hover:bg-slate-900"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-300">
                          <MapPin className="h-4 w-4" />
                        </span>
                        <div>
                          <div className="text-sm font-semibold text-white">
                            {r.destination?.city ?? r.destination_code}
                          </div>
                          {r.operators.length > 0 && (
                            <div className="mt-0.5 text-[10px] uppercase tracking-wider text-slate-400">
                              {r.operators.join(" · ")}
                            </div>
                          )}
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-amber-300" />
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
