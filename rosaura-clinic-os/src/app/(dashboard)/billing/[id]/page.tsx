import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { reversePaymentAction } from "@/app/actions/operations";
import { PaymentForm } from "@/components/billing/PaymentForm";
import { Flash } from "@/components/Flash";
import { canBill, isOwner, requireUser } from "@/lib/access";
import { formatRupiah } from "@/lib/format";
import { invoiceLabel, paymentLabel } from "@/lib/labels";
import { fieldClass, labelClass, dangerButton } from "@/lib/styles";
import { dayKey, formatDateTime } from "@/lib/time";
import { getInvoice, netPaid } from "@/services/billing.service";

export default async function InvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const [user, { id }, query] = await Promise.all([requireUser(), params, searchParams]);
  if (!canBill(user)) redirect("/dashboard");
  const invoice = await getInvoice(id);
  if (!invoice) notFound();
  const paid = netPaid(invoice.payments);
  const remaining = Math.max(invoice.grandTotal - paid, 0);
  const today = dayKey(new Date());

  return (
    <div className="space-y-6">
      <div>
        <Link href="/billing" className="text-sm text-gold-deep">
          Semua tagihan
        </Link>
        <h1 className="font-display mt-2 text-4xl">{invoice.invoiceNumber}</h1>
        <p className="text-sm text-muted">
          {invoice.client.fullName} · {invoiceLabel[invoice.status]}
          {invoice.booking ? ` · ${invoice.booking.bookingCode}` : ""}
        </p>
      </div>
      <Flash error={query.error} notice={query.notice} />

      <section className="rounded-3xl border border-line bg-paper p-5">
        <h2 className="font-display text-2xl">Struk</h2>
        <ul className="mt-4 divide-y divide-line text-sm">
          {invoice.items.map((item) => (
            <li key={item.id} className="flex justify-between gap-3 py-2">
              <span>{item.descriptionSnapshot}</span>
              <span>{formatRupiah(item.unitPrice * item.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 space-y-1 text-sm">
          <p className="flex justify-between"><span>Total tagihan</span><span>{formatRupiah(invoice.grandTotal)}</span></p>
          <p className="flex justify-between"><span>Sudah diterima</span><span>{formatRupiah(paid)}</span></p>
          <p className="flex justify-between font-semibold"><span>Sisa piutang</span><span>{formatRupiah(remaining)}</span></p>
        </div>
      </section>

      {invoice.status !== "VOID" && remaining > 0 ? <PaymentForm invoiceId={invoice.id} remaining={remaining} /> : null}

      <section className="space-y-3">
        <h2 className="font-display text-2xl">Pembayaran</h2>
        {invoice.payments.map((payment) => (
          <article key={payment.id} className="rounded-2xl border border-line bg-paper p-4 text-sm">
            <p className="font-medium">
              {paymentLabel[payment.method]} · {formatRupiah(payment.amount)}
            </p>
            <p className="text-muted">
              {formatDateTime(payment.paidAt)} · {payment.createdBy.employee.name}
              {payment.reversal ? ` · dibalik: ${payment.reversal.reason}` : ""}
            </p>
            {isOwner(user) && !payment.reversal && dayKey(payment.paidAt) === today ? (
              <form action={reversePaymentAction} className="mt-3 flex flex-wrap items-end gap-2">
                <input type="hidden" name="invoiceId" value={invoice.id} />
                <input type="hidden" name="paymentId" value={payment.id} />
                <label className="min-w-64 flex-1">
                  <span className={labelClass}>Alasan pembalikan</span>
                  <input className={fieldClass} name="reason" required minLength={3} />
                </label>
                <button className={dangerButton} type="submit">
                  Balikkan
                </button>
              </form>
            ) : null}
          </article>
        ))}
      </section>
    </div>
  );
}
