import { prisma } from "@/lib/db";
import { ServiceError } from "@/lib/errors";
import type { AppUser } from "@/lib/access";
import { can, canSeeClinical, isOwner } from "@/lib/access";
import { isExpired, todayJakarta } from "@/lib/time";
import { writeAudit } from "@/services/audit";

function assertNoteAccess(actor: AppUser, providerId: string) {
  if (isOwner(actor) || can(actor, ["FRONT_OFFICE"])) return;
  if (actor.roles.includes("CLINICAL") && actor.employeeId === providerId) return;
  throw new ServiceError("Catatan kunjungan hanya diisi dokter, admin, atau petugas yang menangani");
}

export async function saveVisitNote(
  actor: AppUser,
  input: {
    bookingId: string;
    complaint: string;
    workDone: string;
    materialsNote: string;
    followUpOn: string;
  },
) {
  if (!canSeeClinical(actor)) throw new ServiceError("Anda tidak dapat mengisi catatan klinis");

  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: input.bookingId },
      include: { visit: { include: { note: true } }, services: true },
    });
    if (!booking?.visit) throw new ServiceError("Check-in terlebih dahulu sebelum mengisi catatan");
    assertNoteAccess(actor, booking.visit.providerId);
    if (booking.status === "CANCELLED" || booking.status === "NO_SHOW" || booking.status === "RESCHEDULED") {
      throw new ServiceError("Booking ini tidak lagi menerima catatan");
    }

    const followUpOn = input.followUpOn ? new Date(`${input.followUpOn}T00:00:00.000Z`) : null;
    const data = {
      complaint: input.complaint.trim(),
      workDone: input.workDone.trim() || booking.services.map((item) => item.serviceNameSnapshot).join(", "),
      materialsNote: input.materialsNote.trim(),
      followUpOn,
      authorId: actor.userId,
    };

    const note = booking.visit.note
      ? await tx.visitNote.update({ where: { id: booking.visit.note.id }, data })
      : await tx.visitNote.create({ data: { ...data, visitId: booking.visit.id } });

    await writeAudit(tx, actor.userId, "VISIT_NOTE", "visit", booking.visit.id, booking.bookingCode);
    return note;
  });
}

export async function useMaterial(actor: AppUser, bookingId: string, productId: string, quantity: number) {
  if (!canSeeClinical(actor)) throw new ServiceError("Anda tidak dapat mencatat pemakaian bahan");
  if (!Number.isInteger(quantity) || quantity <= 0) throw new ServiceError("Jumlah pemakaian tidak valid");

  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: { visit: { include: { note: true } } },
    });
    if (!booking?.visit?.note) throw new ServiceError("Simpan catatan kunjungan sebelum mencatat bahan");
    assertNoteAccess(actor, booking.visit.providerId);

    const batches = await tx.stockBatch.findMany({
      where: { productId, qtyAvailable: { gt: 0 } },
      orderBy: { expiryDate: "asc" },
      include: { product: true },
    });
    const today = todayJakarta();
    const batch = batches.find((item) => !isExpired(item.expiryDate, today));
    if (!batch) throw new ServiceError("Tidak ada batch layak pakai untuk bahan ini");
    if (batch.qtyAvailable < quantity) {
      throw new ServiceError(`Batch ${batch.batchNumber} hanya tersisa ${batch.qtyAvailable}`);
    }

    await tx.stockBatch.update({
      where: { id: batch.id },
      data: { qtyAvailable: { decrement: quantity } },
    });
    await tx.product.update({
      where: { id: batch.productId },
      data: { qtyOnHand: { decrement: quantity } },
    });
    await tx.stockMovement.create({
      data: {
        productId: batch.productId,
        batchId: batch.id,
        movementType: "USAGE",
        quantity: -quantity,
        reason: `Pemakaian ${booking.bookingCode}`,
        createdById: actor.userId,
      },
    });
    await tx.materialUsage.create({
      data: { visitNoteId: booking.visit.note.id, stockBatchId: batch.id, quantityUsed: quantity },
    });
    await writeAudit(
      tx,
      actor.userId,
      "MATERIAL_USAGE",
      "stock_batch",
      batch.id,
      `${batch.product.name} ${batch.batchNumber} -${quantity}`,
    );
  });
}
