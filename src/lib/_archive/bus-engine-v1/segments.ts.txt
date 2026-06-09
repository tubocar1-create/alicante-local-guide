// Tiempos de segmento aprendidos, con fallback a velocidad urbana.

import type { SegmentStat } from "./types";
import type { TimeProfile } from "./peak-detector";


// Velocidades estructurales (km/h). Aplican a TODAS las líneas por igual.
// SOLO el administrador puede modificar estos valores — no hay override por
// línea, ni aprendizaje, ni ajuste dinámico desde el cliente.
const URBAN_KMH_DAY = 21;
const URBAN_KMH_NIGHT = 28;
const DWELL_MIN_PER_STOP = 0.25;

// Overrides puntuales por línea/dirección/tramo. Solo el administrador los
// edita aquí. La clave es `${line}|${dir}|${fromCode}|${toCode}`.
// Línea 12: tramos definidos manualmente por velocidad real observada.
const SEGMENT_KMH_OVERRIDES: Record<string, number> = (() => {
  const map: Record<string, number> = {};
  const add = (line: string, dir: number, codes: string[], kmh: number) => {
    for (let i = 0; i < codes.length - 1; i++) {
      map[`${line}|${dir}|${codes[i]}|${codes[i + 1]}`] = kmh;
    }
  };
  // L12 IDA (dir 1): Puerta del Mar → Estación Correos a 14 kph
  add("12", 1, ["4359","4082","2682","3937","2947","4264","4117","4118","4301"], 14);
  // L12 IDA (dir 1): Estación Correos → Juan Pablo II a 21 kph
  add("12", 1, ["4301","4302","4303","4304","4305","4306","5101","5125","5102","5103","5104","5105","5109","4332"], 21);
  // L12 VUELTA (dir 2): Juan Pablo II → C. Salud San Blas a 24 kph
  add("12", 2, ["4332","5118","5110","5111","5112","5119","5124","5114","4318"], 24);
  // L12 VUELTA (dir 2): C. Salud San Blas → Puerta del Mar a 14 kph
  add("12", 2, ["4318","4363","4322","4323","4325","4108","4109","4445","3915","2606","4359"], 14);
  return map;
})();

export function segmentKey(line: string, dir: number, from: string, to: string): string {
  return `${line}|${dir}|${from}|${to}`;
}

export function segmentBaselineMin(distanceM: number, profile: TimeProfile): number {
  const kmh = profile === "night" ? URBAN_KMH_NIGHT : URBAN_KMH_DAY;
  const travelMin = (distanceM / 1000 / kmh) * 60;
  return travelMin + DWELL_MIN_PER_STOP;
}

// Tiempo estimado de segmento. ESTRUCTURAL para TODAS las líneas:
//   tiempo = distancia_routed / velocidad_baseline + dwell
// Si existe override por tramo (ver SEGMENT_KMH_OVERRIDES) se usa esa kmh
// en lugar de la baseline estructural.
export function segmentMinutes(opts: {
  stat: SegmentStat | undefined;
  distanceM: number;
  profile: TimeProfile;
  lineCode?: string;
  direction?: number;
  fromStopCode?: string;
  toStopCode?: string;
}): { minutes: number; confidence: number } {
  const { distanceM, profile, lineCode, direction, fromStopCode, toStopCode } = opts;
  const baselineKmh = profile === "night" ? URBAN_KMH_NIGHT : URBAN_KMH_DAY;
  let kmh = baselineKmh;
  if (lineCode && direction != null && fromStopCode && toStopCode) {
    const ov = SEGMENT_KMH_OVERRIDES[`${lineCode}|${direction}|${fromStopCode}|${toStopCode}`];
    if (ov && ov > 0) kmh = ov;
  }
  const travelMin = (distanceM / 1000 / kmh) * 60;
  const minutes = Math.max(0.3, travelMin + DWELL_MIN_PER_STOP);
  return { minutes, confidence: 0.5 };
}
