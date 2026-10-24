import Link from "next/link";
import { createClientAction, setClientActiveAction } from "@/app/actions/operations";
import { Flash } from "@/components/Flash";
import { can, requireUser } from "@/lib/access";
import { fieldClass, labelClass, primaryButton, quietButton } from "@/lib/styles";
import { formatDateOnlyUtc } from "@/lib/time";
import { listClients } from "@/services/client.service";
import { redirect } from "next/navigation";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; error?: string; notice?: string }>;
}) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  if (!can(user, ["FRONT_OFFICE", "CLINICAL"])) redirect("/dashboard");
  const query = params.q ?? "";
  const result = await listClients(query, Number(params.page ?? "1"));
  const canEdit = can(user, ["FRONT_OFFICE"]);
  const pageCount = Math.max(1, Math.ceil(result.total / result.pageSize));
  const queryString = query ? `&q=${encodeURIComponent(query)}` : "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl">Klien</h1>
        <p className="text-sm text-muted">
          {result.total} profil. Data tidak dihapus; klien yang berhenti cukup dinonaktifkan.
        </p>
      </div>
      <Flash error={params.error} notice={params.notice} />
      <form className="flex gap-2" action="/clients">
        <input className={fieldClass} name="q" defaultValue={params.q ?? ""} placeholder="Nama, kode, atau telepon" />
        <button className={quietButton} type="submit">
          Cari
        </button>
      </form>

      {canEdit ? (
        <form action={createClientAction} className="grid gap-3 rounded-3xl border border-line bg-paper p-5 md:grid-cols-4">
          <label>
            <span className={labelClass}>Nama</span>
            <input className={fieldClass} name="fullName" required />
          </label>
          <label>
            <span className={labelClass}>Telepon</span>
            <input className={fieldClass} name="phone" required placeholder="08..." />
          </label>
          <label>
            <span className={labelClass}>Tanggal lahir</span>
            <input className={fieldClass} type="date" name="dateOfBirth" />
          </label>
          <label className="flex items-end gap-2 pb-3 text-sm">
            <input type="checkbox" name="consent" required />
            Setuju pengolahan data
          </label>
          <button className={`${primaryButton} md:col-span-4 md:w-fit`} type="submit">
            Daftarkan klien
          </button>
        </form>
      ) : null}

      <div className="overflow-hidden rounded-3xl border border-line bg-paper">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-xs tracking-wide text-muted uppercase">
            <tr>
              <th className="px-5 py-3 font-medium">Kode</th>
              <th className="px-3 py-3 font-medium">Nama</th>
              <th className="px-3 py-3 font-medium">Telepon</th>
              <th className="px-3 py-3 font-medium">Lahir</th>
              <th className="px-3 py-3 font-medium">Kunjungan</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {result.items.map((client) => (
              <tr key={client.id} className="border-b border-line/70 last:border-0">
                <td className="px-5 py-3">{client.clientCode}</td>
                <td className="px-3 py-3 font-medium capitalize">
                  <Link href={`/clients/${client.id}`}>{client.fullName}</Link>
                </td>
                <td className="px-3 py-3">{client.phone || "-"}</td>
                <td className="px-3 py-3">{client.dateOfBirth ? formatDateOnlyUtc(client.dateOfBirth) : "-"}</td>
                <td className="px-3 py-3">{client._count.skinRecords}</td>
                <td className="px-5 py-3">
                  {canEdit ? (
                    <form action={setClientActiveAction}>
                      <input type="hidden" name="clientId" value={client.id} />
                      <input type="hidden" name="isActive" value={client.isActive ? "false" : "true"} />
                      <button className="text-gold-deep" type="submit">
                        {client.isActive ? "Aktif" : "Nonaktif"}
                      </button>
                    </form>
                  ) : client.isActive ? (
                    "Aktif"
                  ) : (
                    "Nonaktif"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-sm">
        <p className="text-muted">
          Halaman {Math.min(result.page, pageCount)} dari {pageCount}
        </p>
        <div className="flex gap-3">
          {result.page > 1 ? (
            <Link className="text-gold-deep" href={`/clients?page=${result.page - 1}${queryString}`}>
              Sebelumnya
            </Link>
          ) : null}
          {result.page < pageCount ? (
            <Link className="text-gold-deep" href={`/clients?page=${result.page + 1}${queryString}`}>
              Berikutnya
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
