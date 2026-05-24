// lib/runtime/simulation-logger.ts
//
// Drop-in PipelineLogger that bridges the existing reality engine into the new
// simulation engine. Wraps any existing logger so callers can keep their
// console output AND get a live office:
//
//   const logger = simulationLogger(consoleLogger());
//   await runPipeline(idea, { agentRunner, generatedDir, logger });
//
// This file is the ONLY new code that lives in lib/runtime. The pipeline,
// agents, and contracts are untouched.

import { emit } from "../simulation/event-bus.ts";
import type { PipelineLogger, StepName } from "./logger.ts";
import { noopLogger } from "./logger.ts";
import type { AgentName } from "./types.ts";

const AGENT_STEPS: ReadonlySet<StepName> = new Set([
  "ceo",
  "product-owner",
  "solution-architect",
  "cto",
  "engineering-manager",
  "developer",
  "qa",
  "cybersecurity",
]);

function isAgentName(s: StepName): s is AgentName {
  return AGENT_STEPS.has(s);
}

export interface SimulationLoggerOptions {
  /** Inner logger to delegate console / structured logs to. Defaults to noop. */
  inner?: PipelineLogger;
  /** Optional idea string — emitted as a pipeline.start when set. */
  idea?: string;
}

export function simulationLogger(
  innerOrOptions: PipelineLogger | SimulationLoggerOptions = noopLogger(),
): PipelineLogger {
  const opts: SimulationLoggerOptions =
    "start" in innerOrOptions
      ? { inner: innerOrOptions as PipelineLogger }
      : (innerOrOptions as SimulationLoggerOptions);
  const inner = opts.inner ?? noopLogger();
  const idea = opts.idea;

  let startedAt: number | null = null;
  let pipelineStarted = false;
  // Track per-agent first-seen so we don't emit duplicate "started" events
  // when both `start()` and the pipeline orchestrator fire.
  const startedAgents = new Set<AgentName>();
  // Did we observe a hard block?
  let lastDecision:
    | "WROTE_FILES"
    | "GATE_BLOCKED_QA"
    | "GATE_BLOCKED_SECURITY"
    | "VALIDATION_FAILED"
    | "NO_TASKS"
    | "RUNTIME_ERROR"
    | null = null;

  function ensurePipelineStart(): void {
    if (pipelineStarted) return;
    pipelineStarted = true;
    startedAt = Date.now();
    emit({ type: "pipeline.start", idea: idea ?? "(unspecified idea)" });
  }

  return {
    start(agent, note) {
      inner.start(agent, note);
      ensurePipelineStart();

      if (isAgentName(agent)) {
        if (!startedAgents.has(agent)) {
          startedAgents.add(agent);
          emit({ type: "agent.started", agent, note });
        }
      }
    },

    ok(agent, note) {
      inner.ok(agent, note);

      if (isAgentName(agent)) {
        // QA / security carry decisions in the `note`.
        if (agent === "qa") {
          const decision = extractDecision(note, /decision=(PASS|FAIL|CONDITIONAL)/);
          if (decision) {
            emit({
              type: "qa.verdict",
              decision: decision as "PASS" | "FAIL" | "CONDITIONAL",
              bugs: 0,
            });
          }
        } else if (agent === "cybersecurity") {
          const decision = extractDecision(note, /decision=(GO|NO_GO)/);
          if (decision) {
            emit({
              type: "security.verdict",
              decision: decision as "GO" | "NO_GO",
              critical: 0,
            });
          }
        }
        emit({ type: "agent.completed", agent, summary: note });
      } else if (agent === "validation") {
        const m = note ? /(\d+)\s+features,\s*(\d+)\s+tasks/i.exec(note) : null;
        if (m) {
          emit({ type: "validation.ok", features: Number(m[1]), tasks: Number(m[2]) });
        }
      } else if (agent === "file-writer") {
        // `${written.length} file(s), ${sumBytes(written)} bytes`
        const m = note ? /(\d+)\s+file\(s\),\s*(\d+)\s+bytes/i.exec(note) : null;
        if (m) {
          emit({
            type: "files.written",
            taskId: "(unknown)",
            count: Number(m[1]),
            bytes: Number(m[2]),
          });
          lastDecision = "WROTE_FILES";
        }
      }
    },

    blocked(agent, note) {
      inner.blocked(agent, note);
      if (isAgentName(agent)) {
        emit({ type: "agent.blocked", agent, reason: note });
      } else if (agent === "validation") {
        const m = /(\d+)\s+error/i.exec(note ?? "");
        emit({
          type: "validation.failed",
          errors: m ? Number(m[1]) : 1,
          firstError: note ?? "validation failed",
        });
        lastDecision = "VALIDATION_FAILED";
      }
    },

    skipped(agent, note) {
      inner.skipped(agent, note);
      // Surface skipped file-writer (caused by QA/SEC blockers) as a verdict
      // so the UI gets clean signalling.
      if (agent === "file-writer" && note) {
        if (/QA decision=(\w+)/.test(note)) {
          const m = /QA decision=(PASS|FAIL|CONDITIONAL)/.exec(note);
          if (m && m[1] !== "PASS") {
            emit({
              type: "qa.verdict",
              decision: m[1] as "FAIL" | "CONDITIONAL",
              bugs: 0,
            });
            lastDecision = "GATE_BLOCKED_QA";
          }
        }
        if (/Security decision=(GO|NO_GO)/.test(note)) {
          const m = /Security decision=(GO|NO_GO)/.exec(note);
          if (m && m[1] === "NO_GO") {
            emit({ type: "security.verdict", decision: "NO_GO", critical: 0 });
            lastDecision = "GATE_BLOCKED_SECURITY";
          }
        }
      }
    },

    info(message) {
      inner.info(message);
    },

    error(message) {
      inner.error(message);
    },
  };
}

/**
 * Emit pipeline.finished — call this once the pipeline returns, since the
 * existing PipelineLogger surface has no `done` hook.
 */
export function emitPipelineFinished(
  decision:
    | "WROTE_FILES"
    | "GATE_BLOCKED_QA"
    | "GATE_BLOCKED_SECURITY"
    | "VALIDATION_FAILED"
    | "NO_TASKS"
    | "RUNTIME_ERROR",
  startedAt: number,
): void {
  emit({
    type: "pipeline.finished",
    decision,
    ms: Date.now() - startedAt,
  });
}

// ---------- helpers ----------

function extractDecision(note: string | undefined, re: RegExp): string | null {
  if (!note) return null;
  const m = re.exec(note);
  return m ? m[1] : null;
}
