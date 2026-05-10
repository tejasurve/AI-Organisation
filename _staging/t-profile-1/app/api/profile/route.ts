import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import {
  getDistributor,
  getOutstandingForRetailer,
  getRetailer,
} from "@/lib/db/store";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const r = getRetailer(session.retailerId);
  if (!r) {
    return NextResponse.json({ error: "retailer not found" }, { status: 404 });
  }
  const op = getOutstandingForRetailer(r.id);
  const totalPaise = op.reduce((acc, p) => acc + p.amountDuePaise, 0);
  const perDistributor = op.map((p) => {
    const d = getDistributor(p.distributorId);
    return {
      distributor: d
        ? { id: d.id, name: d.name }
        : { id: p.distributorId, name: "Unknown distributor" },
      amountPaise: p.amountDuePaise,
    };
  });
  return NextResponse.json({
    retailer: {
      id: r.id,
      name: r.name,
      ownerName: r.ownerName,
      licenseNumber: r.licenseNumber,
      storeName: r.storeName,
      storeAddress: r.storeAddress,
      phone: r.phone,
      email: r.email,
      gstin: r.gstin,
      favouritesCount: r.favouritesMedicineIds.length,
    },
    outstanding: { totalPaise, perDistributor },
  });
}
