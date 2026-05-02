// scripts/test-llm-runner.ts
//
// Step 9 verification — covers the four stages requested:
//   1. prompt construction      (agent-loader + task-body)
//   2. model routing            (LLMClient.supportsModel + LLMAgentRunner.pickClient)
//   3. JSON parsing             (LLMAgentRunner.parseAndValidateOutput)
//   4. validation pipeline      (json-schema validator against agent outputContract.schema)
//
// Plus an end-to-end run of runPipeline using LLMAgentRunner backed by
// MockLLMClient, which proves the new runner is a drop-in replacement for
// FixtureAgentRunner without modifying the pipeline.
//
// Pure Node, no external deps. Run with:
//   node scripts/test-llm-runner.ts

import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadAgentDefinition } from "../lib/runtime/agent-loader.ts";
import {
  LLMAgentError,
  LLMAgentRunner,
  type LLMCallEvent,
} from "../lib/runtime/agent-runner.ts";
import { validateAgainstSchema } from "../lib/runtime/json-schema.ts";
import { MockLLMClient, type LLMCallOptions } from "../lib/runtime/llm-client.ts";
import { runPipeline } from "../lib/runtime/pipeline.ts";
import { buildTaskBody, markerToInputKey } from "../lib/runtime/task-body.ts";
import type {
  AgentName,
  CEOOutput,
  CTOOutput,
  CompanyContext,
  DeveloperOutput,
  EMOutput,
  QAOutput,
  SecurityOutput,
} from "../lib/runtime/types.ts";

// ---------- tiny test harness (mirrors scripts/test-runtime.ts) ----------

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), "../..");
const SCENARIO = resolve(REPO_ROOT, "fixtures/scenarios/waitlist-mvp");

type TestFn = () => void | Promise<void>;
interface TestRecord { name: string; pass: boolean; error?: string }

const records: TestRecord[] = [];
let currentGroup = "";

const c = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
};

async function group(name: string, body: () => Promise<void> | void): Promise<void> {
  currentGroup = name;
  console.log(`\n${c.bold(c.cyan(name))}`);
  await body();
  currentGroup = "";
}

async function test(name: string, fn: TestFn): Promise<void> {
  const fullName = currentGroup ? `${currentGroup} > ${name}` : name;
  try {
    await fn();
    records.push({ name: fullName, pass: true });
    console.log(`  ${c.green("✓")} ${name}`);
  } catch (e) {
    records.push({ name: fullName, pass: false, error: (e as Error).message });
    console.log(`  ${c.red("✗")} ${name}`);
    for (const line of String((e as Error).message).split("\n")) {
      console.log(`      ${c.red(line)}`);
    }
  }
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`assertion failed: ${msg}`);
}

