import { NextResponse } from "next/server";

import { getDistributor, searchMedicines } from "@/lib/db/store";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const meds = searchMedicines(q).slice(0, 50);
  const results = meds.map((m) => {
    const d = getDistributor(m.distributorId);
    return {
      id: m.id,
      name: m.name,
      brand: m.brand,
      genericName: m.genericName,
      distributor: d
        ? { id: d.id, name: d.name }
        : { id: m.distributorId, name: "Unknown distributor" },
      mrpPaise: m.mrpPaise,
      sellingPricePaise: m.sellingPricePaise,
      scheme: m.scheme,
      packSize: m.packSize,
    };
  });
  return NextResponse.json({ results });
}
