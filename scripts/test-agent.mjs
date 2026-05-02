#!/usr/bin/env node
// scripts/test-agent.mjs
//
// Validates an agent definition (SKILLS.md + prompt.md + config.json)
// without requiring Paperclip to be running or any external dependencies.
//
// Usage:
//   node scripts/test-agent.mjs <agent-dir>
//   node scripts/test-agent.mjs agents/ceo
//
// Exit codes:
//   0 = all tests passed
//   1 = one or more tests failed
//   2 = misuse (bad args, missing files)

import { readFile, stat } from "node:fs/promises";
import { resolve, dirname, join, isAbsolute } from "node:path";

// ---------- args ----------

const args = process.argv.slice(2);
if (args.length !== 1) {
  console.error("Usage: node scripts/test-agent.mjs <agent-dir>");
  process.exit(2);
}
const agentDir = isAbsolute(args[0]) ? args[0] : resolve(process.cwd(), args[0]);

// ---------- runner ----------

const c = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};

let passed = 0;
let failed = 0;
const failures = [];

async function group(name, fn) {
  console.log(`\n${c.bold(c.cyan(name))}`);
  await fn();
}

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ${c.green("✓")} ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ${c.red("✗")} ${name}`);
    for (const line of String(e.message).split("\n")) {
      console.log(`      ${c.red(line)}`);
    }
    failed++;
    failures.push({ name, message: e.message });
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(
      `${msg}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`,
    );
  }
}

// ---------- minimal JSON Schema validator ----------
// Supports the subset we use: type ("object"|"array"|"string"|"number"|
// "integer"|"boolean"|"null"), required, properties, additionalProperties,
// items, minItems, maxItems, enum, minimum, maximum.

function actualTypeOf(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "number") return Number.isInteger(value) ? "integer-or-number" : "number";
  return typeof value;
}

function typeMatches(declared, actual) {
  if (declared === "number") return actual === "number" || actual === "integer-or-number";
  if (declared === "integer") return actual === "integer-or-number";
  return declared === actual;
}

function validateSchema(value, schema, path = "$") {
  const errors = [];

  if (schema.type) {
    const actual = actualTypeOf(value);
    if (!typeMatches(schema.type, actual)) {
      const display = actual === "integer-or-number" ? "number" : actual;
      errors.push(`${path}: expected ${schema.type}, got ${display}`);
      return errors;
    }
  }

  if (Array.isArray(schema.enum)) {
    if (!schema.enum.includes(value)) {
      errors.push(`${path}: value ${JSON.stringify(value)} not in enum [${schema.enum.map((v) => JSON.stringify(v)).join(", ")}]`);
    }
  }

  if (schema.type === "number" || schema.type === "integer") {
    if (typeof schema.minimum === "number" && value < schema.minimum) {
      errors.push(`${path}: ${value} < minimum ${schema.minimum}`);
    }
    if (typeof schema.maximum === "number" && value > schema.maximum) {
      errors.push(`${path}: ${value} > maximum ${schema.maximum}`);
    }
  }

  if (schema.type === "object") {
    if (schema.required) {
      for (const key of schema.required) {
        if (!(key in value)) {
          errors.push(`${path}: missing required property "${key}"`);
        }
      }
    }
    if (schema.properties) {
      for (const [key, sub] of Object.entries(schema.properties)) {
        if (key in value) {
          errors.push(...validateSchema(value[key], sub, `${path}.${key}`));
        }
      }
    }
    if (schema.additionalProperties === false && schema.properties) {
      const allowed = new Set(Object.keys(schema.properties));
      for (const key of Object.keys(value)) {
        if (!allowed.has(key)) {
          errors.push(`${path}: unexpected property "${key}"`);
        }
      }
    }
  }

  if (schema.type === "array") {
    if (schema.minItems != null && value.length < schema.minItems) {
      errors.push(`${path}: array length ${value.length} < minItems ${schema.minItems}`);
    }
    if (schema.maxItems != null && value.length > schema.maxItems) {
      errors.push(`${path}: array length ${value.length} > maxItems ${schema.maxItems}`);
    }
    if (schema.items) {
      value.forEach((item, i) => {
        errors.push(...validateSchema(item, schema.items, `${path}[${i}]`));
      });
    }
  }

  return errors;
}

// ---------- helpers ----------

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function readJson(p) {
  const text = await readFile(p, "utf8");
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`Invalid JSON in ${p}: ${e.message}`);
  }
}

function extractJsonBlocks(md) {
  // Match ```json ... ``` fenced blocks
  return [...md.matchAll(/```json\s*([\s\S]*?)```/g)].map((m) => m[1].trim());
}

// ---------- known Paperclip adapter types ----------
// Source: /Users/tejas/Desktop/Tejas/MVP/paperclip/packages/adapters/<name>/
// (directory names hyphenated; adapterType is the underscore form)
const PAPERCLIP_ADAPTERS = new Set([
  "claude_local",
  "codex_local",
  "cursor_local",
  "gemini_local",
  "opencode_local",
  "openclaw_gateway",
  "pi_local",
  "acpx_local",
]);

// ---------- expected models per agent role ----------
// Source of truth: MODEL_SELECTION.md §3 (Agent → Model Mapping)
// Update this map as new agents are added in later steps.
const EXPECTED_MODELS = {
  ceo: "claude-opus-4-7-thinking-xhigh",
  cto: "claude-opus-4-7-thinking-xhigh",
  cfo: "claude-opus-4-7-thinking-xhigh",
  cybersecurity: "claude-opus-4-7-thinking-xhigh",
  cmo: "claude-opus-4-7-high",
  cpo: "claude-opus-4-7-high",
  "solution-architect": "claude-opus-4-7-high",
  "engineering-manager": "claude-opus-4-7-high",
  designer: "claude-opus-4-7-high",
  analyst: "claude-opus-4-7-high",
  copywriter: "claude-opus-4-7-high",
  seo: "claude-opus-4-7-high",
  outreach: "claude-opus-4-7-high",
  // NOTE: Step 5 of PROJECT_IDEA.md execution explicitly overrides
  // MODEL_SELECTION.md §3 (which lists "Developer | gpt-5.3-codex") and instructs
  // us to use Claude Opus 4.6 for the developer agent. Update both this map and
  // agents/developer/config.json together if the override is reverted.
  developer: "claude-opus-4-6",
  qa: "gpt-5.5-medium",
};

// ---------- main ----------

console.log(c.bold(`\nTesting agent: ${agentDir}`));

const configPath = join(agentDir, "config.json");
const promptPath = join(agentDir, "prompt.md");
const skillsPath = join(agentDir, "SKILLS.md");

let config;
let promptMd;
let skillsMd;

await group("1. File presence", async () => {
  await test("config.json exists", async () => assert(await exists(configPath), `not found: ${configPath}`));
  await test("prompt.md exists", async () => assert(await exists(promptPath), `not found: ${promptPath}`));
  await test("SKILLS.md exists", async () => assert(await exists(skillsPath), `not found: ${skillsPath}`));
});

await group("2. config.json structure", async () => {
  await test("config.json is valid JSON", async () => {
    config = await readJson(configPath);
  });
  await test("required Paperclip agent-hire fields present", async () => {
    const required = ["name", "role", "title", "icon", "capabilities", "adapterType", "adapterConfig", "instructionsBundle"];
    const missing = required.filter((k) => !(k in (config ?? {})));
    assert(missing.length === 0, `missing fields: ${missing.join(", ")}`);
  });
  await test("adapterType is registered in Paperclip", async () => {
    assert(
      PAPERCLIP_ADAPTERS.has(config.adapterType),
      `adapterType "${config.adapterType}" not in known set: ${[...PAPERCLIP_ADAPTERS].join(", ")}`,
    );
  });
  await test("adapterConfig.model is a non-empty string", async () => {
    assert(typeof config.adapterConfig?.model === "string" && config.adapterConfig.model.length > 0, "model missing or empty");
  });
  await test("adapterConfig.model matches MODEL_SELECTION.md for this role", async () => {
    const expected = EXPECTED_MODELS[config.role];
    assert(expected, `no expected model registered for role "${config.role}" (update EXPECTED_MODELS in scripts/test-agent.mjs)`);
    assertEqual(config.adapterConfig.model, expected, `model for role "${config.role}" must match MODEL_SELECTION.md`);
  });
  await test("instructionsBundle.entryFile points to AGENTS.md", async () => {
    assertEqual(config.instructionsBundle?.entryFile, "AGENTS.md", "entryFile should be AGENTS.md");
  });
  await test("runtimeConfig.heartbeat is wake-on-demand by default", async () => {
    assertEqual(config.runtimeConfig?.heartbeat?.enabled, false, "timer heartbeat should be disabled by default");
    assertEqual(config.runtimeConfig?.heartbeat?.wakeOnDemand, true, "wakeOnDemand should be true");
  });
});

await group("3. instructionsBundle @file: references resolve", async () => {
  await test("AGENTS.md → ./prompt.md (loadable, non-empty)", async () => {
    const ref = config.instructionsBundle.files["AGENTS.md"];
    assert(typeof ref === "string" && ref.startsWith("@file:"), `expected @file: reference, got ${ref}`);
    const target = ref.slice("@file:".length);
    const abs = isAbsolute(target) ? target : resolve(agentDir, target);
    assert(await exists(abs), `referenced file not found: ${abs}`);
    promptMd = await readFile(abs, "utf8");
    assert(promptMd.trim().length > 100, `prompt.md is suspiciously short (${promptMd.length} chars)`);
  });
  await test("SKILLS.md → ./SKILLS.md (loadable, non-empty)", async () => {
    const ref = config.instructionsBundle.files["SKILLS.md"];
    assert(typeof ref === "string" && ref.startsWith("@file:"), `expected @file: reference, got ${ref}`);
    const target = ref.slice("@file:".length);
    const abs = isAbsolute(target) ? target : resolve(agentDir, target);
    assert(await exists(abs), `referenced file not found: ${abs}`);
    skillsMd = await readFile(abs, "utf8");
    assert(skillsMd.trim().length > 100, `SKILLS.md is suspiciously short (${skillsMd.length} chars)`);
  });
});

await group("4. prompt.md cross-file consistency", async () => {
  // CEO-specific: the CEO is the only agent whose own output names all four
  // delegation slots. Other agents only mention them incidentally (because they
  // embed CEO output as a worked example), so making this generic would be
  // accidental, not intentional.
  if (config.role === "ceo") {
    await test("prompt mentions all four delegation keys", async () => {
      for (const key of ["cto", "cmo", "cfo", "cpo"]) {
        assert(promptMd.includes(`"${key}"`), `prompt.md does not mention delegation key "${key}"`);
      }
    });
  }
  await test("prompt contains an output skeleton with the required top-level keys", async () => {
    const schema = config.outputContract?.schema;
    assert(schema, "config.outputContract.schema missing");
    const requiredKeys = (schema.required ?? []).slice().sort();
    assert(requiredKeys.length > 0, "schema has no required top-level keys");

    const blocks = extractJsonBlocks(promptMd);
    assert(blocks.length >= 1, "prompt.md has no json fenced blocks");

    const closed = schema.additionalProperties === false;
    let found = false;
    for (const b of blocks) {
      let parsed;
      try {
        parsed = JSON.parse(b);
      } catch {
        continue;
      }
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) continue;
      const blockKeys = Object.keys(parsed).sort();
      const hasAll = requiredKeys.every((k) => blockKeys.includes(k));
      const noExtras = !closed || blockKeys.every((k) => requiredKeys.includes(k));
      if (hasAll && noExtras) {
        found = true;
        break;
      }
    }
    assert(
      found,
      `no skeleton block found with required top-level keys [${requiredKeys.join(", ")}]` +
        (closed ? " (and no extras, since the schema is closed)" : ""),
    );
  });
  await test("worked example in prompt.md validates against schema", async () => {
    const blocks = extractJsonBlocks(promptMd);
    let validated = 0;
    let failures = [];
    for (const b of blocks) {
      let parsed;
      try {
        parsed = JSON.parse(b);
      } catch {
        continue;
      }
      const errs = validateSchema(parsed, config.outputContract.schema);
      if (errs.length === 0) {
        validated++;
      } else {
        failures.push({ block: b.slice(0, 80) + "...", errors: errs });
      }
    }
    assert(validated >= 2, `expected ≥2 valid example blocks (skeleton + worked example), got ${validated}\nfailures: ${JSON.stringify(failures, null, 2)}`);
  });
});

// Auto-generate a minimal valid output from a JSON Schema.
// Used by groups 5–6 so the harness works for any agent without per-role hardcoding.
// Honors `enum` (picks first allowed value), `minimum` (used for numeric defaults),
// and `minItems` (arrays whose minItems > 0 are populated with that many items
// generated from `items`).
function generateMinimalValid(schema) {
  if (!schema || typeof schema !== "object") return null;
  if (Array.isArray(schema.enum) && schema.enum.length > 0) return schema.enum[0];
  if (schema.type === "object") {
    const out = {};
    for (const key of schema.required ?? []) {
      out[key] = generateMinimalValid(schema.properties?.[key] ?? {});
    }
    return out;
  }
  if (schema.type === "array") {
    const min = typeof schema.minItems === "number" ? schema.minItems : 0;
    if (min === 0) return [];
    const itemSchema = schema.items ?? {};
    return Array.from({ length: min }, () => generateMinimalValid(itemSchema));
  }
  if (schema.type === "string") return "";
  if (schema.type === "integer" || schema.type === "number") {
    if (typeof schema.minimum === "number") return schema.minimum;
    return 0;
  }
  if (schema.type === "boolean") return false;
  return null;
}

await group("5. Output contract — accepts valid outputs", async () => {
  await test("accepts: auto-generated minimal valid (from schema)", async () => {
    const minimal = generateMinimalValid(config.outputContract.schema);
    const errs = validateSchema(minimal, config.outputContract.schema);
    assert(errs.length === 0, `unexpected validation errors:\n  - ${errs.join("\n  - ")}`);
  });
  await test("accepts: every parseable json fenced block in prompt.md", async () => {
    const blocks = extractJsonBlocks(promptMd);
    assert(blocks.length >= 2, "expected at least 2 json fenced blocks (skeleton + worked example), got " + blocks.length);
    let validated = 0;
    const failures = [];
    for (const b of blocks) {
      let parsed;
      try {
        parsed = JSON.parse(b);
      } catch {
        continue;
      }
      const errs = validateSchema(parsed, config.outputContract.schema);
      if (errs.length === 0) validated++;
      else failures.push({ block: b.slice(0, 100), errors: errs });
    }
    assert(
      validated >= 2,
      `expected ≥2 valid example blocks, got ${validated}\nfailures:\n${JSON.stringify(failures, null, 2)}`,
    );
  });
});

await group("6. Output contract — rejects schema-violating outputs", async () => {
  const schema = config.outputContract.schema;
  const minimal = generateMinimalValid(schema);

  // 6a — Each required top-level field, when removed, must trigger a missing-property error.
  for (const key of schema.required ?? []) {
    await test(`rejects: missing required "${key}"`, async () => {
      const broken = { ...minimal };
      delete broken[key];
      const errs = validateSchema(broken, schema);
      assert(errs.length > 0, "expected at least one error, got none");
      assert(
        errs.some((e) => e.includes(`missing required property "${key}"`)),
        `expected missing-property error for "${key}", got:\n  - ${errs.join("\n  - ")}`,
      );
    });
  }

  // 6b — If top-level object is closed, an extra property must be rejected.
  if (schema.type === "object" && schema.additionalProperties === false) {
    await test("rejects: extra top-level property", async () => {
      const broken = { ...minimal, __unexpectedTopLevel: "should not be here" };
      const errs = validateSchema(broken, schema);
      assert(
        errs.some((e) => /unexpected property "__unexpectedTopLevel"/.test(e)),
        `expected extra-property error, got:\n  - ${errs.join("\n  - ")}`,
      );
    });
  }

  // 6c — Wrong type on the first required field (string ↔ array swap covers most cases).
  const firstKey = (schema.required ?? [])[0];
  if (firstKey) {
    const sub = schema.properties?.[firstKey];
    if (sub?.type === "string") {
      await test(`rejects: wrong type for "${firstKey}" (array instead of string)`, async () => {
        const broken = { ...minimal, [firstKey]: [] };
        const errs = validateSchema(broken, schema);
        assert(
          errs.some((e) => /expected string, got array/.test(e)),
          `expected type-error, got:\n  - ${errs.join("\n  - ")}`,
        );
      });
    } else if (sub?.type === "array") {
      await test(`rejects: wrong type for "${firstKey}" (string instead of array)`, async () => {
        const broken = { ...minimal, [firstKey]: "not an array" };
        const errs = validateSchema(broken, schema);
        assert(
          errs.some((e) => /expected array, got string/.test(e)),
          `expected type-error, got:\n  - ${errs.join("\n  - ")}`,
        );
      });
    } else if (sub?.type === "object") {
      await test(`rejects: wrong type for "${firstKey}" (string instead of object)`, async () => {
        const broken = { ...minimal, [firstKey]: "not an object" };
        const errs = validateSchema(broken, schema);
        assert(
          errs.some((e) => /expected object, got string/.test(e)),
          `expected type-error, got:\n  - ${errs.join("\n  - ")}`,
        );
      });
    }
  }

  // 6d — If any array property declares maxItems, exceeding it must be rejected.
  for (const [key, sub] of Object.entries(schema.properties ?? {})) {
    if (sub?.type === "array" && typeof sub.maxItems === "number") {
      await test(`rejects: "${key}" exceeds maxItems (${sub.maxItems})`, async () => {
        const tooMany = Array.from({ length: sub.maxItems + 1 }, (_, i) => `item-${i}`);
        const broken = { ...minimal, [key]: tooMany };
        const errs = validateSchema(broken, schema);
        assert(
          errs.some((e) => new RegExp(`array length ${sub.maxItems + 1} > maxItems ${sub.maxItems}`).test(e)),
          `expected maxItems error, got:\n  - ${errs.join("\n  - ")}`,
        );
      });
    }
  }
});

await group("7. SKILLS.md sanity (per-agent sidecar)", async () => {
  const sanityPath = join(agentDir, "test", "sanity.json");
  if (!(await exists(sanityPath))) {
    console.log(`  ${c.dim("(skipped — no test/sanity.json sidecar for this agent)")}`);
    return;
  }
  const sanity = await readJson(sanityPath);

  const mustMention = sanity.skillsMustMention ?? [];
  for (const term of mustMention) {
    await test(`SKILLS.md mentions "${term}"`, async () => {
      assert(new RegExp(term, "i").test(skillsMd), `SKILLS.md does not mention "${term}"`);
    });
  }

  const promptMustMention = sanity.promptMustMention ?? [];
  for (const term of promptMustMention) {
    await test(`prompt.md mentions "${term}"`, async () => {
      assert(new RegExp(term, "i").test(promptMd), `prompt.md does not mention "${term}"`);
    });
  }
});

await group("8. Output integrity rules (cross-array constraints)", async () => {
  const sanityPath = join(agentDir, "test", "sanity.json");
  if (!(await exists(sanityPath))) {
    console.log(`  ${c.dim("(skipped — no test/sanity.json sidecar)")}`);
    return;
  }
  const sanity = await readJson(sanityPath);
  const rules = sanity.outputIntegrityRules ?? [];
  if (rules.length === 0) {
    console.log(`  ${c.dim("(skipped — no outputIntegrityRules declared)")}`);
    return;
  }

  // Integrity rules apply to fully-populated worked examples only.
  // A schema-valid "skeleton" block (with empty placeholder strings) is shape
  // documentation and should not be required to satisfy content invariants.
  const blocks = extractJsonBlocks(promptMd);
  const examples = [];
  for (const b of blocks) {
    let parsed;
    try {
      parsed = JSON.parse(b);
    } catch {
      continue;
    }
    if (validateSchema(parsed, config.outputContract.schema).length !== 0) continue;
    if (hasEmptyStrings(parsed)) continue; // skip skeletons / minimal placeholders
    examples.push(parsed);
  }
  if (examples.length === 0) {
    await test("at least one fully-populated worked example exists for integrity rules", async () => {
      throw new Error(
        "no schema-valid json fenced block in prompt.md has all string fields populated.\n" +
          "Integrity rules need a real worked example, not just the empty skeleton.",
      );
    });
    return;
  }

  for (const rule of rules) {
    const ruleName = rule.name ?? `${rule.type} on ${rule.child ?? rule.parent ?? "?"}`;
    await test(`integrity rule: ${ruleName}`, async () => {
      for (const [exIdx, example] of examples.entries()) {
        const violation = applyIntegrityRule(rule, example);
        if (violation) throw new Error(`example #${exIdx + 1}: ${violation}`);
      }
    });
  }
});

