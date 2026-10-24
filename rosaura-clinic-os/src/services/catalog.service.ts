import { prisma } from "@/lib/db";
import { ServiceError } from "@/lib/errors";
import type { AppUser } from "@/lib/access";
import { isOwner } from "@/lib/access";
import { writeAudit } from "@/services/audit";

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
  if (!isOwner(actor)) throw new ServiceError("Hanya owner yang mengubah katalog layanan");
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

export async function setServiceActive(actor: AppUser, serviceId: string, isActive: boolean) {
  if (!isOwner(actor)) throw new ServiceError("Hanya owner yang mengubah katalog layanan");
  return prisma.service.update({ where: { id: serviceId }, data: { isActive } });
}
