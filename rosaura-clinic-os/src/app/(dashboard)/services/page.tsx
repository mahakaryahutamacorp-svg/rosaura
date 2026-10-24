import { redirect } from "next/navigation";
import { createServiceAction, setServiceActiveAction } from "@/app/actions/operations";
import { Flash } from "@/components/Flash";
import { can, isOwner, requireUser } from "@/lib/access";
import { formatRupiah } from "@/lib/format";
import { fieldClass, labelClass, primaryButton, quietButton } from "@/lib/styles";
import { listServices } from "@/services/catalog.service";

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  if (!can(user, ["FRONT_OFFICE"])) redirect("/dashboard");
  const services = await listServices(true);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl">Layanan</h1>
        <p className="text-sm text-muted">Harga di katalog tidak mengubah booking atau tagihan yang sudah tersimpan.</p>
      </div>
      <Flash error={params.error} notice={params.notice} />
      {isOwner(user) ? (
        <form action={createServiceAction} className="grid gap-3 rounded-3xl border border-line bg-paper p-5 md:grid-cols-4">
          <label>
            <span className={labelClass}>Kode</span>
            <input className={fieldClass} name="code" placeholder="FAC-60" required />
          </label>
          <label>
            <span className={labelClass}>Nama</span>
            <input className={fieldClass} name="name" required />
          </label>
          <label>
            <span className={labelClass}>Durasi menit</span>
            <input className={fieldClass} name="durationMinutes" type="number" min={15} max={240} required />
          </label>
          <label>
            <span className={labelClass}>Harga</span>
            <input className={fieldClass} name="price" type="number" min={1} required />
          </label>
          <button className={`${primaryButton} md:col-span-4 md:w-fit`} type="submit">
            Tambah layanan
          </button>
        </form>
      ) : null}
      <div className="overflow-hidden rounded-3xl border border-line bg-paper">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-xs tracking-wide text-muted uppercase">
            <tr>
              <th className="px-5 py-3 font-medium">Kode</th>
              <th className="px-3 py-3 font-medium">Nama</th>
              <th className="px-3 py-3 font-medium">Durasi</th>
              <th className="px-3 py-3 font-medium">Harga</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {services.map((service) => (
              <tr key={service.id} className="border-b border-line/70 last:border-0">
                <td className="px-5 py-3">{service.code}</td>
                <td className="px-3 py-3 font-medium">{service.name}</td>
                <td className="px-3 py-3">{service.durationMinutes} mnt</td>
                <td className="px-3 py-3">{formatRupiah(service.price)}</td>
                <td className="px-5 py-3">
                  {isOwner(user) ? (
                    <form action={setServiceActiveAction}>
                      <input type="hidden" name="serviceId" value={service.id} />
                      <input type="hidden" name="isActive" value={service.isActive ? "false" : "true"} />
                      <button className={quietButton} type="submit">
                        {service.isActive ? "Aktif" : "Nonaktif"}
                      </button>
                    </form>
                  ) : service.isActive ? (
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
    </div>
  );
}
