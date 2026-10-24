"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { clearSession, createSession } from "@/lib/session";

const attempts = new Map<string, { count: number; resetAt: number }>();

export async function loginAction(
  _previous: { error: string },
  formData: FormData,
): Promise<{ error: string }> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { error: "Isi email dan kata sandi." };
  }

  const now = Date.now();
  const attempt = attempts.get(email);
  if (attempt && attempt.resetAt > now && attempt.count >= 5) {
    return { error: "Terlalu banyak percobaan. Coba lagi beberapa menit lagi." };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { employee: true },
  });
  const valid = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !valid || !user.isActive || !user.employee.isActive) {
    const current = attempt && attempt.resetAt > now ? attempt : { count: 0, resetAt: now + 10 * 60 * 1000 };
    attempts.set(email, { count: current.count + 1, resetAt: current.resetAt });
    return { error: "Email atau kata sandi tidak sesuai." };
  }

  attempts.delete(email);
  await createSession(user.id);
  redirect("/dashboard");
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}
