#!/usr/bin/env node
// scripts/run-pipeline.ts
//
// End-to-end pipeline runner for one task: Idea → CEO → CTO → EM → validate →
// Developer → QA → Security → write files.
//
// Two runner modes:
//
//   --runner fixture (default)
//     Reads canned JSON from a scenario directory. Use for deterministic
//     testing and demos that don't burn API credits.
//     Requires: --scenario <dir>
//
//   --runner llm
//     Drives real LLM calls via the pluggable LLMClient architecture. Both
//     AnthropicLLMClient (claude-* models) and OpenAILLMClient (gpt-* models)
//     are registered, so each agent's adapterConfig.model dispatches to the
//     correct provider. Cursor's built-in models are NOT used at runtime.
//     Requires: ANTHROPIC_API_KEY and/or OPENAI_API_KEY in env (only those
//     providers actually invoked by the agent chain need their key set).
//     Optional env: ANTHROPIC_MODEL_ALIAS, OPENAI_MODEL_ALIAS
//                  (format: "runtime-name=api-name[,runtime-name=api-name]")
//
// Usage:
//   node scripts/run-pipeline.ts --scenario fixtures/scenarios/waitlist-mvp
//   node scripts/run-pipeline.ts --runner llm --idea "..."
//   node scripts/run-pipeline.ts --runner llm --idea "..." --out /tmp/run-1 --verbose
//
// Exit codes:
//   0 = WROTE_FILES (full happy path; files exist on disk under the out dir)
//   1 = pipeline ran cleanly but did not write files (gate blocked or no tasks)
//   2 = misuse / runtime error (bad args, missing scenario, LLM failure, …)

import { mkdir, readFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  FixtureAgentRunner,
  LLMAgentError,
  LLMAgentRunner,
  type AgentRunner,
  type LLMCallEvent,
} from "../lib/runtime/agent-runner.ts";
import { AnthropicLLMClient } from "../lib/runtime/llm-clients/anthropic.ts";
import { OpenAILLMClient } from "../lib/runtime/llm-clients/openai.ts";
import { runPipeline, type PipelineResult } from "../lib/runtime/pipeline.ts";
import { AGENT_NAMES } from "../lib/runtime/types.ts";
import { colors as c, consoleLogger, noopLogger } from "../lib/runtime/logger.ts";

type RunnerMode = "fixture" | "llm";

interface CLIArgs {
  runner: RunnerMode;
  scenario?: string;
  out?: string;
  idea?: string;
  json: boolean;
  quiet: boolean;
  verbose: boolean;
  help: boolean;
}

const args = parseArgs(process.argv.slice(2));

if (args.help) printUsage(0);

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = absUnder(args.out ?? "generated", repoRoot);

// ---------- mode-specific setup ----------

let idea: string;
let runner: AgentRunner;
const llmEvents: LLMCallEvent[] = [];

if (args.runner === "fixture") {
  if (!args.scenario) {
    fail("--runner fixture requires --scenario <dir>");
  }
  const scenarioDir = absUnder(args.scenario!, process.cwd());
  const ideaPath = resolve(scenarioDir, "idea.txt");
  if (args.idea) {
    idea = args.idea;
  } else {
    try {
      idea = (await readFile(ideaPath, "utf-8")).trim();
    } catch (e) {
      fail(`could not read idea.txt at ${ideaPath}: ${(e as Error).message}`);
    }
  }
  const fixtureRunner = new FixtureAgentRunner(scenarioDir);
  try {
    await fixtureRunner.assertFixturesExist(AGENT_NAMES);
  } catch (e) {
    fail((e as Error).message);
  }
  runner = fixtureRunner;

  if (!args.quiet && !args.json) {
    console.log(c.bold(c.cyan("Pipeline run (fixture)")));
    console.log(`  ${c.dim("scenario:")}  ${scenarioDir}`);
    console.log(`  ${c.dim("out dir:")}   ${outDir}`);
    console.log(`  ${c.dim("idea:")}      ${truncate(idea, 78)}`);
    console.log("");
  }
} else {
  // llm mode
  if (!args.idea && !args.scenario) {
    fail("--runner llm requires --idea \"<text>\" (or --scenario <dir> to read its idea.txt)");
  }
  if (args.idea) {
    idea = args.idea;
  } else {
    const ideaPath = resolve(absUnder(args.scenario!, process.cwd()), "idea.txt");
    try {
      idea = (await readFile(ideaPath, "utf-8")).trim();
    } catch (e) {
      fail(`could not read idea.txt at ${ideaPath}: ${(e as Error).message}`);
    }
  }
  await mkdir(outDir, { recursive: true });

  const anthropicAliases = parseAliases(process.env.ANTHROPIC_MODEL_ALIAS, "ANTHROPIC_MODEL_ALIAS");
  const openaiAliases = parseAliases(process.env.OPENAI_MODEL_ALIAS, "OPENAI_MODEL_ALIAS");
  const anthropic = new AnthropicLLMClient({ modelAliases: anthropicAliases });
  const openai = new OpenAILLMClient({ modelAliases: openaiAliases });

  if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
    fail("--runner llm needs ANTHROPIC_API_KEY and/or OPENAI_API_KEY in env");
  }

  runner = new LLMAgentRunner({
    repoRoot,
    clients: [anthropic, openai],
    verbose: args.verbose,
    onCall: (e) => llmEvents.push(e),
  });

  if (!args.quiet && !args.json) {
    console.log(c.bold(c.cyan("Pipeline run (llm)")));
    console.log(`  ${c.dim("providers:")} ${providerStatus()}`);
    if (Object.keys(anthropicAliases).length) {
      console.log(`  ${c.dim("claude aliases:")} ${formatAliases(anthropicAliases)}`);
    }
    if (Object.keys(openaiAliases).length) {
      console.log(`  ${c.dim("gpt aliases:")}    ${formatAliases(openaiAliases)}`);
    }
    console.log(`  ${c.dim("out dir:")}   ${outDir}`);
    console.log(`  ${c.dim("idea:")}      ${truncate(idea, 78)}`);
    console.log("");
  }
}

