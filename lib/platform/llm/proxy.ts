// lib/platform/llm/proxy.ts
//
// Single entry point for any LLM call from the platform.
//
//   call({ provider, model, system, messages, temperature, maxTokens })
//     ↓
//   resolves to { text, inTokens, outTokens, costUsd, latencyMs, provider, model, source }
//
// Behaviour:
//   - If a key is configured for the provider → real API call.
//   - Otherwise → falls back to a deterministic demo response so the whole
//     workflow keeps running without setup. The judge sees the loop end-to-end,
//     just narrated by canned-but-personality-aware text.
//
// The proxy never throws on network errors; it converts them to demo-mode
// fallback so the UI never deadlocks on a missing key or rate limit.

import type { ProviderId } from "./pricing.ts";
import { DEFAULT_MODEL, costUsd } from "./pricing.ts";
import { getSecret } from "../vault/secrets.ts";
import { demoCompletion } from "./demo.ts";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
  /**
   * Optional image attachments for multimodal calls (Gemini-only today).
   * Each entry is raw bytes + a MIME type — the proxy handles base64
   * encoding for the wire. Use sparingly: images burn a LOT of tokens
   * (~258 tokens per tile for 2.5-flash) so only attach when the visual
   * context is critical (e.g. Stitch screenshots when emitting code that
   * must match a design).
   */
  images?: Array<{
    data: Buffer | Uint8Array | string; // raw bytes OR base64 string
    mimeType: string;
  }>;
}

export interface CallOptions {
  provider: ProviderId;
  model?: string;
  system?: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  /**
   * Request strict JSON output. When `true`, the proxy sets the provider's
   * JSON-mode flag (Gemini: `responseMimeType: "application/json"`, OpenAI:
   * `response_format: { type: "json_object" }`, Anthropic: prompt-injected
   * instruction). When an object, the same JSON-mode flag is set AND the
   * provider's response-schema is bound where supported (Gemini only today).
   */
  json?: boolean | Record<string, unknown>;
  /**
   * Gemini-2.5 burns output tokens on internal "thinking" before producing
   * any visible text — a 1024-token budget leaves ~16 tokens for the answer.
   * Set this to override the default thinking budget. `0` disables thinking
   * entirely (faster, cheaper, fine for chat narration). Default: 2048 for
   * 2.5-pro / 2.5-flash, 0 for 2.5-flash-lite.
   */
  thinkingBudget?: number;
  /** Optional persona hint that demo-mode uses to colour the canned text. */
  personaHint?: string;
  /** Optional stage hint that demo-mode uses to pick a relevant script. */
  stageHint?: string;
}

export interface CallResult {
  text: string;
  inTokens: number;
  outTokens: number;
  costUsd: number;
  latencyMs: number;
  provider: ProviderId;
  model: string;
  source: "live" | "demo";
}

/** Caller asked for an LLM but no key is configured for that provider. */
export class NoApiKeyError extends Error {
  readonly provider: ProviderId;
  constructor(provider: ProviderId) {
    super(`No API key configured for provider "${provider}". Add one in Settings.`);
    this.name = "NoApiKeyError";
    this.provider = provider;
  }
}

/** Provider returned an error after exhausting retries. */
export class UpstreamError extends Error {
  readonly provider: ProviderId;
  readonly status?: number;
  constructor(provider: ProviderId, message: string, status?: number) {
    super(`${provider} upstream error${status ? ` (${status})` : ""}: ${message}`);
    this.name = "UpstreamError";
    this.provider = provider;
    this.status = status;
  }
}

/**
 * If true, callLLM returns the deterministic demo response when no key is
 * configured (legacy chat-narration path). If false, it throws NoApiKeyError.
 * Artifact generators must use `allowDemoFallback: false` so we never
 * fabricate fake architectures.
 */
export interface CallOptionsExt extends CallOptions {
  /** Default: true (legacy narration). Generators set this to false. */
  allowDemoFallback?: boolean;
  /** How many times to retry on 503/429. Default: 5 (so 6 attempts total). */
  maxRetries?: number;
  /**
   * Disable the automatic Gemini model failover (flash-lite → flash). The
   * engine sets this to true in tests; production should leave it unset.
   */
  disableModelFailover?: boolean;
}

/**
 * Gemini-side fallback chain. When the primary model 503s for the whole
 * retry budget, we promote up the chain to a fresh model with separate
 * load characteristics. flash-lite is heavily used (cheapest tier) so it
 * 503s most; flash and 2.0-flash have more headroom.
 */
const GEMINI_FAILOVER: Record<string, string | undefined> = {
  "gemini-2.5-flash-lite": "gemini-2.5-flash",
  "gemini-2.5-flash": "gemini-2.0-flash",
};