function assertEq<T>(actual: T, expected: T, msg: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg}\n  expected: ${e}\n  actual:   ${a}`);
}

async function expectThrows(
  fn: () => unknown | Promise<unknown>,
  matcher: (e: Error) => boolean,
  msg: string,
): Promise<Error> {
  let err: Error | null = null;
  try {
    await fn();
  } catch (e) {
    err = e as Error;
  }
  if (!err) throw new Error(`${msg}: expected throw, got success`);
  if (!matcher(err)) throw new Error(`${msg}: error did not match\n  got: ${err.message}`);
  return err;
}

// ---------- shared fixtures ----------

interface ScenarioFixtures {
  idea: string;
  ctx: CompanyContext;
  ceo: CEOOutput;
  cto: CTOOutput;
  em: EMOutput;
  developer: DeveloperOutput;
  qa: QAOutput;
  security: SecurityOutput;
}

async function loadFixtures(): Promise<ScenarioFixtures> {
  const read = async <T>(name: string) =>
    JSON.parse(await readFile(resolve(SCENARIO, `${name}.output.json`), "utf-8")) as T;
  const idea = (await readFile(resolve(SCENARIO, "idea.txt"), "utf-8")).trim();
  return {
    idea,
    ctx: { phase: "validate", cycle: 1, priorCycle: null },
    ceo: await read<CEOOutput>("ceo"),
    cto: await read<CTOOutput>("cto"),
    em: await read<EMOutput>("engineering-manager"),
    developer: await read<DeveloperOutput>("developer"),
    qa: await read<QAOutput>("qa"),
    security: await read<SecurityOutput>("cybersecurity"),
  };
}

const fixtures = await loadFixtures();

/**
 * Build a MockLLMClient pre-loaded with one canned response per agent.
 * Each response is the corresponding fixture JSON, returned verbatim. This
 * lets every agent's outputContract.schema accept the response.
 */
function fixtureMock(): MockLLMClient {
  const mock = new MockLLMClient();
  // CEO — claude-opus-4-7-thinking-xhigh
  mock.set("claude-opus-4-7-thinking-xhigh", JSON.stringify(fixtures.ceo));
  // CTO and Cybersecurity also use claude-opus-4-7-thinking-xhigh — but the mock keys
  // by model only, so we have to choose one fixture per model. Replace dynamically:
  mock.set("claude-opus-4-7-thinking-xhigh", (opts) => responderFromAgentMarker(opts, fixtures));
  // EM — claude-opus-4-7-high
  mock.set("claude-opus-4-7-high", JSON.stringify(fixtures.em));
  // Developer — claude-opus-4-6
  mock.set("claude-opus-4-6", JSON.stringify(fixtures.developer));
  // QA — gpt-5.5-medium
  mock.set("gpt-5.5-medium", JSON.stringify(fixtures.qa));
  // Developer fallback — gpt-5.3-codex (defined in developer config? — keep ready)
  mock.set("gpt-5.3-codex", JSON.stringify(fixtures.developer));
  return mock;
}

/**
 * The CEO/CTO/Cybersecurity all share one model name. We disambiguate by
 * inspecting the user message for the agent's signature markers. This is
 * the simplest way to multiplex one mock model across multiple agents.
 */
function responderFromAgentMarker(opts: LLMCallOptions, f: ScenarioFixtures): string {
  // Cybersecurity's user message contains "=== QA Output ==="
  if (opts.userMessage.includes("=== QA Output ===")) {
    return JSON.stringify(f.security);
  }
  // CTO's user message contains "=== CEO Output ===" but NOT "=== CTO Output ==="
  if (opts.userMessage.includes("=== CEO Output ===") && !opts.userMessage.includes("=== CTO Output ===")) {
    return JSON.stringify(f.cto);
  }
  // CEO's user message uses templated format ("Current phase:")
  if (opts.userMessage.startsWith("Current phase:")) {
    return JSON.stringify(f.ceo);
  }
  throw new Error(`mock: cannot disambiguate caller from model=${opts.model}`);
}

console.log(c.bold("\nTesting Step 9 — LLM integration"));

// ============================================================
// 1. Prompt construction (agent-loader + task-body)
// ============================================================

await group("agent-loader", async () => {
  await test("loads CEO config + prompt.md + SKILLS.md", async () => {
    const def = await loadAgentDefinition(REPO_ROOT, "ceo");
    assertEq(def.config.role, "ceo", "config.role mismatch");
    assertEq(def.config.adapterConfig.model, "claude-opus-4-7-thinking-xhigh", "CEO model mismatch");
    assert(def.entryPrompt.length > 100, "entryPrompt should be non-trivial");
    assert(def.skills.length > 100, "skills should be non-trivial");
  });

  await test("loads CTO config with inputContract sections", async () => {
    const def = await loadAgentDefinition(REPO_ROOT, "cto");
    assertEq(def.config.inputContract?.format, "structured-task-body", "CTO format");
    assert((def.config.inputContract?.sections.length ?? 0) >= 2, "CTO sections >= 2");
  });

  await test("throws on unknown agent", async () => {
    await expectThrows(
      () => loadAgentDefinition(REPO_ROOT, "doesnotexist" as AgentName),
      (e) => /cannot read/.test(e.message),
      "unknown agent should throw",
    );
  });
});

await group("markerToInputKey", async () => {
  await test("=== CEO Output === → ceoOutput", () => {
    assertEq(markerToInputKey("=== CEO Output ==="), "ceoOutput", "CEO Output marker");
  });
  await test("=== Engineering Manager Output === → engineeringManagerOutput", () => {
    assertEq(
      markerToInputKey("=== Engineering Manager Output ==="),
      "engineeringManagerOutput",
      "EM Output marker",
    );
  });
  await test("=== Definition of Done === → definitionOfDone", () => {
    assertEq(markerToInputKey("=== Definition of Done ==="), "definitionOfDone", "DoD marker");
  });
  await test("=== Changed Surfaces === → changedSurfaces", () => {
    assertEq(markerToInputKey("=== Changed Surfaces ==="), "changedSurfaces", "changedSurfaces marker");
  });
  await test("=== Task === → task", () => {
    assertEq(markerToInputKey("=== Task ==="), "task", "Task marker");
  });
});

await group("buildTaskBody (CTO)", async () => {
  await test("renders sections with markers + JSON, separated by blank lines", async () => {
    const def = await loadAgentDefinition(REPO_ROOT, "cto");
    const body = buildTaskBody(def, { ceoOutput: fixtures.ceo, companyContext: fixtures.ctx });
    const sections = body.split("\n\n");
    assertEq(sections.length, 2, "CTO body should have 2 sections");
    assert(sections[0].startsWith("=== CEO Output ==="), "first section marker");
    assert(sections[1].startsWith("=== Company Context ==="), "second section marker");
    const ceoJSON = JSON.parse(sections[0].split("\n").slice(1).join("\n")) as CEOOutput;
    assertEq(ceoJSON.mission, fixtures.ceo.mission, "CEO mission round-trips");
  });

  await test("throws on missing required input key", async () => {
    const def = await loadAgentDefinition(REPO_ROOT, "cto");
    await expectThrows(
      async () => buildTaskBody(def, { companyContext: fixtures.ctx }),
      (e) => /missing required input key "ceoOutput"/.test(e.message),
      "missing ceoOutput should throw",
    );
  });

  await test("skips optional sections when not provided (EM ceoOutput is optional)", async () => {
    const def = await loadAgentDefinition(REPO_ROOT, "engineering-manager");
    const body = buildTaskBody(def, { ctoOutput: fixtures.cto, companyContext: fixtures.ctx });
    assertEq(body.split("\n\n").length, 2, "EM body without ceoOutput has 2 sections");
    const bodyWithCeo = buildTaskBody(def, {
      ctoOutput: fixtures.cto,
      ceoOutput: fixtures.ceo,
      companyContext: fixtures.ctx,
    });
    assertEq(bodyWithCeo.split("\n\n").length, 3, "EM body with ceoOutput has 3 sections");
  });
});

await group("buildTaskBody (CEO)", async () => {
  await test("uses templated format (Current phase / Client goal / Company context)", async () => {
    const def = await loadAgentDefinition(REPO_ROOT, "ceo");
    const body = buildTaskBody(def, { idea: fixtures.idea, companyContext: fixtures.ctx });
    assert(body.startsWith("Current phase:"), "CEO body starts with Current phase:");
    assert(body.includes("Client goal:"), "includes Client goal:");
    assert(body.includes("Company context:"), "includes Company context:");
    assert(body.includes(fixtures.idea), "includes the idea verbatim");
  });
});

// ============================================================
// 2. JSON schema validation pipeline
// ============================================================

await group("validateAgainstSchema", async () => {
  await test("accepts valid CEO output fixture", async () => {
    const def = await loadAgentDefinition(REPO_ROOT, "ceo");
    const result = validateAgainstSchema(fixtures.ceo, def.config.outputContract.schema);
    assertEq(result.valid, true, "CEO fixture is valid");
    assertEq(result.errors.length, 0, "no errors");
  });

  await test("rejects missing required field", async () => {
    const def = await loadAgentDefinition(REPO_ROOT, "ceo");
    const broken = { ...fixtures.ceo } as Record<string, unknown>;
    delete broken.mission;
    const result = validateAgainstSchema(broken, def.config.outputContract.schema);
    assertEq(result.valid, false, "missing mission should fail");
    assert(
      result.errors.some((e) => /required field "mission" is missing/.test(e.message)),
      "error mentions mission",
    );
  });

  await test("rejects unexpected additional property", async () => {
    const def = await loadAgentDefinition(REPO_ROOT, "ceo");
    const extra = { ...fixtures.ceo, surprise: "boom" };
    const result = validateAgainstSchema(extra, def.config.outputContract.schema);
    assertEq(result.valid, false, "additional prop should fail");
    assert(
      result.errors.some((e) => /unexpected additional property "surprise"/.test(e.message)),
      "error mentions surprise",
    );
  });

  await test("rejects out-of-range estimatedHours in EM tasks", async () => {
    const def = await loadAgentDefinition(REPO_ROOT, "engineering-manager");
    const bad: EMOutput = {
      features: fixtures.em.features,
      tasks: fixtures.em.tasks.map((t, i) => (i === 0 ? { ...t, estimatedHours: 99 } : t)),
    };
    const result = validateAgainstSchema(bad, def.config.outputContract.schema);
    assertEq(result.valid, false, "99 hours should fail");
    assert(
      result.errors.some((e) => /99 > maximum 4/.test(e.message)),
      "error mentions maximum",
    );
  });

  await test("rejects bad enum value for QA decision", async () => {
    const def = await loadAgentDefinition(REPO_ROOT, "qa");
    const bad = { ...fixtures.qa, decision: "MAYBE" };
    const result = validateAgainstSchema(bad, def.config.outputContract.schema);
    assertEq(result.valid, false, "MAYBE should fail enum");
    assert(
      result.errors.some((e) => /not in enum/.test(e.message)),
      "error mentions enum",
    );
  });
});

// ============================================================
// 3. MockLLMClient
// ============================================================

await group("MockLLMClient", async () => {
  await test("supportsModel returns true for registered, false for others", () => {
    const m = new MockLLMClient({ "claude-x": "hello" });
    assertEq(m.supportsModel("claude-x"), true, "registered model");
    assertEq(m.supportsModel("gpt-y"), false, "unregistered model");
  });

  await test("call returns canned response and records the call", async () => {
    const m = new MockLLMClient({ "claude-x": "the response" });
    const out = await m.call({ model: "claude-x", systemPrompt: "S", userMessage: "U" });
    assertEq(out, "the response", "returns canned response");
    assertEq(m.calls.length, 1, "one call recorded");
    assertEq(m.calls[0].systemPrompt, "S", "system prompt recorded");
    assertEq(m.calls[0].userMessage, "U", "user message recorded");
  });

  await test("call throws on unregistered model", async () => {
    const m = new MockLLMClient();
    await expectThrows(
      () => m.call({ model: "missing", systemPrompt: "", userMessage: "" }),
      (e) => /no response configured/.test(e.message),
      "unregistered model should throw",
    );
  });

  await test("set() supports a single model name and an array of names", () => {
    const m = new MockLLMClient();
    m.set("a", "1");
    m.set(["b", "c"], "2");
    assertEq(m.supportsModel("a") && m.supportsModel("b") && m.supportsModel("c"), true, "all registered");
  });
});

// ============================================================
// 4. LLMAgentRunner — model routing + parse + validate + happy path
// ============================================================

await group("LLMAgentRunner — happy path", async () => {
  await test("CEO: model routed to mock, response parsed, schema validated", async () => {
    const mock = new MockLLMClient({
      "claude-opus-4-7-thinking-xhigh": JSON.stringify(fixtures.ceo),
    });
    const runner = new LLMAgentRunner({ repoRoot: REPO_ROOT, clients: [mock] });
    const out = (await runner.run({
      agentName: "ceo",
      input: { idea: fixtures.idea, companyContext: fixtures.ctx },
    })) as CEOOutput;
    assertEq(out.mission, fixtures.ceo.mission, "CEO mission round-trips");
    assertEq(mock.calls.length, 1, "exactly one model call");
    assert(mock.calls[0].systemPrompt.length > 200, "system prompt is non-trivial (prompt.md+SKILLS.md)");
    assert(mock.calls[0].userMessage.startsWith("Current phase:"), "CEO user message uses templated format");
    assertEq(mock.calls[0].thinking?.enabled, true, "CEO has thinking enabled (per config.json)");
    assertEq(mock.calls[0].thinking?.effort, "xhigh", "CEO effort=xhigh (per config.json)");
    assertEq(mock.calls[0].responseFormat, "json", "CEO responseFormat=json (per config.json)");
  });

  await test("CTO: structured-task-body in user message", async () => {
    const mock = new MockLLMClient({
      "claude-opus-4-7-thinking-xhigh": JSON.stringify(fixtures.cto),
    });
    const runner = new LLMAgentRunner({ repoRoot: REPO_ROOT, clients: [mock] });
    const out = (await runner.run({
      agentName: "cto",
      input: { ceoOutput: fixtures.ceo, companyContext: fixtures.ctx },
    })) as CTOOutput;
    assertEq(out.architecture.frontend, fixtures.cto.architecture.frontend, "frontend stack");
    assert(mock.calls[0].userMessage.includes("=== CEO Output ==="), "section marker present");
    assert(mock.calls[0].userMessage.includes("=== Company Context ==="), "context marker present");
  });

  await test("strips ```json ... ``` fences if model wraps the output", async () => {
    const wrapped = "```json\n" + JSON.stringify(fixtures.ceo, null, 2) + "\n```";
    const mock = new MockLLMClient({ "claude-opus-4-7-thinking-xhigh": wrapped });
    const runner = new LLMAgentRunner({ repoRoot: REPO_ROOT, clients: [mock] });
    const out = (await runner.run({
      agentName: "ceo",
      input: { idea: fixtures.idea, companyContext: fixtures.ctx },
    })) as CEOOutput;
    assertEq(out.mission, fixtures.ceo.mission, "fenced response parsed");
  });
});

await group("LLMAgentRunner — error paths (no silent fallback)", async () => {
  await test("invalid JSON throws LLMAgentError with raw response captured", async () => {
    const mock = new MockLLMClient({
      "claude-opus-4-7-thinking-xhigh": "not json {",
      "claude-opus-4-7-high": "still not json {",
    });
    const runner = new LLMAgentRunner({ repoRoot: REPO_ROOT, clients: [mock] });
    const err = await expectThrows(
      () =>
        runner.run({
          agentName: "ceo",
          input: { idea: fixtures.idea, companyContext: fixtures.ctx },
        }),
      (e) => e instanceof LLMAgentError && /all 2 model attempt\(s\) failed/.test(e.message),
      "should throw LLMAgentError",
    );
    const llmErr = err as LLMAgentError;
    assert(llmErr.causes.length === 2, "two causes (primary+fallback)");
    assert(llmErr.raw === "still not json {" || llmErr.raw === "not json {", "raw captured");
  });

  await test("valid JSON failing schema throws LLMAgentError with schemaErrors populated", async () => {
    const broken = JSON.stringify({ mission: "x" });
    const mock = new MockLLMClient({
      "claude-opus-4-7-thinking-xhigh": broken,
      "claude-opus-4-7-high": broken,
    });
    const runner = new LLMAgentRunner({ repoRoot: REPO_ROOT, clients: [mock] });
    const err = await expectThrows(
      () =>
        runner.run({
          agentName: "ceo",
          input: { idea: fixtures.idea, companyContext: fixtures.ctx },
        }),
      (e) => e instanceof LLMAgentError,
      "should throw LLMAgentError",
    );
    const llmErr = err as LLMAgentError;
    assert(llmErr.schemaErrors.length >= 3, "at least 3 schema errors (3 missing fields)");
    assert(
      llmErr.schemaErrors.some((se) => /okrs.*missing/.test(se.message)),
      "error mentions okrs",
    );
  });

  await test("primary fails, fallback succeeds → returns successfully", async () => {
    const mock = new MockLLMClient({
      "claude-opus-4-7-thinking-xhigh": "broken {",
      "claude-opus-4-7-high": JSON.stringify(fixtures.ceo),
    });
    const runner = new LLMAgentRunner({ repoRoot: REPO_ROOT, clients: [mock] });
    const out = (await runner.run({
      agentName: "ceo",
      input: { idea: fixtures.idea, companyContext: fixtures.ctx },
    })) as CEOOutput;
    assertEq(out.mission, fixtures.ceo.mission, "fallback succeeded");
    assertEq(mock.calls.length, 2, "called twice — primary then fallback");
    assertEq(mock.calls[0].model, "claude-opus-4-7-thinking-xhigh", "primary first");
    assertEq(mock.calls[1].model, "claude-opus-4-7-high", "fallback second");
  });

  await test("no client supports model → LLMAgentError (root cause in causes[])", async () => {
    const mock = new MockLLMClient();
    const runner = new LLMAgentRunner({ repoRoot: REPO_ROOT, clients: [mock] });
    const err = await expectThrows(
      () =>
        runner.run({
          agentName: "ceo",
          input: { idea: fixtures.idea, companyContext: fixtures.ctx },
        }),
      (e) => e instanceof LLMAgentError && /all 2 model attempt\(s\) failed/.test(e.message),
      "top-level error reports all attempts failed",
    );
    const llmErr = err as LLMAgentError;
    assert(
      llmErr.causes.every((c) => /no LLMClient supports/.test(c.message)),
      "every cause is 'no LLMClient supports'",
    );
  });
});

await group("LLMAgentRunner — model routing across multiple clients", async () => {
  await test("CEO (claude-*) routes to claude client; QA (gpt-*) routes to gpt client", async () => {
    const claudeClient = new MockLLMClient();
    claudeClient.set("claude-opus-4-7-thinking-xhigh", JSON.stringify(fixtures.ceo));
    const gptClient = new MockLLMClient();
    gptClient.set("gpt-5.5-medium", JSON.stringify(fixtures.qa));
    const runner = new LLMAgentRunner({
      repoRoot: REPO_ROOT,
      clients: [claudeClient, gptClient],
    });

    await runner.run({
      agentName: "ceo",
      input: { idea: fixtures.idea, companyContext: fixtures.ctx },
    });
    assertEq(claudeClient.calls.length, 1, "claude client received CEO call");
    assertEq(gptClient.calls.length, 0, "gpt client did not receive CEO call");

    const task = fixtures.em.tasks[0];
    await runner.run({
      agentName: "qa",
      input: { developerOutput: fixtures.developer, task },
    });
    assertEq(claudeClient.calls.length, 1, "claude client unchanged after QA call");
    assertEq(gptClient.calls.length, 1, "gpt client received QA call");
    assertEq(gptClient.calls[0].model, "gpt-5.5-medium", "gpt client routed gpt-5.5-medium");
  });

  await test("client order matters: first matching client wins", async () => {
    const first = new MockLLMClient({ "claude-opus-4-7-thinking-xhigh": JSON.stringify(fixtures.ceo) });
    const second = new MockLLMClient({ "claude-opus-4-7-thinking-xhigh": JSON.stringify(fixtures.ceo) });
    const runner = new LLMAgentRunner({ repoRoot: REPO_ROOT, clients: [first, second] });
    await runner.run({
      agentName: "ceo",
      input: { idea: fixtures.idea, companyContext: fixtures.ctx },
    });
    assertEq(first.calls.length, 1, "first matching client invoked");
    assertEq(second.calls.length, 0, "second matching client skipped");
  });
});

// ============================================================
// 5. End-to-end — runPipeline + LLMAgentRunner + MockLLMClient
// ============================================================

await group("end-to-end pipeline with LLMAgentRunner+MockLLMClient", async () => {
  await test("full pipeline runs, gates pass, files written to tmp dir", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "llm-runner-pipeline-"));
    try {
      const events: LLMCallEvent[] = [];
      const mock = fixtureMock();
      const runner = new LLMAgentRunner({
        repoRoot: REPO_ROOT,
        clients: [mock],
        onCall: (e) => events.push(e),
      });
      const result = await runPipeline(fixtures.idea, {
        agentRunner: runner,
        generatedDir: tmp,
        companyContext: fixtures.ctx,
      });
      assertEq(
        result.decision,
        "WROTE_FILES",
        `decision should be WROTE_FILES (got ${result.decision} - ${result.blockReason})`,
      );
      assert(result.filesWritten.length > 0, "wrote at least one file");
      assertEq(result.outputs.ceo?.mission, fixtures.ceo.mission, "CEO output captured");
      assertEq(result.outputs.qa?.decision, "PASS", "QA decision captured");
      assertEq(result.outputs.security?.decision, "GO", "Security decision captured");

      assertEq(events.length, 6, "6 agent calls observed");
      const seen = new Set(events.map((e) => e.agent));
      assertEq(
        Array.from(seen).sort().join(","),
        ["ceo", "cto", "cybersecurity", "developer", "engineering-manager", "qa"].sort().join(","),
        "all six agents observed",
      );

      for (const w of result.filesWritten) {
        const content = await readFile(w.absolutePath, "utf-8");
        assert(content.length > 0, `${w.declaredPath} non-empty`);
      }
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });
});

// ---------- summary ----------

const failed = records.filter((r) => !r.pass);
const passed = records.length - failed.length;

console.log(
  `\n${c.bold("Summary")}: ${c.green(passed + " passed")}, ${
    failed.length === 0 ? c.dim("0 failed") : c.red(failed.length + " failed")
  }`,
);

if (failed.length > 0) {
  console.log(c.red("\nFailures:"));
  for (const r of failed) console.log(`  - ${r.name}\n      ${r.error}`);
  process.exit(1);
}

console.log(c.green("\nAll Step 9 tests passed."));
process.exit(0);
