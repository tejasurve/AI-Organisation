// lib/runtime/logger.ts
//
// Minimal pluggable logger for pipeline progress. Default impl is a coloured
// console reporter that matches the style used by scripts/test-validate.ts.
// Tests/library callers can pass a noop logger to silence output.

import type { AgentName } from "./types.ts";

export type StepName = AgentName | "validation" | "task-selection" | "file-writer";

export interface PipelineLogger {
  start(agent: StepName, note?: string): void;
  ok(agent: StepName, note?: string): void;
  blocked(agent: StepName, note: string): void;
  skipped(agent: StepName, note: string): void;
  info(message: string): void;
  error(message: string): void;
}

export function noopLogger(): PipelineLogger {
  return {
    start: () => {},
    ok: () => {},
    blocked: () => {},
    skipped: () => {},
    info: () => {},
    error: () => {},
  };
}

const c = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
};

export function consoleLogger(): PipelineLogger {
  function pad(name: StepName): string {
    return name.padEnd(20, " ");
  }
  return {
    start(agent, note) {
      const tail = note ? `  ${c.dim(note)}` : "";
      console.log(`${c.cyan("→")} ${pad(agent)} ${c.dim("running")}${tail}`);
    },
    ok(agent, note) {
      const tail = note ? `  ${c.dim(note)}` : "";
      console.log(`${c.green("✓")} ${pad(agent)} ${c.green("ok")}${tail}`);
    },
    blocked(agent, note) {
      console.log(`${c.red("✗")} ${pad(agent)} ${c.red("blocked")}  ${note}`);
    },
    skipped(agent, note) {
      console.log(`${c.yellow("·")} ${pad(agent)} ${c.yellow("skipped")}  ${c.dim(note)}`);
    },
    info(message) {
      console.log(c.dim(message));
    },
    error(message) {
      console.error(c.red(message));
    },
  };
}

export const colors = c;
