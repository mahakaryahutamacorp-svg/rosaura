import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED = [
  "/dashboard",
  "/bookings",
  "/clients",
  "/billing",
  "/services",
  "/inventory",
  "/employees",
  "/audit",
  "/clinical-photos",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has("rosaura_session");
  const isProtected = PROTECTED.some((path) => pathname === path || pathname.startsWith(`${path}/`));

  if (isProtected && !hasSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (pathname === "/") {
    return NextResponse.redirect(new URL(hasSession ? "/dashboard" : "/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg$).*)"],
};
