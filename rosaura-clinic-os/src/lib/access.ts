import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { readSessionUserId } from "@/lib/session";

export interface AppUser {
  userId: string;
  employeeId: string;
  name: string;
  email: string;
  roles: string[];
}

export function isOwner(user: AppUser) {
  return user.roles.includes("OWNER");
}

export function can(user: AppUser, roles: string[]) {
  return isOwner(user) || roles.some((role) => user.roles.includes(role));
}

export function canSeeClinical(user: AppUser) {
  return can(user, ["CLINICAL"]);
}

export function canBill(user: AppUser) {
  return can(user, ["FRONT_OFFICE"]);
}

export function canBook(user: AppUser) {
  return can(user, ["FRONT_OFFICE", "CLINICAL"]);
}

export function canAdjustStock(user: AppUser) {
  return can(user, ["WAREHOUSE"]);
}

export function canSeeStock(user: AppUser) {
  return can(user, ["WAREHOUSE", "CLINICAL"]);
}

export function canOperateBooking(user: AppUser, therapistId: string) {
  if (can(user, ["FRONT_OFFICE"])) return true;
  return user.roles.includes("CLINICAL") && user.employeeId === therapistId;
}

export async function requireUser(): Promise<AppUser> {
  const userId = await readSessionUserId();
  if (!userId) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { employee: { include: { roles: { include: { role: true } } } } },
  });

  if (!user || !user.isActive || !user.employee.isActive) {
    redirect("/login");
  }

  return {
    userId: user.id,
    employeeId: user.employeeId,
    name: user.employee.name,
    email: user.email,
    roles: user.employee.roles.map((item) => item.role.name),
  };
}
