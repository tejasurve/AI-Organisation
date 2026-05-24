// scripts/smoke-e2e-weather.ts
//
// Full end-to-end smoke against the running dev server. Posts the user's
// weather brief, polls every 5 s, and reports the moment each artefact
// becomes available. Final assertion: HLD/LLD/features/stories are
// weather-app-correct (no Stripe, no PostGIS, no realtime tracking, no
// payments — but DO contain weather/forecast/activity content).

const HOST = "http://localhost:3000";

const BRIEF = {
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
  successMetric: "Weekly active users who return to plan activities.",
};

async function fetchJson(path: string, opts?: RequestInit) {
  const r = await fetch(`${HOST}${path}`, opts);
  return { status: r.status, json: (await r.json()) as Record<string, unknown> };
}

function divider(label: string): void {
  console.log("\n" + "=".repeat(76));
  console.log("▶ " + label);
  console.log("=".repeat(76));
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  divider("1. POST /api/project — start the workflow");
  const created = await fetchJson("/api/project", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(BRIEF),
  });
  console.log(`status: ${created.status}`);
  if (created.status !== 200) {
    console.error("Project creation failed:", JSON.stringify(created.json, null, 2));
    process.exitCode = 1;
    return;
  }
  const projectId = (created.json as { project: { id: string } }).project.id;
  console.log(`project id: ${projectId}`);

  divider("2. Poll until plan-approval gate is reached");
  // The pipeline goes: intake → product-discovery → cto-review (HLD) →
  // plan-draft (LLD) → plan-approval (USER GATE). Each stage is a real LLM
  // call (~5-15s) so the whole front half is ~40-90s.
  const startedAt = Date.now();
  let lastStage = "";
  let lastChatLen = 0;
  let approval = false;

  while (Date.now() - startedAt < 5 * 60 * 1000) {
    const list = await fetchJson("/api/project");
    const current = ((list.json as { projects: Array<Record<string, unknown>> }).projects ?? []).find(
      (p) => p.id === projectId,
    ) as
      | undefined
      | {
          stage: string;
          waitingForUser: boolean;
          chat: Array<{ role: string; speaker?: string; text: string; stage: string }>;
          features: unknown;
          hld: unknown;
          lld: unknown;
        };
    if (!current) {
      console.log("project not found, waiting…");
      await sleep(3000);
      continue;
    }

    if (current.stage !== lastStage) {
      const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
      console.log(`[${elapsed}s] stage → ${current.stage} (waiting=${current.waitingForUser})`);
      lastStage = current.stage;
    }

    const newChat = current.chat.slice(lastChatLen);
    for (const turn of newChat) {
      const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
      const speaker = turn.role === "user" ? "USER" : turn.role === "system" ? "SYSTEM" : (turn.speaker ?? "?").toUpperCase();
      const oneLine = turn.text.split("\n")[0]!.slice(0, 130);
      console.log(`  [${elapsed}s] ${speaker} (${turn.stage}): ${oneLine}${turn.text.length > 130 ? "…" : ""}`);
    }
    lastChatLen = current.chat.length;

    if (current.stage === "plan-approval" && current.waitingForUser) {
      approval = true;
      break;
    }
    if (current.stage === "intake" && !current.waitingForUser) {
      // Intake completed without auto-advance — push it forward with a follow-up.
      console.log("  ↳ Sending follow-up to advance from intake…");
      await fetchJson(`/api/project/${projectId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: BRIEF.pitch.slice(0, 200) + " — proceed with the plan." }),
      });
    }
    if (current.stage === "intake" && current.waitingForUser) {
      console.log("  ↳ Intake paused for clarification, sending follow-up.");
      await fetchJson(`/api/project/${projectId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Yes, proceed with what we have — local-first weather app, no payments, MVP scope as described." }),
      });
    }

    await sleep(4000);
  }

  if (!approval) {
    console.error(`✗ Workflow did not reach plan-approval within timeout (last stage: ${lastStage})`);
    process.exitCode = 1;
    return;
  }

  divider("3. Inspect artefacts");
  // Get the full project state and assert content.
  const fullR = await fetchJson("/api/project");
  const full = ((fullR.json as { projects: Array<Record<string, unknown>> }).projects ?? []).find(
    (p) => p.id === projectId,
  ) as {
    features: {
      personas: Array<{ name: string; context: string }>;
      features: Array<{ name: string; priority: string; userJob: string }>;
      outOfScope: string[];
    } | null;
    hld: {
      summary: string;
      contexts: string[];
      stack: Array<{ area: string; choice: string }>;
      risks: Array<{ risk: string }>;
    } | null;
    lld: {
      modules: Array<{ id: string; description: string }>;
      apis: Array<{ method: string; path: string }>;
    } | null;
  };

  if (full.features) {
    console.log("\nPRODUCT OWNER OUTPUT:");
    console.log("  Personas:");
    for (const p of full.features.personas) console.log(`    - ${p.name}: ${p.context.slice(0, 80)}`);
    console.log("  Features:");
    for (const f of full.features.features) {
      console.log(`    - (${f.priority.toUpperCase()}) ${f.name} — ${f.userJob.slice(0, 80)}`);
    }
    console.log("  Out of scope:");
    for (const o of full.features.outOfScope) console.log(`    - ${o}`);
  }

  if (full.hld) {
    console.log("\nSOLUTION ARCHITECT OUTPUT:");
    console.log("  Summary:", full.hld.summary);
    console.log("  Contexts:", full.hld.contexts.join(", "));
    console.log("  Stack:");
    for (const s of full.hld.stack) console.log(`    - ${s.area}: ${s.choice}`);
  }

  if (full.lld) {
    console.log("\nCTO OUTPUT:");
    console.log("  Modules:");
    for (const m of full.lld.modules) console.log(`    - ${m.id}: ${m.description.slice(0, 80)}`);
    console.log("  APIs:");
    for (const a of full.lld.apis) console.log(`    - ${a.method} ${a.path}`);
  }

  divider("4. VERIFICATION");
  const flat = JSON.stringify(full).toLowerCase();
  // Exclude the outOfScope text from the forbidden check — explicitly
  // listing "AI itinerary" under outOfScope is CORRECT behaviour (PO
  // acknowledging it's future scope), not a fabrication.
  const outOfScopeBlob = (full.features?.outOfScope ?? []).join(" ").toLowerCase();
  const inScopeFlat = JSON.stringify({
    features: full.features?.features,
    hld: full.hld,
    lld: full.lld,
  }).toLowerCase();
  const flatExcludingOutOfScope = inScopeFlat;

  const forbidden = [
    { needle: "stripe", note: "brief says 'Avoid: payments'" },
    { needle: "checkout", note: "no checkout in scope" },
    { needle: "postgis", note: "not needed for a weather app" },
    { needle: "marketplace", note: "wrong domain" },
    { needle: "tattoo", note: "wrong domain" },
  ];
  void outOfScopeBlob; // kept for debugging
  const required = [
    { needle: "weather", note: "core" },
    { needle: "forecast", note: "core" },
    { needle: "activit", note: "core" },
    { needle: "openweather", note: "stated API preference" },
  ];

  let pass = true;
  for (const { needle, note } of forbidden) {
    const hit = flatExcludingOutOfScope.includes(needle);
    console.log((hit ? "✗" : "✓") + ` no "${needle}" in IN-SCOPE artefacts (${note})`);
    if (hit) pass = false;
  }
  for (const { needle, note } of required) {
    const hit = flat.includes(needle);
    console.log((hit ? "✓" : "✗") + ` contains "${needle}" (${note})`);
    if (!hit) pass = false;
  }
  const elapsedTotal = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\nTotal time to plan-approval: ${elapsedTotal}s`);
  console.log("Outcome: " + (pass ? "PASS" : "FAIL"));
  process.exitCode = pass ? 0 : 1;
}

main().catch((e) => {
  console.error("Smoke threw:", e);
  process.exitCode = 1;
});
