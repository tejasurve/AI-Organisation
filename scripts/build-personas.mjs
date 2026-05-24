#!/usr/bin/env node
// scripts/build-personas.mjs
//
// Reads every `agents/<role>/config.json#persona` block and writes a bundle-safe
// TypeScript module at `lib/platform/personas/personas.generated.ts`. The
// generated file is imported by both server and client code, so the catalog
// stays consistent without doing `node:fs` reads at runtime in the browser.
//
// Source of truth for personas is `agents/<role>/config.json#persona`.
// This script materializes that data into the bundle.
//
// Run automatically before `npm run dev` and `npm run build` via the
// `predev` / `prebuild` hooks in package.json. Also runnable directly:
//
//   node scripts/build-personas.mjs

import { readFile, readdir, stat, writeFile, mkdir } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const AGENTS_DIR = join(REPO_ROOT, "agents");
const OUT_FILE = join(REPO_ROOT, "lib", "platform", "personas", "personas.generated.ts");

// Personas the simulation REQUIRES — fail the build if any are missing a
// `persona` block. Keeps drift between AgentName and the catalog impossible.
const REQUIRED = [
  "ceo",
  "product-owner",
  "solution-architect",
  "cto",
  "engineering-manager",
  "designer",
  "developer",
  "qa",
  "cybersecurity",
];

async function main() {
  const entries = await readdir(AGENTS_DIR);
  const personas = [];
  for (const name of entries) {
    const dir = join(AGENTS_DIR, name);
    let s;
    try {
      s = await stat(dir);
    } catch {
      continue;
    }
    if (!s.isDirectory()) continue;
    const configPath = join(dir, "config.json");
    let raw;
    try {
      raw = JSON.parse(await readFile(configPath, "utf8"));
    } catch {
      continue;
    }
    if (!raw.persona) continue;
    personas.push({
      role: raw.role,
      title: raw.title,
      icon: raw.icon,
      persona: raw.persona,
    });
  }

  const missing = REQUIRED.filter((r) => !personas.find((p) => p.role === r));
  if (missing.length > 0) {
    console.error(
      `[build-personas] Missing persona blocks for: ${missing.join(", ")}.\n` +
        `Each required role must have a "persona" block in agents/<role>/config.json.`,
    );
    process.exit(1);
  }

  // Stable sort by role so the diff is predictable.
  personas.sort((a, b) => a.role.localeCompare(b.role));

  const banner = `// AUTO-GENERATED FILE — DO NOT EDIT BY HAND.
//
// Source of truth: agents/<role>/config.json#persona.
// Regenerate by editing the agent config and running:
//   node scripts/build-personas.mjs
//
// This file is consumed by both server and client code (see catalog.ts).
// Last build: ${new Date().toISOString()}
`;

  const body = `export interface GeneratedPersona {
  role: string;
  title: string;
  icon: string;
  displayName: string;
  shortTitle: string;
  emoji: string;
  bio: string;
  voice: string;
  years: number;
  specialties: readonly string[];
  principles: readonly string[];
  tools: readonly string[];
  chatSystemPrompt: string;
  chatModel: { provider: string; model: string };
  chatCapabilities: readonly string[];
}

export const GENERATED_PERSONAS: readonly GeneratedPersona[] = ${JSON.stringify(
    personas.map((p) => ({
      role: p.role,
      title: p.title,
      icon: p.icon ?? "user",
      ...p.persona,
      specialties: p.persona.specialties ?? [],
      principles: p.persona.principles ?? [],
      tools: p.persona.tools ?? [],
      chatCapabilities: p.persona.chatCapabilities ?? [],
    })),
    null,
    2,
  )} as const;
`;

  await mkdir(dirname(OUT_FILE), { recursive: true });
  await writeFile(OUT_FILE, banner + "\n" + body, "utf8");
  console.log(
    `[build-personas] wrote ${personas.length} personas → ${OUT_FILE.replace(REPO_ROOT + "/", "")}`,
  );
}

main().catch((err) => {
  console.error("[build-personas] failed:", err);
  process.exit(1);
});
