// Detector de SAFE MODE: cuando los datos son demasiado pobres, el motor
// renuncia a corregir y se limita a horarios oficiales con velocidad media.

import type { ValidatorReport } from "./fleet-validator";

export type SafeModeContext = {
  avgConfidence: number;
  lastObservationAgeSec: number | null; // null = nunca
  validatorReport: ValidatorReport | null;
};

export type PredictionQuality = "high" | "medium" | "low" | "safe";

export function shouldEnterSafeMode(ctx: SafeModeContext): boolean {
  if (ctx.avgConfidence < 0.35) return true;
  if (ctx.lastObservationAgeSec != null && ctx.lastObservationAgeSec > 30 * 60) return true;
  if (ctx.validatorReport && ctx.validatorReport.removedRatio > 0.4) return true;
  return false;
}

export function classifyPredictionQuality(ctx: SafeModeContext): PredictionQuality {
  if (shouldEnterSafeMode(ctx)) return "safe";
  if (ctx.avgConfidence >= 0.7 && (ctx.lastObservationAgeSec ?? 9_999) < 5 * 60) return "high";
  if (ctx.avgConfidence >= 0.5 && (ctx.lastObservationAgeSec ?? 9_999) < 15 * 60) return "medium";
  return "low";
}

// Degradación temporal pura: aplica a la confianza de cualquier bus en
// función de cuántos segundos lleva sin observación real.
export function degradeConfidenceByAge(confidence: number, ageSec: number | null): number {
  if (ageSec == null) return Math.max(0.3, confidence * 0.6);
  if (ageSec < 5 * 60) return confidence;
  if (ageSec < 15 * 60) return Math.max(0.4, confidence * 0.85);
  if (ageSec < 30 * 60) return Math.max(0.3, confidence * 0.65);
  return Math.max(0.25, confidence * 0.4);
}
