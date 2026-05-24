// app/api/project/route.ts
// GET   → list projects + current
// POST  → create + kick off intake

import { NextResponse } from "next/server";

import { handleUserKickoff } from "@/lib/platform/workflow/engine.ts";
import { createProject, listProjects, getCurrentProject } from "@/lib/platform/workflow/store.ts";
import { hasSecret } from "@/lib/platform/vault/secrets.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    projects: listProjects().map(strip),
    current: strip(getCurrentProject()),
  });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { name?: string; pitch?: string; audience?: string; successMetric?: string; githubRepo?: string }
    | null;
  if (!body?.name || !body?.pitch) {
    return NextResponse.json({ error: "name and pitch required" }, { status: 400 });
  }

  // Block intake at the front door if no LLM key is configured. The
  // workflow is LLM-driven end-to-end now — there is no synthesizer
  // fallback to fabricate plans without one. Surface a precise error so
  // the UI can route the user to Settings → API Keys instead of starting
  // a project that's going to halt at the first stage anyway.
  if (!hasSecret("gemini") && !hasSecret("anthropic") && !hasSecret("openai")) {
    return NextResponse.json(
      {
        error: "no_llm_key",
        message:
          "No LLM API key configured. The AI organisation needs one to think. Add a Gemini, Anthropic, or OpenAI key in Settings → API Keys, then start your project.",
        configuredKeys: { gemini: false, anthropic: false, openai: false },
      },
      { status: 412 }, // 412 Precondition Failed
    );
  }

  const githubRepo = body.githubRepo?.trim();
  const githubBinding =
    githubRepo && githubRepo.includes("/")
      ? (() => {
          const [owner, repo] = githubRepo.split("/", 2);
          return { owner, repo, createNew: true };
        })()
      : undefined;

  const project = createProject(
    {
      name: body.name.trim(),
      pitch: body.pitch.trim(),
      audience: body.audience?.trim(),
      successMetric: body.successMetric?.trim(),
    },
    githubBinding ? { github: githubBinding } : {},
  );
  // Fire-and-forget the intake stage; the client will see updates via polling.
  void handleUserKickoff(project.id);
  return NextResponse.json({ project: strip(project) });
}

function strip<T>(p: T): T {
  return p;
}
