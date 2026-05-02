// lib/runtime/types.ts
//
// TypeScript views of each agent's outputContract.schema.
//
// The agents' config.json files are the source of truth for the LLM (they get
// loaded into Paperclip's hire pipeline). These interfaces give the runtime
// orchestrator a typed view of the same shapes so that pipeline.ts can read
// fields safely. They are duplicated intentionally — we don't want to invert
// the dependency by having the agent contracts import from runtime code.

import type { EMOutput, Feature, Task } from "../schemas/index.ts";

// ---------- CEO ----------

export interface CEODelegation {
  cto: string;
  cmo: string;
  cfo: string;
  cpo: string;
}

export interface CEOOutput {
  mission: string;
  okrs: string[];
  priorities: string[];
  delegation: CEODelegation;
}

// ---------- CTO ----------

export interface CTOArchitecture {
  frontend: string;
  backend: string;
  database: string;
  infrastructure: string;
}

export interface CTOAPIContract {
  endpoint: string;
  method: string;
  description: string;
  request: Record<string, unknown>;
  response: Record<string, unknown>;
}

export interface CTODatabaseTable {
  table: string;
  fields: string[];
}

export interface CTOOutput {
  architecture: CTOArchitecture;
  apiContracts: CTOAPIContract[];
  databaseSchema: CTODatabaseTable[];
  risks: string[];
}

// ---------- Developer ----------

export interface DeveloperFile {
  path: string;
  content: string;
}

export interface DeveloperTest {
  description: string;
  code: string;
}

export interface DeveloperOutput {
  taskId: string;
  implementationPlan: string;
  files: DeveloperFile[];
  tests: DeveloperTest[];
  notes: string[];
}

// ---------- QA ----------

export type QAResultStatus = "pass" | "fail";
export type QADecision = "PASS" | "FAIL" | "CONDITIONAL";

export interface QAResult {
  test: string;
  status: QAResultStatus;
  details: string;
}

export interface QABug {
  description: string;
  stepsToReproduce: string;
  expected: string;
  actual: string;
}

export interface QAOutput {
  taskId: string;
  testPlan: string[];
  results: QAResult[];
  bugs: QABug[];
  decision: QADecision;
}

// ---------- Cybersecurity ----------

export type SecuritySeverity = "critical" | "high" | "medium" | "low";
export type SecurityDecision = "GO" | "NO_GO";

export interface SecurityVulnerability {
  severity: SecuritySeverity;
  description: string;
  recommendation: string;
}

export interface SecurityOutput {
  taskId: string;
  summary: string;
  vulnerabilities: SecurityVulnerability[];
  promptInjectionRisk: string;
  decision: SecurityDecision;
  requiredFixes: string[];
}

// ---------- Re-exports for convenience ----------

export type { EMOutput, Feature, Task };

// ---------- Agent identity ----------

export const AGENT_NAMES = [
  "ceo",
  "cto",
  "engineering-manager",
  "developer",
  "qa",
  "cybersecurity",
] as const;

export type AgentName = (typeof AGENT_NAMES)[number];

// ---------- Company context ----------
//
// Mirrors the `=== Company Context ===` section that several agents accept on
// input. Kept loose (additionalProperties: true) per the agent contracts.

export interface CompanyContext {
  phase: string;
  cycle: number;
  priorCycle: unknown;
  [key: string]: unknown;
}
