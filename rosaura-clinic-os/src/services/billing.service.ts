import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ServiceError } from "@/lib/errors";
import type { AppUser } from "@/lib/access";
import { canBill, isOwner } from "@/lib/access";
import { nextCode } from "@/lib/codes";
import { dayKey, isExpired, todayJakarta } from "@/lib/time";
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

export const INVOICE_PAGE_SIZE = 25;

export async function listInvoices(page = 1) {
  const total = await prisma.invoice.count();
  const pages = Math.max(1, Math.ceil(total / INVOICE_PAGE_SIZE));
  const requested = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safePage = Math.min(requested, pages);
  const items = await prisma.invoice.findMany({
    select: {
      id: true,
      invoiceNumber: true,
      grandTotal: true,
      status: true,
      client: { select: { fullName: true } },
      payments: { select: { amount: true, status: true, reversal: { select: { id: true } } } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (safePage - 1) * INVOICE_PAGE_SIZE,
    take: INVOICE_PAGE_SIZE,
  });
  return { items, total, page: safePage, pages };
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
    const invoiceNumber = await nextCode("INV", await tx.invoice.count(), async (code) =>
      Boolean(await tx.invoice.findUnique({ where: { invoiceNumber: code }, select: { id: true } })),
    );
    const invoice = await tx.invoice.create({
      data: {
        invoiceNumber,
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

export async function listCashierProducts() {
  return prisma.product.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, unit: true, sellPrice: true, qtyOnHand: true, category: { select: { name: true } } },
  });
}

export async function listCashierServices() {
  return prisma.service.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, code: true, name: true, durationMinutes: true, price: true },
  });
}

function paymentParts(input: { method: string; amount: number; transferAmount: number }, due: number) {
  if (input.method === "SPLIT") {
    if (!Number.isInteger(input.amount) || !Number.isInteger(input.transferAmount)) {
      throw new ServiceError("Nominal tunai dan transfer harus bilangan bulat");
    }
    if (input.amount <= 0 || input.transferAmount <= 0) {
      throw new ServiceError("Isi nominal tunai dan transfer");
    }
    if (input.amount + input.transferAmount !== due) {
      throw new ServiceError("Tunai dan transfer harus sama dengan sisa tagihan");
    }
    return [
      { method: "CASH", amount: input.amount },
      { method: "TRANSFER", amount: input.transferAmount },
    ];
  }
  if (!["CASH", "TRANSFER", "QRIS"].includes(input.method)) {
    throw new ServiceError("Metode pembayaran tidak dikenal");
  }
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new ServiceError("Nominal pembayaran tidak valid");
  }
  if (input.amount > due) throw new ServiceError("Nominal melebihi sisa tagihan");
  return [{ method: input.method, amount: input.amount }];
}

async function applyDiscount(
  tx: Prisma.TransactionClient,
  invoiceId: string,
  subtotal: number,
  paid: number,
  discount: number,
) {
  if (!Number.isInteger(discount) || discount < 0) throw new ServiceError("Nominal diskon tidak valid");
  if (discount > subtotal) throw new ServiceError("Diskon melebihi subtotal");
  const grandTotal = subtotal - discount;
  if (grandTotal < paid) {
    throw new ServiceError("Diskon membuat tagihan lebih kecil dari uang yang sudah diterima");
  }
  await tx.invoiceItem.deleteMany({ where: { invoiceId, itemType: "DISCOUNT" } });
  if (discount > 0) {
    await tx.invoiceItem.create({
      data: {
        invoiceId,
        itemType: "DISCOUNT",
        descriptionSnapshot: "Diskon",
        quantity: 1,
        unitPrice: -discount,
      },
    });
  }
  await tx.invoice.update({ where: { id: invoiceId }, data: { grandTotal } });
  return grandTotal;
}