export async function callLLM(opts: CallOptionsExt): Promise<CallResult> {
  const provider = opts.provider;
  const primaryModel = opts.model ?? DEFAULT_MODEL[provider];
  const key = getSecret(providerKeyName(provider));
  const start = Date.now();
  const allowDemo = opts.allowDemoFallback !== false;

  if (!key) {
    if (!allowDemo) throw new NoApiKeyError(provider);
    return demoFallback(opts, primaryModel, start, "no-key");
  }

  // Build a model chain. For Gemini we transparently fail over to a
  // higher-tier model when the primary keeps 503ing. Other providers stay
  // on their single model.
  const chain: string[] = [primaryModel];
  if (provider === "gemini" && !opts.disableModelFailover) {
    let next = GEMINI_FAILOVER[primaryModel];
    while (next && !chain.includes(next)) {
      chain.push(next);
      next = GEMINI_FAILOVER[next];
    }
  }

  const maxRetries = opts.maxRetries ?? 5;
  let lastErr: unknown = null;
  let lastModel = primaryModel;

  for (const model of chain) {
    lastModel = model;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (provider === "gemini") return await callGemini(opts, model, key, start);
        if (provider === "anthropic") return await callAnthropic(opts, model, key, start);
        if (provider === "openai") return await callOpenAI(opts, model, key, start);
        if (!allowDemo) throw new UpstreamError(provider, "cursor SDK not wired");
        return demoFallback(opts, model, start, "cursor-not-implemented");
      } catch (err) {
        lastErr = err;
        const status = extractStatus(err);
        const retryable = status === 503 || status === 429 || status === 500 || isNetworkError(err);
        if (!retryable || attempt === maxRetries) break;
        // Patient exponential backoff: 2s, 4s, 8s, 16s, 30s (capped).
        // Adds ~60s of retry budget per model, which is plenty of room
        // for Gemini's "high demand" spikes to clear.
        const base = Math.min(30000, 2000 * Math.pow(2, attempt));
        const backoffMs = base + Math.floor(Math.random() * 1000);
        console.warn(
          `[llm] ${provider}/${model} attempt ${attempt + 1} failed (status=${status}); retrying in ${backoffMs}ms`,
        );
        await sleep(backoffMs);
      }
    }

    // Exhausted retries on this model. If we have a failover model and the
    // last error looks transient, try the next one.
    const status = extractStatus(lastErr);
    const isTransient = status === 503 || status === 429 || status === 500 || isNetworkError(lastErr);
    const hasNextModel = chain.indexOf(model) < chain.length - 1;
    if (isTransient && hasNextModel) {
      console.warn(`[llm] ${provider}/${model} exhausted retries (status=${status}); failing over to next model.`);
      continue;
    }
    break;
  }

  // Out of retries AND out of failover models.
  const status = extractStatus(lastErr);
  const msg = (lastErr as Error | undefined)?.message ?? "unknown";
  if (!allowDemo) {
    throw new UpstreamError(provider, `[${lastModel}] ${msg}`, status);
  }
  console.warn(`[llm] ${provider} call failed after retries+failover, falling back to demo:`, lastErr);
  return demoFallback(opts, lastModel, start, "error");
}

function extractStatus(err: unknown): number | undefined {
  if (!err || typeof err !== "object") return undefined;
  const e = err as { status?: number; statusCode?: number };
  return e.status ?? e.statusCode;
}

function isNetworkError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; cause?: { code?: string } };
  const code = e.code ?? e.cause?.code;
  return code === "ECONNRESET" || code === "ETIMEDOUT" || code === "ENOTFOUND" || code === "EAI_AGAIN";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function providerKeyName(p: ProviderId): "gemini" | "anthropic" | "openai" | "cursor" {
  return p;
}

function demoFallback(
  opts: CallOptions,
  model: string,
  startedAt: number,
  _reason: string,
): CallResult {
  const text = demoCompletion(opts);
  const inTokens = approxTokens(buildPrompt(opts));
  const outTokens = approxTokens(text);
  return {
    text,
    inTokens,
    outTokens,
    costUsd: 0,
    latencyMs: Math.max(120, Date.now() - startedAt),
    provider: opts.provider,
    model,
    source: "demo",
  };
}

function buildPrompt(opts: CallOptions): string {
  const sys = opts.system ?? "";
  const body = opts.messages.map((m) => `${m.role}:${m.content}`).join("\n");
  return `${sys}\n${body}`;
}

function approxTokens(s: string): number {
  // ~4 chars per token is good enough for cost display.
  return Math.max(1, Math.round(s.length / 4));
}

/**
 * Build a Gemini parts[] array from a ChatMessage. Text-only messages get
 * a single `{ text }` part (matching the old shape); messages with image
 * attachments get text + one `{ inlineData }` part per image.
 */
function buildParts(msg: ChatMessage): Array<
  { text: string } | { inlineData: { data: string; mimeType: string } }
> {
  const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [];
  if (msg.content) parts.push({ text: msg.content });
  for (const img of msg.images ?? []) {
    let base64: string;
    if (typeof img.data === "string") {
      base64 = img.data;
    } else if (Buffer.isBuffer(img.data)) {
      base64 = img.data.toString("base64");
    } else {
      base64 = Buffer.from(img.data).toString("base64");
    }
    parts.push({ inlineData: { data: base64, mimeType: img.mimeType } });
  }
  if (parts.length === 0) parts.push({ text: "" });
  return parts;
}

