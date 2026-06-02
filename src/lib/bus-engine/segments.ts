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

// Devuelve el tiempo estimado del segmento aplicando perfil horario y stats aprendidos.
export function segmentMinutes(opts: {
  stat: SegmentStat | undefined;
  distanceM: number;
  profile: TimeProfile;
}): { minutes: number; confidence: number } {
  const { stat, distanceM, profile } = opts;
  const baseline = segmentBaselineMin(distanceM, profile);

  if (!stat) {
    return { minutes: baseline, confidence: 0.3 };
  }

  // Selección por perfil si hay valor específico, si no avgMinutes ajustado por factor.
  let base = stat.avgMinutes;
  if (profile === "morning_peak" || profile === "afternoon_peak") {
    base = stat.rushMinutes ?? stat.avgMinutes * profileSpeedFactor(profile);
  } else if (profile === "night") {
    base = stat.nightMinutes ?? stat.avgMinutes * profileSpeedFactor(profile);
  } else if (profile === "weekend") {
    base = stat.weekendMinutes ?? stat.avgMinutes * profileSpeedFactor(profile);
  } else if (profile === "holiday") {
    base = stat.holidayMinutes ?? stat.avgMinutes * profileSpeedFactor(profile);
  } else {
    base = stat.avgMinutes * profileSpeedFactor(profile);
  }

  return { minutes: Math.max(0.3, base), confidence: stat.confidence };
}
