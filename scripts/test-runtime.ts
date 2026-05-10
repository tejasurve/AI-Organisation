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

// ---------- 6. report formatter ----------

const { formatReportMarkdown } = await import("../lib/runtime/report.ts");

await group("6. report formatter — Markdown shape", async () => {
  const fixedNow = new Date("2026-05-02T16:15:23.456Z");

  await test("WROTE_FILES report: header + every section + selected task + files written", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "ai-org-report-"));
    try {
      const r = await runPipeline("Build a SaaS landing page with signup", {
        agentRunner: new FixtureAgentRunner(scenarioDir),
        generatedDir: tmp,
        logger: noopLogger(),
      });
      assert(r.decision === "WROTE_FILES", `precondition: WROTE_FILES; got ${r.decision}`);
      const md = formatReportMarkdown(r, { now: fixedNow });
      assert(md.startsWith("# Pipeline run report"), "starts with H1");
      assert(md.includes("**Idea:** Build a SaaS landing page with signup"), "idea line present");
      assert(md.includes("**Decision:** ✅ `WROTE_FILES`"), "decision line present");
      assert(md.includes("**Timestamp:** 2026-05-02T16:15:23.456Z"), "fixed timestamp injected");
      assert(md.includes("## Steps"), "steps section");
      assert(md.includes("## Validation"), "validation section");
      assert(md.includes("## Selected task"), "selected task section");
      assert(md.includes("## Files written"), "files written section");
      assert(md.includes("## Agent outputs"), "agent outputs section");
      for (const role of ["### CEO", "### CTO", "### Engineering Manager", "### Developer", "### QA", "### Cybersecurity"]) {
        assert(md.includes(role), `missing per-agent section: ${role}`);
      }
      assert(/\| `lib\/db\/schema\/.+\.ts` \| \d+ \|/.test(md), "files written table renders rows");
      assert(md.includes("✅ PASS"), "QA decision badge");
      assert(md.includes("✅ GO"), "Security decision badge");
      assert(md.endsWith("Generated by the AI Organisation pipeline runner._\n"), "footer present");
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  await test("blocked report: validation failed → no Selected task, no Files written, blockReason surfaced", async () => {
    const brokenEM = clone(fixtures.em);
    brokenEM.tasks[0].featureId = "f-does-not-exist";
    const r = await runWithMockRunner({ em: brokenEM });
    assert(r.decision === "VALIDATION_FAILED", `precondition: VALIDATION_FAILED; got ${r.decision}`);
    const md = formatReportMarkdown(r, { now: fixedNow });
    assert(md.includes("**Decision:** ⚠️ `VALIDATION_FAILED`"), "blocked decision rendered");
    assert(md.includes("**Block reason:**"), "blockReason surfaced");
    assert(md.includes("## Validation"), "validation section");
    assert(md.includes("Invalid"), "validation marked invalid");
    assert(md.includes("_No task was selected this run._"), "no-task placeholder");
    assert(md.includes("_No files were written this run._"), "no-files placeholder");
    assert(md.includes("### Developer\n\n_Did not run._"), "developer section flagged as not run");
    assert(md.includes("### QA\n\n_Did not run._"), "QA section flagged as not run");
    assert(md.includes("### Cybersecurity\n\n_Did not run._"), "Cybersecurity section flagged as not run");
  });

  await test("QA-blocked report: QA section present with FAIL badge, files-written empty", async () => {
    const failedQA: QAOutput = {
      ...clone(fixtures.qa),
      decision: "FAIL",
      bugs: [{ description: "x", stepsToReproduce: "y", expected: "z", actual: "w" }],
    };
    const r = await runWithMockRunner({ qa: failedQA });
    assert(r.decision === "GATE_BLOCKED_QA", `precondition: GATE_BLOCKED_QA; got ${r.decision}`);
    const md = formatReportMarkdown(r, { now: fixedNow });
    assert(md.includes("**Decision:** ⚠️ `GATE_BLOCKED_QA`"), "QA gate decision rendered");
    assert(md.includes("❌ FAIL"), "QA FAIL badge");
    assert(md.includes("_No files were written this run._"), "no-files placeholder");
    // Cybersecurity DOES still run after QA fails (decision gate only blocks file-write,
    // not the audit) — so the report should render its section, not the placeholder.
    assert(md.includes("### Cybersecurity"), "cybersecurity section header present");
    assert(!md.includes("### Cybersecurity\n\n_Did not run._"), "cybersecurity should NOT be flagged as skipped");
  });
});

