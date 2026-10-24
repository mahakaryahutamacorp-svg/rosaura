import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { addVisitPhotosAction, createSkinVisitAction, removeVisitPhotoAction } from "@/app/actions/clinical-photos";
import { Flash } from "@/components/Flash";
import { PhotoProgress } from "@/components/clinical/PhotoProgress";
import { can, canSeeClinical, requireUser } from "@/lib/access";
import { fieldClass, labelClass, primaryButton, quietButton } from "@/lib/styles";
import { formatDateOnlyUtc, formatLongDate, todayJakarta } from "@/lib/time";
import { getClientProfile } from "@/services/client.service";

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const [user, route, query] = await Promise.all([requireUser(), params, searchParams]);
  if (!can(user, ["FRONT_OFFICE", "CLINICAL"])) redirect("/dashboard");
  const client = await getClientProfile(route.id);
  if (!client) notFound();
  const showClinical = canSeeClinical(user);
  const progress = [...client.skinRecords]
    .sort((left, right) => left.visitDate.getTime() - right.visitDate.getTime())
    .flatMap((record) =>
      record.photos.map((photo) => ({
        id: photo.id,
        label: formatLongDate(record.visitDate),
        caption: photo.caption,
      })),
    );

  return (
    <div className="space-y-6">
      <div>
        <Link href="/clients" className="text-sm text-gold-deep">
          Kembali ke daftar
        </Link>
        <h1 className="font-display mt-2 text-4xl capitalize">{client.fullName}</h1>
        <p className="text-sm text-muted">
          {client.clientCode}
          {client.gender ? ` · ${client.gender}` : ""}
          {client.phone ? ` · ${client.phone}` : ""}
        </p>
      </div>

      <section className="grid gap-3 rounded-3xl border border-line bg-paper p-5 sm:grid-cols-2">
        <Fact label="Alamat" value={client.address || "-"} />
        <Fact label="Tanggal lahir" value={client.dateOfBirth ? formatDateOnlyUtc(client.dateOfBirth) : "-"} />
        <Fact label="Terdaftar" value={formatLongDate(client.registeredAt)} />
        <Fact label="Status" value={client.isActive ? "Aktif" : "Nonaktif"} />
      </section>

      <Flash error={query.error} notice={query.notice} />

      {showClinical ? (
        <>
          <PhotoProgress photos={progress} />
          <form action={createSkinVisitAction} className="grid gap-3 rounded-3xl border border-line bg-paper p-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <h2 className="font-display text-2xl">Kunjungan baru</h2>
              <p className="text-sm text-muted">Catatan dan foto kunjungan ini masuk ke riwayat dokter.</p>
            </div>
            <input type="hidden" name="clientId" value={client.id} />
            <label>
              <span className={labelClass}>Tanggal kunjungan</span>
              <input className={fieldClass} type="date" name="visitDate" required defaultValue={todayJakarta()} />
            </label>
            <label>
              <span className={labelClass}>Foto</span>
              <input className="block w-full text-sm" type="file" name="photos" accept="image/jpeg,image/png,image/webp" multiple />
            </label>
            <label className="md:col-span-2">
              <span className={labelClass}>Catatan</span>
              <textarea className={`${fieldClass} h-24 py-2`} name="doctorNotes" placeholder="Temuan atau rencana pada kunjungan ini" />
            </label>
            <button className={`${primaryButton} md:w-fit`} type="submit">
              Simpan kunjungan
            </button>
          </form>
        </>
      ) : null}

      <section className="space-y-3">
        <h2 className="font-display text-2xl">Riwayat kunjungan</h2>
        {client.skinRecords.length === 0 ? <p className="text-sm text-muted">Belum ada rekam kunjungan.</p> : null}
        {client.skinRecords.map((record) => (
          <article key={record.id} className="rounded-3xl border border-line bg-paper p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-medium">{formatLongDate(record.visitDate)}</h3>
              {showClinical ? (
                <p className="text-sm text-muted">
                  {[record.skinType, record.moisture].filter(Boolean).join(" · ") || "Tanpa tipe kulit"}
                </p>
              ) : (
                <p className="text-sm text-muted">Rekam kulit tersimpan</p>
              )}
            </div>
            {showClinical ? (
              <>
                <ClinicalRecord record={record} />
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {record.photos.map((photo) => (
                    <figure key={photo.id} className="rounded-2xl border border-line bg-ivory p-2">
                      <img
                        className="h-32 w-full rounded-xl object-cover"
                        src={`/clinical-photos/${photo.id}`}
                        alt={photo.caption || `Foto kunjungan ${formatLongDate(record.visitDate)}`}
                      />
                      {photo.caption ? <figcaption className="mt-2 text-xs text-brown">{photo.caption}</figcaption> : null}
                      <form action={removeVisitPhotoAction} className="mt-2">
                        <input type="hidden" name="clientId" value={client.id} />
                        <input type="hidden" name="photoId" value={photo.id} />
                        <button className="text-xs text-[#8a3d36]" type="submit">
                          Hapus
                        </button>
                      </form>
                    </figure>
                  ))}
                </div>
                <form action={addVisitPhotosAction} className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
                  <input type="hidden" name="clientId" value={client.id} />
                  <input type="hidden" name="skinRecordId" value={record.id} />
                  <label>
                    <span className={labelClass}>Tambah foto kunjungan ini</span>
                    <input className="block w-full text-sm" type="file" name="photos" accept="image/jpeg,image/png,image/webp" multiple required />
                  </label>
                  <label>
                    <span className={labelClass}>Keterangan</span>
                    <input className={fieldClass} name="caption" placeholder="Sebelum treatment, pipi kanan" />
                  </label>
                  <button className={quietButton} type="submit">
                    Simpan foto
                  </button>
                </form>
              </>
            ) : null}
          </article>
        ))}
      </section>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs tracking-[0.14em] text-muted uppercase">{label}</p>
      <p className="mt-1 text-sm">{value}</p>
    </div>
  );
}

