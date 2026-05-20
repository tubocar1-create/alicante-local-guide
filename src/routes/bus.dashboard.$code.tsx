import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowDown, ArrowUp, Bus, Radio, RefreshCw, Loader2 } from "lucide-react";
import { useBusGraph } from "@/hooks/useBusGraph";
import busAlicanteImg from "@/assets/bus-alicante.png";


export const Route = createFileRoute("/bus/dashboard/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `Línea ${params.code} · Dashboard en tiempo real` },
      {
        name: "description",
        content: `Dashboard en tiempo real de la Línea ${params.code} de Alicante: paradas, horarios y transbordos en ambos sentidos.`,
      },
    ],
  }),
  component: BusDashboardPage,
});

type StopRow = {
  code: string;
  name: string;
  seq: number;
};

const LINE_PALETTE = ["#EF4444", "#3B82F6", "#22C55E", "#A855F7", "#F59E0B"];

function formatHHMM(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function BusDashboardPage() {
  const { code } = Route.useParams();
  const { data, loading } = useBusGraph();
  const navigate = useNavigate();
  const [clock, setClock] = useState<Date>(new Date());
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const handlePickStop = (stopCode: string, stopName: string) => {
    const prompt = `Quiero coger la línea ${code} en la parada ${stopName} (${stopCode}).`;
    try {
      sessionStorage.setItem("afp:fwdPrompt", prompt);
    } catch {}
    navigate({ to: "/" });
    setTimeout(() => {
      try {
        window.dispatchEvent(
          new CustomEvent("afp:forward-prompt", { detail: { text: prompt } }),
        );
      } catch {}
    }, 350);
  };


  const line = data?.lines.find((l) => l.code === code);

  const stopsByDir = useMemo(() => {
    const out: Record<1 | 2, StopRow[]> = { 1: [], 2: [] };
    if (!data) return out;
    for (const s of data.stops) {
      if (s.line_code !== code) continue;
      if ((s.direction === 1 || s.direction === 2) && s.stop_code) {
        out[s.direction as 1 | 2].push({
          code: s.stop_code,
          name: s.stop_name,
          seq: s.seq,
        });
      }
    }
    out[1].sort((a, b) => a.seq - b.seq);
    out[2].sort((a, b) => a.seq - b.seq);
    return out;
  }, [data, code]);

  // Transbordos: para cada stop_code, qué otras líneas pasan por allí.
  const transfersByStop = useMemo(() => {
    const map = new Map<string, Set<string>>();
    if (!data) return map;
    for (const s of data.stops) {
      if (!s.stop_code || s.line_code === code) continue;
      const set = map.get(s.stop_code) ?? new Set<string>();
      set.add(s.line_code);
      map.set(s.stop_code, set);
    }
    return map;
  }, [data, code]);

  // Top líneas con las que comparte más paradas → chips de cabecera y leyenda.
  const topTransfers = useMemo(() => {
    const counts = new Map<string, number>();
    const allStops = [...stopsByDir[1], ...stopsByDir[2]];
    for (const s of allStops) {
      const others = transfersByStop.get(s.code);
      if (!others) continue;
      for (const l of others) counts.set(l, (counts.get(l) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([lineCode], idx) => ({
        code: lineCode,
        color: LINE_PALETTE[(idx + 1) % LINE_PALETTE.length],
      }));
  }, [stopsByDir, transfersByStop]);

  // Realtime: por cada parada del recorrido (ambas direcciones), pedir su ETA.
  // Guardamos hasta 2 próximos tiempos por parada (índice 0 y 1).
  const [etas, setEtas] = useState<Record<string, number[]>>({});
  const [loadingEtas, setLoadingEtas] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    const allStops = [...stopsByDir[1], ...stopsByDir[2]];
    if (allStops.length === 0) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const fetchStop = async (stopCode: string): Promise<number[]> => {
      try {
        const r = await fetch(
          `/api/public/bus-eta?stop=${encodeURIComponent(stopCode)}&line=${encodeURIComponent(code)}`,
          { cache: "no-store" },
        );
        if (!r.ok) return [];
        const j = (await r.json()) as { all?: number[] };
        return Array.isArray(j.all) ? j.all.slice(0, 1) : [];
      } catch {
        return [];
      }
    };

    const tick = async () => {
      setLoadingEtas(true);
      const codes = Array.from(new Set(allStops.map((s) => s.code)));
      const CHUNK = 6;
      for (let i = 0; i < codes.length; i += CHUNK) {
        if (cancelled) break;
        const slice = codes.slice(i, i + CHUNK);
        const results = await Promise.all(slice.map(fetchStop));
        const next: Record<string, number[]> = {};
        results.forEach((arr, idx) => {
          next[slice[idx]] = arr;
        });
        if (!cancelled) setEtas((prev) => ({ ...prev, ...next }));
      }
      if (!cancelled) {
        setUpdatedAt(new Date().toISOString());
        setLoadingEtas(false);
        timer = setTimeout(tick, 30_000);
      }
    };
    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, stopsByDir[1].length, stopsByDir[2].length]);


  const lineColor = line?.color || "#EF4444";

  const inService =
    Object.values(etas).some((arr) => arr && arr.length > 0) || loadingEtas;


  return (
    <div className="h-[100dvh] overflow-y-auto overscroll-contain bg-black text-white">
      <div className="mx-auto max-w-3xl px-3 py-4">
        {/* HEADER */}
        <div className="flex items-start gap-3">
          <Link
            to="/bus"
            className="mt-1 inline-flex h-9 w-9 items-center justify-center rounded-full text-white hover:bg-white/10"
            aria-label="Volver"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center text-base font-black text-white shadow-lg"
            style={{ background: lineColor, borderRadius: 12 }}
          >
            {code}
          </div>

          <div className="min-w-0 flex-1 pt-0.5">
            <h1 className="font-sans text-2xl font-bold not-italic leading-tight text-white">
              Línea {code}
            </h1>
          </div>

          <div className="shrink-0 self-start rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-right">
            <div className="font-sans text-[9px] font-semibold not-italic uppercase tracking-wide text-white/50 leading-none">
              Hora
            </div>
            <div className="font-mono text-lg font-bold tabular-nums leading-tight text-white">
              {String(clock.getHours()).padStart(2, "0")}:
              {String(clock.getMinutes()).padStart(2, "0")}
              <span className="text-white/50">
                :{String(clock.getSeconds()).padStart(2, "0")}
              </span>
            </div>
          </div>
        </div>

        {/* COLUMNAS IDA / VUELTA */}
        <div className="mt-4 grid grid-cols-2 divide-x divide-white/10 rounded-2xl border border-white/10 bg-white/[0.02] p-2">
          <DirectionColumn
            label="IDA"
            direction={1}
            stops={stopsByDir[1]}
            etas={etas}
            color={lineColor}
            inService={inService}
            transferLines={(c) => {
              const others = transfersByStop.get(c);
              if (!others) return [];
              return topTransfers.filter((t) => others.has(t.code));
            }}
          />
          <DirectionColumn
            label="VUELTA"
            direction={2}
            stops={stopsByDir[2]}
            etas={etas}
            color={lineColor}
            inService={inService}
            transferLines={(c) => {
              const others = transfersByStop.get(c);
              if (!others) return [];
              return topTransfers.filter((t) => others.has(t.code));
            }}
          />
        </div>

        {/* LEYENDA */}
        {topTransfers.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
            <span className="font-sans text-[13px] not-italic text-white/70">Leyenda</span>
            {topTransfers.map((t) => (
              <div key={t.code} className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4" style={{ color: t.color }} />
                <span className="font-sans text-[12px] not-italic text-white leading-tight">
                  Transbordo
                  <br />
                  Línea {t.code}
                </span>
              </div>
            ))}
          </div>
        )}



        {loading && (
          <p className="mt-4 text-center text-sm text-white/60">Cargando paradas…</p>
        )}
      </div>
    </div>
  );
}

