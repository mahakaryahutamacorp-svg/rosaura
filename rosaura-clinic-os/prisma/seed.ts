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

  const passwordHash = await bcrypt.hash("rosaura123", 8);
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
    role: (typeof roleNames)[number],
    phone: string,
  ) {
    const employee = await prisma.employee.create({
      data: { employeeCode: code, name, position, phone },
    });
    const user = await prisma.user.create({
      data: { employeeId: employee.id, email, passwordHash, isActive: true },
    });
    await prisma.employeeRole.create({ data: { employeeId: employee.id, roleId: roles[role].id } });
    return { employee, user };
  }

  const lidya = await addEmployee("EMP-01", "Lidya Rosa", "Pemilik", "lidya@rosaura.local", "OWNER", "081100000001");
  const rina = await addEmployee("EMP-02", "Rina Kusuma", "Resepsionis", "rina@rosaura.local", "FRONT_OFFICE", "081100000002");
  const sinta = await addEmployee("EMP-03", "Sinta Ayu", "Terapis", "sinta@rosaura.local", "CLINICAL", "081100000003");
  const maya = await addEmployee("EMP-04", "Maya Putri", "Terapis", "maya@rosaura.local", "CLINICAL", "081100000004");
  const dimas = await addEmployee("EMP-05", "Dimas Pratama", "Terapis", "dimas@rosaura.local", "CLINICAL", "081100000005");
  const agus = await addEmployee("EMP-06", "Agus Salim", "Petugas gudang", "agus@rosaura.local", "WAREHOUSE", "081100000006");

  const services = {
    facial: await prisma.service.create({
      data: { code: "FAC-60", name: "Facial Treatment", durationMinutes: 60, price: 350000 },
    }),
    acne: await prisma.service.create({
      data: { code: "ACN-45", name: "Acne Peel", durationMinutes: 45, price: 450000 },
    }),
    bright: await prisma.service.create({
      data: { code: "BRT-90", name: "Brightening Facial", durationMinutes: 90, price: 550000 },
    }),
    massage: await prisma.service.create({
      data: { code: "BDY-60", name: "Body Massage", durationMinutes: 60, price: 300000 },
    }),
    led: await prisma.service.create({
      data: { code: "LED-30", name: "LED Therapy", durationMinutes: 30, price: 275000 },
    }),
  };

  const rooms = {
    bed1: await prisma.room.create({ data: { name: "Bed 1" } }),
    bed2: await prisma.room.create({ data: { name: "Bed 2" } }),
    bed3: await prisma.room.create({ data: { name: "Bed 3" } }),
  };

  const summary = await importClinicData(prisma, lidya.user.id);
  await prisma.auditLog.create({
    data: {
      actorUserId: lidya.user.id,
      action: "SEED",
      entityType: "system",
      entityId: "local",
      summary: "Data klinik dimuat dari arsip pasien, rekam kunjungan, dan produk",
    },
  });

  console.log(
    "Staf " +
      [lidya, rina, sinta, maya, dimas, agus].length +
      ", layanan " +
      Object.keys(services).length +
      ", ruang " +
      Object.keys(rooms).length,
  );
  console.log(summary);
  console.log("Masuk dengan kata sandi rosaura123.");
  console.log("lidya@rosaura.local · rina@rosaura.local · sinta@rosaura.local · agus@rosaura.local");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
