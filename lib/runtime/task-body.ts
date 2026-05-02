// lib/runtime/task-body.ts
//
// Formats the structured input dict that the pipeline passes to AgentRunner
// into the user-message string each agent expects.
//
// Two formats are supported:
//
//   1. structured-task-body — used by CTO, EM, Developer, QA, Cybersecurity.
//      One section per entry in the agent's inputContract.sections, each in
//      the form:
//
//          === Section Marker ===
//          { ...JSON for this section... }
//
//      separated by blank lines.
//
//   2. ceo-templated — special case for CEO whose prompt.md describes its
//      input as templated values (Current phase / Client goal / Company
//      context) rather than a structured-task-body.

import type { AgentDefinition, AgentInputSection } from "./agent-loader.ts";
import type { CompanyContext } from "./types.ts";

/**
 * Convention: marker text → input dict key.
 *   "=== CEO Output ==="                 → ceoOutput
 *   "=== Engineering Manager Output ===" → engineeringManagerOutput
 *   "=== Definition of Done ==="         → definitionOfDone
 *   "=== Changed Surfaces ==="           → changedSurfaces
 *   "=== Task ==="                       → task
 *   "=== Feature ==="                    → feature
 *   "=== Company Context ==="            → companyContext
 *
 * Words inside the marker are split on whitespace; the first word is
 * lowercased verbatim; subsequent words are PascalCased and concatenated.
 */
export function markerToInputKey(marker: string): string {
  const inner = marker
    .replace(/^=+\s*/, "")
    .replace(/\s*=+$/, "")
    .trim();
  if (!inner) {
    throw new Error(`markerToInputKey: empty marker ${JSON.stringify(marker)}`);
  }
  const parts = inner.split(/\s+/);
  const head = parts[0].toLowerCase();
  const tail = parts.slice(1).map((p) => p[0].toUpperCase() + p.slice(1).toLowerCase());
  return [head, ...tail].join("");
}

export function buildTaskBody(agent: AgentDefinition, input: Record<string, unknown>): string {
  if (agent.config.role === "ceo") {
    return formatCEOInput(input);
  }

  const sections = agent.config.inputContract?.sections ?? [];
  const parts: string[] = [];
  for (const section of sections) {
    const formatted = formatSection(section, input);
    if (formatted == null) continue;
    parts.push(formatted);
  }
  return parts.join("\n\n");
}

// ---------- internals ----------

function formatSection(
  section: AgentInputSection,
  input: Record<string, unknown>,
): string | null {
  const key = markerToInputKey(section.marker);
  const value = input[key];

  if (value === undefined) {
    if (section.optional) return null;
    throw new Error(
      `buildTaskBody: missing required input key "${key}" for section ${JSON.stringify(section.marker)}`,
    );
  }

  return `${section.marker}\n${JSON.stringify(value, null, 2)}`;
}

function formatCEOInput(input: Record<string, unknown>): string {
  const idea = typeof input.idea === "string" ? input.idea : "";
  const ctx = (input.companyContext as CompanyContext | undefined) ?? {
    phase: "validate",
    cycle: 1,
    priorCycle: null,
  };
  const phase = typeof ctx.phase === "string" ? ctx.phase : "validate";
  const contextJSON = JSON.stringify(ctx, null, 2);

  return [
    `Current phase:    ${phase}`,
    `Client goal:      ${idea}`,
    `Company context:  ${contextJSON}`,
  ].join("\n");
}