// ---------- 7. TaskRoutingRunner (CLI wrapper used by scripts/run-pipeline.ts --task) ----------

const { TaskRoutingRunner, reorderEMTasks } = await import("../lib/runtime/task-routing-runner.ts");
const { mkdir: mkdirP, writeFile: writeFileP } = await import("node:fs/promises");

await group("7. TaskRoutingRunner — pure composition wrapper", async () => {
  await test("reorderEMTasks: target found at non-zero index → moved to position 0, others preserved in order", () => {
    const em: EMOutput = clone(fixtures.em);
    const original = em.tasks.map((t) => t.id);
    const target = original[2];
    const out = reorderEMTasks(em, target);
    assert(out.tasks[0].id === target, `expected target at 0, got ${out.tasks[0].id}`);
    const expected = [target, ...original.filter((id) => id !== target)];
    const actual = out.tasks.map((t) => t.id);
    assert(JSON.stringify(actual) === JSON.stringify(expected), `order mismatch:\n  expected: ${expected}\n  actual:   ${actual}`);
    assert(out.features === em.features, "features array preserved by reference");
  });

  await test("reorderEMTasks: target already at index 0 → returns input unchanged (referentially)", () => {
    const em: EMOutput = clone(fixtures.em);
    const out = reorderEMTasks(em, em.tasks[0].id);
    assert(out === em, "expected same object reference for no-op reorder");
  });

  await test("reorderEMTasks: missing target id → throws with helpful list of available ids", () => {
    const em: EMOutput = clone(fixtures.em);
    let threw = false;
    try {
      reorderEMTasks(em, "t-does-not-exist");
    } catch (e) {
      threw = true;
      const msg = (e as Error).message;
      assert(/not found in Engineering-Manager output/.test(msg), `unexpected message: ${msg}`);
      assert(em.tasks.every((t) => msg.includes(t.id)), `expected all available ids in message; got: ${msg}`);
    }
    assert(threw, "expected reorderEMTasks to throw on missing id");
  });

  await test("reorderEMTasks: rejects malformed EM output", () => {
    let threw = false;
    try {
      reorderEMTasks({ no: "tasks" }, "t-x");
    } catch (e) {
      threw = true;
      assert(/not a valid EMOutput/.test((e as Error).message), `unexpected message: ${(e as Error).message}`);
    }
    assert(threw, "expected reorderEMTasks to throw on invalid shape");
  });

  await test("TaskRoutingRunner: routes EM through reorder, passes other agents straight to inner runner", async () => {
    const em = clone(fixtures.em);
    const inner: AgentRunner = {
      async run(inv: AgentInvocation): Promise<unknown> {
        if (inv.agentName === "engineering-manager") return em;
        if (inv.agentName === "ceo") return fixtures.ceo;
        return null;
      },
    };
    const target = em.tasks[em.tasks.length - 1].id;
    const wrapped = new TaskRoutingRunner({ inner, scenarioDir: "/dev/null", targetTaskId: target });

    const ceoOut = await wrapped.run({ agentName: "ceo", input: {} });
    assert(ceoOut === fixtures.ceo, "CEO passes through unchanged");

    const emOut = (await wrapped.run({ agentName: "engineering-manager", input: {} })) as EMOutput;
    assert(emOut.tasks[0].id === target, `expected target ${target} at 0, got ${emOut.tasks[0].id}`);
  });

  await test("TaskRoutingRunner: per-task fixture override is read for developer/qa/cybersecurity when present", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "ai-org-tro-"));
    try {
      const taskId = "t-test-override";
      const overrideDir = join(tmp, "tasks", taskId);
      await mkdirP(overrideDir, { recursive: true });
      const overrideDev = { taskId, implementationPlan: "OVERRIDE", files: [{ path: "x.ts", content: "// x" }], tests: [], notes: [] };
      await writeFileP(join(overrideDir, "developer.output.json"), JSON.stringify(overrideDev), "utf-8");

      let innerCalled = false;
      const inner: AgentRunner = {
        async run(inv: AgentInvocation): Promise<unknown> {
          innerCalled = true;
          if (inv.agentName === "developer") return fixtures.developer;
          if (inv.agentName === "qa") return fixtures.qa;
          return null;
        },
      };
      const wrapped = new TaskRoutingRunner({ inner, scenarioDir: tmp, targetTaskId: taskId });

      const dev = await wrapped.run({ agentName: "developer", input: {} });
      assert(JSON.stringify(dev) === JSON.stringify(overrideDev), "developer should be the override fixture");
      assert(!innerCalled, "inner.run should NOT have been called for developer when override exists");

      innerCalled = false;
      const qa = await wrapped.run({ agentName: "qa", input: {} });
      assert(qa === fixtures.qa, "qa with no override should fall through to inner");
      assert(innerCalled, "inner.run SHOULD have been called for qa");
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  await test("TaskRoutingRunner: empty/whitespace targetTaskId → constructor throws", () => {
    const inner: AgentRunner = { async run() { return null; } };
    let threwEmpty = false;
    let threwWs = false;
    try {
      new TaskRoutingRunner({ inner, scenarioDir: "/x", targetTaskId: "" });
    } catch {
      threwEmpty = true;
    }
    try {
      new TaskRoutingRunner({ inner, scenarioDir: "/x", targetTaskId: "   " });
    } catch {
      threwWs = true;
    }
    assert(threwEmpty, "empty string should throw");
    assert(threwWs, "whitespace-only should throw");
  });
});

