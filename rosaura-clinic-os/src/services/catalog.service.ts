import { prisma } from "@/lib/db";
import { ServiceError } from "@/lib/errors";
import type { AppUser } from "@/lib/access";
import { canManageCatalog } from "@/lib/access";
import { writeAudit } from "@/services/audit";

function assertCatalog(actor: AppUser) {
  if (!canManageCatalog(actor)) throw new ServiceError("Anda tidak dapat mengubah katalog");
}

export async function listServices(includeInactive = false) {
  return prisma.service.findMany({
    where: includeInactive ? undefined : { isActive: true },
    orderBy: { name: "asc" },
  });
}

export async function listRooms() {
  return prisma.room.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
}

export async function listTherapists() {
  return prisma.employee.findMany({
    where: { isActive: true, roles: { some: { role: { name: "CLINICAL" } } } },
    orderBy: { name: "asc" },
  });
}

export async function createService(
  actor: AppUser,
  input: { code: string; name: string; durationMinutes: number; price: number },
) {
  if (!canManageCatalog(actor)) throw new ServiceError("Anda tidak dapat mengubah katalog layanan");
  const code = input.code.trim().toUpperCase();
  const name = input.name.trim();
  if (!/^[A-Z0-9-]{2,12}$/.test(code)) throw new ServiceError("Kode layanan 2–12 karakter huruf atau angka");
  if (name.length < 3) throw new ServiceError("Nama layanan terlalu pendek");
  if (!Number.isInteger(input.durationMinutes) || input.durationMinutes < 15 || input.durationMinutes > 240) {
    throw new ServiceError("Durasi layanan antara 15 dan 240 menit");
  }
  if (!Number.isInteger(input.price) || input.price <= 0) throw new ServiceError("Harga layanan tidak valid");

  const service = await prisma.service.create({
    data: { code, name, durationMinutes: input.durationMinutes, price: input.price },
  });
  await writeAudit(prisma, actor.userId, "CREATE_SERVICE", "service", service.id, service.code);
  return service;
}

export async function updateService(
  actor: AppUser,
  input: { serviceId: string; code: string; name: string; durationMinutes: number; price: number },
) {
  assertCatalog(actor);
  const code = input.code.trim().toUpperCase();
  const name = input.name.trim();
  if (!/^[A-Z0-9-]{2,12}$/.test(code)) throw new ServiceError("Kode layanan 2–12 karakter huruf atau angka");
  if (name.length < 3) throw new ServiceError("Nama layanan terlalu pendek");
  if (!Number.isInteger(input.durationMinutes) || input.durationMinutes < 15 || input.durationMinutes > 240) {
    throw new ServiceError("Durasi layanan antara 15 dan 240 menit");
  }
  if (!Number.isInteger(input.price) || input.price <= 0) throw new ServiceError("Harga layanan tidak valid");
  const taken = await prisma.service.findFirst({ where: { code, NOT: { id: input.serviceId } } });
  if (taken) throw new ServiceError("Kode layanan sudah dipakai");
  const service = await prisma.service.update({
    where: { id: input.serviceId },
    data: { code, name, durationMinutes: input.durationMinutes, price: input.price },
  });
  await writeAudit(prisma, actor.userId, "UPDATE_SERVICE", "service", service.id, service.code);
  return service;
}

export async function setServiceActive(actor: AppUser, serviceId: string, isActive: boolean) {
  assertCatalog(actor);
  return prisma.service.update({ where: { id: serviceId }, data: { isActive } });
}

export async function deleteService(actor: AppUser, serviceId: string) {
  assertCatalog(actor);
  const used = await prisma.bookingService.count({ where: { serviceId } });
  if (used > 0) {
    await prisma.service.update({ where: { id: serviceId }, data: { isActive: false } });
    throw new ServiceError("Layanan sudah dipakai booking, jadi hanya dinonaktifkan");
  }
  await prisma.service.delete({ where: { id: serviceId } });
  await writeAudit(prisma, actor.userId, "DELETE_SERVICE", "service", serviceId, "Layanan dihapus");
}
