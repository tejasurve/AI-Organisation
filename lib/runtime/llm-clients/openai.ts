// lib/runtime/llm-clients/openai.ts
//
// OpenAILLMClient — adapter for OpenAI / GPT models via the `openai` SDK.
//
// The SDK is loaded lazily through dynamic import so that consumers who never
// instantiate this class do not need to install `openai`. Install when needed:
//   npm install openai
//
// Example:
//   const client = new OpenAILLMClient({
//     apiKey: process.env.OPENAI_API_KEY,
//     modelAliases: { "gpt-5.5-medium": "gpt-4o-2024-08-06" },
//   });

import type { LLMCallOptions, LLMClient } from "../llm-client.ts";

export interface OpenAILLMClientOptions {
  /** OpenAI API key. Defaults to process.env.OPENAI_API_KEY. */
  apiKey?: string;
  /** Restrict to model names with this prefix. Default: "gpt". */
  modelPrefix?: string;
  /** Translate runtime model names to actual OpenAI API model names. */
  modelAliases?: Record<string, string>;
}

export class OpenAILLMClient implements LLMClient {
  private readonly apiKey: string | undefined;
  private readonly modelPrefix: string;
  private readonly aliases: Record<string, string>;
  private clientPromise: Promise<unknown> | null = null;

  constructor(opts: OpenAILLMClientOptions = {}) {
    this.apiKey = opts.apiKey ?? process.env.OPENAI_API_KEY;
    this.modelPrefix = opts.modelPrefix ?? "gpt";
    this.aliases = opts.modelAliases ?? {};
  }

  supportsModel(model: string): boolean {
    return model.startsWith(this.modelPrefix);
  }

  async call(opts: LLMCallOptions): Promise<string> {
    if (!this.apiKey) {
      throw new Error(
        "OpenAILLMClient: no API key. Set OPENAI_API_KEY in env or pass `apiKey` to the constructor.",
      );
    }

    const sdk = (await this.getClient()) as {
      chat: {
        completions: {
          create: (body: Record<string, unknown>) => Promise<unknown>;
        };
      };
    };
    const apiModel = this.aliases[opts.model] ?? opts.model;

    const body: Record<string, unknown> = {
      model: apiModel,
      messages: [
        { role: "system", content: opts.systemPrompt },
        { role: "user", content: opts.userMessage },
      ],
    };
    if (typeof opts.maxTokens === "number") {
      body.max_tokens = opts.maxTokens;
    }
    if (typeof opts.temperature === "number") {
      body.temperature = opts.temperature;
    }
    if (opts.responseFormat === "json") {
      body.response_format = { type: "json_object" };
    }

    let resp: unknown;
    try {
      resp = await sdk.chat.completions.create(body);
    } catch (e) {
      throw new Error(
        `OpenAILLMClient: API call failed for model ${JSON.stringify(apiModel)} (alias of ${JSON.stringify(opts.model)}): ${(e as Error).message}`,
      );
    }

    const choices = (resp as { choices?: unknown }).choices;
    if (!Array.isArray(choices) || choices.length === 0) {
      throw new Error(
        `OpenAILLMClient: response had no choices — got ${JSON.stringify(resp).slice(0, 200)}`,
      );
    }
    const first = choices[0] as { message?: { content?: string } };
    const text = first.message?.content ?? "";
    if (!text) {
      throw new Error("OpenAILLMClient: first choice had no message.content");
    }
    return text;
  }

  private async getClient(): Promise<unknown> {
    if (this.clientPromise) return this.clientPromise;
    this.clientPromise = (async () => {
      let mod: { default: new (opts: { apiKey: string }) => unknown };
      try {
        // Use an indirect string specifier so the type-checker does not try
        // to resolve `openai` at compile time — the SDK is intentionally
        // optional and may not be installed.
        const specifier = "openai";
        mod = (await import(specifier)) as unknown as typeof mod;
      } catch {
        throw new Error(
          "OpenAILLMClient: openai SDK is not installed. Run `npm install openai` to enable.",
        );
      }
      return new mod.default({ apiKey: this.apiKey! });
    })();
    return this.clientPromise;
  }
}