// ---------- Real provider adapters ----------

async function callGemini(
  opts: CallOptions,
  model: string,
  key: string,
  startedAt: number,
): Promise<CallResult> {
  // Lazy import so we don't pull the SDK when not configured.
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genai = new GoogleGenerativeAI(key);

  // Gemini-2.5 models burn tokens on internal "thinking" before any visible
  // text. The default 1024-token budget leaves ~16 tokens for the answer.
  // Default to 8192 tokens overall + a 2048 thinking budget for 2.5-{pro,flash},
  // and 0 thinking for flash-lite (it doesn't have a thinking mode).
  const isThinkingModel = /^gemini-2\.5-(pro|flash)$/i.test(model);
  const defaultThinking = isThinkingModel ? 2048 : 0;
  const thinkingBudget = opts.thinkingBudget ?? defaultThinking;
  const maxOutputTokens = opts.maxTokens ?? (opts.json ? 8192 : 2048);

  const generationConfig: Record<string, unknown> = {
    temperature: opts.temperature ?? 0.7,
    maxOutputTokens,
  };
  if (opts.json) {
    generationConfig.responseMimeType = "application/json";
    if (typeof opts.json === "object") {
      generationConfig.responseSchema = opts.json;
    }
  }
  if (isThinkingModel && thinkingBudget !== undefined) {
    generationConfig.thinkingConfig = { thinkingBudget };
  }

  const m = genai.getGenerativeModel({
    model,
    systemInstruction: opts.system,
    generationConfig: generationConfig as Parameters<typeof genai.getGenerativeModel>[0]["generationConfig"],
  });

  const history = opts.messages.slice(0, -1).map((msg) => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: buildParts(msg),
  }));
  const lastMsg = opts.messages[opts.messages.length - 1];
  // Multimodal: when the last user message has images, send a parts array
  // (text + inlineData). Otherwise send a plain string for backwards compat.
  const lastParts = lastMsg ? buildParts(lastMsg) : [{ text: "" }];

  const chat = m.startChat({ history });
  const resp =
    lastParts.length > 1
      ? await chat.sendMessage(lastParts)
      : await chat.sendMessage(lastMsg?.content ?? "");
  const text = resp.response.text();
  const meta = resp.response.usageMetadata;
  const inTokens = meta?.promptTokenCount ?? approxTokens(buildPrompt(opts));
  // Gemini reports thinkingTokenCount separately; we count it as output for
  // cost purposes (you ARE billed for thinking) but report only candidate
  // tokens to the caller for "useful output" accounting.
  const visibleOut = meta?.candidatesTokenCount ?? approxTokens(text);
  const thinkingOut = (meta as { thoughtsTokenCount?: number } | undefined)?.thoughtsTokenCount ?? 0;
  const billedOut = visibleOut + thinkingOut;

  return {
    text,
    inTokens,
    outTokens: visibleOut,
    costUsd: costUsd("gemini", model, inTokens, billedOut),
    latencyMs: Date.now() - startedAt,
    provider: "gemini",
    model,
    source: "live",
  };
}

async function callAnthropic(
  opts: CallOptions,
  model: string,
  key: string,
  startedAt: number,
): Promise<CallResult> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: key });

  const resp = await client.messages.create({
    model,
    system: opts.system,
    max_tokens: opts.maxTokens ?? 1024,
    temperature: opts.temperature ?? 0.7,
    messages: opts.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
  });

  const blocks = Array.isArray(resp.content) ? resp.content : [];
  const text = blocks
    .filter((b: { type: string }) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("\n");
  const inTokens = resp.usage?.input_tokens ?? approxTokens(buildPrompt(opts));
  const outTokens = resp.usage?.output_tokens ?? approxTokens(text);

  return {
    text,
    inTokens,
    outTokens,
    costUsd: costUsd("anthropic", model, inTokens, outTokens),
    latencyMs: Date.now() - startedAt,
    provider: "anthropic",
    model,
    source: "live",
  };
}

async function callOpenAI(
  opts: CallOptions,
  model: string,
  key: string,
  startedAt: number,
): Promise<CallResult> {
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: key });

  const resp = await client.chat.completions.create({
    model,
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens ?? 1024,
    messages: [
      ...(opts.system
        ? [{ role: "system" as const, content: opts.system }]
        : []),
      ...opts.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ],
  });

  const text = resp.choices[0]?.message?.content ?? "";
  const inTokens = resp.usage?.prompt_tokens ?? approxTokens(buildPrompt(opts));
  const outTokens =
    resp.usage?.completion_tokens ?? approxTokens(text);

  return {
    text,
    inTokens,
    outTokens,
    costUsd: costUsd("openai", model, inTokens, outTokens),
    latencyMs: Date.now() - startedAt,
    provider: "openai",
    model,
    source: "live",
  };
}