// Returns true if the document contains any empty string anywhere. Used to
// distinguish "shape skeletons" (empty placeholder strings) from "worked examples"
// (every string populated) when deciding which examples to run integrity rules on.
function hasEmptyStrings(doc) {
  let found = false;
  function walk(v) {
    if (found) return;
    if (typeof v === "string") {
      if (v === "") found = true;
      return;
    }
    if (Array.isArray(v)) {
      for (const item of v) {
        walk(item);
        if (found) return;
      }
      return;
    }
    if (v && typeof v === "object") {
      for (const k of Object.keys(v)) {
        walk(v[k]);
        if (found) return;
      }
    }
  }
  walk(doc);
  return found;
}

function applyIntegrityRule(rule, doc) {
  if (rule.type === "foreignKey") {
    // Every value of doc[child][*][childKey] must appear in doc[parent][*][parentKey].
    const children = doc[rule.child] ?? [];
    const parents = doc[rule.parent] ?? [];
    const parentKeys = new Set(parents.map((p) => p[rule.parentKey]));
    for (const [i, child] of children.entries()) {
      const fk = child[rule.childKey];
      if (!parentKeys.has(fk)) {
        return `${rule.child}[${i}].${rule.childKey} = ${JSON.stringify(fk)} has no matching ${rule.parent}[].${rule.parentKey}`;
      }
    }
    return null;
  }
  if (rule.type === "groupCount") {
    const children = doc[rule.child] ?? [];
    const counts = new Map();
    for (const child of children) {
      const key = child[rule.groupBy];
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    // Also include zero-count groups when "parent" is declared.
    if (rule.parent && rule.parentKey) {
      for (const p of doc[rule.parent] ?? []) {
        if (!counts.has(p[rule.parentKey])) counts.set(p[rule.parentKey], 0);
      }
    }
    for (const [key, count] of counts.entries()) {
      if (typeof rule.min === "number" && count < rule.min) {
        return `group ${JSON.stringify(key)} has ${count} ${rule.child} (< min ${rule.min})`;
      }
      if (typeof rule.max === "number" && count > rule.max) {
        return `group ${JSON.stringify(key)} has ${count} ${rule.child} (> max ${rule.max})`;
      }
    }
    return null;
  }
  return `unknown integrity rule type "${rule.type}"`;
}

// ---------- summary ----------

console.log(`\n${c.bold("Summary")}: ${c.green(passed + " passed")}, ${failed === 0 ? c.dim("0 failed") : c.red(failed + " failed")}`);
if (failed > 0) {
  console.log(c.red("\nFailures:"));
  for (const f of failures) console.log(`  - ${f.name}`);
  process.exit(1);
}
console.log(c.green("\nAll tests passed."));
process.exit(0);
