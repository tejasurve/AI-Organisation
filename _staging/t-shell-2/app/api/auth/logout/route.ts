import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { SESSION_COOKIE } from "@/lib/auth/session";

export async function POST(): Promise<Response> {
  cookies().delete(SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
