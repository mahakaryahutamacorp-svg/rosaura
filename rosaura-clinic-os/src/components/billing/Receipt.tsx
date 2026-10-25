import { PrintButton } from "@/components/billing/PrintButton";
import { clinicReceipt } from "@/lib/clinic";
import { formatRupiah } from "@/lib/format";

export interface ReceiptLine {
  id: string;
  description: string;
  quantity: number;
  amount: number;
}

export interface ReceiptPayment {
  id: string;
  label: string;
  amount: number;
}

export function Receipt({
  invoiceNumber,
  clientName,
  issuedAt,
  lines,
  subtotal,
  discount,
  total,
  payments,
  remaining,
  draft = false,
}: {
  invoiceNumber?: string;
  clientName: string;
  issuedAt?: string;
  lines: ReceiptLine[];
  subtotal: number;
  discount: number;
  total: number;
  payments: ReceiptPayment[];
  remaining: number;
  draft?: boolean;
}) {
  return (
    <section className="receipt rounded-3xl border border-line bg-paper px-5 py-6 text-ink">
      <header className="text-center">
        <h2 className="font-display text-2xl leading-tight">{clinicReceipt.name}</h2>
        <p className="mt-2 text-sm">{clinicReceipt.street}</p>
        <p className="text-sm">{clinicReceipt.city}</p>
        <p className="mt-1 text-sm">{clinicReceipt.phone}</p>
        <p className="mt-2 text-sm">Kritik dan saran: {clinicReceipt.phone}</p>
      </header>

      <div className="my-4 border-t border-dashed border-line" />

      <div className="space-y-1 text-sm">
        <p className="flex justify-between gap-3">
          <span className="text-muted">No. struk</span>
          <span>{invoiceNumber ?? "—"}</span>
        </p>
        {issuedAt ? (
          <p className="flex justify-between gap-3">
            <span className="text-muted">Waktu</span>
            <span className="text-right">{issuedAt}</span>
          </p>
        ) : null}
        <p className="flex justify-between gap-3">
          <span className="text-muted">Klien</span>
          <span className="text-right capitalize">{clientName || "—"}</span>
        </p>
      </div>

      <div className="my-4 border-t border-dashed border-line" />

      {lines.length === 0 ? <p className="text-sm text-muted">Belum ada barang.</p> : null}
      <ul className="space-y-2 text-sm">
        {lines.map((line) => (
          <li key={line.id} className="flex justify-between gap-3">
            <span>
              {line.description}
              {line.quantity > 1 ? <span className="text-muted"> × {line.quantity}</span> : null}
            </span>
            <span className="shrink-0">{formatRupiah(line.amount)}</span>
          </li>
        ))}
      </ul>

      <div className="my-4 border-t border-dashed border-line" />

      <div className="space-y-1 text-sm">
        <p className="flex justify-between gap-3">
          <span>Subtotal</span>
          <span>{formatRupiah(subtotal)}</span>
        </p>
        <p className="flex justify-between gap-3">
          <span>Diskon</span>
          <span>{discount > 0 ? `-${formatRupiah(discount)}` : formatRupiah(0)}</span>
        </p>
        <p className="flex justify-between gap-3 text-base font-semibold">
          <span>Total</span>
          <span>{formatRupiah(total)}</span>
        </p>
        {payments.map((payment) => (
          <p key={payment.id} className="flex justify-between gap-3">
            <span>{payment.label}</span>
            <span>{formatRupiah(payment.amount)}</span>
          </p>
        ))}
        <p className="flex justify-between gap-3 font-semibold">
          <span>Sisa</span>
          <span>{formatRupiah(Math.max(remaining, 0))}</span>
        </p>
      </div>

      {draft ? <p className="no-print mt-4 text-center text-xs text-muted">Pratinjau. Struk resmi tersimpan setelah pembayaran.</p> : null}

      <div className="no-print mt-5 flex justify-center">
        <PrintButton />
      </div>
    </section>
  );
}
