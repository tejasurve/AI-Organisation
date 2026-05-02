#!/usr/bin/env node
// scripts/validate-em-output.ts
//
// Validates an Engineering Manager output JSON file against the Feature/Task
// schemas + the cross-array integrity rules. Prints { valid, errors } JSON.
//
// Usage:
//   node scripts/validate-em-output.ts <em-output.json>
//   cat em-output.json | node scripts/validate-em-output.ts -
//   node scripts/validate-em-output.ts --from-prompt agents/engineering-manager
//     (extracts the worked-example json fenced block from prompt.md)
//
// Exit codes:
//   0 = valid
//   1 = invalid (errors are printed)
//   2 = misuse (bad args, file not found, JSON parse error)

import { readFile } from "node:fs/promises";
import { resolve, isAbsolute, join } from "node:path";
import { validateEMOutput } from "../lib/validation/validate.ts";

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node scripts/validate-em-output.ts <em-output.json>");
  console.error("       cat em-output.json | node scripts/validate-em-output.ts -");
  console.error("       node scripts/validate-em-output.ts --from-prompt <agent-dir>");
  process.exit(2);
}

let raw: string;

if (args[0] === "--from-prompt") {
  if (args.length !== 2) {
    console.error("--from-prompt requires an agent directory argument");
    process.exit(2);
  }
  const agentDir = isAbsolute(args[1]) ? args[1] : resolve(process.cwd(), args[1]);
  const promptPath = join(agentDir, "prompt.md");
  const prompt = await readFile(promptPath, "utf8");
  const picked = pickEMWorkedExample(prompt);
  if (!picked) {
    console.error(`No json block with top-level keys [features, tasks] found in ${promptPath}`);
    process.exit(2);
  }
  raw = picked;
} else if (args[0] === "-") {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  raw = Buffer.concat(chunks).toString("utf8");
} else {
  const path = isAbsolute(args[0]) ? args[0] : resolve(process.cwd(), args[0]);
  raw = await readFile(path, "utf8");
}

let parsed: unknown;
try {
  parsed = JSON.parse(raw);
} catch (e) {
  const result = {
    valid: false,
    errors: [
      {
        path: "$",
        rule: "json",
        message: `failed to parse JSON: ${(e as Error).message}`,
      },
    ],
  };
  console.log(JSON.stringify(result, null, 2));
  process.exit(1);
}

const result = validateEMOutput(parsed);
console.log(JSON.stringify(result, null, 2));
process.exit(result.valid ? 0 : 1);

function pickEMWorkedExample(md: string): string | null {
  const blocks = [...md.matchAll(/```json\s*([\s\S]*?)```/g)].map((m) => m[1].trim());
  // Pick the LAST json block whose top-level shape looks like an EM output:
  // a non-array object with `features` and `tasks` keys, both arrays, and
  // at least one populated string somewhere (i.e. not the empty skeleton).
  const candidates: string[] = [];
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
      Array.isArray((parsed as Record<string, unknown>).tasks)
    ) {
      // Skip blocks that look like skeletons (every string is empty).
      if (!hasOnlyEmptyStrings(parsed)) candidates.push(b);
    }
  }
  return candidates.length > 0 ? candidates[candidates.length - 1] : null;
}

function hasOnlyEmptyStrings(doc: unknown): boolean {
  let sawString = false;
  let allEmpty = true;
  function walk(v: unknown) {
    if (typeof v === "string") {
      sawString = true;
      if (v.length > 0) allEmpty = false;
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
  return sawString && allEmpty;
}
