// lib/runtime/llm-clients/anthropic.ts
//
// AnthropicLLMClient — adapter for Claude models via @anthropic-ai/sdk.
//
// The SDK is loaded lazily through dynamic import so that:
//   - Consumers who never instantiate this class do not need the SDK.
//   - A clear, actionable error is raised the moment the user tries to call
//     Anthropic without `npm install @anthropic-ai/sdk`.
//
// Example:
//   const client = new AnthropicLLMClient({
//     apiKey: process.env.ANTHROPIC_API_KEY,
//     modelAliases: {
//       "claude-opus-4-7-thinking-xhigh": "claude-3-5-sonnet-20241022"
//     },
//   });

import type { LLMCallOptions, LLMClient } from "../llm-client.ts";

export interface AnthropicLLMClientOptions {
  /** Anthropic API key. Defaults to process.env.ANTHROPIC_API_KEY. */
  apiKey?: string;
  /** Restrict to model names with this prefix. Default: "claude". */
  modelPrefix?: string;
  /** Translate runtime model names to actual Anthropic API model names. */
  modelAliases?: Record<string, string>;
}

/**
 * Mapping from project-internal "effort" labels to Anthropic
 * `thinking.budget_tokens` values. Adjust if the project introduces new
 * effort tiers; values are intentionally conservative.
 */
const EFFORT_TO_BUDGET_TOKENS: Record<string, number> = {
  low: 1024,
  medium: 4096,
  high: 8192,
  xhigh: 16384,
};

export class AnthropicLLMClient implements LLMClient {
  private readonly apiKey: string | undefined;
  private readonly modelPrefix: string;
  private readonly aliases: Record<string, string>;
  private clientPromise: Promise<unknown> | null = null;

  constructor(opts: AnthropicLLMClientOptions = {}) {
    this.apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY;
    this.modelPrefix = opts.modelPrefix ?? "claude";
    this.aliases = opts.modelAliases ?? {};
  }

  supportsModel(model: string): boolean {
    return model.startsWith(this.modelPrefix);
  }

  async call(opts: LLMCallOptions): Promise<string> {
    if (!this.apiKey) {
      throw new Error(
        "AnthropicLLMClient: no API key. Set ANTHROPIC_API_KEY in env or pass `apiKey` to the constructor.",
      );
    }

    const sdk = (await this.getClient()) as {
      messages: { create: (body: Record<string, unknown>) => Promise<unknown> };
    };
    const apiModel = this.aliases[opts.model] ?? opts.model;

    const body: Record<string, unknown> = {
      model: apiModel,
      max_tokens: opts.maxTokens ?? 4096,
      system: opts.systemPrompt,
      messages: [{ role: "user", content: opts.userMessage }],
    };
    if (typeof opts.temperature === "number") {
      body.temperature = opts.temperature;
    }
    if (opts.thinking?.enabled) {
      const budget = EFFORT_TO_BUDGET_TOKENS[opts.thinking.effort] ?? 4096;
      // Extended thinking budget must be < max_tokens.
      const maxTokens = (body.max_tokens as number) ?? 4096;
      body.max_tokens = Math.max(maxTokens, budget + 1024);
      body.thinking = { type: "enabled", budget_tokens: budget };
      // Anthropic requires temperature=1 when thinking is enabled.
      body.temperature = 1;
    }

    let resp: unknown;
    try {
      resp = await sdk.messages.create(body);
    } catch (e) {
      throw new Error(
        `AnthropicLLMClient: API call failed for model ${JSON.stringify(apiModel)} (alias of ${JSON.stringify(opts.model)}): ${(e as Error).message}`,
      );
    }

    const content = (resp as { content?: unknown }).content;
    if (!Array.isArray(content)) {
      throw new Error(
        `AnthropicLLMClient: unexpected response shape (no content array) — got ${JSON.stringify(resp).slice(0, 200)}`,
      );
    }

    const text = content
      .filter(
        (b: unknown): b is { type: string; text: string } =>
          !!b && typeof b === "object" && (b as { type?: string }).type === "text",
      )
      .map((b) => b.text)
      .join("");

    if (!text) {
      throw new Error(
        `AnthropicLLMClient: response had no text blocks (${content.length} block(s) of other types)`,
      );
    }
    return text;
  }

  private async getClient(): Promise<unknown> {
    if (this.clientPromise) return this.clientPromise;
    this.clientPromise = (async () => {
      let mod: { default: new (opts: { apiKey: string }) => unknown };
      try {
        mod = (await import("@anthropic-ai/sdk")) as unknown as typeof mod;
      } catch {
        throw new Error(
          "AnthropicLLMClient: @anthropic-ai/sdk is not installed. Run `npm install @anthropic-ai/sdk` to enable.",
        );
      }
      return new mod.default({ apiKey: this.apiKey! });
    })();
    return this.clientPromise;
  }
}
