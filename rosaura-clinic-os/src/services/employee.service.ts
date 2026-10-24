import { prisma } from "@/lib/db";
import { ServiceError } from "@/lib/errors";
import type { AppUser } from "@/lib/access";
import { isOwner } from "@/lib/access";
import { writeAudit } from "@/services/audit";

const ROLE_NAMES = ["OWNER", "FRONT_OFFICE", "CLINICAL", "WAREHOUSE"] as const;

export async function listEmployees() {
  return prisma.employee.findMany({
    include: { user: true, roles: { include: { role: true } } },
    orderBy: { name: "asc" },
  });
}

export async function updateEmployeeAccess(
  actor: AppUser,
  employeeId: string,
  roleNames: string[],
  isActive: boolean,
) {
  if (!isOwner(actor)) throw new ServiceError("Hanya owner yang mengatur akses karyawan");
  const roles = roleNames.filter((role) => ROLE_NAMES.includes(role as (typeof ROLE_NAMES)[number]));
  if (roles.length === 0) throw new ServiceError("Pilih minimal satu peran");
  if (actor.employeeId === employeeId && !isActive) {
    throw new ServiceError("Anda tidak dapat menonaktifkan akun sendiri");
  }
  if (actor.employeeId === employeeId && !roles.includes("OWNER")) {
    throw new ServiceError("Anda tidak dapat melepas peran owner dari akun sendiri");
  }

  return prisma.$transaction(async (tx) => {
    const employee = await tx.employee.findUnique({ where: { id: employeeId }, include: { user: true } });
    if (!employee?.user) throw new ServiceError("Karyawan tidak ditemukan");
    const roleRows = await tx.role.findMany({ where: { name: { in: roles } } });
    await tx.employee.update({ where: { id: employeeId }, data: { isActive } });
    await tx.user.update({ where: { id: employee.user.id }, data: { isActive } });
    await tx.employeeRole.deleteMany({ where: { employeeId } });
    await tx.employeeRole.createMany({
      data: roleRows.map((role) => ({ employeeId, roleId: role.id })),
    });
    await writeAudit(tx, actor.userId, "ROLE_CHANGE", "employee", employeeId, roles.join(", "));
  });
}