async function deductSoldProduct(
  tx: Prisma.TransactionClient,
  actorUserId: string,
  productId: string,
  quantity: number,
  reason: string,
) {
  const product = await tx.product.findUnique({
    where: { id: productId },
    include: { batches: { orderBy: { expiryDate: "asc" } } },
  });
  if (!product || !product.isActive) throw new ServiceError("Produk tidak ditemukan");
  if (product.qtyOnHand < quantity) {
    throw new ServiceError(`${product.name} tersisa ${product.qtyOnHand} ${product.unit}`);
  }

  if (product.trackBatch) {
    const today = todayJakarta();
    let left = quantity;
    for (const batch of product.batches) {
      if (left === 0) break;
      if (batch.qtyAvailable <= 0 || isExpired(batch.expiryDate, today)) continue;
      const take = Math.min(batch.qtyAvailable, left);
      await tx.stockBatch.update({ where: { id: batch.id }, data: { qtyAvailable: { decrement: take } } });
      await tx.stockMovement.create({
        data: {
          productId: product.id,
          batchId: batch.id,
          movementType: "SALE",
          quantity: -take,
          reason,
          createdById: actorUserId,
        },
      });
      left -= take;
    }
    if (left > 0) throw new ServiceError(`${product.name} tidak cukup di batch yang masih layak`);
  } else {
    await tx.stockMovement.create({
      data: {
        productId: product.id,
        movementType: "SALE",
        quantity: -quantity,
        reason,
        createdById: actorUserId,
      },
    });
  }

  await tx.product.update({ where: { id: product.id }, data: { qtyOnHand: { decrement: quantity } } });
  return product;
}

export async function checkoutSale(
  actor: AppUser,
  input: {
    clientId: string;
    lines: Array<{ kind: "product" | "service"; id: string; quantity: number }>;
    discount: number;
    method: string;
    amount: number;
    transferAmount: number;
    idempotencyKey: string;
  },
) {
  if (!canBill(actor)) throw new ServiceError("Anda tidak dapat mencatat pembayaran");
  if (!input.clientId) throw new ServiceError("Pilih klien");
  if (!input.idempotencyKey) throw new ServiceError("Kunci pembayaran tidak ada");
  if (input.lines.length === 0) throw new ServiceError("Tambahkan minimal satu produk atau layanan");

  const quantities = new Map<string, { kind: "product" | "service"; quantity: number }>();
  for (const line of input.lines) {
    if ((line.kind !== "product" && line.kind !== "service") || !line.id) {
      throw new ServiceError("Keranjang tidak valid");
    }
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      throw new ServiceError("Jumlah tidak valid");
    }
    const current = quantities.get(`${line.kind}:${line.id}`);
    quantities.set(`${line.kind}:${line.id}`, {
      kind: line.kind,
      quantity: (current?.quantity ?? 0) + line.quantity,
    });
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.payment.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) return { id: existing.invoiceId };

    const client = await tx.client.findFirst({ where: { id: input.clientId, isActive: true } });
    if (!client) throw new ServiceError("Klien tidak ditemukan");

    const priced: Array<{
      kind: "product" | "service";
      id: string;
      name: string;
      quantity: number;
      unitPrice: number;
    }> = [];
    for (const [key, line] of quantities) {
      const id = key.slice(line.kind.length + 1);
      if (line.kind === "service") {
        const service = await tx.service.findUnique({ where: { id } });
        if (!service || !service.isActive) throw new ServiceError("Layanan tidak ditemukan");
        priced.push({ kind: "service", id, name: service.name, quantity: line.quantity, unitPrice: service.price });
        continue;
      }
      const product = await tx.product.findUnique({ where: { id } });
      if (!product || !product.isActive) throw new ServiceError("Produk tidak ditemukan");
      priced.push({ kind: "product", id, name: product.name, quantity: line.quantity, unitPrice: product.sellPrice });
    }

    const subtotal = priced.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
    if (!Number.isInteger(input.discount) || input.discount < 0) throw new ServiceError("Nominal diskon tidak valid");
    if (input.discount > subtotal) throw new ServiceError("Diskon melebihi subtotal");
    const due = subtotal - input.discount;
    const parts = due === 0 ? [] : paymentParts(input, due);
    const paidNow = parts.reduce((sum, part) => sum + part.amount, 0);
    if (paidNow !== due) throw new ServiceError("Pembayaran produk harus lunas");

    const invoiceNumber = await nextCode("INV", await tx.invoice.count(), async (code) =>
      Boolean(await tx.invoice.findUnique({ where: { invoiceNumber: code }, select: { id: true } })),
    );
    const invoice = await tx.invoice.create({
      data: {
        invoiceNumber,
        clientId: client.id,
        subtotal,
        grandTotal: due,
        status: due === 0 ? "PAID" : "OPEN",
        items: {
          create: [
            ...priced.map((line) => ({
              itemType: line.kind === "service" ? "SERVICE" : "PRODUCT",
              descriptionSnapshot: line.name,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
            })),
            ...(input.discount > 0
              ? [{ itemType: "DISCOUNT", descriptionSnapshot: "Diskon", quantity: 1, unitPrice: -input.discount }]
              : []),
          ],
        },
      },
    });

    for (const line of priced) {
      if (line.kind !== "product") continue;
      await deductSoldProduct(tx, actor.userId, line.id, line.quantity, `Penjualan ${invoice.invoiceNumber}`);
    }

    if (parts.length === 0) {
      await tx.payment.create({
        data: {
          invoiceId: invoice.id,
          method: "CASH",
          amount: 0,
          idempotencyKey: input.idempotencyKey,
          createdById: actor.userId,
          status: "SUCCESS",
        },
      });
    }
    for (const [index, part] of parts.entries()) {
      await tx.payment.create({
        data: {
          invoiceId: invoice.id,
          method: part.method,
          amount: part.amount,
          idempotencyKey: index === 0 ? input.idempotencyKey : `${input.idempotencyKey}:${part.method}`,
          createdById: actor.userId,
          status: "SUCCESS",
        },
      });
    }
    await syncInvoiceStatus(tx, invoice.id);
    await writeAudit(
      tx,
      actor.userId,
      "CHECKOUT",
      "invoice",
      invoice.id,
      `${invoice.invoiceNumber} diskon ${input.discount}`,
    );
    return { id: invoice.id };
  });
}

