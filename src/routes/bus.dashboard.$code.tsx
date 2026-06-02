import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowDown, ArrowUp, Bus, ChevronDown, Radio, RefreshCw, Loader2, MapPin } from "lucide-react";
import { useBusGraph } from "@/hooks/useBusGraph";
import { classifyLine } from "@/components/BusKnownPicker";
import { saveFavoriteStop } from "@/components/FavoriteStopWidget";
import {
  useBusServiceWindows,
  useBusLineDepartures,
  getServiceStatus,
  getNightLineEstimates,
  dayTypeOf,
  matchesDayType,
  toMinHM,
} from "@/hooks/useBusServiceWindow";
import { cumulativeMinutes, NIGHT_URBAN_KMH } from "@/lib/bus-eta";
import { getClientStopRealtime, getClientStopsRealtimeBatch } from "@/lib/bus-realtime-client";
import busAlicanteImg from "@/assets/bus-alicante.png";
import { useBusEngine } from "@/hooks/useBusEngine";
import { predictLineState } from "@/lib/bus-engine/predict";




function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}



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
const TERMINAL_LAYOVER_MIN = 5;

function normalizeStopLabel(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function collapseConsecutiveDuplicateStops(stops: StopRow[]): StopRow[] {
  const collapsed: StopRow[] = [];
  for (const stop of stops) {
    const prev = collapsed[collapsed.length - 1];
    if (prev && normalizeStopLabel(prev.name) === normalizeStopLabel(stop.name)) {
      collapsed[collapsed.length - 1] = stop;
    } else {
      collapsed.push(stop);
    }
  }
  return collapsed;
}

function minutesFromHHMM(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

function nextTimelineMinuteAfter(dayMinute: number, referenceMinute: number): number {
  let value = dayMinute;
  while (value < referenceMinute) value += 24 * 60;
  return value;
}

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

  // Geolocalización del usuario
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [geoStatus, setGeoStatus] = useState<"idle" | "loading" | "ok" | "unavailable">("loading");
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoStatus("unavailable");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setUserPos({ lat: p.coords.latitude, lng: p.coords.longitude });
        setGeoStatus("ok");
      },
      () => setGeoStatus("unavailable"),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );
  }, []);


  const handlePickStop = (stopCode: string, stopName: string, destination: string) => {
    saveFavoriteStop({ stopId: stopCode, stopName, line: code, destination });
    navigate({
      to: "/transporte/parada-favorita",
      search: { stop: stopCode, line: code },
    });
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
    out[1] = collapseConsecutiveDuplicateStops(out[1].sort((a, b) => a.seq - b.seq));
    out[2] = collapseConsecutiveDuplicateStops(out[2].sort((a, b) => a.seq - b.seq));
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

  // Coordenadas por código de parada
  const stopCoords = useMemo(() => {
    const m = new Map<string, { lat: number; lng: number }>();
    if (!data) return m;
    for (const sm of data.stopsMeta) {
      if (typeof sm.lat === "number" && typeof sm.lng === "number") {
        m.set(sm.code, { lat: sm.lat, lng: sm.lng });
      }
    }
    return m;
  }, [data]);

  // Dos paradas más cercanas por sentido (solo si hay geo)
  const nearestByDir = useMemo(() => {
    const out: Record<1 | 2, { code: string; distance: number }[]> = { 1: [], 2: [] };
    if (!userPos) return out;
    for (const dir of [1, 2] as const) {
      const list: { code: string; distance: number }[] = [];
      for (const s of stopsByDir[dir]) {
        const c = stopCoords.get(s.code);
        if (!c) continue;
        list.push({ code: s.code, distance: haversineMeters(userPos, c) });
      }
      list.sort((a, b) => a.distance - b.distance);
      out[dir] = list.slice(0, 1);
    }
    return out;
  }, [userPos, stopsByDir, stopCoords]);



  // Detección de línea nocturna y estimaciones por parada (sin tiempo real).
  const serviceRows = useBusServiceWindows();
  const departures = useBusLineDepartures();

  const isNightLine = useMemo(() => {
    const st = getServiceStatus(serviceRows, code, clock);
    return st.isNightLine;
  }, [serviceRows, code, clock]);

  // Para líneas nocturnas: hora estimada de llegada por parada.
  //
  // Lógica unificada (3N / 13N / 22N): siempre hay como mínimo un bus rodando
  // entre salidas. Construimos TODAS las salidas candidatas desde el origen
  // (hoy + madrugada anterior) y, para cada parada, elegimos la que produce
  // la llegada más temprana que aún no ha pasado. Así un bus ya rodando
  // (salió antes pero todavía no ha alcanzado la parada) gana frente a la
  // próxima salida programada del origen.
  const nightEtaByDir = useMemo(() => {
    const out: Record<1 | 2, Map<string, { min: number; time: string }>> = {
      1: new Map(),
      2: new Map(),
    };
    if (!serviceRows || !departures) return out;

    const nowMin = clock.getHours() * 60 + clock.getMinutes();
    const todayType = dayTypeOf(clock);
    const yesterdayType = dayTypeOf(new Date(clock.getTime() - 24 * 60 * 60_000));

    for (const dir of [1, 2] as const) {
      const stops = stopsByDir[dir];
      if (stops.length === 0) continue;
      const originName = stops[0].name;

      const sw = serviceRows.find(
        (r) =>
          r.line_code === code &&
          r.terminal_name === originName &&
          (matchesDayType(r.day_type, todayType) ||
            matchesDayType(r.day_type, yesterdayType)),
      );
      if (!sw) continue;

      // Salidas de hoy (timeline = dep) + salidas de ayer madrugada (dep < 12h,
      // timeline = dep, ya ocurrieron pero pueden estar rodando) +
      // salidas de ayer tarde-noche (dep >= 18h, timeline = dep - 1440).
      const depTimelines: number[] = [];
      for (const d of departures) {
        if (d.line_code !== code || d.direction !== sw.direction) continue;
        const depMin = toMinHM(d.departure_time);
        if (matchesDayType(d.day_type, todayType)) {
          depTimelines.push(depMin);
        }
        if (matchesDayType(d.day_type, yesterdayType)) {
          if (depMin >= 18 * 60) depTimelines.push(depMin - 24 * 60);
        }
      }
      if (depTimelines.length === 0) continue;
      depTimelines.sort((a, b) => a - b);

      // Próxima salida del origen (para sincronizar el terminal de destino).
      const nextOriginDeparture =
        depTimelines.find((d) => d - nowMin >= -1) ?? depTimelines[depTimelines.length - 1];

      const syncedDestinationArrival = (destinationName: string): number | null => {
        const destinationDepartures = getNightLineEstimates(
          serviceRows,
          departures,
          code,
          destinationName,
          0,
          clock,
          8,
        );
        const nextDeparture = destinationDepartures?.upcoming
          .map((u) =>
            nextTimelineMinuteAfter(minutesFromHHMM(u.departureTime), nextOriginDeparture),
          )
          .filter((m) => m >= nextOriginDeparture)
          .sort((a, b) => a - b)[0];
        return typeof nextDeparture === "number" ? nextDeparture - TERMINAL_LAYOVER_MIN : null;
      };

      const codes = stops.map((s) => s.code);
      const cum = cumulativeMinutes(codes, stopCoords, { speedKmh: NIGHT_URBAN_KMH });
      const BOARDING_BUFFER_MIN = 5;

      for (let i = 0; i < stops.length; i++) {
        const offset = cum[i] ?? 0;
        const isOrigin = i === 0;
        const isDestTerminal = i === stops.length - 1;

        let arrTimeline: number | null = null;

        if (isDestTerminal && isNightLine) {
          arrTimeline = syncedDestinationArrival(stops[i].name);
        }

        if (arrTimeline == null) {
          // Buscar la salida candidata más temprana cuya llegada a esta parada
          // aún esté en el futuro. Esto prioriza buses ya rodando.
          let best: number | null = null;
          for (const dep of depTimelines) {
            const adj = isOrigin ? dep - BOARDING_BUFFER_MIN : dep + offset;
            if (adj - nowMin < -1) continue; // ya pasó por aquí
            if (best == null || adj < best) best = adj;
          }
          arrTimeline = best;
        }

        if (arrTimeline == null) continue;

        const arrDelta = arrTimeline - nowMin;
        const arrAbs = ((arrTimeline % 1440) + 1440) % 1440;
        const hh = String(Math.floor(arrAbs / 60)).padStart(2, "0");
        const mm = String(Math.round(arrAbs % 60)).padStart(2, "0");
        out[dir].set(stops[i].code, {
          min: Math.max(0, Math.round(arrDelta)),
          time: `${hh}:${mm}`,
        });
      }
    }

    return out;
  }, [isNightLine, serviceRows, departures, code, stopsByDir, stopCoords, clock]);
  const scheduleEtaByDir = nightEtaByDir;


  // Detección HTTPS producción: usamos motor predictivo en lugar de live ETAs
  // (Akamai bloquea las llamadas reales). En preview/local mantenemos el bus QR.
  const usePredict = useMemo(() => {
    if (typeof window === "undefined") return false;
    const h = window.location.hostname;
    if (/^id-preview--/.test(h)) return false;
    if (h === "localhost" || h === "127.0.0.1") return false;
    return true;
  }, []);

  // Realtime progresivo: cada parada pide ETA solo cuando entra en viewport.
  // Saltamos en líneas nocturnas — usamos estimación por horario oficial.
  // Saltamos también en HTTPS prod — usamos el motor predictivo.
  const [etas, setEtas] = useState<Record<string, number[]>>({});
  const [loadingEtaStops, setLoadingEtaStops] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setEtas({});
    setLoadingEtaStops(new Set());
  }, [code]);

  const handleEtaLoading = useCallback((stopCode: string, loading: boolean) => {
    setLoadingEtaStops((prev) => {
      const next = new Set(prev);
      if (loading) next.add(stopCode);
      else next.delete(stopCode);
      return next;
    });
  }, []);

  const handleStopEta = useCallback((stopCode: string, all: number[]) => {
    setEtas((prev) => ({ ...prev, [stopCode]: all.slice(0, 1) }));
  }, []);

  const initialRealtimeStopCodes = useMemo(() => {
    const codes = [
      ...nearestByDir[1].map((n) => n.code),
      ...nearestByDir[2].map((n) => n.code),
    ];
    return [...new Set(codes)].slice(0, 2);
  }, [nearestByDir]);

  useEffect(() => {
    if (usePredict || isNightLine || initialRealtimeStopCodes.length === 0) return;
    let cancelled = false;
    setLoadingEtaStops((prev) => {
      const next = new Set(prev);
      for (const stopCode of initialRealtimeStopCodes) next.add(stopCode);
      return next;
    });

    getClientStopsRealtimeBatch({ stopIds: initialRealtimeStopCodes, line: code })
      .then((batch) => {
        if (cancelled) return;
        setEtas((prev) => {
          const next = { ...prev };
          for (const [stopCode, all] of Object.entries(batch)) next[stopCode] = all.slice(0, 1);
          return next;
        });
      })
      .finally(() => {
        if (cancelled) return;
        setLoadingEtaStops((prev) => {
          const next = new Set(prev);
          for (const stopCode of initialRealtimeStopCodes) next.delete(stopCode);
          return next;
        });
      });

    return () => {
      cancelled = true;
    };
  }, [code, initialRealtimeStopCodes, isNightLine, usePredict]);

  // Motor predictivo: ver definición de `usePredict` arriba.
  const { data: engine } = useBusEngine();

  const [predictedBusesByDir, setPredictedBusesByDir] = useState<
    Record<1 | 2, { busId: string; segmentIndex: number; segmentProgress: number }[]>
  >({ 1: [], 2: [] });

  useEffect(() => {
    if (!usePredict || !engine || isNightLine) return;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const state = predictLineState(engine, code, new Date());

      // 1) ETAs por parada: mejor (menor) etaMin por stopCode.
      const best: Record<string, number> = {};
      for (const e of state.stops) {
        if (e.etaMin < 0) continue;
        const prev = best[e.stopCode];
        if (prev == null || e.etaMin < prev) best[e.stopCode] = e.etaMin;
      }
      setEtas((prev) => {
        const next: Record<string, number[]> = { ...prev };
        for (const dir of [1, 2] as const) {
          for (const s of stopsByDir[dir]) {
            const v = best[s.code];
            if (typeof v === "number") next[s.code] = [v];
          }
        }
        return next;
      });

      // 2) Buses activos por dirección con segmentIndex/progress para overlay.
      const byDir: Record<1 | 2, { busId: string; segmentIndex: number; segmentProgress: number }[]> = {
        1: [],
        2: [],
      };
      for (const b of state.buses) {
        if (b.status !== "moving") continue;
        byDir[b.direction].push({
          busId: b.busId,
          segmentIndex: b.segmentIndex,
          segmentProgress: b.segmentProgress,
        });
      }
      setPredictedBusesByDir(byDir);
    };
    tick();
    const id = setInterval(tick, 400);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [usePredict, engine, code, isNightLine, stopsByDir]);



  const lineCategory = classifyLine(code);
  const catColor = lineCategory === "urban" ? "#EF4444" : "#3B82F6";
  const catGradientEnd = lineCategory === "urban" ? "#B91C1C" : "#1E3A8A";
  const lineColor = line?.color || catColor;

  const inService = isNightLine
    ? nightEtaByDir[1].size > 0 || nightEtaByDir[2].size > 0
    : Object.values(etas).some((arr) => arr && arr.length > 0) || loadingEtaStops.size > 0;


  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-black px-6 text-center text-white">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-5">
          <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-white/70" />
          <p className="font-sans text-sm font-bold not-italic text-white">Cargando paradas…</p>
        </div>
      </div>
    );
  }


  return (
    <div className="h-[100dvh] lg:h-auto overflow-y-auto lg:overflow-visible overscroll-contain bg-black text-white">
      <div className="mx-auto max-w-3xl px-3 py-4">
        {/* HEADER */}
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => {
              try {
                sessionStorage.setItem("agent:open-bus-picker", "1");
              } catch {
                /* noop */
              }
              navigate({ to: "/" });
            }}
            className="mt-1 inline-flex h-9 w-9 items-center justify-center rounded-full text-white hover:bg-white/10"
            aria-label="Volver"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center gap-0.5 text-base font-black text-white shadow-lg"
            style={{
              background: `linear-gradient(160deg, ${catColor} 0%, ${catGradientEnd} 100%)`,
              borderRadius: 12,
            }}
          >
            {lineCategory === "night" && <span aria-hidden>🌙</span>}
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

        {/* Etiqueta de paradas cercanas */}
        {geoStatus === "ok" && (nearestByDir[1].length > 0 || nearestByDir[2].length > 0) && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-[#C9922A]/40 bg-[#C9922A]/10 px-3 py-2">
            <MapPin className="h-4 w-4 text-[#C9922A]" />
            <span className="font-sans text-[11px] font-bold not-italic uppercase tracking-wide text-[#C9922A]">
              Paradas más cercanas a tu ubicación
            </span>
          </div>
        )}




        {/* COLUMNAS IDA / VUELTA */}
        <div className="mt-4 grid grid-cols-2 divide-x divide-white/10 overflow-hidden rounded-2xl border border-white/10 p-2" style={{ background: "linear-gradient(to right, rgba(191,219,254,0.60) 0%, rgba(191,219,254,0.60) 50%, rgba(30,58,138,0.65) 50%, rgba(30,58,138,0.65) 100%)" }}>
          <DirectionColumn
            label="IDA"
            direction={1}
            stops={stopsByDir[1]}
            etas={etas}
            lineCode={code}
            realtimeEnabled={!isNightLine}
            loadingEtaStops={loadingEtaStops}
            onEtaLoading={handleEtaLoading}
            onStopEta={handleStopEta}
            nightEtaByCode={scheduleEtaByDir[1]}
            color={lineColor}
            inService={inService}
            transferLines={(c) => {
              if (isNightLine) return [];
              const others = transfersByStop.get(c);
              if (!others) return [];
              return topTransfers.filter((t) => others.has(t.code));
            }}
            onPickStop={handlePickStop}
            nearestList={nearestByDir[1]}
            geoStatus={geoStatus}
            predictedBuses={predictedBusesByDir[1]}
            disableLiveFetch={usePredict}
          />

          <DirectionColumn
            label="VUELTA"
            direction={2}
            stops={stopsByDir[2]}
            etas={etas}
            lineCode={code}
            realtimeEnabled={!isNightLine}
            loadingEtaStops={loadingEtaStops}
            onEtaLoading={handleEtaLoading}
            onStopEta={handleStopEta}
            nightEtaByCode={scheduleEtaByDir[2]}
            color={lineColor}
            inService={inService}
            transferLines={(c) => {
              if (isNightLine) return [];
              const others = transfersByStop.get(c);
              if (!others) return [];
              return topTransfers.filter((t) => others.has(t.code));
            }}
            onPickStop={handlePickStop}
            nearestList={nearestByDir[2]}
            geoStatus={geoStatus}
            predictedBuses={predictedBusesByDir[2]}
          />

        </div>

        {/* LEYENDA */}
        {!isNightLine && topTransfers.length > 0 && (
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

function HeaderEtas({
  nearestIda,
  nearestVuelta,
  stopsIda,
  stopsVuelta,
  etas,
  geoStatus,
  color,
  now,
  updatedAt,
}: {
  nearestIda: { code: string; distance: number } | null;
  nearestVuelta: { code: string; distance: number } | null;
  stopsIda: StopRow[];
  stopsVuelta: StopRow[];
  etas: Record<string, number[]>;
  geoStatus: "idle" | "loading" | "ok" | "unavailable";
  color: string;
  now: Date;
  updatedAt: string | null;
}) {
  const updatedTs = updatedAt ? new Date(updatedAt).getTime() : Date.now();
  const cell = (
    label: string,
    nearest: { code: string; distance: number } | null,
    stops: StopRow[],
  ) => {
    const stop = nearest ? stops.find((s) => s.code === nearest.code) : null;
    const next = nearest ? etas[nearest.code]?.[0] : undefined;
    let liveMin: number | null = null;
    let arrival: Date | null = null;
    if (typeof next === "number") {
      arrival = new Date(updatedTs + Math.max(0, next) * 60_000);
      liveMin = Math.max(0, Math.round((arrival.getTime() - now.getTime()) / 60_000));
    }
    return (
      <div className="flex-1 min-w-0 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span
            className="font-sans text-[10px] font-extrabold not-italic uppercase tracking-wide"
            style={{ color }}
          >
            {label}
          </span>
          {geoStatus === "ok" && nearest ? (
            <span className="flex items-center gap-0.5 text-[10px] text-[#C9922A]">
              <MapPin className="h-3 w-3" />
              {nearest.distance < 1000
                ? `${Math.round(nearest.distance)} m`
                : `${(nearest.distance / 1000).toFixed(1)} km`}
            </span>
          ) : (
            <span className="text-[10px] text-white/40">n/d</span>
          )}
        </div>
        <div className="truncate font-sans text-[11px] not-italic text-white/70">
          {stop?.name ?? "—"}
        </div>
        <div className="mt-1 flex items-baseline justify-between gap-2">
          <span className="font-sans text-[11px] not-italic text-white/80">
            {liveMin == null
              ? "Sin paso"
              : liveMin <= 0
                ? "Llegando"
                : `Faltan ${liveMin} min`}
          </span>
          <span className="font-mono text-lg font-bold tabular-nums text-white">
            {arrival ? formatHHMM(arrival) : "--:--"}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="mt-3 grid grid-cols-2 divide-x divide-white/10 rounded-2xl border border-white/10 bg-white/[0.03]">
      {cell("Ida", nearestIda, stopsIda)}
      {cell("Vuelta", nearestVuelta, stopsVuelta)}
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

function VisibleStopRealtime({
  stopCode,
  lineCode,
  onLoading,
  onEta,
}: {
  stopCode: string;
  lineCode: string;
  onLoading: (stopCode: string, loading: boolean) => void;
  onEta: (stopCode: string, all: number[]) => void;
}) {
  const sentinelRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    let visible = false;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let controller: AbortController | null = null;

    const clearTimer = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const load = async () => {
      if (cancelled || !visible || document.visibilityState !== "visible") return;
      controller?.abort();
      controller = new AbortController();
      onLoading(stopCode, true);
      try {
        const r = await getClientStopRealtime({ stopId: stopCode, line: lineCode, signal: controller.signal });
        if (!cancelled) onEta(stopCode, r.all);
      } finally {
        if (!cancelled) onLoading(stopCode, false);
        clearTimer();
        if (!cancelled && visible) timer = setTimeout(load, 20_000);
      }
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = Boolean(entry?.isIntersecting);
        if (visible) void load();
        else {
          clearTimer();
          controller?.abort();
          onLoading(stopCode, false);
        }
      },
      { root: null, rootMargin: "180px 0px", threshold: 0.01 },
    );
    observer.observe(node);

    return () => {
      cancelled = true;
      clearTimer();
      controller?.abort();
      observer.disconnect();
      onLoading(stopCode, false);
    };
  }, [lineCode, onEta, onLoading, stopCode]);

  return <span ref={sentinelRef} className="absolute inset-x-0 -top-20 h-px" aria-hidden />;
}

function DirectionColumn({
  label,
  direction,
  stops,
  etas,
  lineCode,
  realtimeEnabled,
  loadingEtaStops,
  onEtaLoading,
  onStopEta,
  nightEtaByCode,
  color,
  inService,
  transferLines,
  onPickStop,
  nearestList,
  geoStatus,
  predictedBuses,
  disableLiveFetch,
}: {
  label: string;
  direction: 1 | 2;
  stops: StopRow[];
  etas: Record<string, number[]>;
  lineCode: string;
  realtimeEnabled: boolean;
  loadingEtaStops: Set<string>;
  onEtaLoading: (stopCode: string, loading: boolean) => void;
  onStopEta: (stopCode: string, all: number[]) => void;
  nightEtaByCode: Map<string, { min: number; time: string }> | null;
  color: string;
  inService: boolean;
  transferLines: (stopCode: string) => { code: string; color: string }[];
  onPickStop: (stopCode: string, stopName: string, destination: string) => void;
  nearestList: { code: string; distance: number }[];
  geoStatus: "idle" | "loading" | "ok" | "unavailable";
  predictedBuses?: { busId: string; segmentIndex: number; segmentProgress: number }[];
  disableLiveFetch?: boolean;
}) {

  const now = new Date();
  const nearest = nearestList[0] ?? null;
  const nearestCodes = useMemo(() => new Set(nearestList.map((n) => n.code)), [nearestList]);
  const distanceByCode = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of nearestList) m.set(n.code, n.distance);
    return m;
  }, [nearestList]);

  // Refs por parada para poder calcular posiciones Y del bus overlay.
  const stopRefs = useRef<(HTMLLIElement | null)[]>([]);
  const olRef = useRef<HTMLOListElement | null>(null);
  const [busPositions, setBusPositions] = useState<{ busId: string; top: number }[]>([]);

  useEffect(() => {
    if (!predictedBuses || predictedBuses.length === 0) {
      setBusPositions([]);
      return;
    }
    const ol = olRef.current;
    if (!ol) return;
    const olTop = ol.getBoundingClientRect().top;
    const positions: { busId: string; top: number }[] = [];
    for (const b of predictedBuses) {
      const a = stopRefs.current[b.segmentIndex];
      const c = stopRefs.current[b.segmentIndex + 1];
      if (!a || !c) continue;
      const aRect = a.getBoundingClientRect();
      const cRect = c.getBoundingClientRect();
      // Centro vertical del badge (badge tiene h-9 = 36px, está cerca del top de cada <li>).
      const aY = aRect.top - olTop + 18;
      const cY = cRect.top - olTop + 18;
      const y = aY + (cY - aY) * b.segmentProgress;
      positions.push({ busId: b.busId, top: y });
    }
    setBusPositions(positions);
  }, [predictedBuses, stops]);



  return (
    <div className="px-1">
      <div className="mb-2 flex items-center justify-between gap-2 pt-1">
        <div className="relative flex items-center gap-1 pl-14">
          <ArrowDown
            style={{ color: direction === 1 ? "#000" : "#fff", left: "26px", transform: "translateX(-50%)" }}
            strokeWidth={4}
            className="absolute top-1/2 -translate-y-1/2 h-12 w-12"
          />
          <span
            className="font-sans text-base font-extrabold not-italic"
            style={{ color: direction === 1 ? "#000" : "#fff" }}
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
              ? "bg-[#C9922A] shadow-[0_0_6px_rgba(201,146,42,0.8)]"
              : "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.7)]",
          ].join(" ")}
        />

      </div>

      {stops.length > 0 && (
        <p className="mb-1.5 truncate font-sans text-[11px] not-italic text-white/70">
          {stops[0].name} → {stops[stops.length - 1].name}
        </p>
      )}

      {/* Parada más cercana */}
      <div className="mb-2 flex items-center gap-1 rounded-md border border-[#C9922A]/30 bg-[#C9922A]/10 px-2 py-1">
        <MapPin className="h-3 w-3 text-[#C9922A]" />
        <span className="font-sans text-[9px] font-semibold not-italic uppercase tracking-wide text-[#C9922A]/80">
          Más cercana
        </span>
        <span className="ml-auto font-sans text-[10px] font-bold not-italic tabular-nums text-[#C9922A]">
          {geoStatus === "unavailable"
            ? "n/d"
            : nearest
              ? `${Math.round(nearest.distance)} m`
              : geoStatus === "loading"
                ? "…"
                : "n/d"}
        </span>
      </div>


      {(() => { /* color del rail vertical: IDA gris claro, VUELTA gris oscuro */ return null; })()}
      <ol ref={olRef} className="relative" style={{ display: "flex", flexDirection: "column", gap: "6mm" }}>
        {stops.length > 1 && (
          <span
            aria-hidden
            className="absolute left-6 top-3 bottom-3 w-[4px] rounded-full"
            style={{ background: direction === 1 ? "#000" : "#fff" }}
          />
        )}
        {/* Overlay: buses predichos deslizándose entre paradas */}
        {busPositions.map((bp) => (
          <img
            key={bp.busId}
            src={busAlicanteImg}
            alt=""
            aria-hidden
            className="pointer-events-none absolute z-30 h-8 w-8 -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]"
            style={{
              left: "24px",
              top: `${bp.top}px`,
              transition: "top 400ms linear",
            }}
          />
        ))}

        {stops.map((s, i) => {
          const hasRealtimeResult = Object.prototype.hasOwnProperty.call(etas, s.code);
          const arr = etas[s.code] ?? [];
          const liveEta = arr[0];
          const scheduleEta = nightEtaByCode?.get(s.code) ?? null;
          // Día: prefer live; fallback a horario. Noche (no realtime): solo horario.
          const eta1 = realtimeEnabled
            ? (typeof liveEta === "number" ? liveEta : scheduleEta?.min)
            : scheduleEta?.min;
          const hasEta = typeof eta1 === "number";
          const isLoadingEta = realtimeEnabled && loadingEtaStops.has(s.code) && !hasEta;
          const isOrigin = i === 0;
          const isDest = i === stops.length - 1;
          const transfers = transferLines(s.code);
          const transferColor = transfers[0]?.color ?? null;
          const etaTime = realtimeEnabled
            ? (typeof liveEta === "number"
                ? formatHHMM(new Date(now.getTime() + liveEta * 60_000))
                : scheduleEta?.time ?? null)
            : scheduleEta?.time ?? null;
          

          const isNearest = nearestCodes.has(s.code);
          const isPrimaryNearest = nearest?.code === s.code;
          const nearestDistance = distanceByCode.get(s.code);

          return (
            <li
              key={`${s.code}-${i}`}
              ref={(el) => { stopRefs.current[i] = el; }}
              className="relative flex flex-col gap-1 rounded-md pb-2"

              style={{
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                boxShadow: isNearest
                  ? "0 0 0 2px rgba(201,146,42,0.9), 0 0 14px rgba(201,146,42,0.45)"
                  : "0 1px 0 rgba(0,0,0,0.4)",
                background: isNearest
                  ? "linear-gradient(90deg, rgba(201,146,42,0.28) 0%, rgba(201,146,42,0.10) 70%, transparent 100%)"
                  : transferColor
                    ? `linear-gradient(90deg, ${transferColor}26 0%, ${transferColor}10 60%, transparent 100%)`
                    : undefined,
              }}
            >
              {!isDest && (
                <ChevronDown
                  aria-hidden
                  className="pointer-events-none absolute -bottom-3 left-[14px] z-20 h-6 w-6"
                  strokeWidth={3}
                  style={{ color: direction === 1 ? "#000" : "#fff" }}
                />
              )}

              <div className="flex items-center gap-1 self-start">
                {(isOrigin || isDest) && (
                  <span
                    className="inline-block rounded px-1.5 py-0.5 font-sans text-[9px] font-bold not-italic uppercase tracking-wide text-white"
                    style={{ background: color }}
                  >
                    {isOrigin ? "Origen" : "Destino"}
                  </span>
                )}
              </div>

              {realtimeEnabled && !disableLiveFetch && (
                <VisibleStopRealtime
                  stopCode={s.code}
                  lineCode={lineCode}
                  onLoading={onEtaLoading}
                  onEta={onStopEta}
                />
              )}

              <button
                type="button"
                onClick={() => onPickStop(s.code, s.name, stops[stops.length - 1]?.name ?? "")}
                className="flex w-full items-start gap-2 rounded-md text-left transition hover:bg-white/5 active:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                aria-label={`Ver tiempo real de ${s.name}`}
              >
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
                    {isLoadingEta ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : hasEta && eta1 === 0 ? (
                      <img
                        src={busAlicanteImg}
                        alt="Bus"
                        className="h-7 w-7 object-contain"
                      />
                    ) : (
                      <>
                        <span className="font-sans text-[12px] font-extrabold not-italic tabular-nums">
                          {hasEta ? eta1 : hasRealtimeResult ? "n/d" : "—"}
                        </span>
                        <span className="font-sans text-[8px] font-bold not-italic">
                          {hasEta ? "min" : ""}
                        </span>
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
                      {etaTime ?? (hasRealtimeResult ? "n/d" : "--:--")}
                    </span>
                    <span className="font-sans text-[9px] font-medium not-italic uppercase tracking-wide text-white/50">
                      estimado
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-sans text-[12px] font-semibold not-italic leading-snug text-white">
                      {s.name}
                    </span>
                    {isNearest && nearestDistance != null && (
                      <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-[#C9922A] px-1.5 py-0.5 font-sans text-[9px] font-bold not-italic uppercase tracking-wide text-black">
                        <MapPin className="h-2.5 w-2.5" />
                        {Math.round(nearestDistance)} m
                      </span>
                    )}
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
              </button>
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