const logger = args.quiet || args.json ? noopLogger() : consoleLogger();

let result: PipelineResult;
try {
  result = await runPipeline(idea, {
    agentRunner: runner,
    generatedDir: outDir,
    logger,
  });
} catch (e) {
  if (e instanceof LLMAgentError) {
    failLLM(e);
  }
  fail(`pipeline crashed: ${(e as Error).message}`);
}

if (args.json) {
  console.log(JSON.stringify(toSerialisable(result), null, 2));
} else {
  printSummary(result);
}

process.exit(exitCodeFor(result.decision));

// ---------- helpers ----------

function parseArgs(argv: readonly string[]): CLIArgs {
  const out: CLIArgs = { runner: "fixture", json: false, quiet: false, verbose: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "-h":
      case "--help":
        out.help = true;
        break;
      case "--runner": {
        const v = requireValue(a, argv[++i]);
        if (v !== "fixture" && v !== "llm") fail(`--runner must be "fixture" or "llm" (got ${JSON.stringify(v)})`);
        out.runner = v;
        break;
      }
      case "--scenario":
        out.scenario = requireValue(a, argv[++i]);
        break;
      case "--out":
        out.out = requireValue(a, argv[++i]);
        break;
      case "--idea":
        out.idea = requireValue(a, argv[++i]);
        break;
      case "--json":
        out.json = true;
        break;
      case "--quiet":
        out.quiet = true;
        break;
      case "-v":
      case "--verbose":
        out.verbose = true;
        break;
      default:
        fail(`unknown argument: ${a}`);
    }
  }
  return out;
}

function requireValue(flag: string, v: string | undefined): string {
  if (v == null || v.startsWith("--")) fail(`flag ${flag} requires a value`);
  return v;
}

function parseAliases(env: string | undefined, varName: string): Record<string, string> {
  if (!env || !env.trim()) return {};
  const out: Record<string, string> = {};
  for (const pair of env.split(",")) {
    const [from, to] = pair.split("=").map((s) => s.trim());
    if (!from || !to) {
      fail(`${varName}: malformed entry ${JSON.stringify(pair)} — expected runtime-name=api-name`);
    }
    out[from] = to;
  }
  return out;
}

function formatAliases(aliases: Record<string, string>): string {
  return Object.entries(aliases).map(([k, v]) => `${k} → ${v}`).join(", ");
}

function providerStatus(): string {
  const parts: string[] = [];
  parts.push(process.env.ANTHROPIC_API_KEY ? `anthropic=${c.green("on")}` : `anthropic=${c.dim("off")}`);
  parts.push(process.env.OPENAI_API_KEY ? `openai=${c.green("on")}` : `openai=${c.dim("off")}`);
  return parts.join(" ");
}

function absUnder(p: string, base: string): string {
  return isAbsolute(p) ? p : resolve(base, p);
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 3) + "..." : s;
}

function exitCodeFor(d: PipelineResult["decision"]): number {
  if (d === "WROTE_FILES") return 0;
  return 1;
}

function fail(msg: string): never {
  console.error(c.red(`run-pipeline: ${msg}`));
  process.exit(2);
}

function failLLM(e: LLMAgentError): never {
  console.error(c.red(`\nrun-pipeline: ${e.message}`));
  for (const cause of e.causes) console.error(c.red(`  cause: ${cause.message}`));
  if (e.schemaErrors.length > 0) {
    console.error(c.red(`  schema errors:`));
    for (const se of e.schemaErrors.slice(0, 10)) {
      console.error(c.red(`    ${se.path}: ${se.message}`));
    }
  }
  if (e.raw != null) {
    console.error(c.red(`  raw (first 400 chars): ${e.raw.slice(0, 400)}`));
  }
  process.exit(2);
}

