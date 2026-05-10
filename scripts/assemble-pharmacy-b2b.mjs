#!/usr/bin/env node
// scripts/assemble-pharmacy-b2b.mjs
//
// Assemble examples/pharmacy-b2b/ from the AI-org pipeline outputs for the
// pharmacy-b2b scenario. Each of the 10 developer tasks owns a disjoint
// slice of the final Next.js app, so assembly is a pure copy operation
// (no merges, no conflicts):
//
//   t-shell-1     → package.json, tsconfig.json, next/postcss/tailwind configs,
//                   next-env.d.ts, app/globals.css, app/layout.tsx, app/page.tsx (login)
//   t-shell-2     → lib/auth/session.ts, app/api/auth/login + logout, middleware.ts,
//                   app/dashboard/{layout.tsx,page.tsx}, components/BottomTabBar.tsx
//   t-data-1      → lib/types.ts, lib/db/store.ts
//   t-home-1      → app/api/medicines/search, app/api/distributors, app/api/offers
//   t-home-2      → app/dashboard/home/page.tsx, app/dashboard/search/page.tsx,
//                   components/SearchBar.tsx, components/MedicineRow.tsx
//   t-cart-1      → lib/api/cart-response.ts, app/api/cart/* (GET/POST/DELETE)
//   t-cart-2      → app/dashboard/cart/page.tsx, components/CartView.tsx
//   t-orders-1    → app/api/orders/route.ts
//   t-orders-2    → app/dashboard/orders/page.tsx
//   t-profile-1   → app/api/profile/route.ts, app/dashboard/profile/page.tsx,
//                   components/LogoutButton.tsx
//
// REPORT.md and REPORT.pdf for every task land in examples/pharmacy-b2b/_reports/
// so the provenance trail follows the code into the assembled app.
//
// Usage:
//   node scripts/assemble-pharmacy-b2b.mjs
//   node scripts/assemble-pharmacy-b2b.mjs --target /tmp/some-other-dir
//
// Exit 0 = clean assembly, 1 = a required task is missing from generated/.

import {
  copyFile,
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { runPipeline } from "../lib/runtime/pipeline.ts";
import { FixtureAgentRunner } from "../lib/runtime/agent-runner.ts";
import { TaskRoutingRunner } from "../lib/runtime/task-routing-runner.ts";
import { noopLogger } from "../lib/runtime/logger.ts";
import { formatProjectReportPdf } from "../lib/runtime/project-report-pdf.ts";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_TARGET = resolve(REPO_ROOT, "examples", "pharmacy-b2b");
const SCENARIO_DIR = resolve(REPO_ROOT, "fixtures", "scenarios", "pharmacy-b2b");
const PROJECT_IDEA = "Build a B2B application for pharmacy retailers to place orders to distributors. 4-tab dashboard (Home, Orders, Cart, Profile) with mock retail-license auth.";

const TASKS = [
  { id: "t-shell-1", label: "Next.js + Tailwind skeleton + login page" },
  { id: "t-shell-2", label: "Mock auth + dashboard layout + bottom tab bar" },
  { id: "t-data-1", label: "In-memory data spine + shared types" },
  { id: "t-home-1", label: "Medicines search / distributors / offers APIs" },
  { id: "t-home-2", label: "Home tab UI + search results page" },
  { id: "t-cart-1", label: "Cart APIs (GET / POST / DELETE)" },
  { id: "t-cart-2", label: "Cart tab UI" },
  { id: "t-orders-1", label: "Orders APIs (GET grouped + POST place-order)" },
  { id: "t-orders-2", label: "Orders tab UI (Active / Closed sub-tabs)" },
  { id: "t-profile-1", label: "Profile API + Profile tab UI" },
];

const args = parseArgs(process.argv.slice(2));
const targetDir = resolve(args.target ?? DEFAULT_TARGET);
const generatedRoot = resolve(REPO_ROOT, "generated");

console.log(`assemble-pharmacy-b2b`);
console.log(`  generated root : ${generatedRoot}`);
console.log(`  target         : ${targetDir}`);
console.log(``);

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
  console.error(`         node scripts/run-pipeline.ts --scenario fixtures/scenarios/pharmacy-b2b --task ${missing[0]}`);
  process.exit(1);
}

// Wipe everything in the target dir EXCEPT the developer-experience
// artefacts (node_modules / .next / package-lock.json) so that re-running
// the assembly while a dev server has .next files locked does not nuke
// the install. The pipeline owns every other file.
const PRESERVED = new Set(["node_modules", ".next", "package-lock.json"]);
try {
  const entries = await readdir(targetDir);
  for (const name of entries) {
    if (PRESERVED.has(name)) continue;
    await rm(join(targetDir, name), { recursive: true, force: true });
  }
} catch (e) {
  if ((e && e.code) !== "ENOENT") throw e;
  await mkdir(targetDir, { recursive: true });
}
await mkdir(targetDir, { recursive: true });

