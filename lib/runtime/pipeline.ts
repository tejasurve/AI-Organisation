// lib/runtime/pipeline.ts
//
// runPipeline drives the canonical execution loop end-to-end:
//
//   Idea → CEO → CTO → EM → validate → (pick first task) → Developer → QA → Security
//
// Decision gate (per Step 8 spec):
//   if (qaOutput.decision === "PASS" && securityOutput.decision === "GO")
//     → write developer files to /generated/{taskId}/{file.path}
//   else
//     → record blockReason and stop
//
// All agent invocations go through the AgentRunner abstraction. The
// orchestrator does not know whether the runner is reading fixtures from disk
// (today) or calling an LLM (tomorrow).

import type { ValidationResult } from "../validation/index.ts";
import { validateEMOutput } from "../validation/index.ts";

import type {
  AgentName,
  CEOOutput,
  CTOOutput,
  CompanyContext,
  DeveloperOutput,
  EMOutput,
  Feature,
  QAOutput,
  SecurityOutput,
  Task,
} from "./types.ts";
import { AGENT_NAMES } from "./types.ts";
import type { AgentRunner } from "./agent-runner.ts";
import { writeGeneratedFiles, type WrittenFile } from "./file-writer.ts";
import type { PipelineLogger, StepName } from "./logger.ts";
import { noopLogger } from "./logger.ts";

// ---------- public types ----------

export type PipelineDecision =
  | "WROTE_FILES"
  | "GATE_BLOCKED_QA"
  | "GATE_BLOCKED_SECURITY"
  | "VALIDATION_FAILED"
  | "NO_TASKS"
  | "RUNTIME_ERROR";

export interface PipelineStep {
  name: StepName;
  status: "ok" | "blocked" | "skipped";
  details?: string;
  durationMs: number;
}

export interface PipelineOutputs {
  ceo?: CEOOutput;
  cto?: CTOOutput;
  em?: EMOutput;
  developer?: DeveloperOutput;
  qa?: QAOutput;
  security?: SecurityOutput;
}

export interface PipelineResult {
  idea: string;
  decision: PipelineDecision;
  blockReason: string | null;
  steps: PipelineStep[];
  validation: ValidationResult;
  selectedTask: Task | null;
  selectedFeature: Feature | null;
  filesWritten: WrittenFile[];
  outputs: PipelineOutputs;
}

export interface PipelineOptions {
  agentRunner: AgentRunner;
  generatedDir: string;
  companyContext?: CompanyContext;
  logger?: PipelineLogger;
}

// ---------- orchestrator ----------

