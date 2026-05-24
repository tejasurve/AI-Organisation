// app/api/project/[id]/approve/route.ts
// POST → approve or request-changes on the currently waiting stage

import { NextResponse } from "next/server";

import { handleUserApproval } from "@/lib/platform/workflow/engine.ts";
import { getProject } from "@/lib/platform/workflow/store.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: { id: string };
}

export async function POST(req: Request, { params }: RouteParams) {
  const body = (await req.json().catch(() => null)) as
    | { approved: boolean; comment?: string }
    | null;
  if (!body || typeof body.approved !== "boolean") {
    return NextResponse.json({ error: "missing approved bool" }, { status: 400 });
  }
  if (!getProject(params.id)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  await handleUserApproval(params.id, body.approved, body.comment);
  return NextResponse.json({ ok: true });
}
