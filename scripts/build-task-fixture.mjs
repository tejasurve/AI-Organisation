#!/usr/bin/env node
// scripts/build-task-fixture.mjs
//
// Author-time helper for hand-crafting per-task developer fixtures without
// having to JSON-escape large blocks of source by hand.
//
// Usage:
//   node scripts/build-task-fixture.mjs <stagingDir> <outFile>
//
// Layout of <stagingDir>:
//   _meta.json                         { taskId, implementationPlan, tests, notes }
//   <relative source path 1>          plain UTF-8 source
//   <relative source path 2>          plain UTF-8 source
//   ...
//
// Every file under <stagingDir> EXCEPT `_meta.json` and any path that begins
// with `_` is treated as a source file. Its repo-relative path becomes the
// developer file's `path` field, its raw bytes become its `content` field.
// `_meta.json` supplies everything else (implementationPlan, tests[], notes[]),
// so the only thing this script does is stitch them into the strict
// developer.output.json shape.

import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { dirname } from "node:path";

async function main() {
  const [stagingDir, outFile] = process.argv.slice(2);
  if (!stagingDir || !outFile) {
    console.error("Usage: node scripts/build-task-fixture.mjs <stagingDir> <outFile>");
    process.exit(2);
  }

  const meta = JSON.parse(await readFile(join(stagingDir, "_meta.json"), "utf-8"));
  if (!meta.taskId) bail(`_meta.json must include a non-empty taskId`);
  if (typeof meta.implementationPlan !== "string" || !meta.implementationPlan.trim()) {
    bail(`_meta.json must include a non-empty implementationPlan string`);
  }
  if (!Array.isArray(meta.tests) || meta.tests.length === 0) {
    bail(`_meta.json must include a non-empty tests[] array (developer schema requires minItems: 1)`);
  }
  for (const [i, t] of meta.tests.entries()) {
    if (typeof t.description !== "string" || typeof t.code !== "string") {
      bail(`_meta.json tests[${i}] must have { description: string, code: string }`);
    }
  }
  if (!Array.isArray(meta.notes)) bail(`_meta.json must include a notes[] array (can be empty)`);

  const files = [];
  for await (const abs of walk(stagingDir)) {
    const rel = relative(stagingDir, abs).split(sep).join("/");
    if (rel === "_meta.json") continue;
    if (rel.startsWith("_") || rel.includes("/_")) continue;
    const content = await readFile(abs, "utf-8");
    files.push({ path: rel, content });
  }
  if (files.length === 0) {
    bail(`no source files found under ${stagingDir} (developer schema requires minItems: 1)`);
  }
  files.sort((a, b) => a.path.localeCompare(b.path));

  const out = {
    taskId: meta.taskId,
    implementationPlan: meta.implementationPlan,
    files,
    tests: meta.tests,
    notes: meta.notes,
  };

  await mkdir(dirname(outFile), { recursive: true });
  await writeFile(outFile, JSON.stringify(out, null, 2) + "\n", "utf-8");

  const totalBytes = files.reduce((acc, f) => acc + Buffer.byteLength(f.content, "utf-8"), 0);
  console.log(`built ${outFile}`);
  console.log(`  taskId: ${meta.taskId}`);
  console.log(`  files:  ${files.length} (${totalBytes.toLocaleString()} bytes)`);
  console.log(`  tests:  ${meta.tests.length}`);
  console.log(`  notes:  ${meta.notes.length}`);
}

async function* walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      yield* walk(full);
    } else if (e.isFile()) {
      yield full;
    }
  }
}

function bail(msg) {
  console.error(`build-task-fixture: ${msg}`);
  process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
