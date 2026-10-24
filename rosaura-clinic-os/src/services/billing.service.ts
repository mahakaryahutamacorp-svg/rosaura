import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ServiceError } from "@/lib/errors";
import type { AppUser } from "@/lib/access";
import { canBill, isOwner } from "@/lib/access";
import { dayKey } from "@/lib/time";
import { writeAudit } from "@/services/audit";

export function netPaid(
  payments: Array<{ amount: number; status: string; reversal: { id: string } | null }>,
) {
  return payments
    .filter((payment) => payment.status === "SUCCESS" && !payment.reversal)
    .reduce((sum, payment) => sum + payment.amount, 0);
}

async function syncInvoiceStatus(tx: Prisma.TransactionClient, invoiceId: string) {
  const invoice = await tx.invoice.findUnique({
    where: { id: invoiceId },
    include: { payments: { include: { reversal: true } } },
  });
  if (!invoice || invoice.status === "VOID") return;
  const status = netPaid(invoice.payments) >= invoice.grandTotal ? "PAID" : "OPEN";
  if (status !== invoice.status) {
    await tx.invoice.update({ where: { id: invoiceId }, data: { status } });
  }
}

export async function listInvoices() {
  return prisma.invoice.findMany({
    include: {
      client: true,
      booking: true,
      payments: { include: { reversal: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getInvoice(id: string) {
  return prisma.invoice.findUnique({
    where: { id },
    include: {
      client: true,
      booking: true,
      items: true,
      payments: { include: { reversal: true, createdBy: { include: { employee: true } } }, orderBy: { paidAt: "desc" } },
    },
  });
}

export async function createInvoice(actor: AppUser, bookingId: string) {
  if (!canBill(actor)) throw new ServiceError("Anda tidak dapat membuat tagihan");

  return prisma.$transaction(async (tx) => {
    const existing = await tx.invoice.findUnique({ where: { bookingId } });
    if (existing) return existing;

    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: { services: true, visit: true },
    });
    if (!booking) throw new ServiceError("Booking tidak ditemukan");
    if (!["CHECKED_IN", "IN_SERVICE", "COMPLETED"].includes(booking.status)) {
      throw new ServiceError("Tagihan dibuat setelah klien check-in");
    }
    if (!booking.visit) throw new ServiceError("Kunjungan belum tercatat");

    const subtotal = booking.services.reduce((sum, item) => sum + item.priceSnapshot, 0);
    const count = await tx.invoice.count();
    const invoice = await tx.invoice.create({
      data: {
        invoiceNumber: `INV-${String(count + 1).padStart(4, "0")}`,
        clientId: booking.clientId,
        bookingId: booking.id,
        visitId: booking.visit.id,
        subtotal,
        grandTotal: subtotal,
        status: "OPEN",
        items: {
          create: booking.services.map((item) => ({
            itemType: "SERVICE",
            descriptionSnapshot: item.serviceNameSnapshot,
            quantity: 1,
            unitPrice: item.priceSnapshot,
          })),
        },
      },
    });
    await writeAudit(tx, actor.userId, "CREATE_INVOICE", "invoice", invoice.id, invoice.invoiceNumber);
    return invoice;
  });
}

export async function recordPayment(
  actor: AppUser,
  input: { invoiceId: string; method: string; amount: number; idempotencyKey: string },
) {
  if (!canBill(actor)) throw new ServiceError("Anda tidak dapat mencatat pembayaran");
  if (!["CASH", "TRANSFER", "QRIS"].includes(input.method)) {
    throw new ServiceError("Metode pembayaran tidak dikenal");
  }
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new ServiceError("Nominal pembayaran tidak valid");
  }
  if (!input.idempotencyKey) throw new ServiceError("Kunci pembayaran tidak ada");

  return prisma.$transaction(async (tx) => {
    const existing = await tx.payment.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) {
      if (existing.invoiceId !== input.invoiceId || existing.amount !== input.amount) {
        throw new ServiceError("Permintaan pembayaran ini sudah dipakai untuk transaksi lain");
      }
      return existing;
    }

    const invoice = await tx.invoice.findUnique({
      where: { id: input.invoiceId },
      include: { payments: { include: { reversal: true } } },
    });
    if (!invoice || invoice.status === "VOID") throw new ServiceError("Tagihan tidak dapat dibayar");
    const remaining = invoice.grandTotal - netPaid(invoice.payments);
    if (input.amount > remaining) {
      throw new ServiceError("Nominal melebihi sisa tagihan");
    }

    const payment = await tx.payment.create({
      data: {
        invoiceId: invoice.id,
        method: input.method,
        amount: input.amount,
        idempotencyKey: input.idempotencyKey,
        createdById: actor.userId,
        status: "SUCCESS",
      },
    });
    await syncInvoiceStatus(tx, invoice.id);
    await writeAudit(tx, actor.userId, "PAYMENT", "payment", payment.id, `${input.method} ${input.amount}`);
    return payment;
  });
}

export async function reversePayment(actor: AppUser, paymentId: string, reason: string) {
  if (!isOwner(actor)) throw new ServiceError("Pembalikan hanya dapat dilakukan owner");
  if (reason.trim().length < 3) throw new ServiceError("Alasan pembalikan wajib diisi");

  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { id: paymentId },
      include: { reversal: true },
    });
    if (!payment || payment.status !== "SUCCESS") throw new ServiceError("Pembayaran tidak ditemukan");
    if (payment.reversal) throw new ServiceError("Pembayaran ini sudah dibalik");
    if (dayKey(payment.paidAt) !== dayKey(new Date())) {
      throw new ServiceError("Pembalikan penuh hanya untuk pembayaran di hari yang sama");
    }

    const reversal = await tx.paymentReversal.create({
      data: {
        paymentId: payment.id,
        amount: payment.amount,
        reason: reason.trim(),
        createdById: actor.userId,
      },
    });
    await syncInvoiceStatus(tx, payment.invoiceId);
    await writeAudit(tx, actor.userId, "PAYMENT_REVERSAL", "payment", payment.id, reason.trim());
    return reversal;
  });
}

export async function cashInBetween(start: Date, end: Date) {
  const [payments, reversals] = await Promise.all([
    prisma.payment.findMany({ where: { status: "SUCCESS", paidAt: { gte: start, lt: end } } }),
    prisma.paymentReversal.findMany({ where: { createdAt: { gte: start, lt: end } } }),
  ]);
  const incoming = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const outgoing = reversals.reduce((sum, reversal) => sum + reversal.amount, 0);
  return incoming - outgoing;
}

export async function outstandingTotal() {
  const invoices = await prisma.invoice.findMany({
    where: { status: "OPEN" },
    include: { payments: { include: { reversal: true } } },
  });
  return invoices.reduce((sum, invoice) => sum + (invoice.grandTotal - netPaid(invoice.payments)), 0);
}
