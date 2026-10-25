import { createClientAction } from "@/app/actions/operations";
import { ClientDirectory } from "@/components/clients/ClientDirectory";
import { Flash } from "@/components/Flash";
import { can, canSeeClientPhone, requireUser } from "@/lib/access";
import { fieldClass, labelClass, primaryButton } from "@/lib/styles";
import { formatDateOnlyUtc } from "@/lib/time";
import { listClientRows } from "@/services/client.service";
import { redirect } from "next/navigation";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  if (!can(user, ["FRONT_OFFICE", "CLINICAL"])) redirect("/dashboard");
  const showPhone = canSeeClientPhone(user);
  const clients = await listClientRows(showPhone);
  const canEdit = can(user, ["FRONT_OFFICE"]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl">Klien</h1>
        <p className="text-sm text-muted">
          {clients.length} profil. Ketik untuk menyaring, lalu gulir untuk melihat sisanya.
          {showPhone ? "" : " Nomor telepon hanya diisi saat pasien baru mendaftar, lalu disembunyikan."}
        </p>
      </div>
      <Flash error={params.error} notice={params.notice} />

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

      <ClientDirectory
        canEdit={canEdit}
        clients={clients.map((client) => ({
          id: client.id,
          fullName: client.fullName,
          clientCode: client.clientCode,
          birth: client.dateOfBirth ? formatDateOnlyUtc(client.dateOfBirth) : "-",
          visits: client._count.skinRecords,
          isActive: client.isActive,
          ...(showPhone ? { phone: client.phone ?? "" } : {}),
        }))}
      />
    </div>
  );
}
