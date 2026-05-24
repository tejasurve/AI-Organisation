// app/api/project/[id]/next-sprint/route.ts
// POST → kick off a new sprint after the project has reached "done".
//
// Body: { focus: string }
//
// Behaviour: archives the current sprint into Project.sprintHistory,
// computes carry-over (incomplete stories + open defects + low-severity
// security findings), increments currentSprint, and asks the PM to draft
// fresh stories anchored on the user-supplied focus + the carry-over.

import { NextResponse } from "next/server";

import { handlePlanNextSprint } from "@/lib/platform/workflow/engine.ts";
import { getProject } from "@/lib/platform/workflow/store.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: { id: string };
}

export async function POST(req: Request, { params }: RouteParams) {
  const body = (await req.json().catch(() => null)) as
    | { focus?: string }
    | null;
  if (!body || typeof body.focus !== "string" || body.focus.trim().length === 0) {
    return NextResponse.json(
      { error: "missing focus string in body" },
      { status: 400 },
    );
  }
  const project = getProject(params.id);
  if (!project) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (project.stage !== "done") {
    return NextResponse.json(
      {
        error: `can only plan next sprint from the "done" stage (current: "${project.stage}")`,
      },
      { status: 409 },
    );
  }
  await handlePlanNextSprint(params.id, body.focus);
  return NextResponse.json({ ok: true, nextSprint: project.currentSprint + 1 });
}
