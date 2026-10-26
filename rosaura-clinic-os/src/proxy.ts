import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session-token";

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
  "/display",
  "/api/display",
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  // Tanda tangan dan masa berlaku diverifikasi di sini, bukan sekadar cek keberadaan cookie.
  const hasSession = Boolean(await verifySessionToken(token));
  const isProtected = PROTECTED.some((path) => pathname === path || pathname.startsWith(`${path}/`));

  if (isProtected && !hasSession) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ message: "Perlu masuk" }, { status: 401, headers: { "Cache-Control": "no-store" } });
    }
    const response = NextResponse.redirect(new URL("/login", request.url));
    if (token) response.cookies.delete(SESSION_COOKIE);
    return response;
  }
  if (pathname === "/") {
    return NextResponse.redirect(new URL(hasSession ? "/dashboard" : "/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg$).*)"],
};
