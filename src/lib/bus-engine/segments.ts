// Tiempos de segmento aprendidos, con fallback a velocidad urbana.

import type { SegmentStat } from "./types";
import type { TimeProfile } from "./peak-detector";
import { profileSpeedFactor } from "./peak-detector";

// Velocidades fallback (km/h). Sin red, sin estado.
const URBAN_KMH_DAY = 16;
const URBAN_KMH_NIGHT = 28;
const DWELL_MIN_PER_STOP = 0.25;

export function segmentKey(line: string, dir: number, from: string, to: string): string {
  return `${line}|${dir}|${from}|${to}`;
}

export function segmentBaselineMin(distanceM: number, profile: TimeProfile): number {
  const kmh = profile === "night" ? URBAN_KMH_NIGHT : URBAN_KMH_DAY;
  const travelMin = (distanceM / 1000 / kmh) * 60;
  return travelMin + DWELL_MIN_PER_STOP;
}

// Tiempo estimado de segmento. ESTRUCTURAL y simétrico para TODAS las líneas:
// en este modelo no hay snapshots, ni fotos, ni Bridge, ni llamadas externas;
// por tanto `bus_segment_stats` (avg_minutes/rush/night aprendidos) NO es una
// fuente válida — está contaminado por una ingesta histórica que ya no existe.
//
// El cálculo único:
//   tiempo = distancia_routed / velocidad_baseline · factor_perfil + dwell
//
// `stat` se acepta en la firma sólo por compatibilidad con call-sites; se
// IGNORA por completo. Así línea 12 y cualquier otra usan exactamente la
// misma física.
export function segmentMinutes(opts: {
  stat: SegmentStat | undefined;
  distanceM: number;
  profile: TimeProfile;
}): { minutes: number; confidence: number } {
  const { distanceM, profile } = opts;
  const baseline = segmentBaselineMin(distanceM, profile);
  const adjusted = baseline * (1 / profileSpeedFactor(profile));
  // profileSpeedFactor ya invierte para hora punta (=1/1.10): aplicamos el
  // factor sobre el tramo travel, no sobre dwell. Reconstruimos:
  const kmh = profile === "night" ? 28 : 16;
  const travelMin = (distanceM / 1000 / kmh) * 60 / profileSpeedFactor(profile);
  const minutes = Math.max(0.3, travelMin + 0.25);
  void adjusted;
  return { minutes, confidence: 0.5 };
}