function printUsage(code: number): never {
  console.error("Usage: node scripts/run-pipeline.ts [--runner <fixture|llm>] [options]");
  console.error("");
  console.error("Common options:");
  console.error("  --runner <mode>    fixture (default) | llm");
  console.error("  --out <dir>        Where to write developer files. Default: <repo>/generated");
  console.error("  --idea <str>       Override idea.txt (or supply the idea in llm mode).");
  console.error("  --json             Print the structured PipelineResult instead of the human summary.");
  console.error("  --quiet            Suppress per-step progress output.");
  console.error("  -v, --verbose      (llm mode) Log per-call routing + prompt/response previews.");
  console.error("  -h, --help         Show this message.");
  console.error("");
  console.error("Fixture mode (default):");
  console.error("  --scenario <dir>   Required. Path to a fixture directory containing");
  console.error("                     {ceo,cto,engineering-manager,developer,qa,cybersecurity}.output.json");
  console.error("                     and idea.txt.");
  console.error("");
  console.error("LLM mode:");
  console.error("  Pluggable LLMClient architecture: AnthropicLLMClient (claude-* models)");
  console.error("  + OpenAILLMClient (gpt-* models). LLMAgentRunner routes by adapterConfig.model");
  console.error("  in each agent's config.json. Cursor's built-in models are NOT used at runtime.");
  console.error("");
  console.error("  Required env: ANTHROPIC_API_KEY and/or OPENAI_API_KEY");
  console.error("  Optional env: ANTHROPIC_MODEL_ALIAS, OPENAI_MODEL_ALIAS");
  console.error("                Format: \"runtime-name=api-name[,runtime-name=api-name]\"");
  console.error("");
  console.error("Examples:");
  console.error("  node scripts/run-pipeline.ts --scenario fixtures/scenarios/waitlist-mvp");
  console.error("  ANTHROPIC_API_KEY=... OPENAI_API_KEY=... \\");
  console.error("    node scripts/run-pipeline.ts --runner llm --idea \"build me a waitlist app\"");
  process.exit(code);
}

function printSummary(r: PipelineResult): void {
  const totalMs = r.steps.reduce((acc, s) => acc + s.durationMs, 0);
  console.log("");
  console.log(c.bold("Run summary"));
  console.log(`  decision:    ${decisionLabel(r.decision)}`);
  if (r.blockReason) console.log(`  blockReason: ${r.blockReason}`);
  console.log(`  total time:  ${totalMs}ms across ${r.steps.length} step(s)`);
  if (r.outputs.em) {
    console.log(`  validation:  valid=${r.validation.valid}  features=${r.outputs.em.features.length}  tasks=${r.outputs.em.tasks.length}`);
  }
  if (r.selectedTask && r.selectedFeature) {
    console.log(`  selected:    ${r.selectedTask.id} (${r.selectedTask.assignedTo}, ${r.selectedTask.estimatedHours}h) → ${r.selectedFeature.id}`);
  }
  if (r.outputs.qa) console.log(`  qa:          ${r.outputs.qa.decision}`);
  if (r.outputs.security) console.log(`  security:    ${r.outputs.security.decision}`);

  if (r.filesWritten.length > 0) {
    console.log("");
    console.log(c.bold("Files written"));
    for (const f of r.filesWritten) {
      console.log(`  ${c.green("+")} ${f.absolutePath}  ${c.dim(`(${f.bytes} bytes)`)}`);
    }
  } else {
    console.log("");
    console.log(c.dim("No files written this run."));
  }

  if (llmEvents.length > 0) {
    console.log("");
    console.log(c.bold("LLM calls"));
    for (const e of llmEvents) {
      console.log(
        `  ${e.agent.padEnd(20)} ${c.dim("model=")}${e.modelUsed.padEnd(34)} ${c.dim("attempt=")}${e.attempt.padEnd(8)} ${c.dim(`sys=${e.systemPromptLength} user=${e.userMessageLength} resp=${e.rawResponseLength}`)}`,
      );
    }
  }
}

function decisionLabel(d: PipelineResult["decision"]): string {
  switch (d) {
    case "WROTE_FILES":
      return c.green(d);
    case "GATE_BLOCKED_QA":
    case "GATE_BLOCKED_SECURITY":
    case "VALIDATION_FAILED":
    case "NO_TASKS":
      return c.yellow(d);
    case "RUNTIME_ERROR":
      return c.red(d);
  }
}

function toSerialisable(r: PipelineResult): unknown {
  // Strip absolutePath to keep the JSON deterministic across machines.
  return {
    ...r,
    filesWritten: r.filesWritten.map((f) => ({
      taskId: f.taskId,
      declaredPath: f.declaredPath,
      bytes: f.bytes,
    })),
  };
}
