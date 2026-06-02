// Aprendizaje incremental: weighted moving average (WMA) y reconciliación.
// Estas funciones son puras y se ejecutan tanto en cliente como en servidor.

export type WmaUpdate = {
  newAvg: number;
  newVariance: number;
  newSamples: number;
  newConfidence: number;
};

// alpha = peso de la nueva muestra (0..1). Más muestras → más estabilidad.
// alpha decrece con N para acercarse a media estadística estable.
export function wmaUpdate(opts: {
  prevAvg: number;
  prevVariance: number;
  prevSamples: number;
  observation: number;
  weight?: number; // confianza de la observación 0..1, default 1
}): WmaUpdate {
  const { prevAvg, prevVariance, prevSamples, observation } = opts;
  const w = Math.min(1, Math.max(0, opts.weight ?? 1));
  const n = prevSamples + 1;
  // alpha base: 1/n, ajustado por confianza
  const alpha = Math.min(0.5, Math.max(0.05, w / Math.max(1, n)));
  const newAvg = prevAvg * (1 - alpha) + observation * alpha;
  const delta = observation - prevAvg;
  const newVariance = prevVariance * (1 - alpha) + delta * delta * alpha;
  const newSamples = n;
  // Confianza: crece con muestras, decrece con varianza relativa.
  const stdDev = Math.sqrt(newVariance);
  const relVar = newAvg > 0 ? Math.min(1, stdDev / newAvg) : 0.5;
  const samplesFactor = Math.min(1, newSamples / 30);
  const newConfidence = Math.max(0.3, samplesFactor * (1 - relVar));
  return { newAvg, newVariance, newSamples, newConfidence };
}

// Confianza combinada del motor para una ventana temporal.
export function combineConfidences(parts: {
  schedule: number;
  realtime: number;
  route: number;
  busPosition: number;
}): number {
  const vals = [parts.schedule, parts.realtime, parts.route, parts.busPosition];
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return Math.max(0, Math.min(1, avg));
}

// Calcula edad en segundos de un timestamp ISO o ms.
export function freshnessSeconds(at: string | number | null | undefined, now: number = Date.now()): number | null {
  if (at == null) return null;
  const t = typeof at === "number" ? at : Date.parse(at);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.round((now - t) / 1000));
}