// ---------- 8. verify-helpers (pure helpers used by scripts/verify-generated.ts) ----------

const {
  parseDeveloperOutputFromReport,
  upsertVerificationSection,
  formatVerificationMarkdown,
} = await import("../lib/runtime/verify-helpers.ts");

await group("8. verify-helpers — REPORT.md round-trip + section upsert", async () => {
  const fixedNow = new Date("2026-05-02T16:15:23.456Z");

  await test("parseDeveloperOutputFromReport: round-trips the embedded JSON for the live SaaS report", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "ai-org-verify-helpers-"));
    try {
      const r = await runPipeline("Build a simple SaaS landing page with signup", {
        agentRunner: new FixtureAgentRunner(scenarioDir),
        generatedDir: tmp,
        logger: noopLogger(),
      });
      assert(r.decision === "WROTE_FILES", `precondition: WROTE_FILES; got ${r.decision}`);
      const md = formatReportMarkdown(r, { now: fixedNow });
      const parsed = parseDeveloperOutputFromReport(md, r.outputs.developer!.taskId);
      assert(parsed.taskId === r.outputs.developer!.taskId, "taskId round-trips");
      assert(parsed.files.length === r.outputs.developer!.files.length, "file count round-trips");
      assert(parsed.tests.length === r.outputs.developer!.tests.length, "test count round-trips");
      assert(parsed.files[0].content === r.outputs.developer!.files[0].content, "file contents round-trip byte-for-byte");
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  await test("parseDeveloperOutputFromReport: throws clearly when section is missing", () => {
    let threw = false;
    try {
      parseDeveloperOutputFromReport("# Pipeline run report\n\n## Steps\n\n_(none)_\n", "t-x");
    } catch (e) {
      threw = true;
      assert(/does not contain a Developer section/.test((e as Error).message), `unexpected error message: ${(e as Error).message}`);
    }
    assert(threw, "expected parseDeveloperOutputFromReport to throw");
  });

  await test("parseDeveloperOutputFromReport: throws clearly when taskId mismatches", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "ai-org-verify-helpers-"));
    try {
      const r = await runPipeline("test", {
        agentRunner: new FixtureAgentRunner(scenarioDir),
        generatedDir: tmp,
        logger: noopLogger(),
      });
      const md = formatReportMarkdown(r, { now: fixedNow });
      let threw = false;
      try {
        parseDeveloperOutputFromReport(md, "t-totally-wrong-id");
      } catch (e) {
        threw = true;
        assert(/does not contain a Developer section.*t-totally-wrong-id/.test((e as Error).message), `unexpected error: ${(e as Error).message}`);
      }
      assert(threw, "expected mismatch to throw");
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  await test("upsertVerificationSection: inserts before footer on first call", () => {
    const md = `# Pipeline run report\n\n## Steps\n\nbody\n\n---\n\n_footer_\n`;
    const out = upsertVerificationSection(md, "## Verification\n\nshiny\n");
    assert(out.includes("## Verification\n\nshiny"), "section inserted");
    assert(out.indexOf("## Verification") < out.indexOf("---"), "section is before the footer rule");
    assert(out.endsWith("_footer_\n"), "footer is preserved at the end");
  });

  await test("upsertVerificationSection: replaces an existing Verification section idempotently", () => {
    const md = `# Header\n\n## Verification\n\nold body\n\n---\n\n_footer_\n`;
    const updated = upsertVerificationSection(md, "## Verification\n\nnew body\n");
    assert(updated.includes("new body"), "new content present");
    assert(!updated.includes("old body"), "old content removed");
    const updated2 = upsertVerificationSection(updated, "## Verification\n\nnew body\n");
    assert(updated2 === updated, "second upsert with same body is a no-op");
  });

  await test("upsertVerificationSection: appends when no footer exists", () => {
    const md = `# Header\n\nbody\n`;
    const out = upsertVerificationSection(md, "## Verification\n\nx\n");
    assert(out.endsWith("## Verification\n\nx\n"), `should end with the section, got: ${JSON.stringify(out.slice(-80))}`);
  });

  await test("formatVerificationMarkdown: pass case renders header + steps table + sandbox path", () => {
    const md = formatVerificationMarkdown({
      taskId: "t-x",
      sandboxPath: "/cache/abc",
      cached: true,
      typecheck: { name: "tsc --noEmit", status: "pass", durationMs: 1200, details: "2 files compile" },
      tests: { name: "vitest run", status: "pass", durationMs: 800, details: "1 test executed" },
      startedAt: new Date("2026-05-02T16:15:00.000Z"),
      finishedAt: new Date("2026-05-02T16:15:02.000Z"),
    });
    assert(md.startsWith("## Verification"), "section header");
    assert(md.includes("**Overall:** ✅ pass"), "overall pass badge");
    assert(md.includes("`/cache/abc`"), "sandbox path rendered");
    assert(md.includes("cache hit, deps reused"), "cache hit annotation");
    assert(md.includes("✅ pass"), "step badges");
    assert(md.includes("| tsc --noEmit | ✅ pass | 1200 ms | 2 files compile |"), "typecheck row");
    assert(md.includes("| vitest run | ✅ pass | 800 ms | 1 test executed |"), "tests row");
  });

  await test("formatVerificationMarkdown: fail case marks overall as fail and embeds captured output", () => {
    const md = formatVerificationMarkdown({
      taskId: "t-x",
      sandboxPath: "/cache/abc",
      cached: false,
      typecheck: { name: "tsc --noEmit", status: "fail", durationMs: 50, details: "tsc exited 2", output: "error TS2307: cannot find module" },
      tests: { name: "vitest run", status: "skipped", durationMs: 0, details: "skipped because typecheck failed" },
      startedAt: new Date("2026-05-02T16:15:00.000Z"),
      finishedAt: new Date("2026-05-02T16:15:02.000Z"),
    });
    assert(md.includes("**Overall:** ❌ fail"), "overall fail badge");
    assert(md.includes("fresh install"), "fresh-install annotation");
    assert(md.includes("⚪ skipped"), "skipped badge for tests");
    assert(md.includes("error TS2307"), "captured tsc output embedded in details block");
    assert(md.includes("captured output"), "details summary present");
  });
});

