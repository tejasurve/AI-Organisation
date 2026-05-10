#!/usr/bin/env node
// scripts/assemble-saas-landing-page.mjs
//
// Assemble examples/saas-landing-page-next/ from the AI-org pipeline outputs.
//
// Each of the 4 developer tasks owns a disjoint slice of the final Next.js
// app, so assembly is a pure copy operation (no merges, no conflicts):
//
//   t-signup-storage-1  →  lib/db/schema/{index.ts,signups.ts}
//   t-signup-storage-2  →  app/api/signup/route.ts + lib/db/client.ts
//   t-landing-page-1    →  package.json, configs, app/layout.tsx, app/globals.css, next-env.d.ts
//   t-landing-page-3    →  app/page.tsx
//
// REPORT.md files are copied to examples/saas-landing-page-next/_reports/
// so the provenance trail follows the code into the assembled app.
//
// Usage:
//   node scripts/assemble-saas-landing-page.mjs
//   node scripts/assemble-saas-landing-page.mjs --target /tmp/some-other-dir
//
// Exit 0 = clean assembly, 1 = a required task is missing from generated/.

import {
  copyFile,
  mkdir,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_TARGET = resolve(REPO_ROOT, "examples", "saas-landing-page-next");

const TASKS = [
  {
    id: "t-signup-storage-1",
    label: "Drizzle schema",
  },
  {
    id: "t-signup-storage-2",
    label: "Next.js Route Handler + storage adapter",
  },
  {
    id: "t-landing-page-1",
    label: "Next.js + Tailwind project skeleton",
  },
  {
    id: "t-landing-page-3",
    label: "Landing page UI",
  },
];

const args = parseArgs(process.argv.slice(2));
const targetDir = resolve(args.target ?? DEFAULT_TARGET);
const generatedRoot = resolve(REPO_ROOT, "generated");

console.log(`assemble-saas-landing-page`);
console.log(`  generated root : ${generatedRoot}`);
console.log(`  target         : ${targetDir}`);
console.log(``);

// Validate that every task has a generated directory before we touch the
// target. Fail loudly if a task is missing — that means the user ran assembly
// before all 4 pipelines completed.
const missing = [];
for (const t of TASKS) {
  const dir = join(generatedRoot, t.id);
  try {
    await stat(dir);
  } catch {
    missing.push(t.id);
  }
}
if (missing.length > 0) {
  console.error(`error: missing generated/{taskId}/ for: ${missing.join(", ")}`);
  console.error(`hint:  run the pipeline for each missing task first, e.g.`);
  console.error(`         node scripts/run-pipeline.ts --scenario fixtures/scenarios/saas-landing-page --task ${missing[0]}`);
  process.exit(1);
}

// Wipe and recreate the target so removed files don't linger.
await rm(targetDir, { recursive: true, force: true });
await mkdir(targetDir, { recursive: true });

let totalCopied = 0;
let totalBytes = 0;
const reportTargets = [];

for (const t of TASKS) {
  const taskDir = join(generatedRoot, t.id);
  const files = await listAllFiles(taskDir);
  console.log(`task ${t.id} (${t.label}): ${files.length} file(s)`);
  for (const f of files) {
    const rel = relative(taskDir, f);
    if (rel === "REPORT.md") {
      const dest = join(targetDir, "_reports", `${t.id}.REPORT.md`);
      await mkdir(dirname(dest), { recursive: true });
      await copyFile(f, dest);
      reportTargets.push(dest);
      console.log(`  REPORT.md     → _reports/${t.id}.REPORT.md`);
      continue;
    }
    const dest = join(targetDir, rel);
    await mkdir(dirname(dest), { recursive: true });
    await copyFile(f, dest);
    const s = await stat(dest);
    totalCopied++;
    totalBytes += s.size;
    console.log(`  + ${rel}  (${s.size} bytes)`);
  }
}

// Emit a short README pointing at the source-of-truth REPORT.md files.
const readmePath = join(targetDir, "README.md");
await writeFile(readmePath, buildReadme(TASKS, reportTargets), "utf-8");

console.log(``);
console.log(`assembled ${totalCopied} files (${totalBytes} bytes total) into ${targetDir}`);
console.log(`provenance: ${reportTargets.length} REPORT.md files copied to _reports/`);
console.log(``);
console.log(`next steps:`);
console.log(`  cd ${relative(process.cwd(), targetDir) || targetDir}`);
console.log(`  npm install`);
console.log(`  npm run dev    # then open http://localhost:3000`);

// ---------- helpers ----------

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--target") {
      out.target = argv[++i];
    } else if (a === "--help" || a === "-h") {
      console.log("Usage: node scripts/assemble-saas-landing-page.mjs [--target <dir>]");
      process.exit(0);
    } else {
      console.error(`unknown arg: ${a}`);
      process.exit(2);
    }
  }
  return out;
}

async function listAllFiles(dir) {
  const out = [];
  async function walk(d) {
    const entries = await readdir(d, { withFileTypes: true });
    for (const entry of entries) {
      const p = join(d, entry.name);
      if (entry.isDirectory()) {
        await walk(p);
      } else if (entry.isFile()) {
        out.push(p);
      }
    }
  }
  await walk(dir);
  return out.sort();
}

function buildReadme(tasks, reports) {
  const reportLinks = reports
    .map((r) => `- [${relative(dirname(r), r)}](./${relative(dirname(dirname(r)), r)})`)
    .join("\n");
  return `# saas-landing-page-next

This directory was **assembled by \`scripts/assemble-saas-landing-page.mjs\`** from the AI-organisation pipeline's generated outputs. **Do not edit files in place** — every \`.ts\`, \`.tsx\`, \`.json\`, \`.mjs\`, and \`.css\` here was written by the pipeline and is overwritten on the next assembly run. The corresponding REPORT.md (with full agent JSON, decisions, and verification result) for each contributing task lives in [\`./_reports/\`](./_reports/).

## Run it

\`\`\`bash
npm install
npm run dev
# then open http://localhost:3000
\`\`\`

Try the form. Submit \`founder@indie.com\`, then submit it again — the second submission should return \`status: 'duplicate'\` and surface as "Looks like you're already on the list…".

## Provenance

Every file in this directory traces back to one of these AI-org pipeline runs:

${tasks.map((t) => `- **${t.id}** — ${t.label}\n  - Report: [_reports/${t.id}.REPORT.md](./_reports/${t.id}.REPORT.md)`).join("\n")}

To regenerate any file, re-run its pipeline:

\`\`\`bash
node scripts/run-pipeline.ts --scenario fixtures/scenarios/saas-landing-page --task <taskId>
node scripts/assemble-saas-landing-page.mjs
\`\`\`

## Storage

\`lib/db/client.ts\` ships with an in-memory Map adapter so the demo runs with zero database setup. The Drizzle schema in \`lib/db/schema/signups.ts\` remains the source of truth for the row shape (the adapter imports \`type Signup\` from it). To upgrade to real Postgres, follow the inline notes at the top of \`lib/db/client.ts\`.
`;
}
