import { redirect } from "next/navigation";
import { createServiceAction, deleteServiceAction, setServiceActiveAction, updateServiceAction } from "@/app/actions/operations";
import { Flash } from "@/components/Flash";
import { can, canManageCatalog, requireUser } from "@/lib/access";
import { formatRupiah } from "@/lib/format";
import { dangerButton, fieldClass, labelClass, primaryButton, quietButton } from "@/lib/styles";
import { listServices } from "@/services/catalog.service";

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  if (!can(user, ["FRONT_OFFICE"])) redirect("/dashboard");
  const services = await listServices(true);
  const canEdit = canManageCatalog(user);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl">Layanan</h1>
        <p className="text-sm text-muted">Harga di katalog tidak mengubah booking atau tagihan yang sudah tersimpan.</p>
      </div>
      <Flash error={params.error} notice={params.notice} />
      {canEdit ? (
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
      <div className="space-y-3">
        {services.length === 0 ? <p className="text-sm text-muted">Belum ada layanan. Tambahkan dari formulir di atas.</p> : null}
        {services.map((service) => (
          <article key={service.id} className="rounded-3xl border border-line bg-paper p-5">
            {canEdit ? (
              <form action={updateServiceAction} className="grid gap-3 md:grid-cols-4">
                <input type="hidden" name="serviceId" value={service.id} />
                <label>
                  <span className={labelClass}>Kode</span>
                  <input className={fieldClass} name="code" defaultValue={service.code} required />
                </label>
                <label>
                  <span className={labelClass}>Nama</span>
                  <input className={fieldClass} name="name" defaultValue={service.name} required />
                </label>
                <label>
                  <span className={labelClass}>Durasi menit</span>
                  <input className={fieldClass} name="durationMinutes" type="number" min={15} max={240} defaultValue={service.durationMinutes} required />
                </label>
                <label>
                  <span className={labelClass}>Harga</span>
                  <input className={fieldClass} name="price" type="number" min={1} defaultValue={service.price} required />
                </label>
                <div className="flex flex-wrap gap-2 md:col-span-4">
                  <button className={primaryButton} type="submit">
                    Simpan
                  </button>
                </div>
              </form>
            ) : (
              <div className="grid gap-1 text-sm md:grid-cols-4">
                <p>{service.code}</p>
                <p className="font-medium">{service.name}</p>
                <p>{service.durationMinutes} mnt</p>
                <p>{formatRupiah(service.price)}</p>
              </div>
            )}
            {canEdit ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <form action={setServiceActiveAction}>
                  <input type="hidden" name="serviceId" value={service.id} />
                  <input type="hidden" name="isActive" value={service.isActive ? "false" : "true"} />
                  <button className={quietButton} type="submit">
                    {service.isActive ? "Aktif" : "Nonaktif"}
                  </button>
                </form>
                <form action={deleteServiceAction}>
                  <input type="hidden" name="serviceId" value={service.id} />
                  <button className={dangerButton} type="submit">
                    Hapus
                  </button>
                </form>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
