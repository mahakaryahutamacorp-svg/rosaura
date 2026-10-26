import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "rosaura_session";
export const SESSION_SECONDS = 60 * 60 * 12;

export interface SessionClaims {
  userId: string;
  /** Harus sama dengan User.tokenVersion di database; dinaikkan untuk mencabut sesi. */
  version: number;
}

function secretKey() {
  const value = process.env.AUTH_SECRET;
  if (!value) {
    throw new Error("AUTH_SECRET belum diatur");
  }
  if (process.env.NODE_ENV === "production" && value.length < 32) {
    console.warn("AUTH_SECRET kurang dari 32 karakter. Ganti dengan rahasia acak yang panjang.");
  }
  return new TextEncoder().encode(value);
}

export async function signSessionToken(userId: string, version = 0) {
  return new SignJWT({ userId, ver: version })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_SECONDS}s`)
    .sign(secretKey());
}

/** Memeriksa tanda tangan dan masa berlaku token. Versi dicek terhadap database di requireUser. */
export async function verifySessionClaims(token: string | undefined): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (typeof payload.userId !== "string") return null;
    // Token lama tanpa "ver" dianggap versi 0.
    const version = typeof payload.ver === "number" ? payload.ver : 0;
    return { userId: payload.userId, version };
  } catch {
    return null;
  }
}

export async function verifySessionToken(token: string | undefined) {
  return (await verifySessionClaims(token))?.userId ?? null;
}
