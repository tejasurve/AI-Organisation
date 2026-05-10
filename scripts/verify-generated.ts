// scripts/verify-generated.ts
//
// Verify generated/{taskId}/ deliverables by:
//   1. Locating REPORT.md and parsing the embedded Developer JSON to recover
//      the developer's vitest tests (which are not written to disk by the
//      pipeline today).
//   2. Spinning up a sandbox project at ~/.cache/ai-organisation/verify-sandbox
//      with drizzle-orm + vitest + typescript installed (cached across runs
//      via a deps hash so subsequent verifications skip npm install).
//   3. Copying the generated *.ts files into the sandbox and materialising the
//      developer's tests as co-located *.test.ts files.
//   4. Running `tsc --noEmit` against the generated files (proves they
//      compile against the *real* drizzle-orm types, not the agent's mental
//      model).
//   5. Running `vitest run` against the materialised tests (proves the
//      developer's own assertions actually hold when executed).
//   6. Appending (or replacing) a `## Verification` section in REPORT.md with
//      the pass/fail summary, durations, and captured output.
//
// Constraints honoured:
//   - lib/runtime/pipeline.ts is NOT touched.
//   - No new persistent files in generated/{taskId}/ beyond an in-place
//     update of REPORT.md.
//   - Pure helpers live in lib/runtime/verify-helpers.ts and are unit-tested
//     by scripts/test-runtime.ts.
//
// Usage:
//   node scripts/verify-generated.ts <taskId> [--generated <dir>] [--no-cache]
//                                              [--keep-sandbox]
//                                              [--no-report-write] [--quiet]

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  formatVerificationMarkdown,
  parseDeveloperOutputFromReport,
  upsertVerificationSection,
  type VerificationResult,
  type VerificationStep,
} from "../lib/runtime/verify-helpers.ts";
import { colors as c } from "../lib/runtime/logger.ts";

interface CLIArgs {
  taskId?: string;
  generatedDir?: string;
  cache: boolean;
  keepSandbox: boolean;
  writeReport: boolean;
  quiet: boolean;
  help: boolean;
}

const SANDBOX_DEPS = {
  "drizzle-orm": "^0.44.0",
  vitest: "^3.2.0",
  typescript: "^5.6.3",
  "@types/node": "^22.0.0",
} as const;

const SANDBOX_TSCONFIG = {
  compilerOptions: {
    target: "ES2022",
    module: "NodeNext",
    moduleResolution: "NodeNext",
    strict: true,
    skipLibCheck: true,
    noEmit: true,
    allowImportingTsExtensions: true,
    esModuleInterop: true,
    resolveJsonModule: true,
    types: ["node"],
  },
  include: ["src/**/*.ts"],
} as const;

const SANDBOX_VITEST_CONFIG = `import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    reporters: "default",
    passWithNoTests: false,
  },
});
`;

