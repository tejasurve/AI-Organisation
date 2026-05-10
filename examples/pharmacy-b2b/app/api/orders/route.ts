import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import {
  createOrdersFromCart,
  getDistributor,
  listOrders,
} from "@/lib/db/store";
import { type OrderStatusGroup } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const raw = (searchParams.get("status") ?? "active").toLowerCase();
  if (raw !== "active" && raw !== "closed") {
    return NextResponse.json(
      { error: "status must be 'active' or 'closed'" },
      { status: 400 },
    );
  }
  const group = raw as OrderStatusGroup;
  const orders = listOrders(session.retailerId, group).map((o) => {
    const d = getDistributor(o.distributorId);
    return {
      id: o.id,
      status: o.status,
      placedAt: o.placedAt.toISOString(),
      expectedDelivery: o.expectedDelivery ? o.expectedDelivery.toISOString() : null,
      itemCount: o.itemCount,
      totalPaise: o.totalPaise,
      distributor: d
        ? { id: d.id, name: d.name }
        : { id: o.distributorId, name: "Unknown distributor" },
    };
  });
  return NextResponse.json({ orders });
}

export async function POST(): Promise<Response> {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const created = createOrdersFromCart(session.retailerId);
  if (created.length === 0) {
    return NextResponse.json({ error: "cart is empty" }, { status: 409 });
  }
  return NextResponse.json({
    orderIds: created.map((c) => c.id),
    orderCount: created.length,
  });
}
