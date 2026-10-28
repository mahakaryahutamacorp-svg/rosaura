import { deleteProductAction, updateProductAction } from "@/app/actions/operations";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { formatRupiah } from "@/lib/format";
import { fieldClass, labelClass, quietButton } from "@/lib/styles";
import { daysUntilExpiry, formatDateOnlyUtc, isExpired } from "@/lib/time";
import type { listInventory } from "@/services/inventory.service";

export type InventoryProduct = Awaited<ReturnType<typeof listInventory>>["products"][number];

export function stockLevel(product: Pick<InventoryProduct, "qtyOnHand" | "minStock">) {
  if (product.qtyOnHand <= 0) return "empty";
  if (product.minStock > 0 && product.qtyOnHand <= product.minStock) return "low";
  return "ok";
}

export function ProductTable({ products, canEdit }: { products: InventoryProduct[]; canEdit: boolean }) {
  return (
    <div className="overflow-x-auto rounded-3xl border border-line bg-paper">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-line text-xs tracking-wide text-muted uppercase">
          <tr>
            <th className="px-5 py-3 font-medium">Produk</th>
            <th className="px-3 py-3 font-medium">Kategori</th>
            <th className="px-3 py-3 font-medium">Harga</th>
            <th className="px-5 py-3 font-medium">Saldo</th>
          </tr>
        </thead>
        <tbody>
          {products.length === 0 ? (
            <tr>
              <td className="px-5 py-6 text-muted" colSpan={4}>
                Produk tidak ditemukan.
              </td>
            </tr>
          ) : null}
          {products.map((product) => (
            <tr key={product.id} className="border-b border-line/70 align-top last:border-0">
              <td className="px-5 py-3">
                <p className="font-medium">{product.name}</p>
                <p className="text-xs text-muted">{product.sku}</p>
                {product.trackBatch ? <BatchList batches={product.batches} /> : null}
              </td>
              <td className="px-3 py-3">{product.category.name}</td>
              <td className="px-3 py-3">{formatRupiah(product.sellPrice)}</td>
              <td className="px-5 py-3">
                <StockBalance product={product} />
                {canEdit ? <ProductEditor product={product} /> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BatchList({ batches }: { batches: InventoryProduct["batches"] }) {
  return (
    <ul className="mt-2 space-y-1 text-xs text-muted">
      {batches.map((batch) => {
        const expired = isExpired(batch.expiryDate);
        return (
          <li key={batch.id} className={expired ? "text-[#8a3d36]" : undefined}>
            {batch.batchNumber} · {formatDateOnlyUtc(batch.expiryDate)} · {batch.qtyAvailable} ·{" "}
            {expired ? "kedaluwarsa" : `${daysUntilExpiry(batch.expiryDate)} hari`}
          </li>
        );
      })}
    </ul>
  );
}

function StockBalance({ product }: { product: InventoryProduct }) {
  const level = stockLevel(product);
  return (
    <div>
      <p>
        {product.qtyOnHand} {product.unit}
      </p>
      {product.minStock > 0 ? <p className="text-xs text-muted">Minimum {product.minStock}</p> : null}
      {level === "empty" ? (
        <span className="mt-1 inline-block rounded-lg bg-[#f6e4e1] px-2 py-0.5 text-xs text-[#8a3d36]">Habis</span>
      ) : null}
      {level === "low" ? (
        <span className="mt-1 inline-block rounded-lg bg-[#f8efd4] px-2 py-0.5 text-xs text-[#7a5b16]">Di bawah minimum</span>
      ) : null}
    </div>
  );
}

function ProductEditor({ product }: { product: InventoryProduct }) {
  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-gold-deep">Ubah atau hapus</summary>
      <form action={updateProductAction} className="mt-3 grid gap-2">
        <input type="hidden" name="productId" value={product.id} />
        <label>
          <span className={labelClass}>Nama</span>
          <input className={fieldClass} name="name" defaultValue={product.name} required />
        </label>
        <label>
          <span className={labelClass}>Kategori</span>
          <input className={fieldClass} name="category" defaultValue={product.category.name} list="product-categories" required />
        </label>
        <label>
          <span className={labelClass}>Harga</span>
          <input className={fieldClass} name="sellPrice" type="number" min={0} defaultValue={product.sellPrice} required />
        </label>
        <label>
          <span className={labelClass}>Stok minimum</span>
          <input className={fieldClass} name="minStock" type="number" min={0} defaultValue={product.minStock} required />
        </label>
        <label>
          <span className={labelClass}>Satuan</span>
          <input className={fieldClass} name="unit" defaultValue={product.unit} required />
        </label>
        <button className={`${quietButton} w-fit`} type="submit">
          Simpan produk
        </button>
      </form>
      <form action={deleteProductAction} className="mt-2">
        <input type="hidden" name="productId" value={product.id} />
        <ConfirmSubmitButton message={`Hapus ${product.name}? Produk yang sudah punya riwayat hanya disembunyikan.`}>
          Hapus
        </ConfirmSubmitButton>
      </form>
    </details>
  );
}
