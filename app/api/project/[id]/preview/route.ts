// app/api/project/[id]/preview/route.ts
//
// GET     → current preview status (idle / starting / ready / errored, port, url)
// POST    → start the preview (boot `next dev` in the workspace, return URL)
// DELETE  → stop the preview (kill the child process)

import { NextResponse } from "next/server";

import { getProject } from "@/lib/platform/workflow/store.ts";
import {
  getPreviewStatus,
  startPreview,
  stopPreview,
} from "@/lib/platform/preview/dev-server.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: { id: string };
}

export async function GET(_req: Request, { params }: RouteParams) {
  if (!getProject(params.id)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const state = getPreviewStatus(params.id);
  return NextResponse.json(state);
}

export async function POST(_req: Request, { params }: RouteParams) {
  if (!getProject(params.id)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const state = await startPreview(params.id);
  // 502 if the boot failed so the UI can show the error clearly without
  // having to inspect the body.
  const status = state.status === "errored" ? 502 : 200;
  return NextResponse.json(state, { status });
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  if (!getProject(params.id)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const state = await stopPreview(params.id);
  return NextResponse.json(state);
}
