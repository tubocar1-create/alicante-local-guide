import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCartelera, type CarteleraTrain } from "@/lib/cartelera.functions";
import { Suspense, useMemo } from "react";

export const Route = createFileRoute("/cartelera")({
  head: () => ({
    meta: [
      { title: "Cartelera tiempo real · Alicante Terminal · ADIF" },
      {
        name: "description",
        content:
          "Salidas, llegadas e incidencias en tiempo real de la estación de Alicante Terminal. Datos ADIF.",
      },
    ],
  }),
  component: CarteleraPage,
  errorComponent: ({ error }) => (
    <div className="min-h-screen bg-background text-foreground p-6">
      <h1 className="text-xl font-semibold mb-2">No se pudo cargar la cartelera</h1>
      <p className="text-sm text-muted-foreground">{error.message}</p>
    </div>
  ),
});

function CarteleraPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="px-4 pt-6 pb-3 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="text-2xl">🚆</div>
          <div className="flex-1">
            <h1 className="text-lg font-bold leading-tight">Alicante Terminal</h1>
            <p className="text-xs text-muted-foreground">
              Información en tiempo real · ADIF
            </p>
          </div>
          <Link
            to="/trenes"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Trenes
          </Link>
        </div>
      </header>
      <Suspense fallback={<Loading />}>
        <Board />
      </Suspense>
    </div>
  );
}

function Loading() {
  return (
    <div className="p-6 text-sm text-muted-foreground">Cargando ADIF…</div>
  );
}

const carteleraOpts = (fn: () => Promise<any>) =>
  queryOptions({
    queryKey: ["cartelera", "alicante-terminal", "v1"],
    queryFn: fn,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

function Board() {
  const fetchFn = useServerFn(getCartelera);
  const { data } = useSuspenseQuery(carteleraOpts(() => fetchFn({})));

  const incidencias = useMemo(() => {
    const all = [...data.salidas, ...data.llegadas];
    return all.filter((t) => t.status !== "EN_HORA" || t.observation);
  }, [data]);

  const salidas = data.salidas.slice(0, 10);
  const llegadas = data.llegadas.slice(0, 10);

  const updatedAgo = Math.max(
    0,
    Math.round((Date.now() - new Date(data.generatedAt).getTime()) / 1000),
  );

  return (
    <div className="p-4 space-y-5 max-w-3xl mx-auto">
      <p className="text-xs text-muted-foreground text-right">
        Actualizado hace {updatedAgo}s
      </p>

      {incidencias.length > 0 && (
        <Section title={`Incidencias (${incidencias.length})`} accent="rose">
          <ul className="divide-y divide-border/40">
            {incidencias.slice(0, 6).map((t, i) => (
              <li key={i} className="py-2 text-sm">
                <div className="flex items-center gap-2">
                  <StatusBadge t={t} />
                  <span className="font-medium">{t.operator} {t.trainNumber}</span>
                  <span className="text-muted-foreground truncate">
                    → {t.direction === "SALIDA" ? t.destination : t.origin}
                  </span>
                </div>
                {t.observation && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {t.observation}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Próximas salidas" accent="emerald">
        <TrainTable trains={salidas} kind="SALIDA" />
      </Section>

      <Section title="Próximas llegadas" accent="sky">
        <TrainTable trains={llegadas} kind="LLEGADA" />
      </Section>

      <p className="text-[11px] text-muted-foreground text-center">
        Datos: ADIF. Los horarios son estimados y pueden cambiar.
      </p>
    </div>
  );
}

function Section({
  title,
  accent,
  children,
}: {
  title: string;
  accent: "emerald" | "sky" | "rose";
  children: React.ReactNode;
}) {
  const ring =
    accent === "emerald"
      ? "border-emerald-500/25 bg-emerald-500/[0.05]"
      : accent === "sky"
      ? "border-sky-500/25 bg-sky-500/[0.05]"
      : "border-rose-500/30 bg-rose-500/[0.06]";
  return (
    <section className={`rounded-xl border ${ring} p-3`}>
      <h2 className="text-sm font-semibold mb-2 uppercase tracking-wide">
        {title}
      </h2>
      {children}
    </section>
  );
}

function TrainTable({
  trains,
  kind,
}: {
  trains: CarteleraTrain[];
  kind: "SALIDA" | "LLEGADA";
}) {
  if (!trains.length) {
    return <p className="text-sm text-muted-foreground py-3">Sin datos.</p>;
  }
  return (
    <ul className="divide-y divide-border/40">
      {trains.map((t, i) => (
        <li key={i} className="py-2 grid grid-cols-[auto_1fr_auto] gap-2 items-center">
          <div className="text-sm font-mono tabular-nums">
            <div className="font-semibold">{t.scheduled}</div>
            {t.estimated !== t.scheduled && (
              <div
                className={
                  t.delayMin > 0
                    ? "text-xs text-amber-500"
                    : "text-xs text-emerald-500"
                }
              >
                {t.estimated}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">
              {kind === "SALIDA" ? t.destination : t.origin}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {t.operator} {t.trainNumber}
              {t.platform ? ` · Vía ${t.platform}` : ""}
            </div>
          </div>
          <StatusBadge t={t} />
        </li>
      ))}
    </ul>
  );
}

function StatusBadge({ t }: { t: CarteleraTrain }) {
  if (t.status === "CANCELADO")
    return (
      <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-rose-500/15 text-rose-400">
        Cancelado
      </span>
    );
  if (t.status === "RETRASO")
    return (
      <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-500/15 text-amber-400">
        +{t.delayMin} min
      </span>
    );
  if (t.status === "ADELANTO")
    return (
      <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-sky-500/15 text-sky-400">
        {t.delayMin} min
      </span>
    );
  if (t.status === "CAMBIO")
    return (
      <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-violet-500/15 text-violet-400">
        Cambio
      </span>
    );
  return (
    <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400">
      En hora
    </span>
  );
}
