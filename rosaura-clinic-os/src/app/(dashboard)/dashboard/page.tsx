import Link from "next/link";
import { Flash } from "@/components/Flash";
import { StatusBadge } from "@/components/StatusBadge";
import { can, isOwner, requireUser } from "@/lib/access";
import { formatRupiah } from "@/lib/format";
import { formatLongDate } from "@/lib/time";
import { getDashboard } from "@/services/dashboard.service";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  const data = await getDashboard(user);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs tracking-[0.18em] text-muted uppercase">Hari ini</p>
        <h1 className="font-display text-4xl">Ringkasan</h1>
      </div>
      <Flash error={params.error} notice={params.notice} />

      {data.kind === "owner" ? (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Uang masuk" value={formatRupiah(data.cashIn)} hint="Pembayaran hari ini dikurangi pembalikan" />
          <Metric label="Piutang" value={formatRupiah(data.piutang)} hint="Tagihan yang belum lunas" />
          <Metric label="Booking" value={String(data.bookingsToday)} hint="Seluruh status hari ini" />
          <Metric label="Tidak datang" value={String(data.noShow)} hint="No-show hari ini" />
        </section>
      ) : null}

      {data.kind === "front" ? (
        <section className="grid gap-3 sm:grid-cols-3">
          <Metric label="Booking hari ini" value={String(data.bookingsToday)} hint="Semua petugas" />
          <Metric label="Belum datang" value={String(data.waiting)} hint="Dibooking atau dikonfirmasi" />
          <Metric label="Tagihan terbuka" value={String(data.openInvoices)} hint="Jumlah piutang, tanpa nominal" />
        </section>
      ) : null}

      {data.kind === "clinical" ? (
        <p className="text-sm text-muted">Jadwal treatment Anda hari ini.</p>
      ) : null}

      {data.kind === "warehouse" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-3xl border border-line bg-paper p-5">
            <h2 className="font-display text-2xl">Kedaluwarsa</h2>
            <ul className="mt-4 space-y-3">
              {data.expiring.length === 0 ? <li className="text-sm text-muted">Tidak ada batch dalam 30 hari.</li> : null}
              {data.expiring.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
                  <span>
                    {item.name} · {item.batchNumber}
                  </span>
                  <span className={item.expired ? "text-[#8a3d36]" : "text-brown"}>
                    {item.expired ? "Kedaluwarsa" : `${item.days} hari`}
                  </span>
                </li>
              ))}
            </ul>
          </article>
          <article className="rounded-3xl border border-line bg-paper p-5">
            <h2 className="font-display text-2xl">Stok minimum</h2>
            <ul className="mt-4 space-y-3">
              {data.low.length === 0 ? <li className="text-sm text-muted">Semua SKU di atas batas minimum.</li> : null}
              {data.low.map((item) => (
                <li key={item.id} className="text-sm">
                  {item.name}: {item.qty} dari minimum {item.min}
                </li>
              ))}
            </ul>
          </article>
        </div>
      ) : (
        <section className="overflow-hidden rounded-3xl border border-line bg-paper">
          <div className="flex items-center justify-between px-5 py-4">
            <h2 className="font-display text-2xl">Antrean</h2>
            {can(user, ["FRONT_OFFICE", "CLINICAL"]) || isOwner(user) ? (
              <Link href="/bookings" className="text-sm text-gold-deep">
                Buka kalender
              </Link>
            ) : null}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="border-y border-line text-xs tracking-wide text-muted uppercase">
                <tr>
                  <th className="px-5 py-3 font-medium">Jam</th>
                  <th className="px-3 py-3 font-medium">Klien</th>
                  <th className="px-3 py-3 font-medium">Layanan</th>
                  <th className="px-3 py-3 font-medium">Petugas</th>
                  <th className="px-3 py-3 font-medium">Ruang</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {"rows" in data && data.rows.length === 0 ? (
                  <tr>
                    <td className="px-5 py-6 text-muted" colSpan={6}>
                      Belum ada booking hari ini.
                    </td>
                  </tr>
                ) : null}
                {"rows" in data
                  ? data.rows.map((row) => (
                      <tr key={row.id} className="border-b border-line/80 last:border-0">
                        <td className="px-5 py-3">{row.time}</td>
                        <td className="px-3 py-3 font-medium">
                          <Link href={`/bookings/${row.id}`}>{row.clientName}</Link>
                        </td>
                        <td className="px-3 py-3">{row.serviceName}</td>
                        <td className="px-3 py-3">{row.therapistName}</td>
                        <td className="px-3 py-3">{row.roomName}</td>
                        <td className="px-5 py-3">
                          <StatusBadge status={row.status} />
                        </td>
                      </tr>
                    ))
                  : null}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {"recent" in data && data.recent ? (
        <section className="rounded-3xl border border-line bg-paper p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-2xl">Kunjungan terakhir</h2>
            <Link href="/clients" className="text-sm text-gold-deep">
              Semua klien
            </Link>
          </div>
          <ul className="mt-4 space-y-3">
            {data.recent.length === 0 ? <li className="text-sm text-muted">Belum ada rekam kunjungan.</li> : null}
            {data.recent.map((item) => (
              <li key={item.id} className="text-sm">
                <Link className="font-medium capitalize" href={`/clients/${item.clientId}`}>
                  {item.clientName}
                </Link>
                <span className="text-muted"> · {formatLongDate(item.visitDate)}</span>
                {item.summary ? <p className="mt-1 text-brown">{item.summary}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <article className="rounded-3xl border border-line bg-paper p-5">
      <p className="text-xs tracking-[0.14em] text-muted uppercase">{label}</p>
      <p className="font-display mt-2 text-4xl text-ink">{value}</p>
      <p className="mt-2 text-xs text-brown">{hint}</p>
    </article>
  );
}