function LineChip({
  code,
  color,
  filled = false,
}: {
  code: string;
  color: string;
  filled?: boolean;
}) {
  return (
    <div
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5"
      style={{
        border: `1.5px solid ${color}`,
        background: filled ? color : "transparent",
      }}
    >
      <Bus className="h-3 w-3" style={{ color: filled ? "#fff" : color }} />
      <span
        className="font-sans text-[10px] font-bold not-italic tabular-nums"
        style={{ color: filled ? "#fff" : color }}
      >
        {code}
      </span>
    </div>

  );
}

function DirectionColumn({
  label,
  direction,
  stops,
  etas,
  color,
  inService,
  transferLines,
}: {
  label: string;
  direction: 1 | 2;
  stops: StopRow[];
  etas: Record<string, number[]>;
  color: string;
  inService: boolean;
  transferLines: (stopCode: string) => { code: string; color: string }[];
}) {
  const now = new Date();

  return (
    <div className="px-1">
      <div className="mb-2 flex items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-1 pl-14">
          <ArrowDown style={{ color }} strokeWidth={4} className="h-7 w-7" />


          <span
            className="font-sans text-base font-extrabold not-italic"
            style={{ color }}
          >
            {label}
          </span>
        </div>

        <span
          aria-label={inService ? "En servicio" : "Sin datos"}
          title={inService ? "En servicio" : "Sin datos"}
          className={[
            "inline-block h-2.5 w-2.5 rounded-full",
            inService
              ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]"
              : "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.7)]",
          ].join(" ")}
        />

      </div>

      {stops.length > 0 && (
        <p className="mb-2 truncate font-sans text-[11px] not-italic text-white/70">
          {stops[0].name} → {stops[stops.length - 1].name}
        </p>
      )}

      <ol className="relative" style={{ display: "flex", flexDirection: "column", gap: "6mm" }}>
        {stops.length > 1 && (
          <span
            aria-hidden
            className="absolute left-6 top-3 bottom-3 w-[2px] rounded-full"
            style={{ background: color }}
          />
        )}
        {stops.map((s, i) => {
          const arr = etas[s.code] ?? [];
          const eta1 = arr[0];
          const hasEta = typeof eta1 === "number";
          const isOrigin = i === 0;
          const isDest = i === stops.length - 1;
          const transfers = transferLines(s.code);
          const transferColor = transfers[0]?.color ?? null;
          const etaTime = hasEta
            ? formatHHMM(new Date(now.getTime() + eta1 * 60_000))
            : null;

          return (
            <li
              key={`${s.code}-${i}`}
              className="relative flex flex-col gap-1 rounded-md pb-2"
              style={{
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                boxShadow: "0 1px 0 rgba(0,0,0,0.4)",
                background: transferColor
                  ? `linear-gradient(90deg, ${transferColor}26 0%, ${transferColor}10 60%, transparent 100%)`
                  : undefined,
              }}
            >

              {(isOrigin || isDest) && (
                <span
                  className="inline-block self-start rounded px-1.5 py-0.5 font-sans text-[9px] font-bold not-italic uppercase tracking-wide text-white"
                  style={{ background: color }}
                >
                  {isOrigin ? "Origen" : "Destino"}
                </span>
              )}
              <div className="flex items-start gap-2">
                {/* Badge con el próximo tiempo + código de parada */}
                <div className="flex shrink-0 flex-col items-center">
                  <div
                    className={[
                      "relative z-10 flex h-9 w-12 flex-col items-center justify-center rounded-md leading-none",
                      hasEta ? "bg-white text-black" : "bg-white/15 text-white/70",
                    ].join(" ")}
                    style={
                      transferColor
                        ? { boxShadow: `0 0 0 2px ${transferColor}` }
                        : isOrigin || isDest
                          ? { boxShadow: `0 0 0 2px #fff` }
                          : undefined
                    }
                  >
                    {hasEta && eta1 === 0 ? (
                      <img
                        src={busAlicanteImg}
                        alt="Bus"
                        className="h-7 w-7 object-contain"
                      />
                    ) : (
                      <>
                        <span className="font-sans text-[12px] font-extrabold not-italic tabular-nums">
                          {hasEta ? eta1 : "—"}
                        </span>
                        <span className="font-sans text-[8px] font-bold not-italic">min</span>
                      </>
                    )}
                  </div>
                  <span className="mt-0.5 font-sans text-[7px] font-medium not-italic tabular-nums leading-none text-white/45">
                    {s.code}
                  </span>
                </div>


                <div className="min-w-0 flex-1">

                  <div className="flex items-baseline gap-1.5">
                    <span className="font-sans text-[11px] font-semibold not-italic tabular-nums text-white/90">
                      {etaTime ?? "--:--"}
                    </span>
                    <span className="font-sans text-[9px] font-medium not-italic uppercase tracking-wide text-white/50">
                      estimado
                    </span>
                  </div>
                  <div className="truncate font-sans text-[12px] font-semibold not-italic leading-snug text-white">
                    {s.name}
                  </div>
                  {transfers.length > 0 && (
                    <div className="mt-1 flex items-start gap-1.5">
                      <RefreshCw
                        className="mt-0.5 h-3 w-3 shrink-0"
                        style={{ color: transfers[0].color }}
                      />
                      <span className="mt-0.5 font-sans text-[9px] font-semibold not-italic uppercase tracking-wide text-white/60">
                        Transbordo
                      </span>
                      <div className="flex flex-col items-start gap-0.5">
                        {transfers.map((t) => (
                          <span
                            key={t.code}
                            className="inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-sans text-[9px] font-bold not-italic tabular-nums leading-none text-white"
                            style={{ background: t.color }}
                          >
                            {t.code}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              </div>
            </li>


          );
        })}
      </ol>

      {stops.length === 0 && (
        <p className="px-2 py-4 text-center text-xs text-white/60">
          Sin paradas para este sentido.
        </p>
      )}
    </div>
  );
}
