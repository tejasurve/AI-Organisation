import { NextResponse } from "next/server";

import { buildCartResponse } from "@/lib/api/cart-response";
import { getSession } from "@/lib/auth/session";
import { removeCartItem } from "@/lib/db/store";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: { medicineId: string };
}

export async function DELETE(_req: Request, ctx: RouteContext): Promise<Response> {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const medicineId = (ctx.params.medicineId ?? "").trim();
  if (!medicineId) {
    return NextResponse.json({ error: "medicineId path param is required" }, { status: 400 });
  }
  removeCartItem(session.retailerId, medicineId);
  return NextResponse.json(buildCartResponse(session.retailerId));
}
