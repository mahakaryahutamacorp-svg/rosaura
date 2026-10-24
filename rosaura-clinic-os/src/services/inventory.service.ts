import { prisma } from "@/lib/db";
import { ServiceError } from "@/lib/errors";
import type { AppUser } from "@/lib/access";
import { canAdjustStock } from "@/lib/access";
import { isExpired, todayJakarta } from "@/lib/time";
import { writeAudit } from "@/services/audit";

export async function listInventory() {
  const [products, movements] = await Promise.all([
    prisma.product.findMany({
      include: { category: true, batches: { orderBy: { expiryDate: "asc" } } },
      orderBy: { name: "asc" },
    }),
    prisma.stockMovement.findMany({
      include: { product: true, batch: true, createdBy: { include: { employee: true } } },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
  ]);
  return { products, movements };
}

export async function usableBatchOptions() {
  const products = await prisma.product.findMany({
    where: { isActive: true, trackBatch: true },
    include: { batches: { orderBy: { expiryDate: "asc" } } },
    orderBy: { name: "asc" },
  });
  const today = todayJakarta();
  return products.flatMap((product) => {
    const batch = product.batches.find((item) => item.qtyAvailable > 0 && !isExpired(item.expiryDate, today));
    if (!batch) return [];
    return [{ productId: product.id, productName: product.name, unit: product.unit, batch }];
  });
}

function assertStockRole(actor: AppUser) {
  if (!canAdjustStock(actor)) throw new ServiceError("Penyesuaian stok hanya untuk gudang atau owner");
}

export async function receiveStock(
  actor: AppUser,
  input: { productId: string; quantity: number; batchNumber: string; expiryDate: string; unitCost: number },
) {
  assertStockRole(actor);
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new ServiceError("Jumlah penerimaan harus lebih dari nol");
  }

  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: input.productId } });
    if (!product || !product.isActive) throw new ServiceError("Produk tidak ditemukan");

    let batchId: string | null = null;
    if (product.trackBatch) {
      if (!input.batchNumber.trim() || !input.expiryDate) {
        throw new ServiceError("Batch dan tanggal kedaluwarsa wajib untuk SKU ini");
      }
      const batch = await tx.stockBatch.create({
        data: {
          productId: product.id,
          batchNumber: input.batchNumber.trim(),
          expiryDate: new Date(`${input.expiryDate}T00:00:00.000Z`),
          qtyAvailable: input.quantity,
          unitCost: Math.max(0, input.unitCost || 0),
        },
      });
      batchId = batch.id;
    }

    await tx.product.update({
      where: { id: product.id },
      data: { qtyOnHand: { increment: input.quantity } },
    });
    await tx.stockMovement.create({
      data: {
        productId: product.id,
        batchId,
        movementType: "RECEIPT",
        quantity: input.quantity,
        reason: "Penerimaan stok",
        createdById: actor.userId,
      },
    });
    await writeAudit(tx, actor.userId, "STOCK_RECEIPT", "product", product.id, `+${input.quantity} ${product.name}`);
  });
}

export async function adjustStock(
  actor: AppUser,
  input: { productId: string; batchId: string; quantity: number; reason: string },
) {
  assertStockRole(actor);
  if (!Number.isInteger(input.quantity) || input.quantity === 0) {
    throw new ServiceError("Perubahan stok tidak boleh nol");
  }
  if (input.reason.trim().length < 3) throw new ServiceError("Alasan penyesuaian wajib diisi");

  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: input.productId } });
    if (!product) throw new ServiceError("Produk tidak ditemukan");

    if (product.trackBatch) {
      const batch = await tx.stockBatch.findFirst({ where: { id: input.batchId, productId: product.id } });
      if (!batch) throw new ServiceError("Batch tidak ditemukan");
      const next = batch.qtyAvailable + input.quantity;
      if (next < 0) throw new ServiceError("Stok batch tidak boleh negatif");
      await tx.stockBatch.update({ where: { id: batch.id }, data: { qtyAvailable: next } });
    }

    const nextOnHand = product.qtyOnHand + input.quantity;
    if (nextOnHand < 0) throw new ServiceError("Stok tidak boleh negatif");
    await tx.product.update({ where: { id: product.id }, data: { qtyOnHand: nextOnHand } });
    await tx.stockMovement.create({
      data: {
        productId: product.id,
        batchId: product.trackBatch ? input.batchId : null,
        movementType: "ADJUSTMENT",
        quantity: input.quantity,
        reason: input.reason.trim(),
        createdById: actor.userId,
      },
    });
    await writeAudit(tx, actor.userId, "STOCK_ADJUSTMENT", "product", product.id, input.reason.trim());
  });
}
