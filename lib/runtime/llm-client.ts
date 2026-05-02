// lib/runtime/llm-client.ts
//
// LLMClient is the seam between LLMAgentRunner and a model provider.
//
// LLMAgentRunner calls one or more clients in priority order. For each agent
// invocation it picks the first client whose `supportsModel(model)` returns
// true and asks it to `call(...)`. The runner does not know which provider
// the client wraps; clients are pluggable.
//
// Bundled implementations:
//   - MockLLMClient (this file)      — deterministic, no network, used by tests
//   - AnthropicLLMClient (./llm-clients/anthropic.ts) — wraps @anthropic-ai/sdk
//   - OpenAILLMClient    (./llm-clients/openai.ts)    — wraps openai
//
// Both provider clients lazy-load their SDK so users only need to install
// the SDK for the provider they actually use.

export interface LLMCallOptions {
  /** The model name to call. Routed by client.supportsModel(name). */
  model: string;
  /** Full system prompt (entry prompt + SKILLS.md, already concatenated by the runner). */
  systemPrompt: string;
  /** The user message — typically the structured-task-body produced by buildTaskBody. */
  userMessage: string;
  /** Provider hint: cap on output tokens. */
  maxTokens?: number;
  /** Provider hint: temperature (0..2 typical). */
  temperature?: number;
  /** Provider hint: enable extended thinking with the given effort label. */
  thinking?: { enabled: boolean; effort: string };
  /** Provider hint: when "json", ask the provider for JSON-only output where supported. */
  responseFormat?: "json" | "text";
}

export interface LLMClient {
  /** Should return true when this client knows how to call the named model. */
  supportsModel(model: string): boolean;
  /** Call the model and return the text completion. Throw on transport / API error. */
  call(opts: LLMCallOptions): Promise<string>;
}

// ---------- MockLLMClient ----------

export type MockResponder =
  | string
  | ((opts: LLMCallOptions) => string | Promise<string>);

/**
 * Deterministic in-memory client. Register a string or a function per model
 * name. Records every call so tests can assert prompt construction.
 */
export class MockLLMClient implements LLMClient {
  readonly responses: Map<string, MockResponder>;
  readonly calls: LLMCallOptions[] = [];

  constructor(responses: Record<string, MockResponder> = {}) {
    this.responses = new Map(Object.entries(responses));
  }

  supportsModel(model: string): boolean {
    return this.responses.has(model);
  }

  async call(opts: LLMCallOptions): Promise<string> {
    this.calls.push(opts);
    const responder = this.responses.get(opts.model);
    if (responder == null) {
      throw new Error(
        `MockLLMClient: no response configured for model ${JSON.stringify(opts.model)}`,
      );
    }
    return typeof responder === "function" ? await responder(opts) : responder;
  }

  /** Convenience: register one or more models with the same response. */
  set(model: string | readonly string[], responder: MockResponder): this {
    const models = Array.isArray(model) ? model : [model as string];
    for (const m of models) this.responses.set(m, responder);
    return this;
  }

  /** Reset call history (useful between test cases that share an instance). */
  clearCalls(): void {
    this.calls.length = 0;
  }
}
