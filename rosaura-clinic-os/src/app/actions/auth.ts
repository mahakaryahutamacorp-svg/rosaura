"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { clearSession, createSession } from "@/lib/session";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_IP_EMAIL = 5;
const MAX_PER_EMAIL = 15;
const MAX_TRACKED = 2000;

// Rate limiting in-memory yang aman dengan batas memori maksimal & pruning otomatis.
// Tidak bergantung pada tabel database tambahan sehingga kompatibel penuh dengan MySQL Hostinger.
const attempts = new Map<string, { count: number; resetAt: number }>();

let dummyHash: string | null = null;
function fakeHash() {
  dummyHash ??= bcrypt.hashSync("rosaura-dummy-password", 10);
  return dummyHash;
}

function prune(now: number) {
  if (attempts.size < MAX_TRACKED) return;
  for (const [key, value] of attempts) {
    if (value.resetAt <= now) attempts.delete(key);
  }
  while (attempts.size >= MAX_TRACKED) {
    const oldest = attempts.keys().next().value;
    if (oldest === undefined) break;
    attempts.delete(oldest);
  }
}

function isBlocked(key: string, limit: number, now: number) {
  const entry = attempts.get(key);
  return Boolean(entry && entry.resetAt > now && entry.count >= limit);
}

function recordFailure(key: string, now: number) {
  const entry = attempts.get(key);
  if (entry && entry.resetAt > now) {
    attempts.set(key, { count: entry.count + 1, resetAt: entry.resetAt });
  } else {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
  }
}

async function clientIp() {
  try {
    const list = await headers();
    const forwarded = list.get("x-forwarded-for")?.split(",")[0]?.trim();
    return (forwarded || list.get("x-real-ip") || "unknown").slice(0, 64);
  } catch {
    return "unknown";
  }
}

export async function loginAction(
  _previous: { error: string },
  formData: FormData,
): Promise<{ error: string }> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 190);
  const password = String(formData.get("password") ?? "").slice(0, 200);
  if (!email || !password) {
    return { error: "Isi email dan kata sandi." };
  }

  const now = Date.now();
  prune(now);
  const ipKey = `ip|${await clientIp()}|${email}`;
  const emailKey = `email|${email}`;
  if (isBlocked(ipKey, MAX_PER_IP_EMAIL, now) || isBlocked(emailKey, MAX_PER_EMAIL, now)) {
    return { error: "Terlalu banyak percobaan. Coba lagi beberapa menit lagi." };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { employee: true },
  });

  // bcrypt selalu dijalankan agar tidak bisa menebak email terdaftar dari lamanya respons.
  const valid = await bcrypt.compare(password, user?.passwordHash ?? fakeHash());
  if (!user || !valid || !user.isActive || !user.employee.isActive) {
    recordFailure(ipKey, now);
    recordFailure(emailKey, now);
    return { error: "Email atau kata sandi tidak sesuai." };
  }

  attempts.delete(ipKey);
  await createSession(user.id);
  redirect("/dashboard");
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}
