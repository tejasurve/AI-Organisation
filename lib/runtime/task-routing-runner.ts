// lib/runtime/task-routing-runner.ts
//
// Pure composition wrapper around any AgentRunner that lets a caller pin the
// pipeline to a specific Engineering-Manager task. Used by scripts/run-pipeline.ts
// to honour the project rule "process ONE task per pipeline run" while still
// letting the user choose WHICH of the EM's tasks runs this time.
//
// What it does on each invocation:
//
//   - Engineering Manager → after the inner runner returns the EM output,
//     reorder `tasks[]` so the requested task is at index 0. The pipeline's
//     task-selection step picks `tasks[0]` (when assignedTo === "developer"),
//     so a single index-swap is enough to retarget without modifying the
//     pipeline.
//
//   - Developer / QA / Cybersecurity → first try a per-task fixture override
//     at `<scenarioDir>/tasks/<targetTaskId>/<agent>.output.json`. If that
//     file exists, return its contents. Otherwise fall through to the inner
//     runner (which will read the scenario-root fixture as before).
//
// All other agents (CEO, CTO) are passed through verbatim.
//
// IMPORTANT: this wrapper is composition-only. It does NOT modify the
// pipeline, validation, schemas, or any agent definitions. It only changes
// what the runner hands back to the pipeline at three specific call sites.

import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { AgentInvocation, AgentRunner } from "./agent-runner.ts";
import type { AgentName, EMOutput, Task } from "./types.ts";

export interface TaskRoutingRunnerOptions {
  /** Inner runner. Typically a FixtureAgentRunner. */
  inner: AgentRunner;
  /** Scenario directory used to look up `<scenarioDir>/tasks/<id>/` overrides. */
  scenarioDir: string;
  /** ID of the task that should run this pipeline invocation. */
  targetTaskId: string;
}

const PER_TASK_AGENTS: ReadonlySet<AgentName> = new Set([
  "developer",
  "qa",
  "cybersecurity",
]);

export class TaskRoutingRunner implements AgentRunner {
  private readonly inner: AgentRunner;
  private readonly scenarioDir: string;
  private readonly targetTaskId: string;

  constructor(options: TaskRoutingRunnerOptions) {
    if (!options.targetTaskId.trim()) {
      throw new Error("TaskRoutingRunner: targetTaskId is required");
    }
    this.inner = options.inner;
    this.scenarioDir = options.scenarioDir;
    this.targetTaskId = options.targetTaskId.trim();
  }

  async run(invocation: AgentInvocation): Promise<unknown> {
    if (PER_TASK_AGENTS.has(invocation.agentName)) {
      const override = await this.tryReadPerTaskFixture(invocation.agentName);
      if (override !== null) return override;
    }

    const result = await this.inner.run(invocation);

    if (invocation.agentName === "engineering-manager") {
      return reorderEMTasks(result, this.targetTaskId);
    }
    return result;
  }

  private async tryReadPerTaskFixture(agent: AgentName): Promise<unknown | null> {
    const path = resolve(this.scenarioDir, "tasks", this.targetTaskId, `${agent}.output.json`);
    try {
      await access(path);
    } catch {
      return null;
    }
    let raw: string;
    try {
      raw = await readFile(path, "utf-8");
    } catch (e) {
      throw new Error(
        `TaskRoutingRunner: could not read per-task fixture ${path}: ${(e as Error).message}`,
      );
    }
    try {
      return JSON.parse(raw);
    } catch (e) {
      throw new Error(
        `TaskRoutingRunner: per-task fixture ${path} is not valid JSON: ${(e as Error).message}`,
      );
    }
  }
}

/**
 * Pure helper: given an EM output and a target task id, returns a NEW EM
 * output whose `tasks[]` has the target at index 0.
 *
 * - If the target id does not exist: throws with a helpful message listing
 *   the available task ids.
 * - If the target is already at index 0: returns the input unchanged
 *   (referentially equal to `em`).
 * - The target task is otherwise spliced out of its original position and
 *   prepended; relative order of all other tasks is preserved.
 */
export function reorderEMTasks(emUnknown: unknown, targetTaskId: string): EMOutput {
  if (!isEMOutput(emUnknown)) {
    throw new Error("TaskRoutingRunner: engineering-manager output is not a valid EMOutput shape");
  }
  const em = emUnknown;
  const idx = em.tasks.findIndex((t) => t.id === targetTaskId);
  if (idx === -1) {
    throw new Error(
      `TaskRoutingRunner: --task ${JSON.stringify(targetTaskId)} not found in Engineering-Manager output. ` +
        `Available task ids: ${em.tasks.map((t) => t.id).join(", ") || "(none)"}`,
    );
  }
  if (idx === 0) return em;
  const target = em.tasks[idx];
  const reordered: Task[] = [target, ...em.tasks.slice(0, idx), ...em.tasks.slice(idx + 1)];
  return { ...em, tasks: reordered };
}

function isEMOutput(v: unknown): v is EMOutput {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return Array.isArray(o.features) && Array.isArray(o.tasks);
}
