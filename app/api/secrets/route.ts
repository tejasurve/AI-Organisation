// app/api/secrets/route.ts
// GET → list configured secrets (masked)

import { NextResponse } from "next/server";
import { listSecretStatuses } from "@/lib/platform/vault/secrets.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ secrets: listSecretStatuses() });
}
