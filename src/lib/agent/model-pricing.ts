// Estimated AI model prices (USD per 1M tokens). Used to compute
// approximate cost figures in the admin observability dashboard.
// Update these numbers when provider pricing changes.

export type ModelPricing = {
  inputPer1M: number;
  outputPer1M: number;
};

export const MODEL_PRICING: Record<string, ModelPricing> = {
  "google/gemini-2.5-flash": { inputPer1M: 0.075, outputPer1M: 0.3 },
  "google/gemini-2.5-flash-lite": { inputPer1M: 0.04, outputPer1M: 0.15 },
  "google/gemini-2.5-pro": { inputPer1M: 1.25, outputPer1M: 5 },
  "openai/gpt-5-mini": { inputPer1M: 0.3, outputPer1M: 1.2 },
  "openai/gpt-5-nano": { inputPer1M: 0.05, outputPer1M: 0.4 },
  "openai/gpt-5": { inputPer1M: 5, outputPer1M: 15 },
};

/** Returns estimated cost in USD for a given token usage and model. */
export function estimateCost(
  model: string | null | undefined,
  tokensIn: number | null | undefined,
  tokensOut: number | null | undefined,
): number {
  if (!model) return 0;
  const p = MODEL_PRICING[model];
  if (!p) return 0;
  const inCost = ((tokensIn ?? 0) / 1_000_000) * p.inputPer1M;
  const outCost = ((tokensOut ?? 0) / 1_000_000) * p.outputPer1M;
  return Number((inCost + outCost).toFixed(6));
}
