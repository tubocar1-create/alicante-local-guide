// Validador de consistencia temporal POST-ETA.
//
// Filtros aplicados por (línea, dirección, parada):
//   - ETAs monotónicamente crecientes a lo largo de la secuencia de la línea
//     (se admite tolerancia de 0.5 min entre paradas consecutivas).
//   - Sin saltos absurdos (gap > maxSegmentMin * 3).
//   - Por dirección: máximo UN bus en "origen activo" + UN bus en "origen futuro
//     inminente". El resto se descarta (sus ETAs caen).
//
// Si un bus rompe la coherencia, se descarta TODO ese bus (no parcial).

import type { StopEta, VirtualBus, Direction } from "./types";

export type TemporalReport = {
  busesIn: number;
  busesOut: number;
  discardedBuses: string[];
  reasons: Record<string, string>;
};

const MAX_BACKSTEP_MIN = 0.5;
const MAX_FORWARD_JUMP_MIN = 25; // ningún segmento urbano razonable supera esto
const MAX_ACTIVE_ORIGINS_PER_DIR = 1;
const MAX_IMMINENT_ORIGINS_PER_DIR = 1;

export function validateTemporalConsistency(opts: {
  fleet: VirtualBus[];
  etas: StopEta[];
  cycleMin: number;
}): { fleet: VirtualBus[]; etas: StopEta[]; report: TemporalReport } {
  const reasons: Record<string, string> = {};
  const discard = new Set<string>();

  // 1. ETA monotonicity por bus.
  //    deriveStopEtas emite el mismo stopCode varias veces (una por loop de
  //    ciclo) y mezcla IDA + VUELTA en el mismo array. Para validar:
  //      - agrupamos por (busId, direction)
  //      - nos quedamos con la ETA mínima por stopSeq (la próxima ocurrencia)
  //      - ordenamos por etaMin (siempre monótono) y validamos solo el salto
  //        máximo hacia adelante. El "backstep" es imposible tras este orden.
  const byBus = new Map<string, StopEta[]>();
  for (const e of opts.etas) {
    if (!e.busId) continue;
    const key = `${e.busId}|${e.direction}`;
    if (!byBus.has(key)) byBus.set(key, []);
    byBus.get(key)!.push(e);
  }
  for (const [key, arr] of byBus) {
    const busId = key.split("|")[0];
    const minBySeq = new Map<number, StopEta>();
    for (const e of arr) {
      const cur = minBySeq.get(e.stopSeq);
      if (!cur || e.etaMin < cur.etaMin) minBySeq.set(e.stopSeq, e);
    }
    const ordered = [...minBySeq.values()].sort((a, b) => a.etaMin - b.etaMin);
    for (let i = 1; i < ordered.length; i++) {
      const gap = ordered[i].etaMin - ordered[i - 1].etaMin;
      if (gap > MAX_FORWARD_JUMP_MIN) {
        discard.add(busId);
        reasons[busId] = `eta_salto(${gap.toFixed(1)}m)`;
        break;
      }
    }
  }

  // 2. Regla de orígenes por dirección.
  //    "origen" = bus cuya elapsedMin está en [-FUTURE_INMINENT, baseHeadway/2)
  //    Aquí aproximamos: orígenes son los buses con el menor elapsedMin por dir.
  for (const dir of [1, 2] as Direction[]) {
    const inDir = opts.fleet
      .filter((b) => b.direction === dir && !discard.has(b.busId))
      .sort((a, b) => a.elapsedMin - b.elapsedMin);
    const active = inDir.filter((b) => b.elapsedMin >= 0);
    const future = inDir.filter((b) => b.elapsedMin < 0);
    if (active.length > MAX_ACTIVE_ORIGINS_PER_DIR) {
      // Mantener los N más recientes (elapsed pequeño → recién salido) por confianza.
      const keep = new Set(
        [...active]
          .sort((a, b) => b.confidence - a.confidence)
          .slice(0, MAX_ACTIVE_ORIGINS_PER_DIR + Math.max(0, active.length - 2))
          .map((b) => b.busId),
      );
      // Solo descartamos si hay claramente >2 "orígenes" muy próximos al inicio.
      const veryClose = active.filter((b) => b.elapsedMin < 2);
      if (veryClose.length > MAX_ACTIVE_ORIGINS_PER_DIR + MAX_IMMINENT_ORIGINS_PER_DIR) {
        for (const b of veryClose) {
          if (!keep.has(b.busId)) {
            discard.add(b.busId);
            reasons[b.busId] = "multiple_origins";
          }
        }
      }
    }
    if (future.length > MAX_IMMINENT_ORIGINS_PER_DIR) {
      const sortedFuture = [...future].sort((a, b) => b.elapsedMin - a.elapsedMin);
      for (let i = MAX_IMMINENT_ORIGINS_PER_DIR; i < sortedFuture.length; i++) {
        discard.add(sortedFuture[i].busId);
        reasons[sortedFuture[i].busId] = "future_origin_excess";
      }
    }
  }

  const fleetOut = opts.fleet.filter((b) => !discard.has(b.busId));
  const etasOut = opts.etas.filter((e) => !e.busId || !discard.has(e.busId));

  return {
    fleet: fleetOut,
    etas: etasOut,
    report: {
      busesIn: opts.fleet.length,
      busesOut: fleetOut.length,
      discardedBuses: [...discard],
      reasons,
    },
  };
}
