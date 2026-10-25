import Link from "next/link";
import { redirect } from "next/navigation";
import { CashierDesk } from "@/components/billing/CashierDesk";
import { Flash } from "@/components/Flash";
import { canBill, requireUser } from "@/lib/access";
import { formatRupiah } from "@/lib/format";
import { invoiceLabel } from "@/lib/labels";
import { listCashierProducts, listCashierServices, listInvoices, netPaid } from "@/services/billing.service";
import { listClientOptions } from "@/services/client.service";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  if (!canBill(user)) redirect("/dashboard");
  const [invoices, products, services, clients] = await Promise.all([
    listInvoices(),
    listCashierProducts(),
    listCashierServices(),
    listClientOptions(),
  ]);

  return (
    <div className="space-y-6">
      <div className="no-print">
        <h1 className="font-display text-4xl">Kasir</h1>
        <p className="text-sm text-muted">Cari produk, layanan, atau klien dengan mengetik. Gulir daftar untuk melihat semuanya. Stok produk terpotong otomatis.</p>
      </div>
      <div className="no-print">
        <Flash error={params.error} notice={params.notice} />
      </div>
      <CashierDesk products={products} services={services} clients={clients} />
      <div className="no-print overflow-hidden rounded-3xl border border-line bg-paper">
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
            {invoices.length === 0 ? (
              <tr>
                <td className="px-5 py-6 text-muted" colSpan={5}>
                  Belum ada tagihan.
                </td>
              </tr>
            ) : null}
            {invoices.map((invoice) => {
              const remaining = invoice.grandTotal - netPaid(invoice.payments);
              return (
                <tr key={invoice.id} className="border-b border-line/70 last:border-0">
                  <td className="px-5 py-3">
                    <Link className="font-medium" href={`/billing/${invoice.id}`}>
                      {invoice.invoiceNumber}
                    </Link>
                  </td>
                  <td className="px-3 py-3 capitalize">{invoice.client.fullName}</td>
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
