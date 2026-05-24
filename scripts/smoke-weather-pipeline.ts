// scripts/smoke-weather-pipeline.ts
//
// End-to-end LLM pipeline smoke test using the user's actual weather brief.
// Verifies that the generators produce WEATHER-APP-CORRECT artifacts (no
// Stripe, no PostGIS, no realtime, no marketplace fabrications).
//
// Usage: npx tsx scripts/smoke-weather-pipeline.ts

import {
  generateCodeReview,
  generateDesignerPrompts,
  generateFeatures,
  generateHld,
  generateLld,
  generateQaDefects,
  generateSecurityAudit,
  generateStories,
  generateStoryCommits,
} from "../lib/platform/workflow/llm-generators.ts";
import type { ProjectBrief } from "../lib/platform/workflow/types.ts";

const brief: ProjectBrief = {
  name: "ClimateLens",
  pitch: `Local Weather & Activity Discovery App.

Build a modern local-first weather web app combining:
- Beautiful weather forecasting (current temp, humidity, wind, UV, sunrise/sunset, hourly + 10-day)
- Smooth motion animations (rain, snow, lightning, glassmorphism)
- Smart local activity suggestions tied to weather (sunny → parks/cycling; rainy → cinemas/cafés)
- Local event discovery (Eventbrite / Ticketmaster integration)

Core features:
1. Weather Dashboard with animated visuals
2. Smart Activity Suggestions
3. Local Event Discovery
4. 10-day weather planner with date-pick
5. Auto-detect location + manual city search
6. Save favorite activities/events
7. Celsius/Fahrenheit toggle, dark/light mode

Tech preferences: Next.js / React, Tailwind CSS, Framer Motion. Backend Node.js or Firebase/Supabase. APIs: OpenWeather, Google Places, Eventbrite, Ticketmaster, Mapbox/Google Maps.

UI must include: motion animations, glassmorphism, smooth page transitions, animated weather icons, dynamic weather-based themes, mobile responsiveness.

MVP focus: local weather, beautiful animated UI, nearby activity suggestions, event discovery, 10-day planning, mobile responsiveness.

Avoid: social features, payments, complex booking systems, global coverage (start local-only).

Future scope (NOT in MVP): AI itinerary planner, group plans, push notifications, calendar integrations, mobile apps.`,
  audience: "Lifestyle-conscious adults aged 22-45 who plan activities around weather.",
  successMetric: "Weekly active users that come back to plan activities.",
};

function divider(label: string): void {
  console.log("\n" + "=".repeat(76));
  console.log("▶  " + label);
  console.log("=".repeat(76));
}

