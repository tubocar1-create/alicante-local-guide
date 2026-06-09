// Score 0..1 que decide cuántos buses extra entran a operación encima de la
// flota base. Combina:
//   - avg_delay (corrección de fase media en la línea)
//   - spacing_error (validatorReport.removedBadSpacing o ratio)
//   - cycle_time_growth (cycleMin actual vs cycleMin de referencia del slot)
//   - congestion_index externo (opcional, [0..1])
//   - historical_slot_pattern (0..1: fracción histórica de ticks del mismo
//     slot/día en los que la línea operaba con > baseBuses)

export type ActivationSignals = {
  avgDelayMin: number;       // valor absoluto
  spacingErrorRatio: number; // 0..1 (validator.removedRatio)
  cycleTimeGrowth: number;   // ratio actual/referencia, 1.0 = sin crecimiento
  congestionIndex: number;   // 0..1
  historicalSlotPattern: number; // 0..1
};

export function extraBusActivationScore(signals: ActivationSignals): number {
  const delayScore = clamp01(signals.avgDelayMin / 6); // 6 min ≈ saturación
  const spacingScore = clamp01(signals.spacingErrorRatio * 1.5);
  const cycleScore = clamp01((signals.cycleTimeGrowth - 1) * 2); // +50% → score 1
  const congestionScore = clamp01(signals.congestionIndex);
  const historicalScore = clamp01(signals.historicalSlotPattern);

  // Pesos: el patrón histórico pesa fuerte (aprendizaje), refuerza con señales
  // dinámicas. Suma máxima posible = 1.
  const score =
    0.35 * historicalScore +
    0.25 * delayScore +
    0.2 * cycleScore +
    0.1 * spacingScore +
    0.1 * congestionScore;

  return Math.round(score * 1000) / 1000;
}

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}