// ---------- 9. report-pdf formatter (REPORT.pdf produced by run-pipeline) ----------

const { formatReportPdf, pdfSafe } = await import("../lib/runtime/report-pdf.ts");
// Modern pdf-parse exposes a class. We deliberately use a relaxed shape since
// we only care about the extracted text body and a coarse page count for our
// test assertions.
const { PDFParse } = await import("pdf-parse");

async function extractPdfText(buf: Buffer): Promise<{ text: string; pageCount: number }> {
  const parser = new PDFParse({ data: buf });
  const result = await parser.getText();
  // pdf-parse's `pages` is an array of per-page results; `total` is the
  // declared page count. Use whichever is available.
  const r = result as unknown as { text: string; total?: number; pages?: unknown[] };
  const pageCount = typeof r.total === "number" ? r.total : Array.isArray(r.pages) ? r.pages.length : 0;
  return { text: r.text, pageCount };
}

await group("9. report-pdf formatter — PDF shape + glyph fidelity", async () => {
  const fixedNow = new Date("2026-05-02T17:00:00.000Z");

  await test("WROTE_FILES PDF: valid magic bytes + EOF + reasonable size + cover content", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "ai-org-pdf-"));
    try {
      const r = await runPipeline("Build a SaaS landing page with signup", {
        agentRunner: new FixtureAgentRunner(scenarioDir),
        generatedDir: tmp,
        logger: noopLogger(),
      });
      assert(r.decision === "WROTE_FILES", `precondition: WROTE_FILES; got ${r.decision}`);

      const buf = await formatReportPdf(r, { now: fixedNow, compress: false });
      assert(buf.length > 5000, `expected >5KB PDF, got ${buf.length} bytes`);
      assert(buf.length < 5_000_000, `expected <5MB PDF, got ${buf.length} bytes`);
      assert(buf.subarray(0, 5).toString("ascii") === "%PDF-", "must start with %PDF- magic bytes");
      assert(buf.subarray(-6).toString("ascii").includes("%%EOF"), "must end with %%EOF marker");

      const { text, pageCount } = await extractPdfText(buf);
      assert(pageCount >= 7, `expected at least 7 pages (cover + summary + 6 agents); got ${pageCount}`);
      assert(text.includes("Pipeline Run Report"), "cover title present");
      assert(text.includes("Build a SaaS landing page with signup"), "idea on cover");
      assert(text.includes("Decision: WROTE_FILES"), "decision badge text on cover");
      assert(text.includes("2026-05-02T17:00:00.000Z"), "injected timestamp on cover");
      // Per-agent pages should each have their title.
      for (const role of ["CEO", "CTO", "Engineering Manager", "Developer", "QA", "Cybersecurity"]) {
        assert(text.includes(role), `missing per-agent page header: ${role}`);
      }
      // Files-written table content lands in the PDF.
      assert(/lib\/db\/schema\/.+\.ts/.test(text), "files written table includes generated path");
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  await test("validation-blocked PDF: skipped agents render 'Did not run.', no files-written rows", async () => {
    const brokenEM = clone(fixtures.em);
    brokenEM.tasks[0].featureId = "f-does-not-exist";
    const r = await runWithMockRunner({ em: brokenEM });
    assert(r.decision === "VALIDATION_FAILED", `precondition: VALIDATION_FAILED; got ${r.decision}`);

    const buf = await formatReportPdf(r, { now: fixedNow, compress: false });
    const { text } = await extractPdfText(buf);
    assert(text.includes("Decision: VALIDATION_FAILED"), "blocked decision rendered on cover");
    assert(text.includes("No files were written this run."), "no-files placeholder present");
    assert(text.includes("Did not run."), "agents that did not execute show placeholder");
    // CEO/CTO/EM ran (the EM failed validation but its output still rendered).
    // Developer/QA/Security did not.
    assert(text.includes("Developer"), "Developer page header still present (with placeholder body)");
  });

  await test("PDF determinism: same input + injected clock => byte-identical buffers", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "ai-org-pdf-det-"));
    try {
      const r = await runPipeline("Determinism check", {
        agentRunner: new FixtureAgentRunner(scenarioDir),
        generatedDir: tmp,
        logger: noopLogger(),
      });
      const a = await formatReportPdf(r, { now: fixedNow, compress: false });
      const b = await formatReportPdf(r, { now: fixedNow, compress: false });
      assert(a.equals(b), `expected byte-identical PDFs; sizes: ${a.length} vs ${b.length}`);
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  await test("pdfSafe: transliterates non-WinAnsi Unicode (arrows, ellipsis, emoji) to ASCII fallbacks", () => {
    assert(pdfSafe("a → b") === "a -> b", "rightwards arrow");
    assert(pdfSafe("a ← b") === "a <- b", "leftwards arrow");
    assert(pdfSafe("a ⇒ b") === "a => b", "rightwards double arrow");
    assert(pdfSafe("done…") === "done...", "horizontal ellipsis");
    assert(pdfSafe("✅ shipped") === "[OK] shipped", "white-heavy check (emoji)");
    assert(pdfSafe("❌ blocked") === "[X] blocked", "cross mark");
    assert(pdfSafe("⚠ careful") === "[!] careful", "warning sign");
    assert(pdfSafe("🟥 critical") === "[critical] critical", "red square emoji (surrogate pair)");
    assert(pdfSafe("🟧 high") === "[high] high", "orange square emoji");
    assert(pdfSafe("🟡 medium") === "[medium] medium", "yellow circle emoji");
    assert(pdfSafe("🟢 low") === "[low] low", "green circle emoji");
  });

  await test("pdfSafe: keeps WinAnsi CP1252 chars intact (em-dash, middle dot, bullet, smart quotes, euro)", () => {
    assert(pdfSafe("a — b") === "a — b", "em-dash preserved");
    assert(pdfSafe("a · b") === "a · b", "middle dot preserved");
    assert(pdfSafe("• item") === "• item", "bullet preserved");
    assert(pdfSafe("\u201Chi\u201D") === "\u201Chi\u201D", "smart double quotes preserved");
    assert(pdfSafe("\u2018hi\u2019") === "\u2018hi\u2019", "smart single quotes preserved");
    assert(pdfSafe("€10") === "€10", "euro sign preserved");
    assert(pdfSafe("café") === "café", "Latin-1 accented char preserved");
  });

  await test("pdfSafe: replaces unsupported BMP code points with '?' (no glyph corruption)", () => {
    // U+05D0 (Hebrew alef) is well outside CP1252 and we don't transliterate it.
    assert(pdfSafe("\u05D0") === "?", "unsupported BMP char becomes '?'");
    assert(pdfSafe("hello \u05D0 world") === "hello ? world", "spliced into sentence");
  });

  await test("pdfSafe: handles null/undefined/empty without throwing", () => {
    assert(pdfSafe(null) === "", "null → empty");
    assert(pdfSafe(undefined) === "", "undefined → empty");
    assert(pdfSafe("") === "", "empty → empty");
  });

  await test("agent-supplied non-WinAnsi text in OKRs renders as ASCII fallback in the PDF", async () => {
    // saas-landing-page CEO output contains 'visitor → signup conversion' in
    // an OKR. Verify it lands in the PDF as the ASCII transliteration, not as
    // a corrupted glyph.
    const saasScenario = resolve(repoRoot, "fixtures", "scenarios", "saas-landing-page");
    const tmp = await mkdtemp(join(tmpdir(), "ai-org-pdf-saas-"));
    try {
      const r = await runPipeline("Build a SaaS landing page with signup", {
        agentRunner: new FixtureAgentRunner(saasScenario),
        generatedDir: tmp,
        logger: noopLogger(),
      });
      assert(r.decision === "WROTE_FILES", `precondition: WROTE_FILES; got ${r.decision}`);
      const buf = await formatReportPdf(r, { now: fixedNow, compress: false });
      const { text } = await extractPdfText(buf);
      assert(text.includes("visitor -> signup"), "Unicode → was transliterated to -> in OKR");
      // PDFKit's WinAnsi fallback char for missing glyphs renders as `!\u2019`
      // when we extract text. With pdfSafe, none should appear from the agent
      // chain (the only legitimate '?' would be from JS optional-chaining in
      // developer test code, which is fine).
      assert(!text.includes("!\u2019"), "no broken-glyph artifacts in extracted text");
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });
});

// ---------- 10. project-report-pdf formatter (consolidated multi-task PDF) ----------

const { formatProjectReportPdf } = await import("../lib/runtime/project-report-pdf.ts");

await group("10. project-report-pdf formatter — consolidated multi-task PDF", async () => {
  const fixedNow = new Date("2026-05-02T17:00:00.000Z");

  // Build two distinct PipelineResults from the same fixtures so we can prove
  // every per-task table row renders.
  async function buildRuns(): Promise<PipelineResult[]> {
    const tmp1 = await mkdtemp(join(tmpdir(), "ai-org-proj-pdf-1-"));
    const tmp2 = await mkdtemp(join(tmpdir(), "ai-org-proj-pdf-2-"));
    try {
      const a = await runPipeline("First task", {
        agentRunner: new FixtureAgentRunner(scenarioDir),
        generatedDir: tmp1,
        logger: noopLogger(),
      });
      const b = await runPipeline("Second task", {
        agentRunner: new FixtureAgentRunner(scenarioDir),
        generatedDir: tmp2,
        logger: noopLogger(),
      });
      assert(a.decision === "WROTE_FILES", `precondition: WROTE_FILES; got ${a.decision}`);
      assert(b.decision === "WROTE_FILES", `precondition: WROTE_FILES; got ${b.decision}`);
      // Reassign run[1] to the SECOND real EM task so the appendix
      // (which iterates EM features → tasks) can find both runs and the test
      // can verify two distinct rows.
      const em = a.outputs.em;
      if (em && em.tasks.length >= 2 && b.selectedTask) {
        b.selectedTask = { ...em.tasks[1] };
      }
      return [a, b];
    } finally {
      await rm(tmp1, { recursive: true, force: true });
      await rm(tmp2, { recursive: true, force: true });
    }
  }

  function makeAssembled(runs: PipelineResult[]): Array<{
    path: string;
    bytes: number;
    lines: number;
    sourceTaskId: string;
  }> {
    return runs.flatMap((r) =>
      r.filesWritten.map((f) => ({
        path: f.declaredPath,
        bytes: f.bytes,
        lines: 10,
        sourceTaskId: r.selectedTask?.id ?? "(none)",
      })),
    );
  }

  await test("PDF shape: magic bytes + EOF + size + every section heading + friendly task labels", async () => {
    const runs = await buildRuns();
    const buf = await formatProjectReportPdf(
      {
        projectName: "Pharmacy B2B",
        idea: "Build me a B2B application for Pharmacy.",
        runs,
        assembledFiles: makeAssembled(runs),
        outputDir: "examples/pharmacy-b2b",
        howToRun: ["cd examples/pharmacy-b2b", "npm install", "npm run dev"],
        userJourney: ["Open http://localhost:3000", "Sign in", "Place an order"],
        credentials: [
          { label: "URL", value: "http://localhost:3000" },
          { label: "Retail license", value: "MH-RP-2024-7821" },
        ],
        taskLabels: {
          "t-waitlist-storage-1": "Friendly label for first step",
          "t-waitlist-storage-2": "Friendly label for second step",
        },
      },
      { now: fixedNow, compress: false },
    );
    assert(buf.length > 5000, `expected >5KB PDF, got ${buf.length}`);
    assert(buf.length < 5_000_000, `expected <5MB PDF, got ${buf.length}`);
    assert(buf.subarray(0, 5).toString("ascii") === "%PDF-", "must start with %PDF-");
    assert(buf.subarray(-6).toString("ascii").includes("%%EOF"), "must end with %%EOF");

    const { text } = await extractPdfText(buf);
    assert(text.includes("Pharmacy B2B"), "project name on cover");
    assert(text.includes("Build me a B2B application for Pharmacy."), "idea on cover");
    assert(text.includes("YOUR AI ORGANISATION SHIPPED"), "cover tagline");
    assert(text.includes("FILES GENERATED"), "files KPI card label");
    assert(text.includes("LINES OF CODE"), "lines KPI card label");
    assert(text.includes("TASKS SUCCEEDED"), "tasks KPI card label");
    assert(text.includes("CRITICAL ISSUES"), "issues KPI card label");
    assert(text.includes("What you built"), "features section heading");
    assert(text.includes("Try it right now"), "user journey section heading");
    assert(text.includes("Open http://localhost:3000"), "first user-journey step");
    assert(text.includes("Sign in"), "second user-journey step");
    assert(text.includes("MH-RP-2024-7821"), "credential value rendered");
    assert(text.includes("Build metrics"), "metrics section heading");
    assert(text.includes("Code per feature"), "feature bar-chart heading");
    assert(text.includes("File-type mix"), "file-type donut heading");
    assert(text.includes("Quality scorecard"), "quality section heading");
    assert(text.includes("Per-feature delivery"), "per-feature delivery heading");
    assert(text.includes("Security audit findings"), "security section");
    assert(text.includes("How to run"), "how to run section heading");
    assert(text.includes("npm install"), "code block contents");
    assert(text.includes("what shipped, by feature"), "appendix friendly heading");
    assert(text.includes("Friendly label for first step"), "taskLabels override appears (run 1)");
    assert(text.includes("Friendly label for second step"), "taskLabels override appears (run 2)");
    // After the redesign, raw task ids should NEVER appear in the appendix
    // when taskLabels are supplied for them.
    assert(!text.includes("t-waitlist-storage-1"), "raw task id 1 should NOT appear when a taskLabel is provided");
    assert(!text.includes("t-waitlist-storage-2"), "raw task id 2 should NOT appear when a taskLabel is provided");
  });

  await test("no blank pages: page count equals exactly 7 sections (footer-overflow fix)", async () => {
    const runs = await buildRuns();
    const buf = await formatProjectReportPdf(
      {
        projectName: "Page Count Test",
        idea: "Verify the footer page-margin fix",
        runs,
        assembledFiles: makeAssembled(runs),
        outputDir: "examples/test",
        howToRun: ["npm install", "npm run dev"],
      },
      { now: fixedNow, compress: false },
    );
    const { pageCount } = await extractPdfText(buf);
    assert(pageCount === 7, `expected exactly 7 pages (cover + 6 sections); got ${pageCount}`);
  });

  await test("mixed decisions: appendix marks blocked task as blocked + headline banner reflects it", async () => {
    const runs = await buildRuns();
    runs[1].decision = "GATE_BLOCKED_QA";
    if (runs[1].outputs.qa) runs[1].outputs.qa = { ...runs[1].outputs.qa, decision: "FAIL" };
    runs[1].filesWritten = [];

    const buf = await formatProjectReportPdf(
      {
        projectName: "Mixed Outcomes Project",
        idea: "Test mixed decisions",
        runs,
        assembledFiles: makeAssembled(runs),
        outputDir: "examples/mixed",
        howToRun: ["echo hello"],
        taskLabels: {
          "t-waitlist-storage-1": "Step that shipped",
          "t-waitlist-storage-2": "Step that got blocked",
        },
      },
      { now: fixedNow, compress: false },
    );
    const { text } = await extractPdfText(buf);
    assert(text.includes("blocked"), "blocked task rendered in appendix row");
    assert(text.includes("Step that got blocked"), "blocked task appears with friendly label");
    assert(/1\s*of\s*2\s*task/i.test(text) || /1\s*\/\s*2/.test(text), "headline / KPI reflects 1 of 2 success");
  });

  await test("determinism: same input + injected clock => byte-identical buffers", async () => {
    const runs = await buildRuns();
    const input = {
      projectName: "Determinism Project",
      idea: "Same input every time",
      runs,
      assembledFiles: makeAssembled(runs),
      outputDir: "examples/determinism",
      howToRun: ["npm install", "npm run dev"],
    };
    const a = await formatProjectReportPdf(input, { now: fixedNow, compress: false });
    const b = await formatProjectReportPdf(input, { now: fixedNow, compress: false });
    assert(a.equals(b), `expected byte-identical PDFs; sizes: ${a.length} vs ${b.length}`);
  });

  await test("non-WinAnsi glyphs (arrows, ellipsis) survive via pdfSafe", async () => {
    const runs = await buildRuns();
    const buf = await formatProjectReportPdf(
      {
        projectName: "Unicode Test",
        idea: "convert visitor → signup conversion … done",
        runs,
        assembledFiles: [],
        outputDir: "examples/unicode",
        howToRun: ["echo a → b"],
      },
      { now: fixedNow, compress: false },
    );
    const { text } = await extractPdfText(buf);
    assert(text.includes("visitor -> signup"), "rightwards arrow in idea was transliterated");
    assert(text.includes("conversion ..."), "ellipsis in idea was transliterated");
    assert(text.includes("a -> b"), "rightwards arrow in how-to-run was transliterated");
    assert(!text.includes("!\u2019"), "no broken-glyph artifacts");
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
