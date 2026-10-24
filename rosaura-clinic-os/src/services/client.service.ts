import { prisma } from "@/lib/db";
import { ServiceError } from "@/lib/errors";
import type { AppUser } from "@/lib/access";
import { can } from "@/lib/access";
import { writeAudit } from "@/services/audit";

const CLIENT_PAGE_SIZE = 25;

export async function listClients(query: string, page: number) {
  const clients = await prisma.client.findMany({
    include: { _count: { select: { skinRecords: true } } },
    orderBy: { fullName: "asc" },
  });
  const term = query.trim().toLowerCase();
  const filtered = term
    ? clients.filter((client) =>
        [client.fullName, client.clientCode, client.phone, client.address].join(" ").toLowerCase().includes(term),
      )
    : clients;
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const start = (safePage - 1) * CLIENT_PAGE_SIZE;
  return {
    total: filtered.length,
    page: safePage,
    pageSize: CLIENT_PAGE_SIZE,
    items: filtered.slice(start, start + CLIENT_PAGE_SIZE),
  };
}

export async function getClientProfile(clientId: string) {
  return prisma.client.findUnique({
    where: { id: clientId },
    include: {
      skinRecords: { orderBy: { visitDate: "desc" } },
    },
  });
}

export async function listActiveClients() {
  return prisma.client.findMany({
    where: { isActive: true },
    orderBy: { fullName: "asc" },
  });
}

export async function createClient(
  actor: AppUser,
  input: { fullName: string; phone: string; dateOfBirth: string; consent: boolean },
) {
  if (!can(actor, ["FRONT_OFFICE", "CLINICAL"])) {
    throw new ServiceError("Anda tidak dapat mendaftarkan klien");
  }
  const fullName = input.fullName.trim();
  const phone = input.phone.trim();
  if (fullName.length < 3) throw new ServiceError("Nama klien terlalu pendek");
  if (!/^0\d{8,14}$/.test(phone)) throw new ServiceError("Nomor telepon diawali 0 dan berisi angka");
  if (!input.consent) throw new ServiceError("Persetujuan pengolahan data wajib dicentang");

  const duplicate = await prisma.client.findFirst({ where: { phone } });
  if (duplicate) {
    throw new ServiceError(`Nomor ini sudah terdaftar pada ${duplicate.fullName} (${duplicate.clientCode})`);
  }

  const count = await prisma.client.count();
  const client = await prisma.client.create({
    data: {
      clientCode: `CL-${String(count + 1).padStart(4, "0")}`,
      fullName,
      phone,
      dateOfBirth: input.dateOfBirth ? new Date(`${input.dateOfBirth}T00:00:00.000Z`) : null,
      consentVersion: "2026-10",
      consentAt: new Date(),
    },
  });
  await writeAudit(prisma, actor.userId, "CREATE_CLIENT", "client", client.id, client.clientCode);
  return client;
}

export async function setClientActive(actor: AppUser, clientId: string, isActive: boolean) {
  if (!can(actor, ["FRONT_OFFICE"])) throw new ServiceError("Anda tidak dapat mengubah status klien");
  const client = await prisma.client.update({ where: { id: clientId }, data: { isActive } });
  await writeAudit(
    prisma,
    actor.userId,
    "CLIENT_STATUS",
    "client",
    client.id,
    isActive ? "diaktifkan" : "dinonaktifkan",
  );
  return client;
}