const args = parseArgs(process.argv.slice(2));
if (args.help || !args.taskId) {
  printUsage();
  process.exit(args.help ? 0 : 2);
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const generatedDir = resolve(repoRoot, args.generatedDir ?? "generated");
const taskDir = resolve(generatedDir, args.taskId);
const reportPath = join(taskDir, "REPORT.md");

if (!args.quiet) {
  console.log(c.bold(`verify-generated: ${args.taskId}`));
  console.log(`  generated dir : ${taskDir}`);
  console.log(`  report path   : ${reportPath}`);
}

await assertExists(taskDir, "generated task directory");
await assertExists(reportPath, "REPORT.md");

const reportMd = await readFile(reportPath, "utf-8");
const developer = parseDeveloperOutputFromReport(reportMd, args.taskId);

const tsFiles = await listGeneratedTsFiles(taskDir);
if (tsFiles.length === 0) fail(`no .ts files found under ${taskDir} to verify`);

if (!args.quiet) {
  console.log(`  generated .ts : ${tsFiles.length} file(s)`);
  console.log(`  dev tests     : ${developer.tests.length} test file(s)`);
}

const startedAt = new Date();

// ---------- sandbox provisioning ----------

const cacheRoot = resolve(homedir(), ".cache", "ai-organisation", "verify-sandbox");
await mkdir(cacheRoot, { recursive: true });

const depsHash = hashDeps(SANDBOX_DEPS);
const persistentSandbox = resolve(cacheRoot, depsHash);
const sandbox = args.cache ? persistentSandbox : await mkdtemp(join(tmpdir(), "ai-org-verify-"));
const cached = args.cache && (await isInstalled(sandbox));

if (!args.quiet) {
  console.log(`  sandbox       : ${sandbox} (${cached ? c.green("cache hit") : c.yellow("fresh install")})`);
}

await mkdir(sandbox, { recursive: true });

// (re)write package.json + tsconfig.json + vitest.config.ts every run so the
// sandbox can never drift from what this script expects.
await writeFile(
  join(sandbox, "package.json"),
  JSON.stringify(
    {
      name: "ai-org-verify-sandbox",
      private: true,
      type: "module",
      version: "0.0.0",
      devDependencies: SANDBOX_DEPS,
    },
    null,
    2,
  ) + "\n",
  "utf-8",
);
await writeFile(join(sandbox, "tsconfig.json"), JSON.stringify(SANDBOX_TSCONFIG, null, 2) + "\n", "utf-8");
await writeFile(join(sandbox, "vitest.config.ts"), SANDBOX_VITEST_CONFIG, "utf-8");

if (!cached) {
  // Fresh install. Print live progress so the user sees that npm is doing
  // something — install is the slow step (10s–60s).
  if (!args.quiet) console.log(`  ${c.dim("running npm install (sandbox deps)...")}`);
  const r = await runCommand("npm", ["install", "--no-audit", "--no-fund", "--silent"], { cwd: sandbox });
  if (r.exitCode !== 0) {
    fail(`sandbox npm install failed (exit ${r.exitCode}):\n${r.output}`);
  }
}

// Wipe and rewrite src/ on every run so removed files don't linger.
const srcDir = join(sandbox, "src");
await rm(srcDir, { recursive: true, force: true });
await mkdir(srcDir, { recursive: true });

for (const f of tsFiles) {
  const dest = join(srcDir, f.relativePath);
  await mkdir(dirname(dest), { recursive: true });
  await copyFile(f.absolutePath, dest);
}

// Materialise the developer's tests next to the generated code so that any
// `import { signups } from "./signups.ts"` in their test resolves.
//
// Heuristic: each developer.tests[i] is a self-contained test file.
//   - First test of taskId t-signup-storage-1 → src/lib/db/schema/signups.test.ts
//   - Subsequent tests → src/__verify_tests__/dev-test-{i}.test.ts
//
// We co-locate the FIRST test with the developer's first generated *.ts file
// (its likely target). This matches the convention in developer.output.json.
let placedFirstTest = false;
for (let i = 0; i < developer.tests.length; i++) {
  const t = developer.tests[i];
  const filename = guessTestFilename(developer, i, placedFirstTest);
  const dest = join(srcDir, filename);
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, t.code, "utf-8");
  placedFirstTest = true;
}

// ---------- typecheck ----------

const tscStarted = Date.now();
const tscResult = await runCommand(
  "npx",
  ["--no-install", "tsc", "--noEmit"],
  { cwd: sandbox },
);
const typecheck: VerificationStep = {
  name: "tsc --noEmit (against real drizzle-orm types)",
  status: tscResult.exitCode === 0 ? "pass" : "fail",
  durationMs: Date.now() - tscStarted,
  details:
    tscResult.exitCode === 0
      ? `${tsFiles.length} .ts file(s) compile cleanly`
      : `tsc exited ${tscResult.exitCode}`,
  output: tscResult.output.trim() || undefined,
};

// ---------- tests ----------

