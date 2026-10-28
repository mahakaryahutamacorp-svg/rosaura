import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ServiceError } from "@/lib/errors";
import type { AppUser } from "@/lib/access";
import { can } from "@/lib/access";
import { nextCode } from "@/lib/codes";
import { rankBySmartSearch } from "@/lib/search";
import { writeAudit } from "@/services/audit";

export const CLIENT_PAGE_SIZE = 25;

function safePageNumber(page: number) {
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

export async function listClients(query: string, page: number, includePhone = false) {
  const term = query.trim().slice(0, 80);
  const where: Prisma.ClientWhereInput = term
    ? {
        OR: [
          { fullName: { contains: term } },
          { clientCode: { contains: term } },
          { address: { contains: term } },
          ...(includePhone ? [{ phone: { contains: term } }] : []),
        ],
      }
    : {};
  const total = await prisma.client.count({ where });
  const pages = Math.max(1, Math.ceil(total / CLIENT_PAGE_SIZE));
  const safePage = Math.min(safePageNumber(page), pages);
  const items = await prisma.client.findMany({
    where,
    include: { _count: { select: { skinRecords: true } } },
    orderBy: { fullName: "asc" },
    skip: (safePage - 1) * CLIENT_PAGE_SIZE,
    take: CLIENT_PAGE_SIZE,
  });
  return { total, page: safePage, pages, pageSize: CLIENT_PAGE_SIZE, items };
}

export async function getClientProfile(clientId: string) {
  return prisma.client.findUnique({
    where: { id: clientId },
    include: {
      skinRecords: {
        orderBy: { visitDate: "desc" },
        include: { photos: { orderBy: { createdAt: "asc" } } },
      },
    },
  });
}

function clientRowSelect(includePhone: boolean) {
  return {
    id: true,
    fullName: true,
    clientCode: true,
    dateOfBirth: true,
    isActive: true,
    phone: includePhone,
    _count: { select: { skinRecords: true } },
  } satisfies Prisma.ClientSelect;
}

/** Id klien yang cocok, sudah diurutkan dari skor tertinggi. Telepon hanya dicari bila boleh dilihat. */
async function rankClientIds(term: string, includePhone: boolean) {
  const candidates = await prisma.client.findMany({
    orderBy: [{ fullName: "asc" }, { id: "asc" }],
    select: { id: true, fullName: true, clientCode: true, address: true, phone: includePhone },
  });
  return rankBySmartSearch(candidates, term, (client) => [
    client.fullName,
    client.clientCode,
    client.address,
    includePhone ? client.phone : null,
  ]).map((client) => client.id);
}

export async function listClientRows(query: string, page: number, includePhone: boolean) {
  const term = query.trim().slice(0, 80);
  const select = clientRowSelect(includePhone);

  if (!term) {
    const total = await prisma.client.count();
    const pages = Math.max(1, Math.ceil(total / CLIENT_PAGE_SIZE));
    const safePage = Math.min(safePageNumber(page), pages);
    const items = await prisma.client.findMany({
      orderBy: [{ fullName: "asc" }, { id: "asc" }],
      skip: (safePage - 1) * CLIENT_PAGE_SIZE,
      take: CLIENT_PAGE_SIZE,
      select,
    });
    return { total, page: safePage, pages, items };
  }

  const rankedIds = await rankClientIds(term, includePhone);
  const total = rankedIds.length;
  const pages = Math.max(1, Math.ceil(total / CLIENT_PAGE_SIZE));
  const safePage = Math.min(safePageNumber(page), pages);
  const pageIds = rankedIds.slice((safePage - 1) * CLIENT_PAGE_SIZE, safePage * CLIENT_PAGE_SIZE);
  const rows = await prisma.client.findMany({ where: { id: { in: pageIds } }, select });
  const byId = new Map(rows.map((row) => [row.id, row]));
  const items = pageIds.flatMap((id) => {
    const row = byId.get(id);
    return row ? [row] : [];
  });
  return { total, page: safePage, pages, items };
}

export async function listClientOptions() {
  return prisma.client.findMany({
    where: { isActive: true },
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true, clientCode: true },
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

  const clientCode = await nextCode("CL", await prisma.client.count(), async (code) =>
    Boolean(await prisma.client.findUnique({ where: { clientCode: code }, select: { id: true } })),
  );
  const client = await prisma.client.create({
    data: {
      clientCode,
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