let totalCopied = 0;
let totalBytes = 0;
const reportTargets = [];
const taskFileMap = new Map(); // task.id -> [relative paths]
const assembledFiles = []; // for project-report-pdf inventory

for (const t of TASKS) {
  const taskDir = join(generatedRoot, t.id);
  const files = await listAllFiles(taskDir);
  console.log(`task ${t.id} (${t.label}): ${files.length} file(s)`);
  taskFileMap.set(t.id, []);

  for (const f of files) {
    const rel = relative(taskDir, f);
    if (rel === "REPORT.md" || rel === "REPORT.pdf") {
      const ext = rel === "REPORT.md" ? "md" : "pdf";
      const dest = join(targetDir, "_reports", `${t.id}.REPORT.${ext}`);
      await mkdir(dirname(dest), { recursive: true });
      await copyFile(f, dest);
      reportTargets.push(dest);
      console.log(`  REPORT.${ext}    → _reports/${t.id}.REPORT.${ext}`);
      continue;
    }
    const dest = join(targetDir, rel);
    await mkdir(dirname(dest), { recursive: true });
    await copyFile(f, dest);
    const s = await stat(dest);
    const lines = await countLines(dest);
    totalCopied++;
    totalBytes += s.size;
    taskFileMap.get(t.id).push({ rel, size: s.size });
    assembledFiles.push({ path: rel, bytes: s.size, lines, sourceTaskId: t.id });
    console.log(`  + ${rel}  (${s.size} bytes, ${lines} lines)`);
  }
}

const readmePath = join(targetDir, "README.md");
await writeFile(readmePath, buildReadme(TASKS, taskFileMap), "utf-8");

// ---------- consolidated project PDF ----------

console.log(``);
console.log(`re-running pipeline in-memory for each task to collect PipelineResult[] for the consolidated PDF...`);

const baseRunner = new FixtureAgentRunner(SCENARIO_DIR);
const runs = [];
for (const t of TASKS) {
  const tmp = join(generatedRoot, "_pdf-scratch", t.id);
  await rm(tmp, { recursive: true, force: true });
  await mkdir(tmp, { recursive: true });
  const runner = new TaskRoutingRunner({ inner: baseRunner, scenarioDir: SCENARIO_DIR, targetTaskId: t.id });
  const result = await runPipeline(PROJECT_IDEA, {
    agentRunner: runner,
    generatedDir: tmp,
    logger: noopLogger(),
  });
  runs.push(result);
  if (result.decision !== "WROTE_FILES") {
    console.log(`  warn: task ${t.id} re-ran with decision=${result.decision} (project PDF will reflect this)`);
  }
}
await rm(join(generatedRoot, "_pdf-scratch"), { recursive: true, force: true });

const projectPdfBuf = await formatProjectReportPdf({
  projectName: "Pharmacy B2B",
  idea: PROJECT_IDEA,
  runs,
  assembledFiles,
  outputDir: relative(REPO_ROOT, targetDir) || targetDir,
  howToRun: [
    `cd ${relative(REPO_ROOT, targetDir) || targetDir}`,
    "npm install",
    "npm run dev",
    "# open http://localhost:3000",
  ],
  userJourney: [
    "Open http://localhost:3000 in your browser",
    "Sign in with the pre-filled retail license MH-RP-2024-7821",
    "On the Home tab, browse the offers carousel and quick links",
    "Use the search bar at the top - type 'paracet' and press Enter",
    "Tap 'Add to cart' on Paracetamol 500mg",
    "Tap the Cart tab in the bottom bar - review items grouped by distributor",
    "Tap 'Place order' - the cart fans out into one order per distributor",
    "Tap the Orders tab - your new order appears under Active",
    "Tap the Profile tab to view store details and outstanding payments",
    "Tap 'Sign out' at the bottom of the Profile tab",
  ],
  credentials: [
    { label: "URL", value: "http://localhost:3000" },
    { label: "Retail license", value: "MH-RP-2024-7821" },
    { label: "Pilot retailer", value: "Anuradha Medicals, Pune" },
  ],
  taskLabels: Object.fromEntries(TASKS.map((t) => [t.id, t.label])),
});
const projectPdfPath = join(targetDir, "REPORT.pdf");
await writeFile(projectPdfPath, projectPdfBuf);
console.log(`  + REPORT.pdf  (${projectPdfBuf.length} bytes)  <- consolidated project report`);

console.log(``);
console.log(`assembled ${totalCopied} files (${(totalBytes / 1024).toFixed(1)} KB total) into ${targetDir}`);
console.log(`provenance: ${reportTargets.length} per-task report file(s) copied to _reports/`);
console.log(`consolidated: REPORT.pdf at ${relative(process.cwd(), projectPdfPath) || projectPdfPath} (${(projectPdfBuf.length / 1024).toFixed(1)} KB)`);
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
      console.log("Usage: node scripts/assemble-pharmacy-b2b.mjs [--target <dir>]");
      process.exit(0);
    } else {
      console.error(`unknown arg: ${a}`);
      process.exit(2);
    }
  }
  return out;
}

