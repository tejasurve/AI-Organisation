#!/usr/bin/env node
// scripts/test-runtime.ts
//
// Tests the lib/runtime layer end-to-end without touching the agent
// definitions. Three groups:
//   1. file-writer path sanitization (security-critical)
//   2. file-writer write semantics (creates dirs, writes content, returns metadata)
//   3. pipeline orchestration via FixtureAgentRunner (happy path + every gate
//      branch — validation failure, QA fail, QA conditional, security NO_GO,
//      no-tasks, taskId mismatch, non-developer assignee)
//
// Zero deps. Run with: node scripts/test-runtime.ts
//
// Exit codes: 0 = all pass, 1 = one or more failed.

import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  FixtureAgentRunner,
  type AgentInvocation,
  type AgentRunner,
} from "../lib/runtime/agent-runner.ts";
import {
  runPipeline,
  writeGeneratedFiles,
  type PipelineResult,
} from "../lib/runtime/pipeline.ts";
import { sanitizeFilePath, sanitizeTaskId } from "../lib/runtime/file-writer.ts";
import { noopLogger } from "../lib/runtime/logger.ts";
import type {
  AgentName,
  CEOOutput,
  CTOOutput,
  DeveloperOutput,
  EMOutput,
  QAOutput,
  SecurityOutput,
} from "../lib/runtime/types.ts";

const c = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
};

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const scenarioDir = resolve(repoRoot, "fixtures", "scenarios", "waitlist-mvp");

let passed = 0;
let failed = 0;
const failures: string[] = [];

function group(name: string, fn: () => Promise<void> | void): Promise<void> | void {
  console.log(`\n${c.bold(c.cyan(name))}`);
  return fn();
}

async function test(name: string, fn: () => Promise<void> | void): Promise<void> {
  try {
    await fn();
    console.log(`  ${c.green("✓")} ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ${c.red("✗")} ${name}`);
    for (const line of String((e as Error).message).split("\n")) {
      console.log(`      ${c.red(line)}`);
    }
    failed++;
    failures.push(name);
  }
}

