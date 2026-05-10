import { NextResponse } from "next/server";

import { buildCartResponse } from "@/lib/api/cart-response";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  return NextResponse.json(buildCartResponse(session.retailerId));
}
