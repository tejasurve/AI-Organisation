import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { findRetailerByLicense } from "@/lib/db/store";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/lib/auth/session";

interface LoginRequestBody {
  licenseNumber?: string;
}

export async function POST(req: Request): Promise<Response> {
  let body: LoginRequestBody;
  try {
    body = (await req.json()) as LoginRequestBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const license = (body.licenseNumber ?? "").trim();
  if (!license) {
    return NextResponse.json({ error: "licenseNumber is required" }, { status: 400 });
  }

  const retailer = findRetailerByLicense(license);
  if (!retailer) {
    return NextResponse.json(
      { error: "no retailer found for that license number" },
      { status: 404 },
    );
  }

  cookies().set({
    name: SESSION_COOKIE,
    value: retailer.id,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return NextResponse.json({
    retailer: {
      id: retailer.id,
      name: retailer.name,
      storeName: retailer.storeName,
      licenseNumber: retailer.licenseNumber,
    },
  });
}
