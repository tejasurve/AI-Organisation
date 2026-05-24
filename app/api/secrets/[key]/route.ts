// app/api/secrets/[key]/route.ts
//
// PUT    → set a secret
// DELETE → remove a secret

import { NextResponse } from "next/server";

import {
  SECRET_KEYS,
  type SecretKey,
  deleteSecret,
  setSecret,
} from "@/lib/platform/vault/secrets.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function ensureKey(s: string): SecretKey | null {
  return (SECRET_KEYS as readonly string[]).includes(s) ? (s as SecretKey) : null;
}

interface RouteParams {
  params: { key: string };
}

export async function PUT(req: Request, { params }: RouteParams) {
  const key = ensureKey(params.key);
  if (!key) {
    return NextResponse.json({ error: "unknown secret key" }, { status: 400 });
  }
  const body = (await req.json().catch(() => null)) as { value?: string } | null;
  if (!body?.value || typeof body.value !== "string") {
    return NextResponse.json({ error: "missing value" }, { status: 400 });
  }
  setSecret(key, body.value.trim());
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  const key = ensureKey(params.key);
  if (!key) {
    return NextResponse.json({ error: "unknown secret key" }, { status: 400 });
  }
  deleteSecret(key);
  return NextResponse.json({ ok: true });
}
