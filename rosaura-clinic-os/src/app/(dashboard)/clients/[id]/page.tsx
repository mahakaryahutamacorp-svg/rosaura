import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { can, canSeeClinical, requireUser } from "@/lib/access";
import { formatDateOnlyUtc, formatLongDate } from "@/lib/time";
import { getClientProfile } from "@/services/client.service";

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [user, route] = await Promise.all([requireUser(), params]);
  if (!can(user, ["FRONT_OFFICE", "CLINICAL"])) redirect("/dashboard");
  const client = await getClientProfile(route.id);
  if (!client) notFound();
  const showClinical = canSeeClinical(user);

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
            {showClinical ? <ClinicalRecord record={record} /> : null}
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