async function countLines(filePath) {
  try {
    const buf = await readFile(filePath, "utf-8");
    if (buf.length === 0) return 0;
    let n = 0;
    for (let i = 0; i < buf.length; i++) if (buf.charCodeAt(i) === 10) n++;
    if (buf.charCodeAt(buf.length - 1) !== 10) n++;
    return n;
  } catch {
    return 0;
  }
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

function buildReadme(tasks, taskFileMap) {
  const provenance = tasks
    .map((t) => {
      const files = taskFileMap.get(t.id) ?? [];
      const fileList = files.length === 0
        ? "  - _(no source files - report-only)_"
        : files.map((f) => `  - \`${f.rel}\``).join("\n");
      return `### ${t.id} - ${t.label}

- Report: [\`_reports/${t.id}.REPORT.md\`](./_reports/${t.id}.REPORT.md) | [PDF](./_reports/${t.id}.REPORT.pdf)
- Files (${files.length}):
${fileList}`;
    })
    .join("\n\n");

  return `# Pharmacy B2B - assembled Next.js app

This directory was **assembled by \`scripts/assemble-pharmacy-b2b.mjs\`** from the AI-organisation pipeline's generated outputs. **Do not edit files in place** - every \`.ts\`, \`.tsx\`, \`.json\`, \`.mjs\`, and \`.css\` here was written by the pipeline (CEO -> CTO -> Engineering Manager -> Developer -> QA -> Cybersecurity, all with PASS / GO verdicts) and is overwritten on the next assembly run.

- Consolidated project report: [\`./REPORT.pdf\`](./REPORT.pdf) - cover, decision matrix, full strategy chapters, per-task chapters, file inventory, how-to-run.
- Per-task provenance: [\`./_reports/\`](./_reports/) - one Markdown + one PDF report per task.

## What this app does

A B2B web app for retail pharmacists. After signing in with their license number, the retailer lands on a 4-tab dashboard:

- **Home** - search bar at the top, horizontal carousel of distributor offers, 5 quick-link tiles (Distributors, Schemes, Generic Medicines, Scan Prescription, Outstanding Payments), and a summary of outstanding balances.
- **Orders** - segmented Active / Closed sub-tabs with order cards (distributor, status pill, items, total, placed-relative time, expected delivery).
- **Cart** - items grouped by distributor with per-distributor subtotal, sticky grand total + Place Order button. Place Order fans the cart out into one order per distributor.
- **Profile** - retailer card (store name, owner, license, GSTIN, address, phone, email, favourites) and per-distributor outstanding-payments breakdown. Sign-out button.

## Run it

\`\`\`bash
npm install
npm run dev
# then open http://localhost:3000
\`\`\`

The pre-filled license on the login screen (\`MH-RP-2024-7821\`) matches the seeded pilot retailer (Anuradha Medicals, Pune), so a fresh \`npm run dev\` works end-to-end on the first try. Click **Sign in** and you'll land on the Home tab.

Try the loop:

1. Tap the search bar, type \`paracet\`, press Enter.
2. **Add to cart** on Paracetamol 500mg.
3. Bottom tab bar -> **Cart**. The line shows up grouped under its distributor.
4. **Place order ({n})** at the bottom. You'll be routed to **Orders** -> Active where the new order appears at the top.
5. Bottom tab bar -> **Profile** to see your store details and outstanding balances. **Sign out** at the bottom.

## Architecture

- **Next.js 14** (App Router) + **Tailwind CSS** + **TypeScript 5**
- All data lives in **in-memory Maps** seeded at boot (\`lib/db/store.ts\`) - no Postgres / Redis / external services required for the demo
- Authentication is a **mock cookie session** (POST /api/auth/login looks up the retailer by license number, sets the \`pharmacy-session\` cookie). \`middleware.ts\` gates \`/dashboard/*\` and \`/api/*\` (except \`/api/auth/login\`).
- Every authenticated route handler **also** calls \`getSession()\` for defence in depth on top of the middleware.
- Money is stored as integer paise everywhere; \`paiseToRupees\` formats with Indian numbering (1,23,45,678).

## Provenance

Every file in this directory traces back to one of these AI-org pipeline runs:

${provenance}

## Regenerate

To regenerate any file, re-run its pipeline:

\`\`\`bash
node scripts/run-pipeline.ts --scenario fixtures/scenarios/pharmacy-b2b --task <taskId>
node scripts/assemble-pharmacy-b2b.mjs
\`\`\`

To regenerate everything from scratch:

\`\`\`bash
for t in t-shell-1 t-shell-2 t-data-1 t-home-1 t-home-2 t-cart-1 t-cart-2 t-orders-1 t-orders-2 t-profile-1; do
  node scripts/run-pipeline.ts --scenario fixtures/scenarios/pharmacy-b2b --task $t --quiet || break
done
node scripts/assemble-pharmacy-b2b.mjs
\`\`\`
`;
}