function assert(cond: boolean, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function expectThrow(fn: () => unknown | Promise<unknown>, match: RegExp, name: string): Promise<void> {
  try {
    await fn();
  } catch (e) {
    const msg = (e as Error).message;
    if (!match.test(msg)) {
      throw new Error(`${name}: error did not match ${match}; got: ${msg}`);
    }
    return;
  }
  throw new Error(`${name}: expected throw matching ${match}, got no throw`);
}

console.log(c.bold("\nTesting lib/runtime"));

// ---------- support: load fixtures + craft mock runners (declared first so
//                     the test groups below can close over them) ----------

interface FixtureSet {
  ceo: CEOOutput;
  cto: CTOOutput;
  em: EMOutput;
  developer: DeveloperOutput;
  qa: QAOutput;
  cybersecurity: SecurityOutput;
}

async function loadFixtures(): Promise<FixtureSet> {
  const read = async (name: string) =>
    JSON.parse(await readFile(join(scenarioDir, `${name}.output.json`), "utf-8"));
  return {
    ceo: await read("ceo"),
    cto: await read("cto"),
    em: await read("engineering-manager"),
    developer: await read("developer"),
    qa: await read("qa"),
    cybersecurity: await read("cybersecurity"),
  };
}

const fixtures = await loadFixtures();

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

function cloneEM(mutate: (em: EMOutput) => void): EMOutput {
  const x = clone(fixtures.em);
  mutate(x);
  return x;
}

function cloneDev(mutate: (d: DeveloperOutput) => void): DeveloperOutput {
  const x = clone(fixtures.developer);
  mutate(x);
  return x;
}

function makeMockRunner(overrides: Partial<FixtureSet>): AgentRunner {
  const set: FixtureSet = { ...fixtures, ...overrides };
  return {
    async run(inv: AgentInvocation): Promise<unknown> {
      const map: Record<AgentName, unknown> = {
        ceo: set.ceo,
        cto: set.cto,
        "engineering-manager": set.em,
        developer: set.developer,
        qa: set.qa,
        cybersecurity: set.cybersecurity,
      };
      return map[inv.agentName];
    },
  };
}

async function runWithMockRunner(overrides: Partial<FixtureSet>): Promise<PipelineResult> {
  const tmp = await mkdtemp(join(tmpdir(), "ai-org-mock-"));
  try {
    return await runPipeline("test", {
      agentRunner: makeMockRunner(overrides),
      generatedDir: tmp,
      logger: noopLogger(),
    });
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

interface GateBranchOptions {
  qaOverride?: Partial<QAOutput>;
  secOverride?: Partial<SecurityOutput>;
  expectDecision: PipelineResult["decision"];
}

async function runGateBranch(opts: GateBranchOptions): Promise<void> {
  const qa: QAOutput = opts.qaOverride ? { ...clone(fixtures.qa), ...opts.qaOverride } : fixtures.qa;
  const sec: SecurityOutput = opts.secOverride ? { ...clone(fixtures.cybersecurity), ...opts.secOverride } : fixtures.cybersecurity;
  const r = await runWithMockRunner({ qa, cybersecurity: sec });
  assert(r.decision === opts.expectDecision, `expected ${opts.expectDecision}, got ${r.decision} (blockReason=${r.blockReason})`);
  assert(r.filesWritten.length === 0, `expected no files written, got ${r.filesWritten.length}`);
}

// ---------- 1. file-writer path sanitization ----------

await group("1. file-writer — path sanitization (security-critical)", async () => {
  await test("sanitizeTaskId accepts canonical task ids", () => {
    assert(sanitizeTaskId("t-waitlist-storage-1") === "t-waitlist-storage-1", "should pass through");
    assert(sanitizeTaskId("t-a") === "t-a", "minimal id allowed");
    assert(sanitizeTaskId("a_b.c-d") === "a_b.c-d", "alphanumeric + ._- allowed");
  });

  await test("sanitizeTaskId rejects path separators, dots, and traversal", async () => {
    await expectThrow(() => sanitizeTaskId("a/b"), /unsafe taskId/, "slash");
    await expectThrow(() => sanitizeTaskId(".."), /unsafe taskId/, "..");
    await expectThrow(() => sanitizeTaskId("."), /unsafe taskId/, ".");
    await expectThrow(() => sanitizeTaskId(""), /empty taskId/, "empty");
    await expectThrow(() => sanitizeTaskId("a b"), /unsafe taskId/, "space");
    await expectThrow(() => sanitizeTaskId("a$b"), /unsafe taskId/, "shell metachar");
  });

  await test("sanitizeFilePath accepts canonical relative paths", () => {
    assert(sanitizeFilePath("lib/db/schema/waitlist-emails.ts") === "lib/db/schema/waitlist-emails.ts", "deep path");
    assert(sanitizeFilePath("a.ts") === "a.ts", "single file");
    assert(sanitizeFilePath("a/b/c.txt") === "a/b/c.txt", "nested file");
  });

  await test("sanitizeFilePath rejects absolute paths", async () => {
    await expectThrow(() => sanitizeFilePath("/etc/passwd"), /absolute paths not allowed/, "unix abs");
    await expectThrow(() => sanitizeFilePath("/lib/db/schema.ts"), /absolute paths not allowed/, "rooted");
  });

  await test("sanitizeFilePath rejects path traversal", async () => {
    await expectThrow(() => sanitizeFilePath(".."), /path traversal/, "bare ..");
    await expectThrow(() => sanitizeFilePath("../etc/passwd"), /path traversal/, "leading ..");
    await expectThrow(() => sanitizeFilePath("a/../../etc/passwd"), /path traversal/, "nested ..");
    await expectThrow(() => sanitizeFilePath("a/b/.."), /path traversal/, "trailing ..");
  });

  await test("sanitizeFilePath normalises and rejects empty", async () => {
    assert(sanitizeFilePath("./lib/x.ts") === "lib/x.ts", "leading ./ stripped");
    assert(sanitizeFilePath("lib//db//x.ts") === "lib/db/x.ts", "double slash collapsed");
    await expectThrow(() => sanitizeFilePath(""), /empty file path/, "empty");
  });
});

// ---------- 2. file-writer write semantics ----------

await group("2. file-writer — write semantics", async () => {
  await test("writes one file with correct content + bytes", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "ai-org-write-"));
    try {
      const written = await writeGeneratedFiles({
        taskId: "t-demo-1",
        files: [{ path: "a/b.txt", content: "hello\n" }],
        rootDir: tmp,
      });
      assert(written.length === 1, `expected 1, got ${written.length}`);
      assert(written[0].declaredPath === "a/b.txt", "declaredPath preserved");
      assert(written[0].bytes === 6, `expected 6 bytes, got ${written[0].bytes}`);
      const onDisk = await readFile(written[0].absolutePath, "utf-8");
      assert(onDisk === "hello\n", `content mismatch: ${JSON.stringify(onDisk)}`);
      assert(written[0].absolutePath.endsWith("/t-demo-1/a/b.txt"), `wrong location: ${written[0].absolutePath}`);
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  await test("creates nested directories as needed", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "ai-org-write-"));
    try {
      await writeGeneratedFiles({
        taskId: "t-demo-2",
        files: [{ path: "deep/nested/dir/with/file.ts", content: "x" }],
        rootDir: tmp,
      });
      const onDisk = await readFile(join(tmp, "t-demo-2", "deep", "nested", "dir", "with", "file.ts"), "utf-8");
      assert(onDisk === "x", "nested write should land");
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  await test("writes multiple files and rejects duplicates", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "ai-org-write-"));
    try {
      const written = await writeGeneratedFiles({
        taskId: "t-multi",
        files: [
          { path: "a.txt", content: "1" },
          { path: "b.txt", content: "22" },
        ],
        rootDir: tmp,
      });
      assert(written.length === 2, "two files written");

      await expectThrow(
        () =>
          writeGeneratedFiles({
            taskId: "t-multi-dup",
            files: [
              { path: "a.txt", content: "1" },
              { path: "a.txt", content: "2" },
            ],
            rootDir: tmp,
          }),
        /duplicate file path/,
        "duplicate paths",
      );
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  await test("refuses to write zero files", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "ai-org-write-"));
    try {
      await expectThrow(
        () => writeGeneratedFiles({ taskId: "t-empty", files: [], rootDir: tmp }),
        /no files to write/,
        "empty files[]",
      );
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  await test("end-to-end: refuses traversal even if sanitizer were bypassed", async () => {
    // This double-checks that `resolve(taskDir, file.path)` cannot escape
    // taskDir even if the developer-supplied path tries to.
    const tmp = await mkdtemp(join(tmpdir(), "ai-org-write-"));
    try {
      await expectThrow(
        () =>
          writeGeneratedFiles({
            taskId: "t-x",
            files: [{ path: "../escape.txt", content: "x" }],
            rootDir: tmp,
          }),
        /path traversal/,
        "leading-..",
      );
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });
});

// ---------- 3. pipeline orchestration via FixtureAgentRunner ----------

await group("3. pipeline — happy path against waitlist-mvp scenario", async () => {
  await test("happy path: reads scenario, validates, gates pass, writes 2 files", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "ai-org-pipe-"));
    try {
      const result = await runPipeline("test idea", {
        agentRunner: new FixtureAgentRunner(scenarioDir),
        generatedDir: tmp,
        logger: noopLogger(),
      });
      assert(result.decision === "WROTE_FILES", `expected WROTE_FILES, got ${result.decision} (reason=${result.blockReason})`);
      assert(result.validation.valid, "EM output should validate");
      assert(result.outputs.qa?.decision === "PASS", `QA should be PASS, got ${result.outputs.qa?.decision}`);
      assert(result.outputs.security?.decision === "GO", `Security should be GO, got ${result.outputs.security?.decision}`);
      assert(result.selectedTask?.id === "t-waitlist-storage-1", `expected t-waitlist-storage-1, got ${result.selectedTask?.id}`);
      assert(result.filesWritten.length === 2, `expected 2 files, got ${result.filesWritten.length}`);

      // Files actually exist on disk under the per-task directory.
      const taskDir = join(tmp, "t-waitlist-storage-1");
      const entries = await readdir(taskDir, { recursive: true });
      const has = (s: string) => entries.some((e) => e.toString().endsWith(s));
      assert(has("waitlist-emails.ts"), `missing waitlist-emails.ts; entries: ${JSON.stringify(entries)}`);
      assert(has("index.ts"), `missing index.ts; entries: ${JSON.stringify(entries)}`);
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  await test("step ordering is canonical (CEO → CTO → EM → validation → task-selection → developer → qa → cybersecurity → file-writer)", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "ai-org-pipe-"));
    try {
      const r = await runPipeline("test", {
        agentRunner: new FixtureAgentRunner(scenarioDir),
        generatedDir: tmp,
        logger: noopLogger(),
      });
      const expected = ["ceo", "cto", "engineering-manager", "validation", "task-selection", "developer", "qa", "cybersecurity", "file-writer"];
      const actual = r.steps.map((s) => s.name);
      assert(JSON.stringify(actual) === JSON.stringify(expected), `step order mismatch:\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`);
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });
});

await group("4. pipeline — gate branches (each must NOT write files)", async () => {
  await test("gate-blocked: QA decision = FAIL → no files written", async () => {
    await runGateBranch({
      qaOverride: { decision: "FAIL", bugs: [{ description: "broken", stepsToReproduce: "x", expected: "y", actual: "z" }] },
      expectDecision: "GATE_BLOCKED_QA",
    });
  });

  await test("gate-blocked: QA decision = CONDITIONAL → no files written (strict PASS rule)", async () => {
    await runGateBranch({
      qaOverride: { decision: "CONDITIONAL" },
      expectDecision: "GATE_BLOCKED_QA",
    });
  });

  await test("gate-blocked: Security decision = NO_GO → no files written", async () => {
    await runGateBranch({
      secOverride: {
        decision: "NO_GO",
        vulnerabilities: [{ severity: "critical", description: "x", recommendation: "y" }],
        requiredFixes: ["fix x"],
      },
      expectDecision: "GATE_BLOCKED_SECURITY",
    });
  });
});

await group("5. pipeline — validation and selection branches", async () => {
  await test("validation-failed: EM emits a task referencing an unknown feature", async () => {
    const r = await runWithMockRunner({
      em: cloneEM((em) => {
        em.tasks[0].featureId = "f-does-not-exist";
      }),
    });
    assert(r.decision === "VALIDATION_FAILED", `expected VALIDATION_FAILED, got ${r.decision}`);
    assert(r.validation.valid === false, "validation should be false");
    assert(r.filesWritten.length === 0, "no files should be written");
  });

  await test("no-tasks: EM emits empty tasks[] → halts cleanly", async () => {
    const r = await runWithMockRunner({
      em: { features: [], tasks: [] },
    });
    assert(r.decision === "NO_TASKS", `expected NO_TASKS, got ${r.decision}`);
    assert(r.filesWritten.length === 0, "no files written");
  });

  await test("non-developer task: first task is qa → halts before developer step", async () => {
    const r = await runWithMockRunner({
      em: cloneEM((em) => {
        // Move the qa task to position 0 — also need to keep f-waitlist-storage with ≥1 task.
        const idx = em.tasks.findIndex((t) => t.assignedTo === "qa");
        const [qaTask] = em.tasks.splice(idx, 1);
        em.tasks.unshift(qaTask);
      }),
    });
    assert(r.decision === "NO_TASKS", `expected NO_TASKS, got ${r.decision}`);
    assert(r.outputs.developer == null, "developer should not have run");
    assert(r.filesWritten.length === 0, "no files written");
  });

  await test("taskId mismatch: developer.taskId !== task.id → RUNTIME_ERROR, no files", async () => {
    const r = await runWithMockRunner({
      developer: cloneDev((dev) => {
        dev.taskId = "wrong-id";
      }),
    });
    assert(r.decision === "RUNTIME_ERROR", `expected RUNTIME_ERROR, got ${r.decision}`);
    assert(r.filesWritten.length === 0, "no files written");
  });
});

// ---------- summary ----------

console.log(`\n${c.bold("Summary")}: ${c.green(passed + " passed")}, ${failed === 0 ? c.dim("0 failed") : c.red(failed + " failed")}`);
if (failed > 0) {
  console.log(c.red("\nFailures:"));
  for (const name of failures) console.log(`  - ${name}`);
  process.exit(1);
}
console.log(c.green("\nAll tests passed."));
process.exit(0);