export async function recordPayment(
  actor: AppUser,
  input: {
    invoiceId: string;
    method: string;
    amount: number;
    transferAmount: number;
    discount: number;
    idempotencyKey: string;
  },
) {
  if (!canBill(actor)) throw new ServiceError("Anda tidak dapat mencatat pembayaran");
  if (!input.idempotencyKey) throw new ServiceError("Kunci pembayaran tidak ada");
  if (!Number.isInteger(input.discount) || input.discount < 0) throw new ServiceError("Nominal diskon tidak valid");

  return prisma.$transaction(async (tx) => {
    const existing = await tx.payment.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) {
      if (existing.invoiceId !== input.invoiceId) {
        throw new ServiceError("Permintaan pembayaran ini sudah dipakai untuk transaksi lain");
      }
      return existing;
    }

    const invoice = await tx.invoice.findUnique({
      where: { id: input.invoiceId },
      include: { payments: { include: { reversal: true } } },
    });
    if (!invoice || invoice.status === "VOID") throw new ServiceError("Tagihan tidak dapat dibayar");
    const paid = netPaid(invoice.payments);
    const grandTotal = await applyDiscount(tx, invoice.id, invoice.subtotal, paid, input.discount);
    const due = grandTotal - paid;
    if (due === 0) {
      await syncInvoiceStatus(tx, invoice.id);
      await writeAudit(tx, actor.userId, "DISCOUNT", "invoice", invoice.id, `Diskon ${input.discount}`);
      return invoice;
    }

    const parts = paymentParts(input, due);
    let first: { id: string } | null = null;
    for (const [index, part] of parts.entries()) {
      const payment = await tx.payment.create({
        data: {
          invoiceId: invoice.id,
          method: part.method,
          amount: part.amount,
          idempotencyKey: index === 0 ? input.idempotencyKey : `${input.idempotencyKey}:${part.method}`,
          createdById: actor.userId,
          status: "SUCCESS",
        },
      });
      if (!first) first = payment;
    }
    await syncInvoiceStatus(tx, invoice.id);
    await writeAudit(
      tx,
      actor.userId,
      "PAYMENT",
      "payment",
      first?.id ?? invoice.id,
      parts.map((part) => `${part.method} ${part.amount}`).join(" + "),
    );
    return first ?? invoice;
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
    prisma.payment.aggregate({
      where: { status: "SUCCESS", paidAt: { gte: start, lt: end } },
      _sum: { amount: true },
    }),
    prisma.paymentReversal.aggregate({
      where: { createdAt: { gte: start, lt: end } },
      _sum: { amount: true },
    }),
  ]);
  return (payments._sum.amount ?? 0) - (reversals._sum.amount ?? 0);
}

export async function outstandingTotal() {
  const [billed, paid] = await Promise.all([
    prisma.invoice.aggregate({ where: { status: "OPEN" }, _sum: { grandTotal: true } }),
    prisma.payment.aggregate({
      where: { status: "SUCCESS", reversal: { is: null }, invoice: { status: "OPEN" } },
      _sum: { amount: true },
    }),
  ]);
  return (billed._sum.grandTotal ?? 0) - (paid._sum.amount ?? 0);
}
