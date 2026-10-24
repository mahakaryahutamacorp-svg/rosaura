import { redirect } from "next/navigation";
import { adjustStockAction, receiveStockAction } from "@/app/actions/operations";
import { Flash } from "@/components/Flash";
import { canAdjustStock, canSeeStock, requireUser } from "@/lib/access";
import { fieldClass, labelClass, primaryButton, secondaryButton } from "@/lib/styles";
import { formatRupiah } from "@/lib/format";
import { daysUntilExpiry, formatDateOnlyUtc, formatDateTime, isExpired } from "@/lib/time";
import { listInventory } from "@/services/inventory.service";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  if (!canSeeStock(user)) redirect("/dashboard");
  const { products, movements } = await listInventory();
  const canAdjust = canAdjustStock(user);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl">Stok</h1>
        <p className="text-sm text-muted">
          {products.length} produk. Harga jual mengikuti arsip. SKU batch tetap memakai tanggal kedaluwarsa.
        </p>
      </div>
      <Flash error={params.error} notice={params.notice} />

      <div className="overflow-hidden rounded-3xl border border-line bg-paper">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-xs tracking-wide text-muted uppercase">
            <tr>
              <th className="px-5 py-3 font-medium">Produk</th>
              <th className="px-3 py-3 font-medium">Kategori</th>
              <th className="px-3 py-3 font-medium">Harga</th>
              <th className="px-5 py-3 font-medium">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id} className="border-b border-line/70 last:border-0">
                <td className="px-5 py-3">
                  <p className="font-medium">{product.name}</p>
                  {product.trackBatch ? (
                    <ul className="mt-2 space-y-1 text-xs text-muted">
                      {product.batches.map((batch) => {
                        const expired = isExpired(batch.expiryDate);
                        const days = daysUntilExpiry(batch.expiryDate);
                        return (
                          <li key={batch.id}>
                            {batch.batchNumber} · {formatDateOnlyUtc(batch.expiryDate)} · {batch.qtyAvailable} ·{" "}
                            {expired ? "kedaluwarsa" : `${days} hari`}
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </td>
                <td className="px-3 py-3">{product.category.name}</td>
                <td className="px-3 py-3">{formatRupiah(product.sellPrice)}</td>
                <td className="px-5 py-3">
                  {product.qtyOnHand} {product.unit}
                  {product.qtyOnHand <= product.minStock && product.minStock > 0 ? " · di bawah minimum" : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canAdjust ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <form action={receiveStockAction} className="grid gap-3 rounded-3xl border border-line bg-paper p-5">
            <h2 className="font-display text-2xl">Terima stok</h2>
            <label>
              <span className={labelClass}>Produk</span>
              <select className={fieldClass} name="productId">
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                    {product.trackBatch ? " (batch)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={labelClass}>Jumlah</span>
              <input className={fieldClass} name="quantity" type="number" min={1} required />
            </label>
            <label>
              <span className={labelClass}>Nomor batch</span>
              <input className={fieldClass} name="batchNumber" placeholder="Wajib untuk SKU batch" />
            </label>
            <label>
              <span className={labelClass}>Kedaluwarsa</span>
              <input className={fieldClass} type="date" name="expiryDate" />
            </label>
            <label>
              <span className={labelClass}>Biaya satuan</span>
              <input className={fieldClass} name="unitCost" type="number" min={0} defaultValue={0} />
            </label>
            <button className={primaryButton} type="submit">
              Simpan penerimaan
            </button>
          </form>
          <form action={adjustStockAction} className="grid gap-3 rounded-3xl border border-line bg-paper p-5">
            <h2 className="font-display text-2xl">Penyesuaian</h2>
            <label>
              <span className={labelClass}>Batch atau produk</span>
              <select className={fieldClass} name="target">
                {products.flatMap((product) =>
                  product.trackBatch
                    ? product.batches.map((batch) => (
                        <option key={batch.id} value={`${product.id}|${batch.id}`}>
                          {product.name} · {batch.batchNumber}
                        </option>
                      ))
                    : [
                        <option key={product.id} value={`${product.id}|`}>
                          {product.name} · saldo sederhana
                        </option>,
                      ],
                )}
              </select>
            </label>
            <label>
              <span className={labelClass}>Perubahan</span>
              <input className={fieldClass} name="quantity" type="number" required placeholder="Contoh: -1" />
            </label>
            <label>
              <span className={labelClass}>Alasan</span>
              <input className={fieldClass} name="reason" required minLength={3} />
            </label>
            <button className={secondaryButton} type="submit">
              Simpan penyesuaian
            </button>
          </form>
        </div>
      ) : (
        <p className="text-sm text-muted">Peran klinis melihat stok. Penerimaan dan koreksi dilakukan gudang atau owner.</p>
      )}

      <section className="rounded-3xl border border-line bg-paper p-5">
        <h2 className="font-display text-2xl">Mutasi terbaru</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {movements.map((movement) => (
            <li key={movement.id} className="flex flex-wrap justify-between gap-2">
              <span>
                {movement.product.name}
                {movement.batch ? ` · ${movement.batch.batchNumber}` : ""} · {movement.quantity > 0 ? "+" : ""}
                {movement.quantity} · {movement.reason}
              </span>
              <span className="text-muted">
                {movement.createdBy.employee.name} · {formatDateTime(movement.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
