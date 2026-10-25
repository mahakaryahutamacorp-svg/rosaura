"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { checkoutSaleAction, type ActionResult } from "@/app/actions/operations";
import { Receipt } from "@/components/billing/Receipt";
import { formatRupiah } from "@/lib/format";
import { smartSearchScore } from "@/lib/search";
import { fieldClass, labelClass, primaryButton, quietButton } from "@/lib/styles";

interface ProductOption {
  id: string;
  name: string;
  unit: string;
  sellPrice: number;
  qtyOnHand: number;
  category: { name: string };
}

interface ServiceOption {
  id: string;
  code: string;
  name: string;
  durationMinutes: number;
  price: number;
}

interface ClientOption {
  id: string;
  fullName: string;
  clientCode: string;
}

interface CartLine {
  kind: "product" | "service";
  id: string;
  name: string;
  unit: string;
  sellPrice: number;
  stock: number | null;
  quantity: number;
}

interface CatalogItem {
  kind: "product" | "service";
  id: string;
  name: string;
  detail: string;
  price: number;
  stock: number | null;
  search: string;
  label: string;
}

const initialState: ActionResult = { ok: true, message: "" };

export function CashierDesk({
  products,
  services,
  clients,
}: {
  products: ProductOption[];
  services: ServiceOption[];
  clients: ClientOption[];
}) {
  const [state, action] = useActionState(checkoutSaleAction, initialState);
  const [key, setKey] = useState("");
  useEffect(() => {
    setKey(crypto.randomUUID());
  }, []);
  const [productQuery, setProductQuery] = useState("");
  const [clientQuery, setClientQuery] = useState("");
  const [clientId, setClientId] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discountText, setDiscountText] = useState("0");
  const [method, setMethod] = useState("CASH");
  const [cashText, setCashText] = useState("");
  const [transferText, setTransferText] = useState("");

  const client = clients.find((item) => item.id === clientId);
  const discount = wholeNumber(discountText);
  const subtotal = cart.reduce((sum, line) => sum + line.sellPrice * line.quantity, 0);
  const discountValue = discount ?? 0;
  const total = Math.max(subtotal - discountValue, 0);
  const cash = wholeNumber(cashText);
  const transfer = wholeNumber(transferText);
  const splitReady = method !== "SPLIT" || (cash !== null && transfer !== null && cash > 0 && transfer > 0 && cash + transfer === total);
  const discountReady = discount !== null && discount <= subtotal;
  const canSubmit = cart.length > 0 && Boolean(clientId) && discountReady && (total === 0 || splitReady);

  const catalog = useMemo<CatalogItem[]>(
    () => [
      ...services.map((service) => ({
        kind: "service" as const,
        id: service.id,
        name: service.name,
        detail: `${service.code} · ${service.durationMinutes} menit`,
        price: service.price,
        stock: null,
        search: `${service.name} ${service.code} layanan`,
        label: "Layanan",
      })),
      ...products.map((product) => {
        const treatment = product.category.name.toLowerCase() === "treatment";
        return {
          kind: "product" as const,
          id: product.id,
          name: product.name,
          detail: `stok ${product.qtyOnHand} ${product.unit}`,
          price: product.sellPrice,
          stock: product.qtyOnHand,
          search: `${product.name} ${product.category.name} ${treatment ? "layanan" : "produk"}`,
          label: treatment ? "Layanan" : "Produk",
        };
      }),
    ],
    [products, services],
  );

  const visibleCatalog = useMemo(() => {
    return catalog
      .map((item) => ({ item, score: smartSearchScore(productQuery, item.search) }))
      .filter((entry): entry is { item: CatalogItem; score: number } => entry.score !== null)
      .sort((left, right) => right.score - left.score || left.item.name.localeCompare(right.item.name, "id"));
  }, [catalog, productQuery]);

  const visibleClients = useMemo(() => {
    return clients
      .map((item) => ({ item, score: smartSearchScore(clientQuery, item.fullName, item.clientCode) }))
      .filter((entry): entry is { item: ClientOption; score: number } => entry.score !== null)
      .sort((left, right) => right.score - left.score || left.item.fullName.localeCompare(right.item.fullName, "id"));
  }, [clientQuery, clients]);

  function addItem(item: CatalogItem) {
    if (item.stock !== null && item.stock <= 0) return;
    setCart((current) => {
      const existing = current.find((line) => line.kind === item.kind && line.id === item.id);
      if (!existing) {
        return [
          ...current,
          {
            kind: item.kind,
            id: item.id,
            name: item.name,
            unit: item.kind === "service" ? "sesi" : "pcs",
            sellPrice: item.price,
            stock: item.stock,
            quantity: 1,
          },
        ];
      }
      if (existing.stock !== null && existing.quantity >= existing.stock) return current;
      return current.map((line) =>
        line.kind === item.kind && line.id === item.id ? { ...line, quantity: line.quantity + 1 } : line,
      );
    });
  }

  function setQuantity(kind: CartLine["kind"], id: string, quantity: number) {
    setCart((current) =>
      current.flatMap((line) => {
        if (line.kind !== kind || line.id !== id) return [line];
        if (quantity <= 0) return [];
        const next = line.stock === null ? quantity : Math.min(quantity, line.stock);
        return [{ ...line, quantity: next }];
      }),
    );
  }

  const payAmount = method === "SPLIT" ? (cash ?? 0) : total;

  return (
    <form action={action} className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <input type="hidden" name="idempotencyKey" value={key} />
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="lines" value={JSON.stringify(cart.map((line) => ({ kind: line.kind, id: line.id, quantity: line.quantity })))} />
      <input type="hidden" name="discount" value={discountValue} />
      <input type="hidden" name="method" value={total === 0 ? "CASH" : method} />
      <input type="hidden" name="amount" value={payAmount} />
      <input type="hidden" name="transferAmount" value={method === "SPLIT" ? (transfer ?? 0) : 0} />

      <div className="no-print space-y-4">
        <section className="rounded-3xl border border-line bg-paper p-5">
          <div className="flex items-end justify-between gap-3">
            <h2 className="font-display text-2xl">Klien</h2>
            <p className="text-xs text-muted">
              {visibleClients.length} dari {clients.length}
            </p>
          </div>
          <label className="mt-3 block">
            <span className={labelClass}>Cari nama atau kode</span>
            <input
              className={fieldClass}
              value={clientQuery}
              onChange={(event) => setClientQuery(event.target.value)}
              placeholder="Ketik nama, misalnya sari atau CL-12"
            />
          </label>
          {client ? <p className="mt-3 text-sm">Dipilih: {client.fullName} · {client.clientCode}</p> : null}
          <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto">
            {visibleClients.length === 0 ? <li className="text-sm text-muted">Klien tidak ditemukan.</li> : null}
            {visibleClients.map(({ item }) => {
              const selected = item.id === clientId;
              return (
                <li key={item.id}>
                  <button
                    className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-left ${selected ? "border-gold bg-gold/10" : "border-line"}`}
                    type="button"
                    onClick={() => setClientId(item.id)}
                  >
                    <span className="text-sm font-medium capitalize">{item.fullName}</span>
                    <span className="text-xs text-muted">{item.clientCode}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-3xl border border-line bg-paper p-5">
          <div className="flex items-end justify-between gap-3">
            <h2 className="font-display text-2xl">Produk dan layanan</h2>
            <p className="text-xs text-muted">
              {visibleCatalog.length} dari {catalog.length} · stok terpotong saat bayar
            </p>
          </div>
          <label className="mt-3 block">
            <span className={labelClass}>Cari</span>
            <input
              className={fieldClass}
              value={productQuery}
              onChange={(event) => setProductQuery(event.target.value)}
              placeholder="Ketik nama, misalnya peel acne atau prp"
            />
          </label>
          <ul className="mt-3 max-h-[36rem] space-y-2 overflow-y-auto">
            {visibleCatalog.length === 0 ? <li className="text-sm text-muted">Tidak ditemukan.</li> : null}
            {visibleCatalog.map(({ item }) => {
              const inCart = cart.find((line) => line.kind === item.kind && line.id === item.id)?.quantity ?? 0;
              const soldOut = item.stock !== null && (item.stock <= 0 || inCart >= item.stock);
              return (
                <li key={`${item.kind}-${item.id}`} className="flex items-center justify-between gap-3 rounded-2xl border border-line px-3 py-2">
                  <span>
                    <span className="block text-sm font-medium">
                      {item.name}{" "}
                      <span className="text-xs font-normal text-muted">{item.label}</span>
                    </span>
                    <span className="text-xs text-muted">
                      {formatRupiah(item.price)} · {item.detail}
                    </span>
                  </span>
                  <button className={quietButton} type="button" onClick={() => addItem(item)} disabled={soldOut}>
                    {soldOut ? "Habis" : "Tambah"}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-3xl border border-line bg-paper p-5">
          <h2 className="font-display text-2xl">Keranjang</h2>
          {cart.length === 0 ? <p className="mt-3 text-sm text-muted">Belum ada produk atau layanan.</p> : null}
          <ul className="mt-3 space-y-3">
            {cart.map((line) => (
              <li key={`${line.kind}-${line.id}`} className="grid gap-2 rounded-2xl border border-line p-3 sm:grid-cols-[1fr_7rem_auto] sm:items-end">
                <div>
                  <p className="text-sm font-medium">{line.name}</p>
                  <p className="text-xs text-muted">
                    {line.kind === "service" ? "Layanan" : "Produk"} · {formatRupiah(line.sellPrice)} · {formatRupiah(line.sellPrice * line.quantity)}
                  </p>
                </div>
                <label>
                  <span className={labelClass}>Jumlah</span>
                  <input
                    className={fieldClass}
                    type="number"
                    min={1}
                    max={line.stock ?? undefined}
                    value={line.quantity}
                    onChange={(event) => setQuantity(line.kind, line.id, Number(event.target.value))}
                  />
                </label>
                <button className={quietButton} type="button" onClick={() => setQuantity(line.kind, line.id, 0)}>
                  Hapus
                </button>
              </li>
            ))}
          </ul>

          <label className="mt-4 block max-w-xs">
            <span className={labelClass}>Diskon (Rp)</span>
            <input
              className={fieldClass}
              inputMode="numeric"
              value={discountText}
              onChange={(event) => setDiscountText(event.target.value.replace(/[^\d]/g, ""))}
              placeholder="0"
            />
          </label>
          {discount !== null && discount > subtotal ? <p className="mt-2 text-sm text-[#8a3d36]">Diskon melebihi subtotal.</p> : null}

          <fieldset className="mt-4">
            <legend className={labelClass}>Pembayaran</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                ["CASH", "Tunai"],
                ["QRIS", "QRIS"],
                ["TRANSFER", "Transfer"],
                ["SPLIT", "Sebagian tunai, sebagian transfer"],
              ].map(([value, label]) => (
                <label key={value} className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm">
                  <input type="radio" name="methodChoice" value={value} checked={method === value} onChange={() => setMethod(value)} />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          {method === "SPLIT" && total > 0 ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label>
                <span className={labelClass}>Tunai</span>
                <input className={fieldClass} inputMode="numeric" value={cashText} onChange={(event) => setCashText(event.target.value.replace(/[^\d]/g, ""))} placeholder="0" />
              </label>
              <label>
                <span className={labelClass}>Transfer</span>
                <input className={fieldClass} inputMode="numeric" value={transferText} onChange={(event) => setTransferText(event.target.value.replace(/[^\d]/g, ""))} placeholder="0" />
              </label>
              <p className="text-sm text-muted sm:col-span-2">
                Tunai + transfer harus {formatRupiah(total)}.
                {cash !== null && transfer !== null && cash + transfer !== total ? ` Selisih ${formatRupiah(total - cash - transfer)}.` : ""}
              </p>
            </div>
          ) : null}

          {state.message && !state.ok ? <p className="mt-3 text-sm text-[#8a3d36]">{state.message}</p> : null}
          <PayButton disabled={!canSubmit} total={total} />
        </section>
      </div>

      <Receipt
        draft
        clientName={client?.fullName ?? ""}
        lines={cart.map((line) => ({
          id: `${line.kind}-${line.id}`,
          description: line.name,
          quantity: line.quantity,
          amount: line.sellPrice * line.quantity,
        }))}
        subtotal={subtotal}
        discount={Math.min(discountValue, subtotal)}
        total={total}
        payments={previewPayments(method, total, cash ?? 0, transfer ?? 0)}
        remaining={0}
      />
    </form>
  );
}

function previewPayments(method: string, total: number, cash: number, transfer: number) {
  if (total <= 0) return [];
  if (method === "SPLIT") {
    return [
      { id: "cash", label: "Tunai", amount: cash },
      { id: "transfer", label: "Transfer", amount: transfer },
    ].filter((payment) => payment.amount > 0);
  }
  const label = method === "QRIS" ? "QRIS" : method === "TRANSFER" ? "Transfer" : "Tunai";
  return [{ id: method, label, amount: total }];
}

function wholeNumber(value: string) {
  if (!/^\d+$/.test(value)) return null;
  return Number(value);
}

function PayButton({ disabled, total }: { disabled: boolean; total: number }) {
  const { pending } = useFormStatus();
  return (
    <button className={`${primaryButton} mt-4`} type="submit" disabled={disabled || pending}>
      {pending ? "Menyimpan..." : total === 0 ? "Simpan penjualan" : `Bayar ${formatRupiah(total)}`}
    </button>
  );
}
