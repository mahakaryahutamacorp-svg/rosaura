import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

import { importClinicData } from "./import-clinic";

const prisma = new PrismaClient();

async function main() {
  await prisma.materialUsage.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.stockBatch.deleteMany();
  await prisma.product.deleteMany();
  await prisma.productCategory.deleteMany();
  await prisma.paymentReversal.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.clinicalPhoto.deleteMany();
  await prisma.skinRecord.deleteMany();
  await prisma.visitNote.deleteMany();
  await prisma.visit.deleteMany();
  await prisma.bookingStatusHistory.deleteMany();
  await prisma.bookingAssignment.deleteMany();
  await prisma.bookingService.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.employeeRole.deleteMany();
  await prisma.user.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.role.deleteMany();
  await prisma.client.deleteMany();
  await prisma.service.deleteMany();
  await prisma.room.deleteMany();

  const doctorPasswordHash = await bcrypt.hash("sayangsuami1", 8);
  const adminPasswordHash = await bcrypt.hash("majubersama1", 8);
  const roleNames = ["OWNER", "FRONT_OFFICE", "CLINICAL", "WAREHOUSE"] as const;
  const roles: Record<(typeof roleNames)[number], { id: string }> = {
    OWNER: { id: "" },
    FRONT_OFFICE: { id: "" },
    CLINICAL: { id: "" },
    WAREHOUSE: { id: "" },
  };
  for (const name of roleNames) {
    roles[name] = await prisma.role.create({ data: { name } });
  }

  async function addEmployee(
    code: string,
    name: string,
    position: string,
    email: string,
    assigned: (typeof roleNames)[number][],
    passwordHash: string,
  ) {
    const employee = await prisma.employee.create({
      data: { employeeCode: code, name, position },
    });
    const user = await prisma.user.create({
      data: { employeeId: employee.id, email, passwordHash, isActive: true },
    });
    await prisma.employeeRole.createMany({
      data: assigned.map((role) => ({ employeeId: employee.id, roleId: roles[role].id })),
    });
    return { employee, user };
  }

  const gita = await addEmployee("DOK-01", "Gita", "Dokter", "dokter@rosaura.id", ["OWNER", "CLINICAL"], doctorPasswordHash);
  const admin = await addEmployee("ADM-01", "Yaya", "Admin", "yaya@rosaura.id", ["FRONT_OFFICE", "WAREHOUSE"], adminPasswordHash);

  const rooms = {
    bed1: await prisma.room.create({ data: { name: "Bed 1" } }),
    bed2: await prisma.room.create({ data: { name: "Bed 2" } }),
    bed3: await prisma.room.create({ data: { name: "Bed 3" } }),
  };

  const summary = await importClinicData(prisma, gita.user.id);
  await prisma.auditLog.create({
    data: {
      actorUserId: gita.user.id,
      action: "SEED",
      entityType: "system",
      entityId: "local",
      summary: "Data klinik dimuat dari arsip pasien, rekam kunjungan, dan produk",
    },
  });

  console.log(
    "Staf " +
      [gita, admin].length +
      ", layanan 0, ruang " +
      Object.keys(rooms).length,
  );
  console.log(summary);
  console.log("dokter@rosaura.id · yaya@rosaura.id");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
