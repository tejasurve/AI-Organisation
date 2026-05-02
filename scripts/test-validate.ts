#!/usr/bin/env node
// scripts/test-validate.ts
//
// Tests the lib/validation/validate.ts validator against:
//   - the EM agent's worked example (positive end-to-end)
//   - a hand-rolled minimal valid case
//   - lifecycle states (in_progress, done) that the EM contract forbids but
//     the system schema allows
//   - all four cross-array / per-field violation categories from §3 of the spec
//
// Zero deps. Run with: node scripts/test-validate.ts
//
// Exit codes: 0 = all pass, 1 = one or more failed.

import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validateEMOutput } from "../lib/validation/validate.ts";
import type { ValidationResult } from "../lib/validation/errors.ts";
import type { EMOutput } from "../lib/schemas/em-output.ts";

const c = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
};

let passed = 0;
let failed = 0;
const failures: string[] = [];

function group(name: string, fn: () => void | Promise<void>) {
  console.log(`\n${c.bold(c.cyan(name))}`);
  return fn();
}

async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
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

function assertValid(result: ValidationResult): void {
  if (!result.valid) {
    throw new Error(
      "expected valid=true but got valid=false; errors:\n  - " +
        result.errors.map((e) => `[${e.rule}] ${e.path}: ${e.message}`).join("\n  - "),
    );
  }
}

function assertInvalid(result: ValidationResult, expected: { rule: string; pathContains?: string }): void {
  if (result.valid) {
    throw new Error("expected valid=false but got valid=true with no errors");
  }
  const matched = result.errors.find(
    (e) => e.rule === expected.rule && (expected.pathContains == null || e.path.includes(expected.pathContains)),
  );
  if (!matched) {
    throw new Error(
      `no error matched { rule: "${expected.rule}", pathContains: "${expected.pathContains ?? ""}" }\n  ` +
        `errors:\n  - ` +
        result.errors.map((e) => `[${e.rule}] ${e.path}: ${e.message}`).join("\n  - "),
    );
  }
}

// ---------- fixtures ----------

const minimalValid: EMOutput = {
  features: [
    {
      id: "f-a",
      name: "Feature A",
      description: "The first feature.",
      priority: "high",
      status: "pending",
    },
  ],
  tasks: [
    {
      id: "t-a-1",
      featureId: "f-a",
      description: "Do the first thing.",
      assignedTo: "developer",
      estimatedHours: 2,
      status: "pending",
    },
  ],
};

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

// Read the EM worked example from prompt.md (the LAST json block whose
// top-level keys are exactly features+tasks, skipping the skeleton).
async function loadEMWorkedExample(): Promise<unknown> {
  const here = dirname(fileURLToPath(import.meta.url));
  const promptPath = resolve(here, "..", "agents", "engineering-manager", "prompt.md");
  const md = await readFile(promptPath, "utf8");
  const blocks = [...md.matchAll(/```json\s*([\s\S]*?)```/g)].map((m) => m[1].trim());
  let last: unknown = null;
  for (const b of blocks) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(b);
    } catch {
      continue;
    }
    if (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      Array.isArray((parsed as Record<string, unknown>).features) &&
      Array.isArray((parsed as Record<string, unknown>).tasks) &&
      !looksLikeSkeleton(parsed)
    ) {
      last = parsed;
    }
  }
  if (!last) throw new Error("no EM worked-example block found in prompt.md");
  return last;
}

function looksLikeSkeleton(doc: unknown): boolean {
  let foundEmpty = false;
  function walk(v: unknown) {
    if (foundEmpty) return;
    if (typeof v === "string" && v === "") {
      foundEmpty = true;
      return;
    }
    if (Array.isArray(v)) {
      for (const item of v) walk(item);
      return;
    }
    if (v && typeof v === "object") {
      for (const x of Object.values(v as Record<string, unknown>)) walk(x);
    }
  }
  walk(doc);
  return foundEmpty;
}

// ---------- tests ----------

console.log(c.bold("\nTesting lib/validation/validate.ts"));

