import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db";
import { ServiceError } from "@/lib/errors";
import type { AppUser } from "@/lib/access";
import { canSeeClinical } from "@/lib/access";
import { jakartaDateTime, parseDay } from "@/lib/time";
import { writeAudit } from "@/services/audit";

const MAX_FILES = 4;
const MAX_BYTES = 6 * 1024 * 1024;

export interface IncomingPhoto {
  bytes: Buffer;
  contentType: "image/jpeg" | "image/png" | "image/webp";
}

function assertClinical(actor: AppUser) {
  if (!canSeeClinical(actor)) {
    throw new ServiceError("Foto rekam medis hanya untuk dokter dan pemilik");
  }
}

function storageRoot() {
  return path.resolve(process.cwd(), "storage", "clinical-photos");
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

export function inspectPhoto(bytes: Buffer): IncomingPhoto {
  if (bytes.length === 0) throw new ServiceError("Berkas foto kosong");
  if (bytes.length > MAX_BYTES) throw new ServiceError("Setiap foto maksimal 6 MB");
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { bytes, contentType: "image/jpeg" };
  }
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { bytes, contentType: "image/png" };
  }
  const riff = bytes.subarray(0, 4).toString("ascii");
  const webp = bytes.subarray(8, 12).toString("ascii");
  if (riff === "RIFF" && webp === "WEBP") {
    return { bytes, contentType: "image/webp" };
  }
  throw new ServiceError("Gunakan foto JPEG, PNG, atau WebP");
}

async function saveFiles(actor: AppUser, skinRecordId: string, files: IncomingPhoto[], caption: string) {
  if (files.length === 0) return;
  if (files.length > MAX_FILES) throw new ServiceError("Maksimal 4 foto sekaligus");
  await mkdir(storageRoot(), { recursive: true });
  const written: string[] = [];
  try {
    for (const file of files) {
      const photo = await prisma.clinicalPhoto.create({
        data: {
          skinRecordId,
          contentType: file.contentType,
          byteSize: file.bytes.length,
          caption,
          createdById: actor.userId,
        },
      });
      await writeFile(storagePath(photo.id), file.bytes);
      written.push(photo.id);
    }
  } catch (error) {
    await prisma.clinicalPhoto.deleteMany({ where: { id: { in: written } } });
    await Promise.all(written.map((id) => rm(storagePath(id), { force: true })));
    throw error;
  }
  await writeAudit(prisma, actor.userId, "ADD_CLINICAL_PHOTO", "skinRecord", skinRecordId, `${files.length} foto`);
}

export async function createClinicalVisit(
  actor: AppUser,
  input: { clientId: string; visitDate: string; doctorNotes: string; files: IncomingPhoto[] },
) {
  assertClinical(actor);
  const notes = input.doctorNotes.trim();
  if (!notes && input.files.length === 0) {
    throw new ServiceError("Isi catatan atau pilih minimal satu foto");
  }
  const client = await prisma.client.findUnique({ where: { id: input.clientId }, select: { id: true } });
  if (!client) throw new ServiceError("Klien tidak ditemukan");
  const record = await prisma.skinRecord.create({
    data: {
      clientId: client.id,
      externalId: `local-${crypto.randomUUID()}`,
      visitDate: jakartaDateTime(parseDay(input.visitDate), "12:00"),
      doctorNotes: notes,
    },
  });
  try {
    await saveFiles(actor, record.id, input.files, "");
  } catch (error) {
    await prisma.skinRecord.delete({ where: { id: record.id } });
    throw error;
  }
  await writeAudit(prisma, actor.userId, "CREATE_SKIN_VISIT", "skinRecord", record.id, "Kunjungan kulit baru");
  return record;
}

export async function addClinicalPhotos(
  actor: AppUser,
  input: { skinRecordId: string; caption: string; files: IncomingPhoto[] },
) {
  assertClinical(actor);
  if (input.files.length === 0) throw new ServiceError("Pilih minimal satu foto");
  const record = await prisma.skinRecord.findUnique({ where: { id: input.skinRecordId }, select: { id: true } });
  if (!record) throw new ServiceError("Kunjungan tidak ditemukan");
  await saveFiles(actor, record.id, input.files, input.caption.trim().slice(0, 120));
}

export async function removeClinicalPhoto(actor: AppUser, photoId: string) {
  assertClinical(actor);
  const photo = await prisma.clinicalPhoto.findUnique({ where: { id: photoId } });
  if (!photo) throw new ServiceError("Foto tidak ditemukan");
  await prisma.clinicalPhoto.delete({ where: { id: photo.id } });
  await rm(storagePath(photo.id), { force: true });
  await writeAudit(prisma, actor.userId, "REMOVE_CLINICAL_PHOTO", "clinicalPhoto", photo.id, "Foto kunjungan dihapus");
}

export async function readClinicalPhoto(actor: AppUser, photoId: string) {
  assertClinical(actor);
  const photo = await prisma.clinicalPhoto.findUnique({ where: { id: photoId } });
  if (!photo) return null;
  try {
    const bytes = await readFile(storagePath(photo.id));
    return { bytes, contentType: photo.contentType };
  } catch {
    return null;
  }
}
