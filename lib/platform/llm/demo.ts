// lib/platform/llm/demo.ts
//
// Deterministic, persona-aware fallback responses for when no real LLM key
// is configured (or a provider errors out). Lets judges see the whole loop
// without anyone pasting credentials on stage.
//
// The text varies by `personaHint` and `stageHint`, picked from a short
// curated set. Each response feels like the right character on the right step.

import type { CallOptions } from "./proxy.ts";

export function demoCompletion(opts: CallOptions): string {
  const persona = (opts.personaHint ?? "").toLowerCase();
  const stage = (opts.stageHint ?? "").toLowerCase();
  const lastUser =
    [...opts.messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const idea = extractIdea(lastUser);

  if (persona.includes("ceo")) return ceoLine(stage, idea);
  if (persona.includes("cto")) return ctoLine(stage, idea);
  if (persona.includes("solution") || persona.includes("architect"))
    return architectLine(stage, idea);
  if (persona.includes("designer")) return designerLine(stage, idea);
  if (persona.includes("pm") || persona.includes("product"))
    return pmLine(stage, idea);
  if (persona.includes("dev") || persona.includes("engineer"))
    return devLine(stage, idea);
  if (persona.includes("qa") || persona.includes("quality"))
    return qaLine(stage, idea);

  return `Acknowledged. Working on: ${idea || "the current task"}.`;
}

// ---------- per-persona lines ----------

function ceoLine(stage: string, idea: string): string {
  if (stage.includes("kickoff") || stage.includes("intake")) {
    return [
      `Got it — so we're building **${idea}**.`,
      `Before I pull the team in, two quick checks:`,
      ``,
      `1. **Target user** — who is this for, exactly? "Anyone" never ships.`,
      `2. **Success in one number** — what metric tells us this worked?`,
      ``,
      `Answer those and I'll bring the CTO and Solution Architect in to draft a plan.`,
    ].join("\n");
  }
  if (stage.includes("review-plan")) {
    return `The architecture is solid. I'm forwarding it for your approval. Once you sign off, design and stories start in parallel.`;
  }
  if (stage.includes("sprint-done")) {
    return `Sprint shipped. Numbers look healthy. Next iteration starts when you are.`;
  }
  return `On it. Translating the brief into a delegation tree now.`;
}

function ctoLine(stage: string, _idea: string): string {
  if (stage.includes("review-plan") || stage.includes("plan")) {
    return [
      `Stack proposal:`,
      `- **Frontend:** Next.js + Tailwind + shadcn/ui`,
      `- **Backend:** Node + Postgres + Redis`,
      `- **Auth:** Clerk (fastest path; swap to Auth.js if cost matters)`,
      `- **Hosting:** Vercel + Neon + Upstash`,
      `- **Observability:** Sentry + LogTail`,
      ``,
      `Risks I'm watching: vendor lock-in on auth, cold starts on free tier.`,
    ].join("\n");
  }
  return `Locking in API contracts and the schema before anyone writes code.`;
}

function architectLine(stage: string, idea: string): string {
  // Note: the workflow engine's parseHld/Lld helpers compose the actual
  // diagram + module list + APIs from the brief itself; this prose is what
  // the persona "says" while drafting. Keep it short and brief-aware.
  if (stage.includes("hld")) {
    return `Drafting the high-level design for **${idea || "the product"}** — bounded contexts, system context diagram, stack with rationale, and the top risks worth calling out. Sending it for your review in a moment.`;
  }
  if (stage.includes("lld")) {
    return `Following up with the low-level design — module boundaries, data model, and the public API surface. Sending shortly.`;
  }
  return `Drafting the trade-off matrix. ADR follows.`;
}

function designerLine(stage: string, _idea: string): string {
  if (stage.includes("designs") || stage.includes("design")) {
    return `Generating 4 concept screens via Stitch. Each leans into a different aesthetic — minimal, playful, dense, premium — so you can pick the direction quickly.`;
  }
  if (stage.includes("redesign")) {
    return `Got the comments. Reworking the selected screen with tighter hierarchy and the requested CTA prominence.`;
  }
  return `Designing.`;
}

function pmLine(stage: string, _idea: string): string {
  if (stage.includes("stories")) {
    return [
      `Backlog drafted. Five vertical slices, each independently shippable.`,
      ``,
      `Definition of done per story includes: tests, telemetry, and a flag-gate so we can dark-launch.`,
    ].join("\n");
  }
  return `Capturing acceptance criteria.`;
}

function devLine(stage: string, _idea: string): string {
  if (stage.includes("code-review")) {
    return `Addressed the architect's feedback. Pulled out the duplicated mapper, added the missing null-guard, and reduced the API surface by one method.`;
  }
  if (stage.includes("defect")) {
    return `Reproduced the defect locally, root cause was a stale cache. Patched the invalidation path and added a regression test.`;
  }
  return `Shipped the slice. Tests green.`;
}

function qaLine(stage: string, _idea: string): string {
  if (stage.includes("qa") || stage.includes("test")) {
    return `Ran the test matrix — 1 defect found in the signup flow on iOS Safari. Filing as P1. Everything else passes.`;
  }
  return `Verifying.`;
}

function extractIdea(s: string): string {
  // Pluck the *first sentence* of the user's last message; good enough for
  // demo-mode echoing.
  const t = s.trim().replace(/\s+/g, " ");
  if (!t) return "";
  const dot = t.indexOf(".");
  if (dot > 8 && dot < 120) return t.slice(0, dot);
  return t.length > 120 ? `${t.slice(0, 117)}…` : t;
}
