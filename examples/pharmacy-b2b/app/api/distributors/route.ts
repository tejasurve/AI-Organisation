import { NextResponse } from "next/server";

import { listDistributors } from "@/lib/db/store";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const distributors = listDistributors().map((d) => ({
    id: d.id,
    name: d.name,
    region: d.region,
    rating: d.rating,
  }));
  return NextResponse.json({ distributors });
}
