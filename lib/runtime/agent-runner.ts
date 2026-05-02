// lib/runtime/agent-runner.ts
//
// AgentRunner is the single seam between the pipeline orchestrator and the
// thing that actually produces an agent's output for a given input.
//
// Two implementations live here:
//
//   - FixtureAgentRunner — reads pre-canned JSON outputs from a scenario
//     directory. Used by tests and demos that need determinism without
//     burning API credits.
//
//   - LLMAgentRunner — loads each agent's config.json + prompt.md + SKILLS.md,
//     formats the input as the agent's expected user-message body, calls the
//     configured model through a pluggable LLMClient (Anthropic, OpenAI, mock,
//     …), parses the JSON response, validates it against the agent's
//     outputContract.schema, and returns the parsed object. Throws a
//     structured LLMAgentError on any failure — never silently falls back.
//
// The pipeline does not care which implementation it has; that swap is the
// whole point of the abstraction.

import { readFile, access } from "node:fs/promises";
import { resolve, isAbsolute } from "node:path";

import { loadAgentDefinition, type AgentDefinition } from "./agent-loader.ts";
import { validateAgainstSchema, type SchemaError } from "./json-schema.ts";
import type { LLMCallOptions, LLMClient } from "./llm-client.ts";
import { buildTaskBody } from "./task-body.ts";
import type { AgentName } from "./types.ts";

export interface AgentInvocation {
  agentName: AgentName;
  input: Record<string, unknown>;
}

export interface AgentRunner {
  run(invocation: AgentInvocation): Promise<unknown>;
}

// ---------- FixtureAgentRunner ----------

export class FixtureAgentRunner implements AgentRunner {
  readonly scenarioDir: string;

  constructor(scenarioDir: string) {
    this.scenarioDir = isAbsolute(scenarioDir) ? scenarioDir : resolve(process.cwd(), scenarioDir);
  }

  async run(invocation: AgentInvocation): Promise<unknown> {
    const file = `${invocation.agentName}.output.json`;
    const fullPath = resolve(this.scenarioDir, file);
    let raw: string;
    try {
      raw = await readFile(fullPath, "utf-8");
    } catch (e) {
      throw new Error(
        `FixtureAgentRunner: missing fixture for "${invocation.agentName}" at ${fullPath}\n  cause: ${(e as Error).message}`,
      );
    }
    try {
      return JSON.parse(raw);
    } catch (e) {
      throw new Error(
        `FixtureAgentRunner: fixture ${fullPath} is not valid JSON: ${(e as Error).message}`,
      );
    }
  }

  // Verifies that every required fixture exists before the pipeline starts.
  // Fails fast with a clear message naming any that are missing.
  async assertFixturesExist(agents: readonly AgentName[]): Promise<void> {
    const missing: string[] = [];
    for (const agent of agents) {
      const p = resolve(this.scenarioDir, `${agent}.output.json`);
      try {
        await access(p);
      } catch {
        missing.push(p);
      }
    }
    if (missing.length > 0) {
      throw new Error(
        `FixtureAgentRunner: ${missing.length} fixture(s) missing in ${this.scenarioDir}:\n  - ${missing.join("\n  - ")}`,
      );
    }
  }
}

// ---------- LLMAgentRunner ----------

export interface LLMAgentRunnerOptions {
  /** Repo root. Agent definitions are loaded from `${repoRoot}/agents/<role>/`. */
  repoRoot: string;
  /** One or more LLM clients. The runner picks the first whose supportsModel(name) is true. */
  clients: readonly LLMClient[];
  /** When true, log per-call routing + prompt/response previews to stderr. */
  verbose?: boolean;
  /**
   * Per-call hook invoked after every successful LLM call. Useful for tests to
   * inspect prompt construction without enabling stderr logging.
   */
  onCall?: (event: LLMCallEvent) => void;
}

export interface LLMCallEvent {
  agent: AgentName;
  attempt: "primary" | "fallback";
  modelRequested: string;
  modelUsed: string;
  systemPromptLength: number;
  userMessageLength: number;
  rawResponseLength: number;
}

/**
 * Structured error thrown when an agent invocation fails. `causes` accumulates
 * one error per model attempt (primary, then fallback). `raw` is the most
 * recent raw model output if any was received before failure.
 */
export class LLMAgentError extends Error {
  readonly agent: AgentName;
  readonly causes: readonly Error[];
  readonly raw: string | null;
  readonly schemaErrors: readonly SchemaError[];

  constructor(
    agent: AgentName,
    message: string,
    causes: readonly Error[] = [],
    raw: string | null = null,
    schemaErrors: readonly SchemaError[] = [],
  ) {
    super(message);
    this.name = "LLMAgentError";
    this.agent = agent;
    this.causes = causes;
    this.raw = raw;
    this.schemaErrors = schemaErrors;
  }
}

export class LLMAgentRunner implements AgentRunner {
  readonly repoRoot: string;
  readonly clients: readonly LLMClient[];
  private readonly verbose: boolean;
  private readonly onCall: ((event: LLMCallEvent) => void) | undefined;
  private readonly defCache: Map<AgentName, AgentDefinition> = new Map();

  constructor(opts: LLMAgentRunnerOptions) {
    this.repoRoot = opts.repoRoot;
    this.clients = opts.clients;
    this.verbose = opts.verbose ?? false;
    this.onCall = opts.onCall;
    if (this.clients.length === 0) {
      throw new Error("LLMAgentRunner: at least one LLMClient is required");
    }
  }