function ClinicalRecord({
  record,
}: {
  record: {
    complaint: string;
    doctorNotes: string;
    acneStatus: boolean;
    acneArea: string;
    acneDegree: string;
    hyperpigmentationStatus: boolean;
    hyperpigmentationArea: string;
    hyperpigmentationDegree: string;
    wrinkleStatus: boolean;
    wrinkleArea: string;
    wrinkleDegree: string;
    scarStatus: boolean;
    scarType: string;
    allergyHistory: string;
    diseaseHistory: string;
    medicationHistory: string;
    lastTreatmentProduct: string;
    otherSkinConditions: string;
    contraception: string;
    pregnant: boolean;
    breastfeeding: boolean;
    photoBefore: string;
    photoAfter: string;
  };
}) {
  const findings = [
    finding("Jerawat", record.acneStatus, record.acneArea, record.acneDegree),
    finding("Hiperpigmentasi", record.hyperpigmentationStatus, record.hyperpigmentationArea, record.hyperpigmentationDegree),
    finding("Kerutan", record.wrinkleStatus, record.wrinkleArea, record.wrinkleDegree),
    finding("Bekas", record.scarStatus, record.scarType, ""),
  ].filter((item): item is string => Boolean(item));
  const flags = [record.pregnant ? "Hamil" : "", record.breastfeeding ? "Menyusui" : ""].filter(Boolean);

  return (
    <div className="mt-4 space-y-3 text-sm">
      {record.complaint ? <Note label="Keluhan" value={record.complaint} /> : null}
      {record.doctorNotes ? <Note label="Catatan" value={record.doctorNotes} /> : null}
      {findings.length > 0 ? <Note label="Temuan" value={findings.join(" · ")} /> : null}
      {flags.length > 0 ? <Note label="Kondisi" value={flags.join(" · ")} /> : null}
      {record.allergyHistory ? <Note label="Alergi" value={record.allergyHistory} /> : null}
      {record.diseaseHistory ? <Note label="Riwayat penyakit" value={record.diseaseHistory} /> : null}
      {record.medicationHistory ? <Note label="Obat" value={record.medicationHistory} /> : null}
      {record.lastTreatmentProduct ? <Note label="Produk terakhir" value={record.lastTreatmentProduct} /> : null}
      {record.otherSkinConditions ? <Note label="Kondisi lain" value={record.otherSkinConditions} /> : null}
      {record.contraception ? <Note label="Kontrasepsi" value={record.contraception} /> : null}
      {record.photoBefore || record.photoAfter ? (
        <p className="text-muted">Nama berkas foto ada di arsip lama. File gambarnya tidak ikut dimuat.</p>
      ) : null}
    </div>
  );
}

function finding(label: string, active: boolean, area: string, degree: string) {
  const detail = [area, degree].filter(Boolean).join(", ");
  if (!active && !detail) return "";
  return detail ? `${label}: ${detail}` : label;
}

function Note({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="text-muted">{label}. </span>
      <span className="whitespace-pre-wrap">{value}</span>
    </p>
  );
}
