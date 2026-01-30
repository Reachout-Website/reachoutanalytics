import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE = "auth_session";
const LOGIN_PATH = "/login";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow login page and auth API
  if (pathname === LOGIN_PATH || pathname.startsWith("/api/auth/")) {
    return NextResponse.next();
  }

  // Allow static assets and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const authSecret = process.env.AUTH_SECRET;
  const cookieValue = request.cookies.get(AUTH_COOKIE)?.value;

  if (!authSecret || cookieValue !== authSecret) {
    const loginUrl = new URL(LOGIN_PATH, request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
