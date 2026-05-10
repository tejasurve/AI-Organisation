import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_API_PATHS = new Set<string>(["/api/auth/login"]);
const SESSION_COOKIE = "pharmacy-session";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");
  const isDashboard = pathname.startsWith("/dashboard");

  if (!isApi && !isDashboard) return NextResponse.next();
  if (isApi && PUBLIC_API_PATHS.has(pathname)) return NextResponse.next();

  const sessionId = request.cookies.get(SESSION_COOKIE)?.value;
  if (!sessionId) {
    if (isApi) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/:path*"],
};
