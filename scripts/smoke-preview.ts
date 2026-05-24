// scripts/smoke-preview.ts
//
// Fast smoke for the workspace-scaffold + preview-dev-server machinery,
// without paying the cost of a full LLM pipeline run.
//
//   1. scaffoldWorkspace() into a throwaway project id
//   2. verify configs + layout + globals + symlinked node_modules
//   3. startPreview() — spawns a real `next dev` child process
//   4. fetch the URL — assert HTTP 200
//   5. stopPreview() — confirm it dies cleanly
//
// Run with: node scripts/smoke-preview.ts

import { promises as fs } from "node:fs";
import path from "node:path";
import {
  scaffoldWorkspace,
  workspaceDir,
  writeWorkspaceFile,
} from "../lib/platform/preview/scaffolder.ts";
import {
  getPreviewStatus,
  startPreview,
  stopPreview,
} from "../lib/platform/preview/dev-server.ts";

const PROJECT_ID = "prj-smoke-preview";

function ok(msg: string): void {
  console.log(`  ✓ ${msg}`);
}
function fail(msg: string): never {
  console.error(`  ✗ ${msg}`);
  process.exit(1);
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  console.log(`\n== Smoke: scaffold + preview dev-server (${PROJECT_ID}) ==\n`);

  // ----- 1. Scaffold -----
  console.log("1. Scaffolding workspace…");
  const dir = await scaffoldWorkspace(PROJECT_ID, "SmokePreviewApp");
  console.log(`   workspace dir: ${dir}`);

  const expected = [
    "package.json",
    "next.config.js",
    "tsconfig.json",
    "tailwind.config.ts",
    "postcss.config.js",
    "app/layout.tsx",
    "app/globals.css",
    "app/page.tsx",
    "node_modules",
  ];
  for (const f of expected) {
    if (!(await exists(path.join(dir, f)))) fail(`missing: ${f}`);
  }
  ok(`${expected.length} boilerplate files present`);

  // Verify node_modules is a symlink (not a copy).
  const stat = await fs.lstat(path.join(dir, "node_modules"));
  if (!stat.isSymbolicLink()) fail("node_modules is NOT a symlink — install would be slow");
  ok("node_modules is symlinked to platform root");

  // Sanity: layout has the project name
  const layout = await fs.readFile(path.join(dir, "app/layout.tsx"), "utf8");
  if (!layout.includes("SmokePreviewApp")) fail("layout doesn't include project name");
  ok("layout.tsx has the project name");

  // ----- 2. Write a feature file via writeWorkspaceFile -----
  console.log("\n2. Writing a custom feature page via writeWorkspaceFile…");
  const customPage = `export default function Page() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-emerald-400">
          Smoke-preview is working
        </h1>
        <p className="mt-3 text-zinc-400">
          Custom content written via writeWorkspaceFile.
        </p>
      </div>
    </main>
  );
}
`;
  const r = await writeWorkspaceFile(PROJECT_ID, "app/page.tsx", customPage);
  if (!r.ok) fail(`writeWorkspaceFile rejected: ${r.reason}`);
  ok("custom app/page.tsx written");

  // Path-escape rejection check
  const escape = await writeWorkspaceFile(PROJECT_ID, "../etc/passwd", "boom");
  if (escape.ok) fail("path-escape should have been rejected");
  ok("path traversal rejected");

  const offlist = await writeWorkspaceFile(PROJECT_ID, "secrets.env", "boom");
  if (offlist.ok) fail("off-allowlist write should have been rejected");
  ok("off-allow-list write rejected");

  // ----- 3. Boot the preview -----
  console.log("\n3. Booting `next dev` for the workspace…");
  const t0 = Date.now();
  const state = await startPreview(PROJECT_ID);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`   start took ${elapsed}s, status=${state.status}, port=${state.port}, url=${state.url}`);

  if (state.status !== "ready") {
    console.error("   log tail:");
    console.error(state.logTail ?? "(no log)");
    fail(`expected status=ready, got ${state.status}: ${state.errorMessage ?? ""}`);
  }
  ok(`preview ready at ${state.url}`);

  // ----- 4. Fetch the URL -----
  console.log("\n4. Fetching the rendered page…");
  if (!state.url) fail("no URL on ready state");
  const resp = await fetch(state.url);
  console.log(`   HTTP ${resp.status}`);
  if (!resp.ok) fail(`expected 200, got ${resp.status}`);
  const html = await resp.text();
  if (!html.includes("Smoke-preview is working")) {
    fail("rendered HTML missing our custom h1");
  }
  ok("rendered HTML contains our custom h1 — Next.js is serving the workspace");

  // ----- 5. Stop the preview -----
  console.log("\n5. Stopping the preview…");
  const stopped = await stopPreview(PROJECT_ID);
  if (stopped.status !== "idle") fail(`expected idle after stop, got ${stopped.status}`);
  // Give the OS a beat to release the port.
  await new Promise((r) => setTimeout(r, 500));
  ok("preview stopped cleanly");

  // ----- 6. Verify status reflects no server -----
  const after = getPreviewStatus(PROJECT_ID);
  if (after.status !== "idle") fail(`expected idle status, got ${after.status}`);
  ok("getPreviewStatus reports idle");

  console.log("\n== All preview smoke checks passed. ==\n");
}

main().catch((err) => {
  console.error("Smoke threw:", err);
  process.exit(1);
});
