// lib/runtime/agent-loader.ts
//
// Loads an agent's full definition from disk:
//   1. Reads agents/<role>/config.json
//   2. Resolves @file: references in instructionsBundle.files (typically
//      AGENTS.md → prompt.md and SKILLS.md → SKILLS.md)
//   3. Returns a typed AgentDefinition that LLMAgentRunner can consume
//
// The loader is read-only and never modifies the on-disk agent definition.

import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";

import type { JSONSchema } from "./json-schema.ts";
import type { AgentName } from "./types.ts";

// ---------- typed view of agents/<role>/config.json ----------

export interface AgentAdapterThinking {
  enabled: boolean;
  effort: string;
}

export interface AgentAdapterConfig {
  model: string;
  fallbackModel?: string;
  maxOutputTokens?: number;
  temperature?: number;
  responseFormat?: string;
  thinking?: AgentAdapterThinking;
  modelReasoningEffort?: string;
  [key: string]: unknown;
}

export interface AgentInstructionsBundle {
  entryFile?: string;
  files: Record<string, string>;
}

export interface AgentInputSection {
  marker: string;
  format?: string;
  schemaRef?: string;
  schema?: JSONSchema;
  extract?: string;
  optional?: boolean;
}

export interface AgentInputContract {
  format: string;
  sections: AgentInputSection[];
}

export interface AgentOutputContract {
  format: string;
  schema: JSONSchema;
}

export interface AgentConfig {
  name: string;
  role: AgentName;
  title: string;
  adapterType: string;
  adapterConfig: AgentAdapterConfig;
  instructionsBundle: AgentInstructionsBundle;
  inputContract?: AgentInputContract;
  outputContract: AgentOutputContract;
  [key: string]: unknown;
}

// ---------- resolved definition handed to the runner ----------

export interface AgentDefinition {
  config: AgentConfig;
  /** Resolved @file: references, keyed by their logical name (e.g. "AGENTS.md", "SKILLS.md"). */
  instructions: Record<string, string>;
  /** The instructionsBundle.entryFile content (typically prompt.md). "" if absent. */
  entryPrompt: string;
  /** SKILLS.md content if loaded by the bundle, else "". */
  skills: string;
  /** Absolute path of the agent directory. */
  agentDir: string;
}

// ---------- loader ----------

export async function loadAgentDefinition(
  repoRoot: string,
  agent: AgentName,
): Promise<AgentDefinition> {
  const repoAbs = isAbsolute(repoRoot) ? repoRoot : resolve(process.cwd(), repoRoot);
  const agentDir = resolve(repoAbs, "agents", agent);
  const configPath = resolve(agentDir, "config.json");

  let raw: string;
  try {
    raw = await readFile(configPath, "utf-8");
  } catch (e) {
    throw new Error(
      `loadAgentDefinition[${agent}]: cannot read ${configPath}: ${(e as Error).message}`,
    );
  }

  let config: AgentConfig;
  try {
    config = JSON.parse(raw) as AgentConfig;
  } catch (e) {
    throw new Error(
      `loadAgentDefinition[${agent}]: invalid JSON in ${configPath}: ${(e as Error).message}`,
    );
  }

  if (config.role !== agent) {
    throw new Error(
      `loadAgentDefinition[${agent}]: config.role=${JSON.stringify(config.role)} does not match requested agent ${JSON.stringify(agent)}`,
    );
  }

  // Resolve @file: references in instructionsBundle.files
  const instructions: Record<string, string> = {};
  const bundle = config.instructionsBundle?.files ?? {};
  for (const [logical, ref] of Object.entries(bundle)) {
    if (typeof ref !== "string" || !ref.startsWith("@file:")) {
      // Only @file: refs are supported by this loader.
      continue;
    }
    const relPath = ref.slice("@file:".length);
    const fullPath = isAbsolute(relPath) ? relPath : resolve(agentDir, relPath);
    try {
      instructions[logical] = await readFile(fullPath, "utf-8");
    } catch (e) {
      throw new Error(
        `loadAgentDefinition[${agent}]: instructionsBundle.files["${logical}"] → ${fullPath} is unreadable: ${(e as Error).message}`,
      );
    }
  }

  const entryFile = config.instructionsBundle?.entryFile;
  const entryPrompt =
    entryFile && Object.prototype.hasOwnProperty.call(instructions, entryFile)
      ? instructions[entryFile]
      : "";
  const skills = Object.prototype.hasOwnProperty.call(instructions, "SKILLS.md")
    ? instructions["SKILLS.md"]
    : "";

  return { config, instructions, entryPrompt, skills, agentDir };
}
