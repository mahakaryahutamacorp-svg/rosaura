import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AppUser } from "@/lib/access";
import { prisma } from "@/lib/db";
import {
  emptyDisplayPromos,
  isDisplayPromoSlot,
  type DisplayPromoSlide,
  type DisplayPromoSlot,
  type DisplayPromos,
} from "@/lib/display";
import { ServiceError } from "@/lib/errors";
import type { IncomingPhoto } from "@/services/clinical-photo.service";
import { writeAudit } from "@/services/audit";

const MAX_PER_SLOT = 6;

function storageRoot() {
  return path.resolve(process.cwd(), "storage", "display-promos");
}

function storagePath(photoId: string) {
  const root = storageRoot();
  const filePath = path.resolve(root, photoId);
  const relative = path.relative(root, filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new ServiceError("Berkas foto tidak valid");
  }
  return filePath;
}

function promoUrl(id: string) {
  return `/api/display/promos/${id}`;
}

function isMissingTable(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String(error.code) : "";
  const message = "message" in error ? String(error.message) : "";
  return code === "P2021" || /does not exist|no such table|unknown table/i.test(message);
}

async function ensurePromoTable() {
  const mysql = (process.env.DATABASE_URL ?? "").startsWith("mysql://");
  if (mysql) {
    await prisma.$executeRawUnsafe(
      "CREATE TABLE IF NOT EXISTS `DisplayPromo` (`id` VARCHAR(191) NOT NULL, `slot` VARCHAR(191) NOT NULL, `contentType` VARCHAR(191) NOT NULL, `byteSize` INT NOT NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY (`id`), KEY `DisplayPromo_slot_createdAt_idx` (`slot`, `createdAt`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
    );
    return;
  }
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "DisplayPromo" ("id" TEXT NOT NULL PRIMARY KEY, "slot" TEXT NOT NULL, "contentType" TEXT NOT NULL, "byteSize" INTEGER NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "DisplayPromo_slot_createdAt_idx" ON "DisplayPromo"("slot", "createdAt")`,
  );
}

async function withPromoTable<T>(run: () => Promise<T>) {
  try {
    return await run();
  } catch (error) {
    if (!isMissingTable(error)) throw error;
    await ensurePromoTable();
    return run();
  }
}

function assertSlot(slot: string): asserts slot is DisplayPromoSlot {
  if (!isDisplayPromoSlot(slot)) throw new ServiceError("Bagian promosi tidak dikenal");
}

export async function listDisplayPromos(): Promise<DisplayPromos> {
  const rows = await withPromoTable(() =>
    prisma.displayPromo.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, slot: true },
    }),
  );
  const promos = emptyDisplayPromos();
  for (const row of rows) {
    if (!isDisplayPromoSlot(row.slot)) continue;
    promos[row.slot].push({ id: row.id, url: promoUrl(row.id) });
  }
  return promos;
}

export async function addDisplayPromos(actor: AppUser, slot: string, files: IncomingPhoto[]) {
  assertSlot(slot);
  if (files.length === 0) throw new ServiceError("Pilih foto promosi");
  const count = await withPromoTable(() => prisma.displayPromo.count({ where: { slot } }));
  if (count >= MAX_PER_SLOT || count + files.length > MAX_PER_SLOT) {
    throw new ServiceError(`Maksimal ${MAX_PER_SLOT} foto promosi di bagian ini`);
  }

  await mkdir(storageRoot(), { recursive: true });
  const saved: DisplayPromoSlide[] = [];
  try {
    for (const file of files) {
      const photo = await prisma.displayPromo.create({
        data: {
          slot,
          contentType: file.contentType,
          byteSize: file.bytes.length,
        },
      });
      saved.push({ id: photo.id, url: promoUrl(photo.id) });
      await writeFile(storagePath(photo.id), file.bytes);
    }
  } catch (error) {
    await prisma.displayPromo.deleteMany({ where: { id: { in: saved.map((photo) => photo.id) } } });
    await Promise.all(saved.map((photo) => rm(storagePath(photo.id), { force: true })));
    throw error;
  }

  await writeAudit(prisma, actor.userId, "ADD_DISPLAY_PROMO", "displayPromo", slot, `${files.length} foto ${slot}`);
  return saved;
}

export async function removeDisplayPromo(actor: AppUser, photoId: string) {
  const photo = await withPromoTable(() => prisma.displayPromo.findUnique({ where: { id: photoId } }));
  if (!photo) throw new ServiceError("Foto promosi tidak ditemukan");
  await prisma.displayPromo.delete({ where: { id: photo.id } });
  await rm(storagePath(photo.id), { force: true });
  await writeAudit(prisma, actor.userId, "REMOVE_DISPLAY_PROMO", "displayPromo", photo.id, photo.slot);
}

export async function readDisplayPromo(photoId: string) {
  const photo = await withPromoTable(() => prisma.displayPromo.findUnique({ where: { id: photoId } }));
  if (!photo) return null;
  try {
    const bytes = await readFile(storagePath(photo.id));
    return { bytes, contentType: photo.contentType };
  } catch {
    return null;
  }
}