  async run(invocation: AgentInvocation): Promise<unknown> {
    const def = await this.getDefinition(invocation.agentName);

    let userMessage: string;
    try {
      userMessage = buildTaskBody(def, invocation.input);
    } catch (e) {
      throw new LLMAgentError(invocation.agentName, (e as Error).message, [e as Error]);
    }
    const systemPrompt = this.buildSystemPrompt(def);

    const primary = def.config.adapterConfig.model;
    const fallback = def.config.adapterConfig.fallbackModel;
    const attempts: Array<{ label: "primary" | "fallback"; model: string }> = [
      { label: "primary", model: primary },
    ];
    if (fallback && fallback !== primary) {
      attempts.push({ label: "fallback", model: fallback });
    }

    const causes: Error[] = [];
    let lastRaw: string | null = null;
    let lastSchemaErrors: readonly SchemaError[] = [];

    for (const attempt of attempts) {
      try {
        return await this.callAndValidate(def, attempt.label, attempt.model, systemPrompt, userMessage);
      } catch (e) {
        causes.push(new Error(`[${attempt.label}=${attempt.model}] ${(e as Error).message}`));
        if (e instanceof LLMAgentError) {
          if (e.raw != null) lastRaw = e.raw;
          if (e.schemaErrors.length > 0) lastSchemaErrors = e.schemaErrors;
        }
      }
    }

    throw new LLMAgentError(
      invocation.agentName,
      `LLMAgentRunner[${invocation.agentName}]: all ${attempts.length} model attempt(s) failed`,
      causes,
      lastRaw,
      lastSchemaErrors,
    );
  }

  private async callAndValidate(
    def: AgentDefinition,
    label: "primary" | "fallback",
    model: string,
    systemPrompt: string,
    userMessage: string,
  ): Promise<unknown> {
    const client = this.pickClient(model);
    const callOpts: LLMCallOptions = {
      model,
      systemPrompt,
      userMessage,
      maxTokens: def.config.adapterConfig.maxOutputTokens,
      temperature: def.config.adapterConfig.temperature,
      thinking: def.config.adapterConfig.thinking,
      responseFormat:
        typeof def.config.adapterConfig.responseFormat === "string" &&
        def.config.adapterConfig.responseFormat.toLowerCase().includes("json")
          ? "json"
          : "text",
    };

    if (this.verbose) {
      // eslint-disable-next-line no-console
      console.error(`[LLM] ${def.config.role} → model=${model} (${label})`);
      // eslint-disable-next-line no-console
      console.error(`  system (${systemPrompt.length} chars): ${preview(systemPrompt)}`);
      // eslint-disable-next-line no-console
      console.error(`  user   (${userMessage.length} chars): ${preview(userMessage)}`);
    }

    const raw = await client.call(callOpts);

    if (this.verbose) {
      // eslint-disable-next-line no-console
      console.error(`  ←      (${raw.length} chars): ${preview(raw)}`);
    }
    if (this.onCall) {
      this.onCall({
        agent: def.config.role,
        attempt: label,
        modelRequested: model,
        modelUsed: model,
        systemPromptLength: systemPrompt.length,
        userMessageLength: userMessage.length,
        rawResponseLength: raw.length,
      });
    }

    return parseAndValidateOutput(raw, def);
  }

  private pickClient(model: string): LLMClient {
    for (const c of this.clients) {
      if (c.supportsModel(model)) return c;
    }
    throw new Error(
      `LLMAgentRunner: no LLMClient supports model ${JSON.stringify(model)}. Registered ${this.clients.length} client(s).`,
    );
  }

  private buildSystemPrompt(def: AgentDefinition): string {
    // The agent prompts assert "your SKILLS.md is loaded into context at task
    // start", so we concatenate prompt.md + SKILLS.md as the system prompt.
    const parts: string[] = [];
    if (def.entryPrompt) parts.push(def.entryPrompt);
    if (def.skills.trim()) {
      parts.push("\n---\n");
      parts.push("# SKILLS.md (your authoritative role definition)\n");
      parts.push(def.skills);
    }
    return parts.join("");
  }

  private async getDefinition(agent: AgentName): Promise<AgentDefinition> {
    const cached = this.defCache.get(agent);
    if (cached) return cached;
    const def = await loadAgentDefinition(this.repoRoot, agent);
    this.defCache.set(agent, def);
    return def;
  }
}

// ---------- helpers ----------

function parseAndValidateOutput(raw: string, def: AgentDefinition): unknown {
  const text = stripJSONFence(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new LLMAgentError(
      def.config.role,
      `LLMAgentRunner[${def.config.role}]: model output is not valid JSON: ${(e as Error).message}`,
      [e as Error],
      raw,
    );
  }

  const result = validateAgainstSchema(parsed, def.config.outputContract.schema);
  if (!result.valid) {
    const summary = result.errors
      .slice(0, 5)
      .map((e) => `  ${e.path}: ${e.message}`)
      .join("\n");
    const more = result.errors.length > 5 ? `\n  ...and ${result.errors.length - 5} more` : "";
    throw new LLMAgentError(
      def.config.role,
      `LLMAgentRunner[${def.config.role}]: model output failed schema validation (${result.errors.length} error(s)):\n${summary}${more}`,
      result.errors.map((e) => new Error(`${e.path}: ${e.message}`)),
      raw,
      result.errors,
    );
  }

  return parsed;
}

function stripJSONFence(text: string): string {
  const trimmed = text.trim();
  // Match ```json ... ``` or ``` ... ``` even when content spans many lines.
  const fence = /^```(?:json|JSON)?\s*\n?([\s\S]*?)\n?```$/m.exec(trimmed);
  if (fence) return fence[1].trim();
  return trimmed;
}

function preview(s: string, max = 140): string {
  const oneLine = s.replace(/\s+/g, " ").trim();
  return oneLine.length > max ? oneLine.slice(0, max - 3) + "..." : oneLine;
}
