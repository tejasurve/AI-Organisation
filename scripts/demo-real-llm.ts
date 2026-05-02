// scripts/demo-real-llm.ts
//
// Stage C-2 of Step 9 verification: prove the LLMAgentRunner can drive a real
// Claude call end-to-end (system prompt, structured user message, JSON parse,
// schema validation) without any mocks.
//
// Default behaviour: invoke ONE agent (CEO) with one real Anthropic call and
// validate the response against agents/ceo/config.json's outputContract.schema.
// Use --agent <role> to pick a different agent; use --pipeline to run the
// whole chain (CEO → CTO → EM → Developer → QA → Cybersecurity → file write)
// — that's six real calls, costs more, and only makes sense once you've
// validated a single call works.
//
// Required env (at least one):
//   ANTHROPIC_API_KEY        — your Anthropic key (needed for any claude-* model)
//   OPENAI_API_KEY           — your OpenAI key    (needed for any gpt-* model, e.g. QA)
//
// Optional env (recommended — see README for current API model names):
//   ANTHROPIC_MODEL_ALIAS    — "runtime-name=api-name[,runtime-name=api-name]"
//                              e.g. "claude-opus-4-7-thinking-xhigh=claude-opus-4-5-20250514"
//   OPENAI_MODEL_ALIAS       — same format, e.g. "gpt-5.5-medium=gpt-4o-2024-08-06"
//
// Single-agent (default — one paid Claude call):
//   ANTHROPIC_API_KEY=sk-ant-... \
//     ANTHROPIC_MODEL_ALIAS="claude-opus-4-7-thinking-xhigh=claude-3-5-sonnet-20241022" \
//     node scripts/demo-real-llm.ts
//
// Full pipeline (six paid calls — five Claude + one GPT for QA):
//   ANTHROPIC_API_KEY=... OPENAI_API_KEY=... \
//     ANTHROPIC_MODEL_ALIAS="..." OPENAI_MODEL_ALIAS="..." \
//     node scripts/demo-real-llm.ts --pipeline --out /tmp/run-1
//
// Exit codes: 0 success, 1 missing key, 2 LLM/validation failure.

import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  LLMAgentError,
  LLMAgentRunner,
  type LLMCallEvent,
} from "../lib/runtime/agent-runner.ts";
import { AnthropicLLMClient } from "../lib/runtime/llm-clients/anthropic.ts";
import { OpenAILLMClient } from "../lib/runtime/llm-clients/openai.ts";
import { runPipeline } from "../lib/runtime/pipeline.ts";
import type { AgentName, CompanyContext } from "../lib/runtime/types.ts";
import { AGENT_NAMES } from "../lib/runtime/types.ts";

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), "../..");

interface CLIOptions {
  agent: AgentName;
  pipeline: boolean;
  out: string;
  idea: string;
  verbose: boolean;
}

function parseArgs(argv: string[]): CLIOptions {
  const opts: CLIOptions = {
    agent: "ceo",
    pipeline: false,
    out: resolve(REPO_ROOT, "generated"),
    idea: "Build me a managed AI organisation that turns a single founder idea into shipped, secured code in under an hour.",
    verbose: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "--agent": {
        const v = argv[++i];
        if (!AGENT_NAMES.includes(v as AgentName)) {
          die(`unknown agent: ${v}. valid: ${AGENT_NAMES.join(", ")}`);
        }
        opts.agent = v as AgentName;
        break;
      }
      case "--pipeline":
        opts.pipeline = true;
        break;
      case "--out":
        opts.out = resolve(argv[++i]);
        break;
      case "--idea":
        opts.idea = argv[++i];
        break;
      case "--verbose":
      case "-v":
        opts.verbose = true;
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
        break;
      default:
        die(`unknown argument: ${a}`);
    }
  }
  return opts;
}

function printHelp(): void {
  console.log(`Usage: node scripts/demo-real-llm.ts [options]

Single-agent demo (default):
  --agent <role>     ${AGENT_NAMES.join(" | ")}            (default: ceo)
  --idea  "<text>"   founder idea passed to CEO              (used by --agent ceo and --pipeline)

Full pipeline demo (six real calls — five Claude + one GPT):
  --pipeline         run CEO → CTO → EM → Developer → QA → Security
  --out   <dir>      where to write generated files          (default: ./generated)

  --verbose          log every system+user prompt + raw response preview
  --help             show this message

Required env (at least one):
  ANTHROPIC_API_KEY        your Anthropic API key (needed for claude-* models)
  OPENAI_API_KEY           your OpenAI    API key (needed for gpt-*    models, e.g. QA)

Optional env:
  ANTHROPIC_MODEL_ALIAS    e.g. "claude-opus-4-7-thinking-xhigh=claude-3-5-sonnet-20241022"
  OPENAI_MODEL_ALIAS       e.g. "gpt-5.5-medium=gpt-4o-2024-08-06"
`);
}

function die(msg: string): never {
  console.error(`error: ${msg}`);
  console.error(`run with --help for usage`);
  process.exit(1);
}

function parseAliases(env: string | undefined, varName: string): Record<string, string> {
  if (!env || !env.trim()) return {};
  const aliases: Record<string, string> = {};
  for (const pair of env.split(",")) {
    const [from, to] = pair.split("=").map((s) => s.trim());
    if (!from || !to) {
      die(`malformed ${varName} entry ${JSON.stringify(pair)} — expected runtime-name=api-name`);
    }
    aliases[from] = to;
  }
  return aliases;
}

