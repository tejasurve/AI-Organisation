// scripts/smoke-weather-backhalf.ts — just the QA/review/security stages
// for the same weather brief, plus a fast "no LLM cost" stub stories input.
//
// Used to verify the schema fix without paying for the full pipeline again.

import {
  generateCodeReview,
  generateQaDefects,
  generateSecurityAudit,
} from "../lib/platform/workflow/llm-generators.ts";
import type {
  HldArtefact,
  LldArtefact,
  ProjectBrief,
  UserStory,
} from "../lib/platform/workflow/types.ts";

const brief: ProjectBrief = {
  name: "ClimateLens",
  pitch: "Local Weather & Activity Discovery App. Weather dashboard with animations, weather-aware activity suggestions, local event discovery via Eventbrite/Ticketmaster, 10-day planner. Tech: Next.js, Tailwind, Framer Motion, OpenWeather API, Google Places, Mapbox. Avoid payments, social, global coverage.",
  audience: "Lifestyle-conscious adults",
  successMetric: "WAU",
};

const hld: HldArtefact = {
  summary: "Next.js weather app calling OpenWeather + Google Places + Eventbrite, animated UI via Framer Motion.",
  bullets: ["Serverless backend", "External API caching"],
  contexts: ["Weather Service", "Activity Discovery", "Event Aggregator"],
  diagramMermaid: "flowchart TD\n  A[User] --> B(Next.js)",
  stack: [
    { area: "Frontend", choice: "Next.js + Tailwind + Framer Motion", rationale: "brief preference" },
    { area: "Weather", choice: "OpenWeather API", rationale: "10-day forecast" },
  ],
  risks: [
    { risk: "External API rate limits", mitigation: "Cache + degrade gracefully" },
    { risk: "Animation perf on low-end mobile", mitigation: "Reduced-motion fallback" },
  ],
};

const lld: LldArtefact = {
  modules: [
    { id: "weather/forecast", description: "Fetches OpenWeather data", surface: ["getCurrent", "get10Day"] },
    { id: "activity/suggestions", description: "Maps weather to activities", surface: ["suggest"] },
    { id: "events/discovery", description: "Pulls Eventbrite events", surface: ["search"] },
  ],
  dataModel: [
    { entity: "WeatherForecast", fields: ["current", "hourly", "daily"] },
    { entity: "Activity", fields: ["name", "type", "weatherAffinity"] },
  ],
  apis: [
    { method: "GET", path: "/api/weather/current", purpose: "Current local weather" },
    { method: "GET", path: "/api/weather/forecast", purpose: "10-day forecast" },
    { method: "GET", path: "/api/activities/suggestions", purpose: "Weather-aware activities" },
  ],
};

const stories: UserStory[] = [
  {
    id: "s1",
    title: "View Animated Weather Dashboard",
    asA: "Active Planner",
    iWant: "to see the current weather beautifully",
    soThat: "I can plan today",
    acceptance: ["Loads in < 2s", "Shows current temp + condition + hourly"],
    tasks: ["OpenWeather API client", "Framer Motion icons"],
    status: "todo",
    effort: "L",
    sprintNumber: 1,
    origin: "fresh",
  },
  {
    id: "s2",
    title: "Discover Local Events",
    asA: "Active Planner",
    iWant: "to see events nearby",
    soThat: "I have things to do",
    acceptance: ["Eventbrite results within 25mi", "Save event"],
    tasks: ["Eventbrite client", "Event list UI"],
    status: "todo",
    effort: "M",
    sprintNumber: 1,
    origin: "fresh",
  },
];

const commits = stories.map((s, i) => ({
  storyId: s.id,
  storyTitle: s.title,
  branch: `feat/${s.id}`,
  prNumber: 200 + i,
  commits: 3,
  files: [
    `lib/${s.id === "s1" ? "weather/forecast.ts" : "events/discovery.ts"}`,
    `components/${s.id === "s1" ? "Dashboard.tsx" : "EventList.tsx"}`,
    `lib/${s.id === "s1" ? "weather/forecast.test.ts" : "events/discovery.test.ts"}`,
  ],
  linesAdded: 150,
  linesRemoved: 30,
  notes: s.tasks[0]!,
}));

async function main(): Promise<void> {
  console.log("→ QA");
  const qa = await generateQaDefects({ brief, stories, hld });
  console.log(`  ${qa.defects.length} defects | $${qa.llm.costUsd.toFixed(6)} | ${qa.llm.latencyMs}ms`);
  for (const d of qa.defects) {
    console.log(`  - ${d.severity}: ${d.title}\n    ${d.repro}`);
  }

  console.log("\n→ Code review");
  const cr = await generateCodeReview({ brief, stories, lld, commits });
  console.log(`  ${cr.artefact.comments.length} comments | $${cr.llm.costUsd.toFixed(6)} | ${cr.llm.latencyMs}ms`);
  console.log(`  Diff: ${cr.artefact.diffSummary}`);
  for (const c of cr.artefact.comments) {
    console.log(`  - [${c.severity}] ${c.file}:${c.line}\n    ${c.text}`);
  }

  console.log("\n→ Security");
  const sec = await generateSecurityAudit({ brief, hld, lld, stories });
  console.log(`  ${sec.artefact.verdict} · ${sec.artefact.findings.length} findings | $${sec.llm.costUsd.toFixed(6)} | ${sec.llm.latencyMs}ms`);
  for (const f of sec.artefact.findings) {
    console.log(`  - [${f.severity}] ${f.finding}\n    fix: ${f.fix}`);
  }

  // Sanity: no Stripe/PostGIS in any back-half output either.
  const flat = JSON.stringify({ qa: qa.defects, cr: cr.artefact, sec: sec.artefact }).toLowerCase();
  const forbidden = ["stripe", "postgis", "tattoo", "marketplace", "escrow"];
  let pass = true;
  for (const word of forbidden) {
    const hit = flat.includes(word);
    console.log((hit ? "✗" : "✓") + ` no "${word}"`);
    if (hit) pass = false;
  }
  process.exitCode = pass ? 0 : 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
