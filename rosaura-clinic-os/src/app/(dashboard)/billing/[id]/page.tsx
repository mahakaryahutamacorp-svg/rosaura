import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { reversePaymentAction } from "@/app/actions/operations";
import { PaymentForm } from "@/components/billing/PaymentForm";
import { OpenCustomerDisplay } from "@/components/display/OpenCustomerDisplay";
import { Receipt } from "@/components/billing/Receipt";
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

  const discount = Math.max(invoice.subtotal - invoice.grandTotal, 0);
  const saleLines = invoice.items.filter((item) => item.itemType !== "DISCOUNT");

  return (
    <div className="space-y-6">
      <div className="no-print">
        <Link href="/billing" className="text-sm text-gold-deep">
          Semua tagihan
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <h1 className="font-display text-4xl">{invoice.invoiceNumber}</h1>
          <OpenCustomerDisplay />
        </div>
        <p className="text-sm text-muted">
          {invoice.client.fullName} · {invoiceLabel[invoice.status]}
          {invoice.booking ? ` · ${invoice.booking.bookingCode}` : ""}
        </p>
      </div>
      <div className="no-print">
        <Flash error={query.error} notice={query.notice} />
      </div>

      <div className="mx-auto max-w-sm">
        <Receipt
          invoiceNumber={invoice.invoiceNumber}
          clientName={invoice.client.fullName}
          issuedAt={formatDateTime(invoice.createdAt)}
          lines={saleLines.map((item) => ({
            id: item.id,
            description: item.descriptionSnapshot,
            quantity: item.quantity,
            amount: item.unitPrice * item.quantity,
          }))}
          subtotal={invoice.subtotal}
          discount={discount}
          total={invoice.grandTotal}
          payments={invoice.payments
            .filter((payment) => payment.amount > 0 && !payment.reversal)
            .map((payment) => ({
              id: payment.id,
              label: paymentLabel[payment.method] ?? payment.method,
              amount: payment.amount,
            }))}
          remaining={remaining}
        />
      </div>

      {invoice.status !== "VOID" && remaining > 0 ? (
        <PaymentForm
          invoiceId={invoice.id}
          clientName={invoice.client.fullName}
          lines={saleLines.map((item) => ({
            name: item.descriptionSnapshot,
            quantity: item.quantity,
            amount: item.unitPrice * item.quantity,
          }))}
          subtotal={invoice.subtotal}
          grandTotal={invoice.grandTotal}
          paid={paid}
        />
      ) : null}

      <section className="no-print space-y-3">
        <h2 className="font-display text-2xl">Pembayaran</h2>
        {invoice.payments.filter((payment) => payment.amount > 0).map((payment) => (
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