export async function runPipeline(idea: string, options: PipelineOptions): Promise<PipelineResult> {
  const log = options.logger ?? noopLogger();
  const ctx: CompanyContext = options.companyContext ?? { phase: "validate", cycle: 1, priorCycle: null };

  const result: PipelineResult = {
    idea,
    decision: "RUNTIME_ERROR",
    blockReason: null,
    steps: [],
    validation: { valid: false, errors: [] },
    selectedTask: null,
    selectedFeature: null,
    filesWritten: [],
    outputs: {},
  };

  // 1. CEO
  const ceoOutput = await runStep<CEOOutput>(result, log, "ceo", () =>
    options.agentRunner.run({ agentName: "ceo", input: { idea, companyContext: ctx } }),
  );
  result.outputs.ceo = ceoOutput;

  // 2. CTO — consumes CEO delegation brief + company context
  const ctoOutput = await runStep<CTOOutput>(result, log, "cto", () =>
    options.agentRunner.run({ agentName: "cto", input: { ceoOutput, companyContext: ctx } }),
  );
  result.outputs.cto = ctoOutput;

  // 3. Engineering Manager — consumes CTO output (+ CEO priorities)
  const emOutput = await runStep<EMOutput>(result, log, "engineering-manager", () =>
    options.agentRunner.run({
      agentName: "engineering-manager",
      input: { ctoOutput, ceoOutput, companyContext: ctx },
    }),
  );
  result.outputs.em = emOutput;

  // 4. Validate EM output against the system schema + cross-array integrity rules.
  log.start("validation");
  const tv = Date.now();
  const validation = validateEMOutput(emOutput);
  result.validation = validation;
  if (!validation.valid) {
    const note = `${validation.errors.length} error(s)`;
    pushStep(result, "validation", "blocked", note, Date.now() - tv);
    log.blocked("validation", note);
    result.decision = "VALIDATION_FAILED";
    result.blockReason = `EM output failed validation: ${describeFirstErrors(validation)}`;
    return result;
  }
  pushStep(result, "validation", "ok", `${emOutput.features.length} features, ${emOutput.tasks.length} tasks`, Date.now() - tv);
  log.ok("validation", `${emOutput.features.length} features, ${emOutput.tasks.length} tasks`);

  // 5. Pick first task — the spec says "Only process ONE task" this cycle.
  if (emOutput.tasks.length === 0) {
    pushStep(result, "task-selection", "blocked", "EM produced no tasks", 0);
    log.blocked("task-selection", "EM produced no tasks");
    result.decision = "NO_TASKS";
    result.blockReason = "EM produced no tasks this cycle";
    return result;
  }
  const task = emOutput.tasks[0];
  const feature = emOutput.features.find((f) => f.id === task.featureId);
  if (!feature) {
    // Should be caught by validateEMOutput, but defend anyway.
    pushStep(result, "task-selection", "blocked", `task references unknown feature ${task.featureId}`, 0);
    log.blocked("task-selection", `task references unknown feature ${task.featureId}`);
    result.decision = "VALIDATION_FAILED";
    result.blockReason = `selected task references unknown featureId ${task.featureId}`;
    return result;
  }
  result.selectedTask = task;
  result.selectedFeature = feature;
  const taskNote = `picked ${task.id} (${task.assignedTo}, ${task.estimatedHours}h) under ${feature.id}`;
  pushStep(result, "task-selection", "ok", taskNote, 0);
  log.ok("task-selection", taskNote);

  // Sanity: the developer is the only role this pipeline currently routes work to.
  // Designer / QA tasks would need a parallel pipeline; surface it cleanly.
  if (task.assignedTo !== "developer") {
    const note = `selected task is assignedTo=${task.assignedTo}; this pipeline only routes "developer" tasks today`;
    pushStep(result, "task-selection", "skipped", note, 0);
    log.skipped("developer", note);
    log.skipped("qa", "skipped because no developer output to evaluate");
    log.skipped("cybersecurity", "skipped because no developer output to audit");
    log.skipped("file-writer", "skipped because no developer output to write");
    result.decision = "NO_TASKS";
    result.blockReason = note;
    return result;
  }

  // 6. Developer — consumes task + feature + CTO output + company context
  const devOutput = await runStep<DeveloperOutput>(result, log, "developer", () =>
    options.agentRunner.run({
      agentName: "developer",
      input: { task, feature, ctoOutput, companyContext: ctx },
    }),
  );
  result.outputs.developer = devOutput;

  if (devOutput.taskId !== task.id) {
    const note = `developer.taskId=${JSON.stringify(devOutput.taskId)} but expected ${JSON.stringify(task.id)}`;
    pushStep(result, "developer", "blocked", note, 0);
    log.blocked("developer", note);
    result.decision = "RUNTIME_ERROR";
    result.blockReason = note;
    return result;
  }

  // 7. QA — consumes developer output + original task
  const qaOutput = await runStep<QAOutput>(result, log, "qa", () =>
    options.agentRunner.run({
      agentName: "qa",
      input: { developerOutput: devOutput, task },
    }),
  );
  result.outputs.qa = qaOutput;
  // Decorate the QA step with the verdict for the run summary.
  decorateLastStep(result, "qa", `decision=${qaOutput.decision}`);

  // 8. Cybersecurity — consumes QA output + developer output + changed surfaces
  const secOutput = await runStep<SecurityOutput>(result, log, "cybersecurity", () =>
    options.agentRunner.run({
      agentName: "cybersecurity",
      input: {
        qaOutput,
        developerOutput: devOutput,
        changedSurfaces: { files: devOutput.files.map((f) => f.path) },
      },
    }),
  );
  result.outputs.security = secOutput;
  decorateLastStep(result, "cybersecurity", `decision=${secOutput.decision}`);

  // 9. Decision gate — STRICT: only PASS+GO writes files.
  if (qaOutput.decision !== "PASS") {
    const note = `QA decision=${qaOutput.decision} (must be "PASS" to write files)`;
    log.skipped("file-writer", note);
    pushStep(result, "file-writer", "skipped", note, 0);
    result.decision = "GATE_BLOCKED_QA";
    result.blockReason = note;
    return result;
  }
  if (secOutput.decision !== "GO") {
    const note = `Security decision=${secOutput.decision} (must be "GO" to write files)`;
    log.skipped("file-writer", note);
    pushStep(result, "file-writer", "skipped", note, 0);
    result.decision = "GATE_BLOCKED_SECURITY";
    result.blockReason = note;
    return result;
  }

  // 10. Write files
  log.start("file-writer", `${devOutput.files.length} file(s) → ${options.generatedDir}/${task.id}/`);
  const tw = Date.now();
  const written = await writeGeneratedFiles({
    taskId: task.id,
    files: devOutput.files,
    rootDir: options.generatedDir,
  });
  result.filesWritten = written;
  const writeNote = `${written.length} file(s), ${sumBytes(written)} bytes`;
  pushStep(result, "file-writer", "ok", writeNote, Date.now() - tw);
  log.ok("file-writer", writeNote);

  result.decision = "WROTE_FILES";
  return result;
}

// ---------- helpers ----------

async function runStep<T>(
  result: PipelineResult,
  log: PipelineLogger,
  name: StepName,
  fn: () => Promise<unknown>,
): Promise<T> {
  log.start(name);
  const t0 = Date.now();
  try {
    const out = (await fn()) as T;
    pushStep(result, name, "ok", undefined, Date.now() - t0);
    log.ok(name);
    return out;
  } catch (e) {
    const msg = (e as Error).message;
    pushStep(result, name, "blocked", msg, Date.now() - t0);
    log.blocked(name, msg);
    throw e;
  }
}

function pushStep(
  result: PipelineResult,
  name: StepName,
  status: PipelineStep["status"],
  details: string | undefined,
  durationMs: number,
): void {
  result.steps.push({ name, status, details, durationMs });
}

function decorateLastStep(result: PipelineResult, name: StepName, details: string): void {
  for (let i = result.steps.length - 1; i >= 0; i--) {
    if (result.steps[i].name === name) {
      result.steps[i].details = result.steps[i].details ? `${result.steps[i].details} | ${details}` : details;
      return;
    }
  }
}

function describeFirstErrors(v: ValidationResult): string {
  return v.errors
    .slice(0, 3)
    .map((e) => `[${e.rule}] ${e.path}: ${e.message}`)
    .join("; ");
}

function sumBytes(written: readonly WrittenFile[]): number {
  let sum = 0;
  for (const w of written) sum += w.bytes;
  return sum;
}

// ---------- re-exports for callers ----------

export { AGENT_NAMES };
export type { AgentName, AgentRunner };
export { writeGeneratedFiles } from "./file-writer.ts";
export type { WrittenFile } from "./file-writer.ts";
