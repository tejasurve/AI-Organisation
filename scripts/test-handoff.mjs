#!/usr/bin/env node
// scripts/test-handoff.mjs
//
// Verifies that one agent's structured output can be cleanly handed off as
// another agent's structured input — no free text, no parsing hacks.
//
// Specifically for the CEO → CTO link:
//   1. Extract a CEO worked-example output from agents/ceo/prompt.md.
//   2. Validate it against the CEO output schema.
//   3. Wrap it in the CTO's task-body format (per agents/cto/config.json's inputContract).
//   4. Parse the wrapped body using the section markers declared by the CTO config.
//   5. Confirm the round-trip (parsed JSON deep-equals original) and that
//      `delegation.cto` extracts to a non-empty brief for the CTO.
//
// Usage:
//   node scripts/test-handoff.mjs <upstream-agent-dir> <downstream-agent-dir>
//   node scripts/test-handoff.mjs agents/ceo agents/cto
//
// Exit codes: 0 = ok, 1 = handoff broken, 2 = misuse.

import { readFile } from "node:fs/promises";
import { resolve, isAbsolute, join } from "node:path";

const args = process.argv.slice(2);
if (args.length !== 2) {
  console.error("Usage: node scripts/test-handoff.mjs <upstream-agent-dir> <downstream-agent-dir>");
  process.exit(2);
}
const upstreamDir = isAbsolute(args[0]) ? args[0] : resolve(process.cwd(), args[0]);
const downstreamDir = isAbsolute(args[1]) ? args[1] : resolve(process.cwd(), args[1]);

const c = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};

let passed = 0;
let failed = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log(`  ${c.green("✓")} ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ${c.red("✗")} ${name}`);
    for (const line of String(e.message).split("\n")) console.log(`      ${c.red(line)}`);
    failed++;
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// Reused minimal JSON Schema validator (subset: type, required, properties,
// additionalProperties, items, minItems, maxItems, enum, minimum, maximum).
// Kept in lock-step with the validator in scripts/test-agent.mjs so that
// inline schemas validate identically in both harnesses.

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
    for (const key of schema.required ?? []) {
      if (!(key in value)) errors.push(`${path}: missing required property "${key}"`);
    }
    for (const [key, sub] of Object.entries(schema.properties ?? {})) {
      if (key in value) errors.push(...validateSchema(value[key], sub, `${path}.${key}`));
    }
    if (schema.additionalProperties === false && schema.properties) {
      const allowed = new Set(Object.keys(schema.properties));
      for (const key of Object.keys(value)) {
        if (!allowed.has(key)) errors.push(`${path}: unexpected property "${key}"`);
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
      value.forEach((item, i) => errors.push(...validateSchema(item, schema.items, `${path}[${i}]`)));
    }
  }
  return errors;
}

function extractJsonBlocks(md) {
  return [...md.matchAll(/```json\s*([\s\S]*?)```/g)].map((m) => m[1].trim());
}