let tests: VerificationStep;
if (developer.tests.length === 0) {
  tests = {
    name: "vitest run",
    status: "skipped",
    durationMs: 0,
    details: "developer produced 0 tests; nothing to execute",
  };
} else if (typecheck.status === "fail") {
  tests = {
    name: "vitest run",
    status: "skipped",
    durationMs: 0,
    details: "skipped because typecheck failed",
  };
} else {
  const vitestStarted = Date.now();
  const vitestResult = await runCommand(
    "npx",
    ["--no-install", "vitest", "run", "--reporter=default"],
    { cwd: sandbox },
  );
  tests = {
    name: "vitest run (developer-authored tests)",
    status: vitestResult.exitCode === 0 ? "pass" : "fail",
    durationMs: Date.now() - vitestStarted,
    details:
      vitestResult.exitCode === 0
        ? `${developer.tests.length} test file(s) executed and passed`
        : `vitest exited ${vitestResult.exitCode}`,
    output: vitestResult.output.trim() || undefined,
  };
}

// ---------- result + REPORT.md update ----------

const finishedAt = new Date();
const result: VerificationResult = {
  taskId: args.taskId,
  sandboxPath: sandbox,
  cached,
  typecheck,
  tests,
  startedAt,
  finishedAt,
};
const sectionMd = formatVerificationMarkdown(result);

if (args.writeReport) {
  const updated = upsertVerificationSection(reportMd, sectionMd);
  await writeFile(reportPath, updated, "utf-8");
}

// ---------- console summary ----------

if (!args.quiet) {
  console.log("");
  console.log(c.bold("Verification result"));
  printStep(typecheck);
  printStep(tests);
  console.log(`  total         : ${finishedAt.getTime() - startedAt.getTime()} ms`);
  if (args.writeReport) {
    console.log(`  ${c.bold("Report")}    : ${reportPath} (Verification section ${reportMd.includes("\n## Verification\n") ? "replaced" : "appended"})`);
  }
}

if (!args.cache && !args.keepSandbox) {
  await rm(sandbox, { recursive: true, force: true });
}

const overallFail = typecheck.status === "fail" || tests.status === "fail";
process.exit(overallFail ? 1 : 0);

// ---------- helpers ----------

function parseArgs(argv: readonly string[]): CLIArgs {
  const out: CLIArgs = {
    cache: true,
    keepSandbox: false,
    writeReport: true,
    quiet: false,
    help: false,
  };
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "-h":
      case "--help":
        out.help = true;
        break;
      case "--generated":
        out.generatedDir = requireValue(a, argv[++i]);
        break;
      case "--no-cache":
        out.cache = false;
        break;
      case "--keep-sandbox":
        out.keepSandbox = true;
        break;
      case "--no-report-write":
        out.writeReport = false;
        break;
      case "--quiet":
        out.quiet = true;
        break;
      default:
        if (a.startsWith("--")) fail(`unknown flag: ${a}`);
        positional.push(a);
    }
  }
  if (positional.length > 1) fail(`expected 1 positional argument (taskId), got ${positional.length}: ${positional.join(", ")}`);
  out.taskId = positional[0];
  return out;
}

function requireValue(flag: string, v: string | undefined): string {
  if (v == null || v.startsWith("--")) fail(`flag ${flag} requires a value`);
  return v;
}

