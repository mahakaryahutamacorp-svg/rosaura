import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("rosaura123", 8);
  for (const name of ["OWNER", "FRONT_OFFICE", "CLINICAL", "WAREHOUSE"]) {
    await prisma.role.upsert({ where: { name }, update: {}, create: { name } });
  }
  const roles = Object.fromEntries((await prisma.role.findMany()).map((role) => [role.name, role]));

  async function upsertEmployee(
    code: string,
    name: string,
    position: string,
    email: string,
    assigned: string[],
  ) {
    const existing = await prisma.user.findUnique({ where: { email } });
    const employee = existing
      ? await prisma.employee.update({
          where: { id: existing.employeeId },
          data: { employeeCode: code, name, position, phone: null, isActive: true },
        })
      : await prisma.employee.create({ data: { employeeCode: code, name, position } });
    const user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: { passwordHash, isActive: true },
        })
      : await prisma.user.create({
          data: { employeeId: employee.id, email, passwordHash, isActive: true },
        });
    await prisma.employeeRole.deleteMany({ where: { employeeId: employee.id } });
    await prisma.employeeRole.createMany({
      data: assigned.map((role) => ({ employeeId: employee.id, roleId: roles[role].id })),
    });
    return { employeeId: employee.id, userId: user.id };
  }

  const gita = await upsertEmployee("DOK-01", "Gita", "Dokter", "gita@rosaura.id", ["OWNER", "CLINICAL"]);
  const admin = await upsertEmployee("ADM-01", "Admin", "Admin", "admin@rosaura.id", [
    "FRONT_OFFICE",
    "WAREHOUSE",
  ]);
  const keepUsers = [gita.userId, admin.userId];
  const keepEmployees = [gita.employeeId, admin.employeeId];

  await prisma.auditLog.updateMany({
    where: { actorUserId: { notIn: keepUsers } },
    data: { actorUserId: gita.userId },
  });
  await prisma.payment.updateMany({
    where: { createdById: { notIn: keepUsers } },
    data: { createdById: gita.userId },
  });
  await prisma.paymentReversal.updateMany({
    where: { createdById: { notIn: keepUsers } },
    data: { createdById: gita.userId },
  });
  await prisma.booking.updateMany({
    where: { createdById: { notIn: keepUsers } },
    data: { createdById: gita.userId },
  });
  await prisma.bookingStatusHistory.updateMany({
    where: { changedById: { notIn: keepUsers } },
    data: { changedById: gita.userId },
  });
  await prisma.stockMovement.updateMany({
    where: { createdById: { notIn: keepUsers } },
    data: { createdById: gita.userId },
  });
  await prisma.visitNote.updateMany({
    where: { authorId: { notIn: keepUsers } },
    data: { authorId: gita.userId },
  });
  await prisma.clinicalPhoto.updateMany({
    where: { createdById: { notIn: keepUsers } },
    data: { createdById: gita.userId },
  });
  await prisma.visit.updateMany({
    where: { providerId: { notIn: keepEmployees } },
    data: { providerId: gita.employeeId },
  });
  await prisma.bookingAssignment.updateMany({
    where: { employeeId: { notIn: keepEmployees } },
    data: { employeeId: gita.employeeId },
  });

  const assignments = await prisma.bookingAssignment.findMany({ orderBy: { id: "asc" } });
  const seen = new Set<string>();
  const duplicateIds: string[] = [];
  for (const row of assignments) {
    const key = `${row.bookingId}:${row.employeeId}`;
    if (seen.has(key)) duplicateIds.push(row.id);
    else seen.add(key);
  }
  if (duplicateIds.length > 0) {
    await prisma.bookingAssignment.deleteMany({ where: { id: { in: duplicateIds } } });
  }

  await prisma.employeeRole.deleteMany({ where: { employeeId: { notIn: keepEmployees } } });
  await prisma.user.deleteMany({ where: { id: { notIn: keepUsers } } });
  await prisma.employee.deleteMany({ where: { id: { notIn: keepEmployees } } });

  const left = await prisma.employee.findMany({
    include: { user: true, roles: { include: { role: true } } },
    orderBy: { employeeCode: "asc" },
  });
  console.log(
    left.map((employee) => ({
      code: employee.employeeCode,
      name: employee.name,
      position: employee.position,
      email: employee.user?.email,
      roles: employee.roles.map((item) => item.role.name),
    })),
  );
  console.log("karyawan tersisa:", left.length);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