await group("1. Positive — accepts valid outputs", async () => {
  await test("accepts: minimal valid (1 feature + 1 task, pending)", () => {
    assertValid(validateEMOutput(minimalValid));
  });

  await test("accepts: empty arrays (no features, no tasks)", () => {
    assertValid(validateEMOutput({ features: [], tasks: [] }));
  });

  await test("accepts: lifecycle status (feature in_progress, task done)", () => {
    const x = clone(minimalValid);
    x.features[0].status = "in_progress";
    x.tasks[0].status = "done";
    assertValid(validateEMOutput(x));
  });

  await test("accepts: estimatedHours boundary 1", () => {
    const x = clone(minimalValid);
    x.tasks[0].estimatedHours = 1;
    assertValid(validateEMOutput(x));
  });

  await test("accepts: estimatedHours boundary 4", () => {
    const x = clone(minimalValid);
    x.tasks[0].estimatedHours = 4;
    assertValid(validateEMOutput(x));
  });

  await test("accepts: estimatedHours non-integer in range (2.5)", () => {
    // Spec says `number (1–4)`, not `integer`. Non-integers are allowed at the
    // system layer; the EM agent contract is stricter and only emits integers.
    const x = clone(minimalValid);
    x.tasks[0].estimatedHours = 2.5;
    assertValid(validateEMOutput(x));
  });

  await test("accepts: every assigned role (developer, designer, qa)", () => {
    const x: EMOutput = {
      features: [{ id: "f-a", name: "F", description: "d", priority: "high", status: "pending" }],
      tasks: [
        { id: "t-a-1", featureId: "f-a", description: "d", assignedTo: "developer", estimatedHours: 1, status: "pending" },
        { id: "t-a-2", featureId: "f-a", description: "d", assignedTo: "designer", estimatedHours: 2, status: "pending" },
        { id: "t-a-3", featureId: "f-a", description: "d", assignedTo: "qa", estimatedHours: 3, status: "pending" },
      ],
    };
    assertValid(validateEMOutput(x));
  });

  await test("accepts: every priority (high, medium, low)", () => {
    const x: EMOutput = {
      features: [
        { id: "f-a", name: "F", description: "d", priority: "high", status: "pending" },
        { id: "f-b", name: "F", description: "d", priority: "medium", status: "pending" },
        { id: "f-c", name: "F", description: "d", priority: "low", status: "pending" },
      ],
      tasks: [
        { id: "t-a-1", featureId: "f-a", description: "d", assignedTo: "developer", estimatedHours: 1, status: "pending" },
        { id: "t-b-1", featureId: "f-b", description: "d", assignedTo: "developer", estimatedHours: 1, status: "pending" },
        { id: "t-c-1", featureId: "f-c", description: "d", assignedTo: "developer", estimatedHours: 1, status: "pending" },
      ],
    };
    assertValid(validateEMOutput(x));
  });

  await test("accepts: EM agent's worked example from prompt.md (end-to-end integration)", async () => {
    const example = await loadEMWorkedExample();
    assertValid(validateEMOutput(example));
  });
});

await group("2. Negative — top-level shape violations", async () => {
  await test("rejects: input is null", () => {
    assertInvalid(validateEMOutput(null), { rule: "type", pathContains: "$" });
  });
  await test("rejects: input is a string", () => {
    assertInvalid(validateEMOutput("not an object"), { rule: "type", pathContains: "$" });
  });
  await test("rejects: input is an array", () => {
    assertInvalid(validateEMOutput([]), { rule: "type", pathContains: "$" });
  });
  await test("rejects: features is missing", () => {
    assertInvalid(validateEMOutput({ tasks: [] }), { rule: "type", pathContains: "$.features" });
  });
  await test("rejects: tasks is missing", () => {
    assertInvalid(validateEMOutput({ features: [] }), { rule: "type", pathContains: "$.tasks" });
  });
  await test("rejects: features is not an array", () => {
    assertInvalid(validateEMOutput({ features: "nope", tasks: [] }), { rule: "type", pathContains: "$.features" });
  });
});

await group("3. Negative — feature shape", async () => {
  await test("rejects: feature missing id", () => {
    const x = clone(minimalValid);
    delete (x.features[0] as Partial<typeof x.features[0]>).id;
    assertInvalid(validateEMOutput(x), { rule: "missing", pathContains: "$.features[0].id" });
  });
  await test("rejects: feature has empty name", () => {
    const x = clone(minimalValid);
    x.features[0].name = "";
    assertInvalid(validateEMOutput(x), { rule: "nonempty", pathContains: "$.features[0].name" });
  });
  await test("rejects: feature priority not in enum", () => {
    const x = clone(minimalValid) as unknown as { features: Array<Record<string, unknown>>; tasks: unknown[] };
    x.features[0].priority = "urgent";
    assertInvalid(validateEMOutput(x), { rule: "enum", pathContains: "$.features[0].priority" });
  });
  await test("rejects: feature status not in lifecycle enum", () => {
    const x = clone(minimalValid) as unknown as { features: Array<Record<string, unknown>>; tasks: unknown[] };
    x.features[0].status = "blocked";
    assertInvalid(validateEMOutput(x), { rule: "enum", pathContains: "$.features[0].status" });
  });
});

