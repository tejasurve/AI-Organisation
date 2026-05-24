// app/api/demo/route.ts
//
// Drives a canned demo cycle through the SAME bus the real pipeline uses, so
// the office animates end-to-end without any LLM credit burn.
//
// POST /api/demo            → starts a default demo (waitlist MVP)
// POST /api/demo?flavour=secfail   → security blocks the release
// POST /api/demo?flavour=qafail    → QA fails with bugs
//
// All emitted events are real AgentEvents — same surface, same mapper, same
// renderer. The only difference vs the real pipeline is who's pushing them in.

import { emit } from "@/lib/simulation/event-bus.ts";
import type { AgentEventInput } from "@/lib/simulation/types.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Flavour = "happy" | "secfail" | "qafail";

export async function POST(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const flavour = (url.searchParams.get("flavour") ?? "happy") as Flavour;
  // We intentionally don't await — fire-and-forget so the HTTP response is
  // snappy; the events stream into clients via SSE.
  void runDemo(flavour);
  return Response.json({ ok: true, flavour });
}

export async function GET(req: Request): Promise<Response> {
  // Allow GET too for convenience (curl, browser link).
  return POST(req);
}

async function runDemo(flavour: Flavour): Promise<void> {
  const sleep = (ms: number): Promise<void> =>
    new Promise<void>((r) => setTimeout(r, ms));

  const events: Array<[number, AgentEventInput]> = [];
  const push = (delay: number, ev: AgentEventInput) => events.push([delay, ev]);

  push(0, { type: "pipeline.start", idea: "Waitlist MVP for an AI accountant for solo founders." });

  push(900, { type: "agent.started", agent: "ceo" });
  push(2400, { type: "agent.completed", agent: "ceo", summary: "OKRs set, briefs delegated." });

  push(2900, { type: "agent.started", agent: "cto" });
  push(4600, { type: "agent.completed", agent: "cto", summary: "Stack: Next.js, Postgres, Stripe." });

  push(5000, { type: "agent.started", agent: "engineering-manager" });
  push(6600, { type: "validation.ok", features: 3, tasks: 7 });
  push(6800, { type: "agent.completed", agent: "engineering-manager", summary: "3 features, 7 tasks." });

  push(7200, { type: "agent.started", agent: "developer", taskId: "T-3", note: "Waitlist signup endpoint" });
  push(8200, { type: "agent.progress", agent: "developer", pct: 25, note: "Schema + migrations" });
  push(9600, { type: "agent.progress", agent: "developer", pct: 50, note: "API handler" });
  push(11000, { type: "agent.progress", agent: "developer", pct: 75, note: "Tests" });
  push(12200, { type: "agent.completed", agent: "developer", taskId: "T-3", summary: "Endpoint + tests delivered." });

  push(12700, { type: "agent.started", agent: "qa" });
  if (flavour === "qafail") {
    push(14100, { type: "qa.verdict", decision: "FAIL", bugs: 2 });
    push(14400, {
      type: "agent.completed",
      agent: "qa",
      summary: "FAIL — regression in duplicate-email handling.",
    });
    push(15200, { type: "pipeline.finished", decision: "GATE_BLOCKED_QA", ms: 15000 });
    await scheduleAll(events, sleep);
    return;
  }
  push(14100, { type: "qa.verdict", decision: "PASS", bugs: 0 });
  push(14400, { type: "agent.completed", agent: "qa", summary: "PASS — 8 tests green." });

  push(14900, { type: "agent.started", agent: "cybersecurity" });
  if (flavour === "secfail") {
    push(16400, { type: "security.verdict", decision: "NO_GO", critical: 1 });
    push(16700, {
      type: "agent.completed",
      agent: "cybersecurity",
      summary: "NO_GO — unbounded input on email field; XSS risk.",
    });
    push(17500, { type: "pipeline.finished", decision: "GATE_BLOCKED_SECURITY", ms: 17000 });
    await scheduleAll(events, sleep);
    return;
  }
  push(16400, { type: "security.verdict", decision: "GO", critical: 0 });
  push(16700, { type: "agent.completed", agent: "cybersecurity", summary: "GO — no critical findings." });

  push(17100, { type: "files.written", taskId: "T-3", count: 4, bytes: 8421 });
  push(18200, { type: "pipeline.finished", decision: "WROTE_FILES", ms: 18000 });

  await scheduleAll(events, sleep);
}

async function scheduleAll(
  schedule: Array<[number, AgentEventInput]>,
  sleep: (ms: number) => Promise<void>,
): Promise<void> {
  const t0 = Date.now();
  for (const [delay, ev] of schedule) {
    const elapsed = Date.now() - t0;
    if (elapsed < delay) await sleep(delay - elapsed);
    emit(ev);
  }
}
