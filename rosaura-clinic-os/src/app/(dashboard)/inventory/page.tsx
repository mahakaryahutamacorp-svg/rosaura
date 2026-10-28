import Link from "next/link";
import { redirect } from "next/navigation";
import { adjustStockAction, createProductAction, receiveStockAction } from "@/app/actions/operations";
import { Flash } from "@/components/Flash";
import { ProductTable, stockLevel, type InventoryProduct } from "@/components/inventory/ProductTable";
import { SearchBox } from "@/components/search/SearchBox";
import { canAdjustStock, canManageCatalog, canSeeStock, requireUser } from "@/lib/access";
import { rankBySmartSearch } from "@/lib/search";
import { fieldClass, labelClass, primaryButton, secondaryButton } from "@/lib/styles";
import { formatDateTime } from "@/lib/time";
import { listInventory } from "@/services/inventory.service";

interface InventoryFilters {
  query: string;
  category: string;
  lowOnly: boolean;
}

function filterProducts(products: InventoryProduct[], filters: InventoryFilters) {
  const scoped = products.filter(
    (product) =>
      (!filters.category || product.category.name === filters.category) &&
      (!filters.lowOnly || stockLevel(product) !== "ok"),
  );
  return rankBySmartSearch(scoped, filters.query, (product) => [
    product.name,
    product.category.name,
    product.sku,
    product.description,
    ...product.batches.map((batch) => batch.batchNumber),
  ]);
}

function filterHref(filters: InventoryFilters, change: Partial<InventoryFilters>) {
  const next = { ...filters, ...change };
  const search = new URLSearchParams();
  if (next.query) search.set("q", next.query);
  if (next.category) search.set("category", next.category);
  if (next.lowOnly) search.set("stock", "low");
  const text = search.toString();
  return text ? `/inventory?${text}` : "/inventory";
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string; q?: string; category?: string; stock?: string }>;
}) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  if (!canSeeStock(user)) redirect("/dashboard");
  const { products, movements } = await listInventory();
  const canAdjust = canAdjustStock(user);
  const canEdit = canManageCatalog(user);
  const categories = [...new Set(products.map((product) => product.category.name))].sort((left, right) =>
    left.localeCompare(right, "id"),
  );
  const filters: InventoryFilters = {
    query: (params.q ?? "").trim().slice(0, 80),
    category: categories.includes(params.category ?? "") ? (params.category ?? "") : "",
    lowOnly: params.stock === "low",
  };
  const visible = filterProducts(products, filters);
  const lowCount = products.filter((product) => stockLevel(product) !== "ok").length;
  const preserveParams: Record<string, string> = {
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.lowOnly ? { stock: "low" } : {}),
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl">Stok</h1>
        <p className="text-sm text-muted">
          {products.length} produk · {lowCount} habis atau di bawah minimum. SKU batch tetap memakai tanggal kedaluwarsa.
        </p>
      </div>
      <Flash error={params.error} notice={params.notice} />
      <datalist id="product-categories">
        {categories.map((category) => (
          <option key={category} value={category} />
        ))}
      </datalist>

      {canEdit ? (
        <form action={createProductAction} className="grid gap-3 rounded-3xl border border-line bg-paper p-5 md:grid-cols-6">
          <h2 className="font-display text-2xl md:col-span-6">Produk baru</h2>
          <label className="md:col-span-2">
            <span className={labelClass}>Nama</span>
            <input className={fieldClass} name="name" required />
          </label>
          <label>
            <span className={labelClass}>Kategori</span>
            <input className={fieldClass} name="category" list="product-categories" required placeholder="Krim, Treatment" />
          </label>
          <label>
            <span className={labelClass}>Harga</span>
            <input className={fieldClass} name="sellPrice" type="number" min={0} required />
          </label>
          <label>
            <span className={labelClass}>Stok awal</span>
            <input className={fieldClass} name="quantity" type="number" min={0} defaultValue={0} required />
          </label>
          <label>
            <span className={labelClass}>Stok minimum</span>
            <input className={fieldClass} name="minStock" type="number" min={0} defaultValue={0} required />
          </label>
          <label>
            <span className={labelClass}>Satuan</span>
            <input className={fieldClass} name="unit" defaultValue="pcs" required />
          </label>
          <button className={`${primaryButton} md:col-span-6 md:w-fit`} type="submit">
            Tambah produk
          </button>
        </form>
      ) : null}

      <section className="space-y-3">
        <SearchBox
          basePath="/inventory"
          label="Cari produk"
          defaultValue={filters.query}
          preserveParams={preserveParams}
          placeholder="Nama, kategori, SKU, atau nomor batch. Salah ketik ringan tetap ketemu"
        />
        <div className="flex flex-wrap gap-2 text-sm">
          <FilterChip href={filterHref(filters, { category: "" })} active={!filters.category} label="Semua kategori" />
          {categories.map((category) => (
            <FilterChip
              key={category}
              href={filterHref(filters, { category })}
              active={filters.category === category}
              label={category}
            />
          ))}
          <FilterChip
            href={filterHref(filters, { lowOnly: !filters.lowOnly })}
            active={filters.lowOnly}
            label={`Perlu restok (${lowCount})`}
          />
        </div>
        <p className="text-sm text-muted">
          Menampilkan {visible.length} dari {products.length} produk
          {filters.query ? `, diurutkan dari yang paling cocok dengan "${filters.query}"` : ""}.
        </p>
        <ProductTable products={visible} canEdit={canEdit} />
      </section>

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
        <p className="text-sm text-muted">Peran klinis hanya melihat stok. Admin dapat menambah, mengubah, menghapus, dan memperbarui stok.</p>
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

function FilterChip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={`rounded-xl border px-3 py-1.5 transition ${
        active ? "border-gold bg-champagne font-semibold text-ink" : "border-line bg-paper text-brown hover:border-gold"
      }`}
    >
      {label}
    </Link>
  );
}
