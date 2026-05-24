// app/api/project/[id]/message/route.ts
// POST → user sends a message to the team

import { NextResponse } from "next/server";

import { handleUserMessage } from "@/lib/platform/workflow/engine.ts";
import { getProject } from "@/lib/platform/workflow/store.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: { id: string };
}

export async function POST(req: Request, { params }: RouteParams) {
  const body = (await req.json().catch(() => null)) as { text?: string } | null;
  if (!body?.text?.trim()) {
    return NextResponse.json({ error: "missing text" }, { status: 400 });
  }
  if (!getProject(params.id)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  await handleUserMessage(params.id, body.text.trim());
  return NextResponse.json({ ok: true });
}
