// app/api/project/[id]/route.ts
// GET    → get one project's state (polled by client)
// DELETE → drop the project

import { NextResponse } from "next/server";

import { deleteProject, getProject, setCurrentProject } from "@/lib/platform/workflow/store.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: { id: string };
}

export async function GET(_req: Request, { params }: RouteParams) {
  const project = getProject(params.id);
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });
  setCurrentProject(project.id);
  return NextResponse.json({ project });
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  deleteProject(params.id);
  return NextResponse.json({ ok: true });
}
