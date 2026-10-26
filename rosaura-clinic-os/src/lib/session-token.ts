import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "rosaura_session";
export const SESSION_SECONDS = 60 * 60 * 12;

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

export async function signSessionToken(userId: string) {
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_SECONDS}s`)
    .sign(secretKey());
}

/** Mengembalikan userId bila tanda tangan dan masa berlaku token sah. */
export async function verifySessionToken(token: string | undefined) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    return typeof payload.userId === "string" ? payload.userId : null;
  } catch {
    return null;
  }
}