await group("4. Negative — task shape", async () => {
  await test("rejects: task missing featureId", () => {
    const x = clone(minimalValid);
    delete (x.tasks[0] as Partial<typeof x.tasks[0]>).featureId;
    assertInvalid(validateEMOutput(x), { rule: "missing", pathContains: "$.tasks[0].featureId" });
  });
  await test("rejects: task assignedTo not in role enum (architect)", () => {
    const x = clone(minimalValid) as unknown as { features: unknown[]; tasks: Array<Record<string, unknown>> };
    x.tasks[0].assignedTo = "architect";
    assertInvalid(validateEMOutput(x), { rule: "enum", pathContains: "$.tasks[0].assignedTo" });
  });
  await test("rejects: task status not in lifecycle enum", () => {
    const x = clone(minimalValid) as unknown as { features: unknown[]; tasks: Array<Record<string, unknown>> };
    x.tasks[0].status = "scheduled";
    assertInvalid(validateEMOutput(x), { rule: "enum", pathContains: "$.tasks[0].status" });
  });
  await test("rejects: estimatedHours = 0 (below range)", () => {
    const x = clone(minimalValid);
    x.tasks[0].estimatedHours = 0;
    assertInvalid(validateEMOutput(x), { rule: "range", pathContains: "$.tasks[0].estimatedHours" });
  });
  await test("rejects: estimatedHours = 5 (above range)", () => {
    const x = clone(minimalValid);
    x.tasks[0].estimatedHours = 5;
    assertInvalid(validateEMOutput(x), { rule: "range", pathContains: "$.tasks[0].estimatedHours" });
  });
  await test("rejects: estimatedHours is a string", () => {
    const x = clone(minimalValid) as unknown as { features: unknown[]; tasks: Array<Record<string, unknown>> };
    x.tasks[0].estimatedHours = "two";
    assertInvalid(validateEMOutput(x), { rule: "type", pathContains: "$.tasks[0].estimatedHours" });
  });
  await test("rejects: estimatedHours is NaN", () => {
    const x = clone(minimalValid);
    x.tasks[0].estimatedHours = NaN;
    assertInvalid(validateEMOutput(x), { rule: "type", pathContains: "$.tasks[0].estimatedHours" });
  });
});

await group("5. Negative — cross-array integrity", async () => {
  await test("rejects: task.featureId points at non-existent feature (foreignKey)", () => {
    const x = clone(minimalValid);
    x.tasks[0].featureId = "f-does-not-exist";
    assertInvalid(validateEMOutput(x), { rule: "foreignKey", pathContains: "$.tasks[0].featureId" });
  });
  await test("rejects: feature has 0 tasks (minTasks)", () => {
    const x: EMOutput = {
      features: [
        { id: "f-a", name: "F", description: "d", priority: "high", status: "pending" },
        { id: "f-orphan", name: "F", description: "d", priority: "low", status: "pending" },
      ],
      tasks: [{ id: "t-a-1", featureId: "f-a", description: "d", assignedTo: "developer", estimatedHours: 1, status: "pending" }],
    };
    assertInvalid(validateEMOutput(x), { rule: "minTasks", pathContains: "$.features[1].id" });
  });
});

await group("6. Error accumulation — multiple violations are all reported", async () => {
  await test("multiple errors accumulate (not short-circuited)", () => {
    const broken = {
      features: [{ id: "f-a", name: "", description: "d", priority: "urgent", status: "pending" }],
      tasks: [
        { id: "t-x", featureId: "f-missing", description: "", assignedTo: "developer", estimatedHours: 99, status: "pending" },
      ],
    };
    const result = validateEMOutput(broken);
    assert(!result.valid, "expected invalid");
    // Expect at least these distinct rule kinds to all appear:
    const ruleKinds = new Set(result.errors.map((e) => e.rule));
    for (const expected of ["nonempty", "enum", "foreignKey", "range", "minTasks"]) {
      assert(ruleKinds.has(expected as (typeof result.errors)[number]["rule"]), `expected rule kind "${expected}" but only saw [${[...ruleKinds].join(", ")}]`);
    }
  });
});

await group("7. Output format — return shape matches spec", async () => {
  await test("valid case returns { valid: true, errors: [] }", () => {
    const r = validateEMOutput(minimalValid);
    assert(r.valid === true, `valid should be true, got ${r.valid}`);
    assert(Array.isArray(r.errors) && r.errors.length === 0, `errors should be []`);
    assert(Object.keys(r).sort().join(",") === "errors,valid", `unexpected keys: ${Object.keys(r).join(",")}`);
  });
  await test("invalid case returns { valid: false, errors: [...] }", () => {
    const r = validateEMOutput(null);
    assert(r.valid === false, `valid should be false, got ${r.valid}`);
    assert(Array.isArray(r.errors) && r.errors.length > 0, `errors should be a non-empty array`);
    for (const e of r.errors) {
      assert(typeof e.path === "string", "error.path should be a string");
      assert(typeof e.rule === "string", "error.rule should be a string");
      assert(typeof e.message === "string", "error.message should be a string");
    }
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
