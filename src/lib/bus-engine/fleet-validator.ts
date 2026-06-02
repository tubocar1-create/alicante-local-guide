// Validador de consistencia de flota virtual.
// Reglas duras:
//   - sin duplicados (mismo trip_key/dirección),
//   - spacing entre buses en [headway*0.45, headway*2.2],
//   - velocidad razonable [6, 42] km/h,
//   - tope: fleet_size + 1.
//
// Devuelve la flota saneada + un reporte para que el motor sepa cuánto descartó
// (entrada en SAFE MODE depende de eso).

import type { VirtualBus } from "./types";
import { fleetSizeCap } from "./fleet-sizer";

const URBAN_MIN_KMH = 6;
const URBAN_MAX_KMH = 42;

export type ValidatorReport = {
  inputCount: number;
  outputCount: number;
  removedDuplicates: number;
  removedBadSpacing: number;
  removedBadSpeed: number;
  removedCap: number;
  removedRatio: number; // fraction removed
};

export function validateFleetConsistency(opts: {
  fleet: VirtualBus[];
  cycleMin: number;
  headwayMin: number;
  speeds: Map<string, number>; // busId → km/h
}): { fleet: VirtualBus[]; report: ValidatorReport } {
  const inputCount = opts.fleet.length;
  let removedDuplicates = 0;
  let removedBadSpacing = 0;
  let removedBadSpeed = 0;
  let removedCap = 0;

  // 1. Dedupe por busId.
  const seen = new Set<string>();
  let work: VirtualBus[] = [];
  for (const b of opts.fleet) {
    if (seen.has(b.busId)) {
      removedDuplicates++;
      continue;
    }
    seen.add(b.busId);
    work.push(b);
  }

  // 2. Velocidad fuera de rango → degradar y, si extrema, descartar.
  work = work.filter((b) => {
    const v = opts.speeds.get(b.busId);
    if (v == null) return true;
    if (v < 0 || v > URBAN_MAX_KMH * 1.5) {
      removedBadSpeed++;
      return false;
    }
    if (v < URBAN_MIN_KMH * 0.5) {
      // muy lento sostenido sería terminal_wait; aquí no descartamos, sólo degradamos
      b.confidence = Math.max(0.25, b.confidence * 0.7);
    }
    return true;
  });

  // 3. Spacing por dirección (ordenamos por elapsedMin, calculamos diffs).
  const minSpacing = opts.headwayMin * 0.45;
  const maxSpacing = opts.headwayMin * 2.2;
  for (const dir of [1, 2] as const) {
    const inDir = work
      .filter((b) => b.direction === dir)
      .sort((a, b) => a.elapsedMin - b.elapsedMin);
    for (let i = 1; i < inDir.length; i++) {
      const prev = inDir[i - 1];
      const cur = inDir[i];
      const gap = cur.elapsedMin - prev.elapsedMin;
      if (gap < minSpacing) {
        // Fusionar: descartamos el de menor confianza.
        const weak = prev.confidence <= cur.confidence ? prev : cur;
        const idx = work.indexOf(weak);
        if (idx >= 0) {
          work.splice(idx, 1);
          removedBadSpacing++;
        }
      } else if (gap > maxSpacing) {
        // Demasiado lejos: degradamos confianza pero no eliminamos.
        cur.confidence = Math.max(0.3, cur.confidence * 0.85);
      }
    }
  }

  // 4. Cap final.
  const cap = fleetSizeCap(opts.cycleMin, opts.headwayMin);
  if (cap > 0 && work.length > cap) {
    work.sort((a, b) => b.confidence - a.confidence);
    const trimmed = work.slice(0, cap);
    removedCap = work.length - trimmed.length;
    work = trimmed;
  }

  const outputCount = work.length;
  const removedRatio = inputCount > 0 ? (inputCount - outputCount) / inputCount : 0;
  return {
    fleet: work,
    report: {
      inputCount,
      outputCount,
      removedDuplicates,
      removedBadSpacing,
      removedBadSpeed,
      removedCap,
      removedRatio,
    },
  };
}
