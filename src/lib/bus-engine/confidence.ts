// Score de confianza 0..1 a partir de muestras, antigüedad y varianza.

export function computeConfidence(opts: {
  samples: number;
  ageDays?: number;
  normalizedStdDev?: number; // 0..1 (mayor = peor)
  baseline?: number;
}): number {
  const baseline = opts.baseline ?? 0.3;
  const samplesFactor = Math.min(1, opts.samples / 30);
  const ageFactor = Math.exp(-(opts.ageDays ?? 0) / 14);
  const varFactor = 1 - Math.min(1, Math.max(0, opts.normalizedStdDev ?? 0));
  const learned = samplesFactor * ageFactor * varFactor;
  // Mezcla baseline con learned para evitar 0 cuando no hay muestras.
  return Math.max(baseline, Math.min(1, learned));
}
