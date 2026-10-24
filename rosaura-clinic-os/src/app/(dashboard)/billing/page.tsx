import Link from "next/link";
import { redirect } from "next/navigation";
import { Flash } from "@/components/Flash";
import { canBill, requireUser } from "@/lib/access";
import { formatRupiah } from "@/lib/format";
import { invoiceLabel } from "@/lib/labels";
import { listInvoices } from "@/services/billing.service";
import { netPaid } from "@/services/billing.service";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  if (!canBill(user)) redirect("/dashboard");
  const invoices = await listInvoices();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl">Kasir</h1>
        <p className="text-sm text-muted">Tagihan, pembayaran, dan sisa piutang dicatat terpisah.</p>
      </div>
      <Flash error={params.error} notice={params.notice} />
      <div className="overflow-hidden rounded-3xl border border-line bg-paper">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-line text-xs tracking-wide text-muted uppercase">
            <tr>
              <th className="px-5 py-3 font-medium">Nomor</th>
              <th className="px-3 py-3 font-medium">Klien</th>
              <th className="px-3 py-3 font-medium">Total</th>
              <th className="px-3 py-3 font-medium">Sisa</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => {
              const remaining = invoice.grandTotal - netPaid(invoice.payments);
              return (
                <tr key={invoice.id} className="border-b border-line/70 last:border-0">
                  <td className="px-5 py-3">
                    <Link className="font-medium" href={`/billing/${invoice.id}`}>
                      {invoice.invoiceNumber}
                    </Link>
                  </td>
                  <td className="px-3 py-3">{invoice.client.fullName}</td>
                  <td className="px-3 py-3">{formatRupiah(invoice.grandTotal)}</td>
                  <td className="px-3 py-3">{formatRupiah(Math.max(remaining, 0))}</td>
                  <td className="px-5 py-3">{invoiceLabel[invoice.status] ?? invoice.status}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
