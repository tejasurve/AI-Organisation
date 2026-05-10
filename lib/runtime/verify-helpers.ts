// lib/runtime/verify-helpers.ts
//
// Pure helpers used by scripts/verify-generated.ts. Kept side-effect-free so
// they can be unit-tested without filesystem or npm I/O:
//
//   - parseDeveloperOutputFromReport: extracts the lossless Developer JSON
//     embedded in REPORT.md by lib/runtime/report.ts.
//   - upsertVerificationSection: inserts (or replaces) a `## Verification`
//     section in a REPORT.md string, placed just before the trailing footer.
//   - formatVerificationMarkdown: turns a VerificationResult into the body of
//     the section.
//
// All three are intentionally pure: same input → same output.

import type { DeveloperOutput } from "./types.ts";

export interface VerificationResult {
  taskId: string;
  sandboxPath: string;
  cached: boolean;
  typecheck: VerificationStep;
  tests: VerificationStep;
  startedAt: Date;
  finishedAt: Date;
}

export interface VerificationStep {
  name: string;
  status: "pass" | "fail" | "skipped";
  durationMs: number;
  details?: string;
  /** Captured stdout/stderr — truncated by the writer, not here. */
  output?: string;
}

// ---------- parseDeveloperOutputFromReport ----------

export function parseDeveloperOutputFromReport(
  reportMarkdown: string,
  taskId: string,
): DeveloperOutput {
  const sectionHeader = `### Developer (executed \`${taskId}\`)`;
  const sectionStart = reportMarkdown.indexOf(sectionHeader);
  if (sectionStart === -1) {
    throw new Error(
      `verify: REPORT.md does not contain a Developer section for task ${JSON.stringify(taskId)} (looked for ${JSON.stringify(sectionHeader)})`,
    );
  }

  // Bound the search to the developer section: end at the next H3 heading,
  // the trailing horizontal rule, or end-of-file.
  const after = reportMarkdown.slice(sectionStart + sectionHeader.length);
  const nextHeading = after.search(/^### /m);
  const nextRule = after.search(/^---/m);
  const candidates = [nextHeading, nextRule].filter((i) => i !== -1);
  const sectionEnd = candidates.length > 0 ? Math.min(...candidates) : after.length;
  const sectionBody = after.slice(0, sectionEnd);

  // Inside the developer section, find the JSON fence under the
  // <details><summary>Full Developer output...</summary> block.
  const fenceMatch = sectionBody.match(
    /<summary>Full Developer output[^<]*<\/summary>\s*```json\s*\n([\s\S]+?)\n```/,
  );
  if (!fenceMatch) {
    throw new Error(
      "verify: Developer section in REPORT.md is missing the embedded JSON fence " +
        "(no <details>...<summary>Full Developer output...</summary>...json fenced block)",
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(fenceMatch[1]);
  } catch (e) {
    throw new Error(`verify: embedded Developer JSON is not valid JSON: ${(e as Error).message}`);
  }

  if (!isDeveloperOutputShape(parsed)) {
    throw new Error("verify: embedded Developer JSON does not match the DeveloperOutput shape");
  }
  if (parsed.taskId !== taskId) {
    throw new Error(
      `verify: embedded Developer JSON taskId ${JSON.stringify(parsed.taskId)} does not match requested ${JSON.stringify(taskId)}`,
    );
  }
  return parsed;
}

function isDeveloperOutputShape(v: unknown): v is DeveloperOutput {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.taskId === "string" &&
    typeof o.implementationPlan === "string" &&
    Array.isArray(o.files) &&
    Array.isArray(o.tests) &&
    Array.isArray(o.notes)
  );
}

// ---------- upsertVerificationSection ----------

const SECTION_HEADER = "## Verification";

export function upsertVerificationSection(reportMarkdown: string, sectionBody: string): string {
  const trimmedSection = sectionBody.startsWith(SECTION_HEADER)
    ? sectionBody.trim()
    : `${SECTION_HEADER}\n\n${sectionBody.trim()}`;

  const existingIdx = reportMarkdown.indexOf(`\n${SECTION_HEADER}\n`);
  if (existingIdx !== -1) {
    // Replace existing section: from "## Verification" up to next "## " /
    // "---" / EOF.
    const tail = reportMarkdown.slice(existingIdx + 1);
    const endRel = findSectionEndIndex(tail);
    const endAbs = endRel === -1 ? reportMarkdown.length : existingIdx + 1 + endRel;
    return reportMarkdown.slice(0, existingIdx + 1) + trimmedSection + "\n\n" + reportMarkdown.slice(endAbs).replace(/^\n+/, "");
  }

  // Insert before the trailing horizontal rule + footer ("---\n\n_..._").
  // If there is no footer we just append to the end.
  const footerIdx = reportMarkdown.lastIndexOf("\n---\n");
  if (footerIdx === -1) {
    return reportMarkdown.replace(/\n*$/, "") + "\n\n" + trimmedSection + "\n";
  }
  return reportMarkdown.slice(0, footerIdx) + "\n\n" + trimmedSection + reportMarkdown.slice(footerIdx);
}

function findSectionEndIndex(after: string): number {
  // After the leading "## Verification\n", find the next H2 ("## ") /
  // horizontal rule ("---") / EOF. Skip the section header itself.
  const skip = SECTION_HEADER.length;
  const rest = after.slice(skip);
  const nextH2 = rest.search(/\n## /);
  const nextRule = rest.search(/\n---/);
  const candidates = [nextH2, nextRule].filter((i) => i !== -1);
  if (candidates.length === 0) return -1;
  return skip + Math.min(...candidates);
}

// ---------- formatVerificationMarkdown ----------

export function formatVerificationMarkdown(result: VerificationResult): string {
  const overall = overallStatus(result);
  const dur = result.finishedAt.getTime() - result.startedAt.getTime();
  const tick = "`";
  const fence = "```";
  const lines: string[] = [];
  lines.push(SECTION_HEADER);
  lines.push("");
  lines.push("- **Overall:** " + badge(overall));
  lines.push(
    "- **Sandbox:** " +
      tick +
      result.sandboxPath +
      tick +
      " (" +
      (result.cached ? "cache hit, deps reused" : "fresh install") +
      ")",
  );
  lines.push("- **Started:** " + result.startedAt.toISOString());
  lines.push("- **Finished:** " + result.finishedAt.toISOString() + " (" + dur + " ms)");
  lines.push("");
  lines.push("| Step | Status | Duration | Notes |");
  lines.push("|------|--------|----------|-------|");
  lines.push(stepRow(result.typecheck));
  lines.push(stepRow(result.tests));
  if (result.typecheck.output || result.tests.output) {
    lines.push("");
    if (result.typecheck.output) {
      lines.push("<details>");
      lines.push("<summary>" + escapeInline(result.typecheck.name) + " \u2014 captured output</summary>");
      lines.push("");
      lines.push(fence);
      lines.push(truncate(result.typecheck.output, 6000));
      lines.push(fence);
      lines.push("");
      lines.push("</details>");
    }
    if (result.tests.output) {
      lines.push("<details>");
      lines.push("<summary>" + escapeInline(result.tests.name) + " \u2014 captured output</summary>");
      lines.push("");
      lines.push(fence);
      lines.push(truncate(result.tests.output, 6000));
      lines.push(fence);
      lines.push("");
      lines.push("</details>");
    }
  }
  return lines.join("\n");
}

function overallStatus(r: VerificationResult): "pass" | "fail" | "skipped" {
  if (r.typecheck.status === "fail" || r.tests.status === "fail") return "fail";
  if (r.typecheck.status === "skipped" && r.tests.status === "skipped") return "skipped";
  return "pass";
}

function stepRow(s: VerificationStep): string {
  const notes = escapeCell(s.details ?? "");
  return "| " + escapeCell(s.name) + " | " + badge(s.status) + " | " + s.durationMs + " ms | " + notes + " |";
}

function badge(s: "pass" | "fail" | "skipped"): string {
  switch (s) {
    case "pass":
      return "\u2705 pass";
    case "fail":
      return "\u274c fail";
    case "skipped":
      return "\u26aa skipped";
  }
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + "\n... [truncated, " + (s.length - max) + " more chars] ...";
}

function escapeInline(s: string): string {
  return s.replace(/\s+/g, " ").trim().replace(/\|/g, "\\|");
}

const TICK = String.fromCharCode(96);
function escapeCell(s: string): string {
  return escapeInline(s).split(TICK).join("'");
}
