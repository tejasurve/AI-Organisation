// lib/platform/llm/pricing.ts
//
// Prices used purely for cost meter display. Values are USD per 1M tokens.
// Update as providers move; off by a few % is fine for demo purposes.

export type ProviderId = "gemini" | "anthropic" | "openai" | "cursor";

export interface ModelPrice {
  inPer1M: number;
  outPer1M: number;
}

export const PRICES: Record<ProviderId, Record<string, ModelPrice>> = {
  gemini: {
    "gemini-2.5-flash-lite": { inPer1M: 0.10, outPer1M: 0.40 },
    "gemini-2.5-flash": { inPer1M: 0.30, outPer1M: 2.50 },
    "gemini-2.5-pro": { inPer1M: 1.25, outPer1M: 10.0 },
    "gemini-3-pro": { inPer1M: 2.5, outPer1M: 10.0 },
  },
  anthropic: {
    "claude-3-5-haiku-latest": { inPer1M: 0.80, outPer1M: 4.0 },
    "claude-3-5-sonnet-latest": { inPer1M: 3.0, outPer1M: 15.0 },
    "claude-sonnet-4-5": { inPer1M: 3.0, outPer1M: 15.0 },
    "claude-opus-4-5": { inPer1M: 15.0, outPer1M: 75.0 },
  },
  openai: {
    "gpt-4o-mini": { inPer1M: 0.15, outPer1M: 0.60 },
    "gpt-4o": { inPer1M: 2.50, outPer1M: 10.0 },
    "gpt-4.1": { inPer1M: 2.50, outPer1M: 10.0 },
    "o1-mini": { inPer1M: 3.0, outPer1M: 12.0 },
  },
  cursor: {
    "cursor-default": { inPer1M: 0, outPer1M: 0 },
  },
};

export const DEFAULT_MODEL: Record<ProviderId, string> = {
  // gemini-2.5-flash-lite is the workhorse: cheap, fast, no 2.5-thinking
  // budget overhead, supports JSON mode + responseSchema, and (importantly
  // for our use) has materially lower 503 / quota-exceeded rates than
  // gemini-2.5-flash. We bump up to flash/pro for individual artefacts
  // where reasoning quality is worth the rate-limit risk.
  gemini: "gemini-2.5-flash-lite",
  anthropic: "claude-3-5-sonnet-latest",
  openai: "gpt-4o-mini",
  cursor: "cursor-default",
};

export function priceFor(
  provider: ProviderId,
  model: string,
): ModelPrice {
  return PRICES[provider]?.[model] ?? { inPer1M: 0, outPer1M: 0 };
}

export function costUsd(
  provider: ProviderId,
  model: string,
  inTokens: number,
  outTokens: number,
): number {
  const p = priceFor(provider, model);
  return (inTokens * p.inPer1M + outTokens * p.outPer1M) / 1_000_000;
}
