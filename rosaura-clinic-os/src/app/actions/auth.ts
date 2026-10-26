"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { clearSession, createSession, readSession } from "@/lib/session";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_IP_EMAIL = 5;
const MAX_PER_EMAIL = 15;

// Hash tiruan agar waktu respons sama baik email terdaftar maupun tidak.
let dummyHash: string | null = null;
function fakeHash() {
  dummyHash ??= bcrypt.hashSync("rosaura-dummy-password", 10);
  return dummyHash;
}

// Pencatat percobaan disimpan di database: bertahan saat server restart dan berlaku
// walau aplikasi berjalan di lebih dari satu proses.
async function isBlocked(ipKey: string, emailKey: string, now: Date) {
  const rows = await prisma.loginAttempt.findMany({
    where: { key: { in: [ipKey, emailKey] }, resetAt: { gt: now } },
  });
  return rows.some((row) => row.count >= (row.key === ipKey ? MAX_PER_IP_EMAIL : MAX_PER_EMAIL));
}

async function recordFailure(key: string, now: Date) {
  const existing = await prisma.loginAttempt.findUnique({ where: { key } });
  if (existing && existing.resetAt > now) {
    await prisma.loginAttempt.update({ where: { key }, data: { count: { increment: 1 } } });
    return;
  }
  const resetAt = new Date(now.getTime() + WINDOW_MS);
  await prisma.loginAttempt.upsert({
    where: { key },
    create: { key, count: 1, resetAt },
    update: { count: 1, resetAt },
  });
}

async function clientIp() {
  const list = await headers();
  const forwarded = list.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (forwarded || list.get("x-real-ip") || "unknown").slice(0, 64);
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

  const now = new Date();
  // Bersihkan catatan yang sudah lewat agar tabel tidak membengkak.
  await prisma.loginAttempt.deleteMany({ where: { resetAt: { lte: now } } });
  const ipKey = `ip|${await clientIp()}|${email}`;
  const emailKey = `email|${email}`;
  if (await isBlocked(ipKey, emailKey, now)) {
    return { error: "Terlalu banyak percobaan. Coba lagi beberapa menit lagi." };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { employee: true },
  });
  // bcrypt selalu dijalankan agar tidak bisa menebak email terdaftar dari lamanya respons.
  const valid = await bcrypt.compare(password, user?.passwordHash ?? fakeHash());
  if (!user || !valid || !user.isActive || !user.employee.isActive) {
    await Promise.all([recordFailure(ipKey, now), recordFailure(emailKey, now)]);
    return { error: "Email atau kata sandi tidak sesuai." };
  }

  await prisma.loginAttempt.deleteMany({ where: { key: ipKey } });
  await createSession(user.id, user.tokenVersion);
  redirect("/dashboard");
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}

/** Mencabut semua sesi akun ini di semua perangkat, termasuk perangkat ini. */
export async function logoutAllAction() {
  const session = await readSession();
  if (session) {
    await prisma.user.updateMany({
      where: { id: session.userId, tokenVersion: session.version },
      data: { tokenVersion: { increment: 1 } },
    });
  }
  await clearSession();
  redirect("/login");
}
