import { NextResponse } from "next/server";

import { buildCartResponse } from "@/lib/api/cart-response";
import { getSession } from "@/lib/auth/session";
import { addCartItem, getMedicine } from "@/lib/db/store";

export const dynamic = "force-dynamic";

interface AddItemBody {
  medicineId?: string;
  qty?: number;
}

export async function POST(req: Request): Promise<Response> {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  let body: AddItemBody;
  try {
    body = (await req.json()) as AddItemBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const medicineId = (body.medicineId ?? "").trim();
  if (!medicineId) {
    return NextResponse.json({ error: "medicineId is required" }, { status: 400 });
  }
  const qty = Number.isFinite(body.qty) && (body.qty as number) >= 1 ? Math.floor(body.qty as number) : 1;
  if (!getMedicine(medicineId)) {
    return NextResponse.json({ error: "medicine not found" }, { status: 404 });
  }
  addCartItem(session.retailerId, medicineId, qty);
  return NextResponse.json(buildCartResponse(session.retailerId));
}
