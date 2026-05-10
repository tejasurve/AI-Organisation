import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import {
  findSignupByEmail,
  insertSignup,
} from "@/lib/db/client";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "invalid JSON body" },
      { status: 400 },
    );
  }

  const obj = (body ?? {}) as Record<string, unknown>;
  const emailRaw = typeof obj.email === "string" ? obj.email.trim() : "";
  if (!EMAIL_RE.test(emailRaw)) {
    return NextResponse.json(
      { error: "email is required and must be a valid email address" },
      { status: 400 },
    );
  }

  const sourceRaw = typeof obj.source === "string" ? obj.source.trim() : "";
  const source = sourceRaw.length > 0 ? sourceRaw : "landing-v1";

  const existing = findSignupByEmail(emailRaw);
  if (existing) {
    return NextResponse.json({ id: existing.id, status: "duplicate" });
  }

  const inserted = insertSignup({
    id: randomUUID(),
    email: emailRaw,
    source,
    createdAt: new Date(),
  });
  return NextResponse.json({ id: inserted.id, status: "queued" });
}