// ---------- main ----------

const opts = parseArgs(process.argv.slice(2));

if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
  die(
    "no API keys found. Set ANTHROPIC_API_KEY and/or OPENAI_API_KEY in env and re-run, e.g.:\n" +
      "  export ANTHROPIC_API_KEY=sk-ant-...\n" +
      "  export OPENAI_API_KEY=sk-...   # only needed for QA (gpt-5.5-medium) in --pipeline",
  );
}

const anthropicAliases = parseAliases(process.env.ANTHROPIC_MODEL_ALIAS, "ANTHROPIC_MODEL_ALIAS");
const openaiAliases = parseAliases(process.env.OPENAI_MODEL_ALIAS, "OPENAI_MODEL_ALIAS");
if (Object.keys(anthropicAliases).length > 0) {
  console.log(`[demo] anthropic aliases:`);
  for (const [from, to] of Object.entries(anthropicAliases)) console.log(`         ${from} → ${to}`);
}
if (Object.keys(openaiAliases).length > 0) {
  console.log(`[demo] openai aliases:`);
  for (const [from, to] of Object.entries(openaiAliases)) console.log(`         ${from} → ${to}`);
}

// Always register both providers so LLMAgentRunner can route by model. Each
// client checks for its own API key only when actually called, so users
// running the single-agent CEO demo don't need OPENAI_API_KEY.
const anthropic = new AnthropicLLMClient({
  apiKey: process.env.ANTHROPIC_API_KEY,
  modelAliases: anthropicAliases,
});
const openai = new OpenAILLMClient({
  apiKey: process.env.OPENAI_API_KEY,
  modelAliases: openaiAliases,
});

const events: LLMCallEvent[] = [];
const runner = new LLMAgentRunner({
  repoRoot: REPO_ROOT,
  clients: [anthropic, openai],
  verbose: opts.verbose,
  onCall: (e) => events.push(e),
});

const ctx: CompanyContext = { phase: "validate", cycle: 1, priorCycle: null };

if (opts.pipeline) {
  await mkdir(opts.out, { recursive: true });
  console.log(`[demo] running full pipeline against the real Claude API (six paid calls)`);
  console.log(`[demo] generated/  → ${opts.out}`);
  console.log(`[demo] idea        → ${JSON.stringify(opts.idea)}`);

  const result = await runPipeline(opts.idea, {
    agentRunner: runner,
    generatedDir: opts.out,
    companyContext: ctx,
  }).catch((e) => {
    if (e instanceof LLMAgentError) {
      printLLMError(e);
      process.exit(2);
    }
    throw e;
  });

  console.log(`\n[demo] decision = ${result.decision}`);
  if (result.blockReason) console.log(`[demo] block    = ${result.blockReason}`);
  console.log(`[demo] files written: ${result.filesWritten.length}`);
  for (const f of result.filesWritten) {
    console.log(`         ${f.declaredPath} (${f.bytes} bytes) → ${f.absolutePath}`);
  }
  console.log(`\n[demo] LLM calls observed: ${events.length}`);
  for (const e of events) {
    console.log(
      `         ${e.agent.padEnd(20)} model=${e.modelUsed.padEnd(34)} sys=${e.systemPromptLength} user=${e.userMessageLength} resp=${e.rawResponseLength}`,
    );
  }
  process.exit(result.decision === "WROTE_FILES" ? 0 : 2);
}

// Single-agent demo (default)
console.log(`[demo] single-agent demo against the real Claude API`);
console.log(`[demo] agent       → ${opts.agent}`);
console.log(`[demo] idea        → ${JSON.stringify(opts.idea)}`);

const input: Record<string, unknown> =
  opts.agent === "ceo"
    ? { idea: opts.idea, companyContext: ctx }
    : die(
        `single-agent demo currently only supports --agent ceo (other agents need upstream fixtures). Use --pipeline for the full chain.`,
      );

let parsed: unknown;
try {
  parsed = await runner.run({ agentName: opts.agent, input });
} catch (e) {
  if (e instanceof LLMAgentError) {
    printLLMError(e);
    process.exit(2);
  }
  throw e;
}

console.log(`\n[demo] success — model output passed schema validation\n`);
console.log(JSON.stringify(parsed, null, 2));

console.log(`\n[demo] LLM call(s):`);
for (const e of events) {
  console.log(
    `         ${e.agent} attempt=${e.attempt} model=${e.modelUsed} sys=${e.systemPromptLength} user=${e.userMessageLength} resp=${e.rawResponseLength}`,
  );
}

function printLLMError(e: LLMAgentError): void {
  console.error(`\n[demo] LLMAgentError on agent=${e.agent}`);
  console.error(`        ${e.message}`);
  for (const c of e.causes) console.error(`        cause: ${c.message}`);
  if (e.schemaErrors.length > 0) {
    console.error(`        schema errors:`);
    for (const se of e.schemaErrors.slice(0, 10)) {
      console.error(`          ${se.path}: ${se.message}`);
    }
  }
  if (e.raw != null) {
    console.error(`        raw (first 400 chars): ${e.raw.slice(0, 400)}`);
  }
}
