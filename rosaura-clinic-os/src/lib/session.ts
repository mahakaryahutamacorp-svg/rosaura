import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  SESSION_SECONDS,
  signSessionToken,
  verifySessionClaims,
  type SessionClaims,
} from "@/lib/session-token";

export async function createSession(userId: string, version = 0) {
  const token = await signSessionToken(userId, version);

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function readSession(): Promise<SessionClaims | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySessionClaims(token);
}

export async function readSessionUserId() {
  return (await readSession())?.userId ?? null;
}
