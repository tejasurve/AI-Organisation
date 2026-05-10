import { NextResponse } from "next/server";

import { getDistributor, listOffers } from "@/lib/db/store";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const offers = listOffers().map((o) => {
    const d = getDistributor(o.distributorId);
    return {
      id: o.id,
      title: o.title,
      description: o.description,
      bannerLabel: o.bannerLabel,
      validUntil: o.validUntil.toISOString(),
      distributor: d
        ? { id: d.id, name: d.name }
        : { id: o.distributorId, name: "Unknown distributor" },
    };
  });
  return NextResponse.json({ offers });
}
