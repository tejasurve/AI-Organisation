// app/api/project/[id]/design/route.ts
// POST → select or redesign a screen during design-approval stage
// Body shapes:
//   { action: "select", screenId }
//   { action: "redesign", screenId, prompt }

import { NextResponse } from "next/server";

import {
  handleScreenRedesign,
  handleScreenSelected,
} from "@/lib/platform/workflow/engine.ts";
import { getProject } from "@/lib/platform/workflow/store.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: { id: string };
}

export async function POST(req: Request, { params }: RouteParams) {
  const project = getProject(params.id);
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as
    | { action: "select"; screenId: string }
    | { action: "redesign"; screenId: string; prompt: string }
    | null;
  if (!body) return NextResponse.json({ error: "missing body" }, { status: 400 });

  if (body.action === "select") {
    await handleScreenSelected(project.id, body.screenId);
    return NextResponse.json({ ok: true });
  }
  if (body.action === "redesign") {
    const screen = project.design?.screens.find((s) => s.id === body.screenId);
    if (!screen) {
      return NextResponse.json({ error: "screen not in project" }, { status: 404 });
    }
    await handleScreenRedesign(project.id, screen, body.prompt);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