function printUsage(): void {
  console.log(`Usage:
  node scripts/verify-generated.ts <taskId> [options]

Options:
  --generated <dir>      Root containing {taskId}/REPORT.md (default: ./generated)
  --no-cache             Don't reuse the cached sandbox at ~/.cache/ai-organisation/verify-sandbox
                         (forces a fresh tmp dir + npm install)
  --keep-sandbox         When --no-cache is set, don't delete the tmp sandbox
                         after verification (useful for debugging failures)
  --no-report-write      Don't update REPORT.md; only print the result
  --quiet                Suppress progress output (still prints failure summary)
  -h, --help             Show this message

What it does:
  1. Reads generated/{taskId}/REPORT.md and parses the embedded Developer JSON.
  2. Provisions a cached sandbox with drizzle-orm + vitest + typescript.
  3. Copies the generated *.ts files into the sandbox.
  4. Materialises the developer's tests as co-located *.test.ts files.
  5. Runs tsc --noEmit (typecheck against real drizzle-orm types).
  6. Runs vitest run (executes the developer's own tests for real).
  7. Appends a "## Verification" section to REPORT.md with the result.

Exit codes:
  0  typecheck and tests both pass (or tests are absent)
  1  typecheck or tests failed
  2  invalid invocation
`);
}

function fail(msg: string): never {
  console.error(c.red(`verify-generated: ${msg}`));
  process.exit(2);
}

async function assertExists(p: string, label: string): Promise<void> {
  try {
    await stat(p);
  } catch {
    fail(`${label} not found at ${p}`);
  }
}

interface GeneratedFile {
  absolutePath: string;
  relativePath: string;
}

async function listGeneratedTsFiles(rootDir: string): Promise<GeneratedFile[]> {
  const out: GeneratedFile[] = [];
  async function walk(d: string): Promise<void> {
    const entries = await readdir(d, { withFileTypes: true });
    for (const entry of entries) {
      const abs = join(d, entry.name);
      if (entry.isDirectory()) {
        await walk(abs);
      } else if (entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
        out.push({ absolutePath: abs, relativePath: relative(rootDir, abs) });
      }
    }
  }
  await walk(rootDir);
  return out.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

function hashDeps(deps: Record<string, string>): string {
  // Stable hash so the same dep set always reuses the same sandbox dir.
  const sorted = Object.entries(deps)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}@${v}`)
    .join(",");
  return createHash("sha256").update(sorted).digest("hex").slice(0, 16);
}

async function isInstalled(sandbox: string): Promise<boolean> {
  try {
    await stat(join(sandbox, "node_modules", "vitest"));
    await stat(join(sandbox, "node_modules", "drizzle-orm"));
    return true;
  } catch {
    return false;
  }
}

interface CommandResult {
  exitCode: number;
  output: string;
}

async function runCommand(
  cmd: string,
  argv: readonly string[],
  opts: { cwd: string },
): Promise<CommandResult> {
  return new Promise((resolveP) => {
    const child = spawn(cmd, argv, { cwd: opts.cwd, env: process.env });
    let buf = "";
    child.stdout.on("data", (d) => (buf += d.toString()));
    child.stderr.on("data", (d) => (buf += d.toString()));
    child.on("close", (code) => resolveP({ exitCode: code ?? 0, output: buf }));
    child.on("error", (err) => resolveP({ exitCode: 1, output: `${buf}\n[spawn error] ${err.message}` }));
  });
}

function guessTestFilename(developer: { files: { path: string }[] }, testIndex: number, placedFirst: boolean): string {
  if (testIndex === 0 && !placedFirst) {
    const target = developer.files.find((f) => !f.path.endsWith("/index.ts") && !f.path.endsWith("\\index.ts"));
    const base = target?.path ?? developer.files[0]?.path ?? "verify";
    return base.replace(/\.ts$/, "") + ".test.ts";
  }
  return join("__verify_tests__", `dev-test-${testIndex + 1}.test.ts`);
}

function printStep(s: VerificationStep): void {
  const badge = s.status === "pass" ? c.green("\u2713 " + s.status) : s.status === "fail" ? c.red("\u2717 " + s.status) : c.dim("\u25cb " + s.status);
  console.log(`  ${badge.padEnd(10)} ${s.name}  ${c.dim(`(${s.durationMs} ms)`)}${s.details ? c.dim("  — " + s.details) : ""}`);
  if (s.status === "fail" && s.output) {
    console.log(c.red(s.output.split("\n").map((l) => "      " + l).join("\n")));
  }
}
