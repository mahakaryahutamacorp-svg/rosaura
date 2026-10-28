import { prisma } from "@/lib/db";
import { ServiceError } from "@/lib/errors";
import type { AppUser } from "@/lib/access";
import { canAdjustStock, canManageCatalog } from "@/lib/access";
import { normalizeCatalogName } from "@/lib/catalog-name";
import { isExpired, todayJakarta } from "@/lib/time";
import { writeAudit } from "@/services/audit";

export async function listInventory() {
  const [products, movements] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      include: { category: true, batches: { orderBy: { expiryDate: "asc" } } },
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
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
  if (!canAdjustStock(actor)) throw new ServiceError("Penerimaan dan koreksi stok untuk admin atau gudang");
}

function assertCatalog(actor: AppUser) {
  if (!canManageCatalog(actor)) throw new ServiceError("Anda tidak dapat mengubah katalog produk");
}

async function categoryIdFor(name: string) {
  const trimmed = name.trim();
  if (trimmed.length < 2) throw new ServiceError("Nama kategori terlalu pendek");
  const existing = await prisma.productCategory.findFirst({ where: { name: trimmed } });
  if (existing) return existing.id;
  const created = await prisma.productCategory.create({ data: { name: trimmed } });
  return created.id;
}

function assertMinStock(minStock: number) {
  if (!Number.isInteger(minStock) || minStock < 0) throw new ServiceError("Stok minimum tidak valid");
}

export async function createProduct(
  actor: AppUser,
  input: { name: string; category: string; sellPrice: number; quantity: number; minStock: number; unit: string },
) {
  assertCatalog(actor);
  const name = input.name.trim();
  const unit = input.unit.trim() || "pcs";
  if (name.length < 2) throw new ServiceError("Nama produk terlalu pendek");
  if (!Number.isInteger(input.sellPrice) || input.sellPrice < 0) throw new ServiceError("Harga produk tidak valid");
  if (!Number.isInteger(input.quantity) || input.quantity < 0) throw new ServiceError("Stok awal tidak valid");
  assertMinStock(input.minStock);
  const key = normalizeCatalogName(name);
  const existing = await prisma.product.findMany({ where: { isActive: true }, select: { name: true } });
  if (existing.some((product) => normalizeCatalogName(product.name) === key)) {
    throw new ServiceError("Produk dengan nama ini sudah ada");
  }
  const categoryId = await categoryIdFor(input.category);

  return prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        sku: `PRD-${Date.now().toString(36).toUpperCase()}`,
        name,
        categoryId,
        unit,
        sellPrice: input.sellPrice,
        qtyOnHand: input.quantity,
        minStock: input.minStock,
        trackBatch: false,
      },
    });
    if (input.quantity > 0) {
      await tx.stockMovement.create({
        data: {
          productId: product.id,
          movementType: "RECEIPT",
          quantity: input.quantity,
          reason: "Stok awal produk baru",
          createdById: actor.userId,
        },
      });
    }
    await writeAudit(tx, actor.userId, "CREATE_PRODUCT", "product", product.id, product.name);
    return product;
  });
}

export async function updateProduct(
  actor: AppUser,
  input: { productId: string; name: string; category: string; sellPrice: number; minStock: number; unit: string },
) {
  assertCatalog(actor);
  const name = input.name.trim();
  const unit = input.unit.trim() || "pcs";
  if (name.length < 2) throw new ServiceError("Nama produk terlalu pendek");
  if (!Number.isInteger(input.sellPrice) || input.sellPrice < 0) throw new ServiceError("Harga produk tidak valid");
  assertMinStock(input.minStock);
  const current = await prisma.product.findUnique({ where: { id: input.productId }, select: { isActive: true } });
  if (!current?.isActive) throw new ServiceError("Produk tidak ditemukan");
  const key = normalizeCatalogName(name);
  const existing = await prisma.product.findMany({
    where: { isActive: true, NOT: { id: input.productId } },
    select: { name: true },
  });
  if (existing.some((product) => normalizeCatalogName(product.name) === key)) {
    throw new ServiceError("Produk dengan nama ini sudah ada");
  }
  const categoryId = await categoryIdFor(input.category);
  const product = await prisma.product.update({
    where: { id: input.productId },
    data: { name, categoryId, unit, sellPrice: input.sellPrice, minStock: input.minStock },
  });
  await writeAudit(prisma, actor.userId, "UPDATE_PRODUCT", "product", product.id, product.name);
  return product;
}

/**
 * Produk yang sudah terjual atau dipakai di kunjungan hanya disembunyikan agar
 * riwayat mutasi stok tetap utuh untuk audit.
 */
export async function deleteProduct(actor: AppUser, productId: string): Promise<"deleted" | "hidden"> {
  assertCatalog(actor);
  const product = await prisma.product.findUnique({ where: { id: productId }, include: { batches: true } });
  if (!product || !product.isActive) throw new ServiceError("Produk tidak ditemukan");
  const batchIds = product.batches.map((batch) => batch.id);
  const [usages, outgoing] = await Promise.all([
    batchIds.length ? prisma.materialUsage.count({ where: { stockBatchId: { in: batchIds } } }) : 0,
    prisma.stockMovement.count({ where: { productId, movementType: { in: ["SALE", "USAGE"] } } }),
  ]);

  if (usages > 0 || outgoing > 0) {
    await prisma.$transaction(async (tx) => {
      await tx.product.update({ where: { id: productId }, data: { isActive: false } });
      await writeAudit(tx, actor.userId, "HIDE_PRODUCT", "product", productId, product.name);
    });
    return "hidden";
  }

  await prisma.$transaction(async (tx) => {
    await tx.stockMovement.deleteMany({ where: { productId } });
    await tx.stockBatch.deleteMany({ where: { productId } });
    await tx.product.delete({ where: { id: productId } });
    await writeAudit(tx, actor.userId, "DELETE_PRODUCT", "product", productId, product.name);
  });
  return "deleted";
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
    if (!product || !product.isActive) throw new ServiceError("Produk tidak ditemukan");

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