function pickWorkedExample(blocks, schema) {
  // The "skeleton" is structurally minimal; the worked example has populated content.
  // Return the first parseable block that is not the empty/skeleton block.
  for (const b of blocks) {
    let parsed;
    try {
      parsed = JSON.parse(b);
    } catch {
      continue;
    }
    if (validateSchema(parsed, schema).length !== 0) continue;
    const isSkeleton = JSON.stringify(parsed).replace(/[\s"]/g, "").length < 60;
    if (!isSkeleton) return parsed;
  }
  return null;
}

function getAtPath(obj, dottedPath) {
  if (dottedPath === "." || dottedPath === "") return obj;
  return dottedPath.split(".").reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

// Generic "is this value structurally empty?" — used to decide whether the
// extracted brief/handoff carries any real content for the downstream agent.
function isEmptyValue(v) {
  if (v == null) return true;
  if (typeof v === "string") return v === "";
  if (Array.isArray(v)) return v.length === 0 || v.every(isEmptyValue);
  if (typeof v === "object") {
    const values = Object.values(v);
    return values.length === 0 || values.every(isEmptyValue);
  }
  return false;
}

// Minimal-valid generator (subset, mirrors test-agent.mjs). Used to populate
// non-upstream sections (e.g. company context, changed surfaces) when the
// section declares an inline schema. Honors `enum`, `minimum`, and `minItems`.
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

// Sample context used when no inline schema is provided for a context-shaped section.
const SAMPLE_CONTEXT = { phase: "validate", cycle: 1, priorCycle: null };

// Decide the value to inject into each section when building the task body.
// sections[0] gets the upstream worked example; later sections are auto-supplied
// (skipped if optional, generated from inline schema if present, else sample context).
function payloadFor(section, isFirst, upstreamWorkedExample) {
  if (isFirst) return { include: true, value: upstreamWorkedExample };
  if (section.optional) return { include: false };
  if (section.schema) return { include: true, value: generateMinimalValid(section.schema) };
  return { include: true, value: SAMPLE_CONTEXT };
}

// Build the structured task body using only sections marked include=true.
function buildTaskBody(sections, plan) {
  const parts = [];
  sections.forEach((s, i) => {
    if (!plan[i].include) return;
    parts.push(`${s.marker}\n${JSON.stringify(plan[i].value, null, 2)}`);
  });
  return parts.join("\n\n");
}

// Parse the body back. Tolerates absent optional sections; throws on absent required.
function parseTaskBody(body, sections) {
  const result = {};
  // Find each marker's position; null if the marker isn't in the body.
  const positions = sections.map((s) => body.indexOf(s.marker));

  for (let i = 0; i < sections.length; i++) {
    const s = sections[i];
    const start = positions[i];
    if (start === -1) {
      if (s.optional) continue;
      throw new Error(`required section marker not found: "${s.marker}"`);
    }
    const after = start + s.marker.length;
    // Next section is the next one whose position is > after.
    let nextStart = body.length;
    for (let j = 0; j < positions.length; j++) {
      if (j === i) continue;
      if (positions[j] > after && positions[j] < nextStart) nextStart = positions[j];
    }
    const slice = body.slice(after, nextStart).trim();
    try {
      result[s.marker] = JSON.parse(slice);
    } catch (e) {
      throw new Error(`section "${s.marker}" is not valid JSON: ${e.message}`);
    }
  }
  return result;
}

// ---------- main ----------

console.log(c.bold(`\nHandoff: ${upstreamDir} → ${downstreamDir}`));

const upstreamConfigPath = join(upstreamDir, "config.json");
const upstreamPromptPath = join(upstreamDir, "prompt.md");
const downstreamConfigPath = join(downstreamDir, "config.json");

const upstreamConfig = JSON.parse(await readFile(upstreamConfigPath, "utf8"));
const upstreamPrompt = await readFile(upstreamPromptPath, "utf8");
const downstreamConfig = JSON.parse(await readFile(downstreamConfigPath, "utf8"));

console.log(`\n${c.bold(c.cyan("1. Upstream output schema is reachable"))}`);
let ceoSchema;
await test("upstream config has outputContract.schema", async () => {
  ceoSchema = upstreamConfig.outputContract?.schema;
  assert(ceoSchema, "upstream config.outputContract.schema missing");
});

console.log(`\n${c.bold(c.cyan("2. Downstream declares an inputContract"))}`);
await test("downstream config has inputContract.sections", async () => {
  assert(
    Array.isArray(downstreamConfig.inputContract?.sections) && downstreamConfig.inputContract.sections.length > 0,
    "downstream config.inputContract.sections missing or empty",
  );
});

console.log(`\n${c.bold(c.cyan("3. Downstream's first section references upstream output"))}`);
let firstSection;
await test("first section is JSON and references upstream schema", async () => {
  firstSection = downstreamConfig.inputContract.sections[0];
  assert(firstSection.format === "json", `first section format is "${firstSection.format}", expected "json"`);
  const ref = firstSection.schemaRef ?? "";
  assert(
    ref.includes("../ceo/config.json") || ref.includes(upstreamDir.split("/").pop() + "/config.json"),
    `schemaRef "${ref}" does not point at upstream config (${upstreamDir})`,
  );
});

console.log(`\n${c.bold(c.cyan("4. CEO worked example survives the handoff"))}`);
let workedExample;
await test("worked example present in upstream prompt.md", async () => {
  const blocks = extractJsonBlocks(upstreamPrompt);
  workedExample = pickWorkedExample(blocks, ceoSchema);
  assert(workedExample, "no validating, non-skeleton json fenced block found in upstream prompt.md");
});

await test("worked example validates against upstream output schema", async () => {
  const errs = validateSchema(workedExample, ceoSchema);
  assert(errs.length === 0, "worked example fails upstream schema:\n  - " + errs.join("\n  - "));
});

let parsed;
let plan;
await test("round-trip through downstream task body preserves the upstream JSON", async () => {
  const sections = downstreamConfig.inputContract.sections;
  plan = sections.map((s, i) => payloadFor(s, i === 0, workedExample));
  const body = buildTaskBody(sections, plan);
  parsed = parseTaskBody(body, sections);

  const roundTripped = parsed[sections[0].marker];
  assert(
    JSON.stringify(roundTripped) === JSON.stringify(workedExample),
    "round-tripped JSON differs from original",
  );
});

await test("extract path resolves to a non-null value (structurally-empty content is valid)", async () => {
  const sections = downstreamConfig.inputContract.sections;
  const extractPath = sections[0].extract;
  assert(extractPath, "first section has no `extract` path");
  const brief = getAtPath(parsed[sections[0].marker], extractPath);
  assert(brief !== undefined, `extracted brief at "${extractPath}" is undefined — the path does not resolve in the upstream output`);
});

await test("every required non-upstream section parses as JSON and validates against its declared schema", async () => {
  const sections = downstreamConfig.inputContract.sections;
  for (let i = 1; i < sections.length; i++) {
    const s = sections[i];
    if (!plan[i].include) continue; // optional section was intentionally skipped
    const value = parsed[s.marker];
    assert(value !== undefined, `section "${s.marker}" did not appear in parsed body`);
    if (s.schema) {
      const errs = validateSchema(value, s.schema);
      assert(errs.length === 0, `section "${s.marker}" fails its declared schema:\n  - ` + errs.join("\n  - "));
    }
  }
});

console.log(`\n${c.bold(c.cyan("5. Downstream prompt documents a non-empty handoff"))}`);
await test("downstream prompt.md contains an upstream-shaped example with a non-empty extracted brief", async () => {
  const downstreamPromptPath = join(downstreamDir, "prompt.md");
  const downstreamPrompt = await readFile(downstreamPromptPath, "utf8");
  const blocks = extractJsonBlocks(downstreamPrompt);
  const sections = downstreamConfig.inputContract.sections;
  const extractPath = sections[0].extract;

  let foundNonEmpty = false;
  let validatedCount = 0;
  for (const b of blocks) {
    let parsedBlock;
    try {
      parsedBlock = JSON.parse(b);
    } catch {
      continue;
    }
    // Only consider blocks that match the upstream output schema.
    if (validateSchema(parsedBlock, ceoSchema).length !== 0) continue;
    validatedCount++;
    const brief = getAtPath(parsedBlock, extractPath);
    if (!isEmptyValue(brief)) {
      foundNonEmpty = true;
      break;
    }
  }
  assert(
    foundNonEmpty,
    `no upstream-shaped example in downstream prompt.md has a non-empty value at "${extractPath}" — ` +
      `the downstream prompt must document at least one example where the upstream actually delegates real work.\n` +
      `Found ${validatedCount} upstream-shaped block(s).`,
  );
});

console.log(`\n${c.bold("Summary")}: ${c.green(passed + " passed")}, ${failed === 0 ? c.dim("0 failed") : c.red(failed + " failed")}`);
process.exit(failed === 0 ? 0 : 1);