async function main(): Promise<void> {
  let totalCost = 0;
  let totalLatency = 0;
  const recordCall = (stage: string, r: { costUsd: number; latencyMs: number; source: string; model: string }) => {
    totalCost += r.costUsd;
    totalLatency += r.latencyMs;
    console.log(`  [${stage}] ${r.source} · ${r.model} · ${r.latencyMs}ms · $${r.costUsd.toFixed(6)}`);
  };

  // 1. Features (Product Owner)
  divider("1. Product Owner — generateFeatures");
  const fx = await generateFeatures(brief);
  recordCall("features", fx.llm);
  console.log("\nPersonas:");
  for (const p of fx.artefact.personas) console.log(`  - ${p.name}: ${p.context}`);
  console.log("\nFeatures:");
  for (const f of fx.artefact.features) {
    console.log(`  - (${f.priority.toUpperCase()}) ${f.name} — ${f.userJob}`);
  }
  console.log("\nOut of scope:");
  for (const o of fx.artefact.outOfScope) console.log(`  - ${o}`);

  // 2. HLD (Solution Architect)
  divider("2. Solution Architect — generateHld");
  const hx = await generateHld({ brief, features: fx.artefact });
  recordCall("hld", hx.llm);
  console.log("\nSummary:", hx.artefact.summary);
  console.log("\nContexts:", hx.artefact.contexts.join(", "));
  console.log("\nStack:");
  for (const s of hx.artefact.stack) console.log(`  - ${s.area}: ${s.choice} (${s.rationale})`);
  console.log("\nRisks:");
  for (const r of hx.artefact.risks) console.log(`  - ${r.risk} → ${r.mitigation}`);
  console.log("\nMermaid (first 8 lines):");
  console.log(hx.artefact.diagramMermaid.split("\n").slice(0, 8).map((l) => "  " + l).join("\n"));

  // 3. LLD (CTO)
  divider("3. CTO — generateLld");
  const lx = await generateLld({ brief, features: fx.artefact, hld: hx.artefact });
  recordCall("lld", lx.llm);
  console.log("\nModules:");
  for (const m of lx.artefact.modules) console.log(`  - ${m.id}: ${m.description}`);
  console.log("\nData model:");
  for (const d of lx.artefact.dataModel) console.log(`  - ${d.entity}: ${d.fields.slice(0, 5).join(", ")}${d.fields.length > 5 ? "…" : ""}`);
  console.log("\nAPIs:");
  for (const a of lx.artefact.apis) console.log(`  - ${a.method} ${a.path} — ${a.purpose}`);

  // 4. Designer prompts
  divider("4. Designer — generateDesignerPrompts");
  const dx = await generateDesignerPrompts({ brief, features: fx.artefact });
  recordCall("designer", dx.llm);
  console.log("\nAesthetic direction:", dx.aestheticDirection);
  console.log("\nScreen prompts:");
  for (const s of dx.screens) console.log(`  - ${s.title}:\n      ${s.prompt}`);

  // 5. Stories (Engineering Manager)
  divider("5. Engineering Manager — generateStories");
  const sx = await generateStories({
    brief,
    features: fx.artefact,
    hld: hx.artefact,
    lld: lx.artefact,
    sprintNumber: 1,
  });
  recordCall("stories", sx.llm);
  console.log("\nSprint-1 backlog:");
  for (const story of sx.stories) {
    console.log(`  - [${story.effort}] ${story.title}`);
    console.log(`      ${story.asA} — ${story.iWant}`);
    console.log(`      tasks: ${story.tasks.join(" | ")}`);
  }

  // 6. Per-story commits (Developer) — batched single call for all stories.
  divider("6. Developer — generateStoryCommits (batched, all stories)");
  const cxBatch = await generateStoryCommits({ brief, stories: sx.stories, lld: lx.artefact });
  recordCall("commits:batch", cxBatch.llm);
  for (const c of cxBatch.commits) {
    console.log(`\n${c.storyTitle}:`);
    console.log(`  branch=${c.branch}  commits=${c.commits}  PR#${c.prNumber}`);
    console.log(`  +${c.linesAdded}/-${c.linesRemoved}`);
    console.log(`  files: ${c.files.join(", ")}`);
    console.log(`  notes: ${c.notes}`);
  }

  // 7. QA
  divider("7. QA — generateQaDefects");
  const qx = await generateQaDefects({ brief, stories: sx.stories, hld: hx.artefact });
  recordCall("qa", qx.llm);
  console.log(`\nDefects (${qx.defects.length}):`);
  for (const d of qx.defects) {
    console.log(`  - ${d.severity} ${d.title}`);
    console.log(`    ${d.repro}`);
  }

  // 8. Code review
  divider("8. Solution Architect — generateCodeReview");
  // For the smoke we'll just synthesise a small fake commit set so we don't
  // pay for 5 story commits. In the real engine each story has its own.
  const fakeCommits = sx.stories.map((s, i) => ({
    storyId: s.id,
    storyTitle: s.title,
    branch: `feat/story-${i + 1}`,
    prNumber: 200 + i,
    commits: 3,
    files: [`lib/weather/${s.id}.ts`, `components/${s.id}.tsx`],
    linesAdded: 120,
    linesRemoved: 25,
    notes: s.tasks[0] ?? "",
  }));
  const cr = await generateCodeReview({
    brief,
    stories: sx.stories,
    lld: lx.artefact,
    commits: fakeCommits,
  });
  recordCall("code-review", cr.llm);
  console.log(`\nDiff summary: ${cr.artefact.diffSummary}`);
  for (const c of cr.artefact.comments) {
    console.log(`  - [${c.severity}] ${c.file}:${c.line} — ${c.text}`);
  }

  // 9. Security
  divider("9. Cybersecurity — generateSecurityAudit");
  const sec = await generateSecurityAudit({
    brief,
    hld: hx.artefact,
    lld: lx.artefact,
    stories: sx.stories,
  });
  recordCall("security", sec.llm);
  console.log(`\nVerdict: ${sec.artefact.verdict}`);
  for (const f of sec.artefact.findings) {
    console.log(`  - [${f.severity}] ${f.finding}`);
    console.log(`    fix: ${f.fix}`);
  }

  // ---------- VERIFICATION ----------
  divider("VERIFICATION — domain correctness");

  const flatText = [
    fx.artefact.features.map((f) => f.name + " " + f.userJob).join(" "),
    hx.artefact.summary,
    hx.artefact.stack.map((s) => s.area + " " + s.choice + " " + s.rationale).join(" "),
    lx.artefact.modules.map((m) => m.id + " " + m.description).join(" "),
    lx.artefact.apis.map((a) => a.path + " " + a.purpose).join(" "),
    sx.stories.map((s) => s.title + " " + s.tasks.join(" ")).join(" "),
  ].join(" ").toLowerCase();

  const forbidden = [
    { needle: "stripe", note: "brief says 'Avoid: payments'" },
    { needle: "checkout", note: "brief says 'Avoid: payments'" },
    { needle: "postgis", note: "weather app uses lat/lng API call, not spatial DB" },
    { needle: "marketplace", note: "not a marketplace" },
    { needle: "escrow", note: "not in scope" },
    { needle: "tattoo", note: "wrong domain" },
    { needle: "ai itinerary", note: "Future Scope only" },
    { needle: "push notification", note: "Future Scope only" },
    { needle: "calendar integration", note: "Future Scope only" },
  ];
  const required = [
    { needle: "weather", note: "core product" },
    { needle: "forecast", note: "core feature" },
    { needle: "activit", note: "activity suggestions are core" },
  ];

  let pass = true;
  for (const { needle, note } of forbidden) {
    const found = flatText.includes(needle);
    console.log((found ? "✗" : "✓") + ` no "${needle}" (${note})`);
    if (found) pass = false;
  }
  for (const { needle, note } of required) {
    const found = flatText.includes(needle);
    console.log((found ? "✓" : "✗") + ` contains "${needle}" (${note})`);
    if (!found) pass = false;
  }

  divider("COST SUMMARY");
  console.log(`Total LLM cost: $${totalCost.toFixed(4)}`);
  console.log(`Total latency:  ${totalLatency}ms (${(totalLatency / 1000).toFixed(1)}s)`);
  console.log(`Outcome:        ${pass ? "PASS" : "FAIL"}`);

  process.exitCode = pass ? 0 : 1;
}

main().catch((e) => {
  console.error("Smoke threw:", e);
  process.exitCode = 1;
});
