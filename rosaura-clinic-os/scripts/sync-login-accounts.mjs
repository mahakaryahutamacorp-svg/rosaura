import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const accounts = [
  {
    code: "DOK-01",
    name: "Gita",
    position: "Dokter",
    email: "dokter@rosaura.id",
    previous: ["gita@rosaura.id"],
    password: "sayangsuami1",
    roles: ["OWNER", "CLINICAL"],
  },
  {
    code: "ADM-01",
    name: "Yaya",
    position: "Admin",
    email: "yaya@rosaura.id",
    previous: ["admin@rosaura.id"],
    password: "majubersama1",
    roles: ["FRONT_OFFICE", "WAREHOUSE"],
  },
];

async function roleId(name) {
  const role = await prisma.role.upsert({ where: { name }, update: {}, create: { name } });
  return role.id;
}

for (const account of accounts) {
  const passwordHash = await bcrypt.hash(account.password, 8);
  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { in: [account.email, ...account.previous] } },
        { employee: { employeeCode: account.code } },
      ],
    },
    include: { employee: true },
  });

  if (!existing) {
    const employee = await prisma.employee.create({
      data: { employeeCode: account.code, name: account.name, position: account.position },
    });
    const user = await prisma.user.create({
      data: { employeeId: employee.id, email: account.email, passwordHash, isActive: true },
    });
    await prisma.employeeRole.createMany({
      data: await Promise.all(
        account.roles.map(async (name) => ({ employeeId: employee.id, roleId: await roleId(name) })),
      ),
    });
    console.log(`akun dibuat ${account.email} ${user.id}`);
    continue;
  }

  await prisma.employee.update({
    where: { id: existing.employeeId },
    data: { name: account.name, position: account.position, isActive: true },
  });
  await prisma.user.update({
    where: { id: existing.id },
    data: { email: account.email, passwordHash, isActive: true },
  });
  console.log(`akun diperbarui ${account.email}`);
}

await prisma.$disconnect();
