import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  SESSION_SECONDS,
  signSessionToken,
  verifySessionToken,
} from "@/lib/session-token";

export async function createSession(userId: string) {
  const token = await signSessionToken(userId);

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

export async function readSessionUserId(): Promise<string | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySessionToken(token);
}
