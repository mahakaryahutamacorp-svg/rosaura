import Link from "next/link";
import { redirect } from "next/navigation";
import { Pager } from "@/components/Pager";
import { SearchBox } from "@/components/search/SearchBox";
import { canSeeClinical, requireUser } from "@/lib/access";
import { formatLongDate } from "@/lib/time";
import { searchMedicalRecords, type MedicalRecordHit } from "@/services/medical-record.service";

export default async function MedicalRecordsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  if (!canSeeClinical(user)) redirect("/dashboard");
  const query = (params.q ?? "").trim().slice(0, 80);
  const result = await searchMedicalRecords(query, Number(params.page));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl">Rekam Medis</h1>
        <p className="text-sm text-muted">
          {result.total} rekam kunjungan{query ? ` cocok dengan "${query}", diurutkan dari yang paling relevan` : ", terbaru di atas"}.
          Gabungkan nama pasien dengan keluhan, temuan, alergi, obat, atau bulan kunjungan.
        </p>
      </div>

      <SearchBox
        basePath="/medical-records"
        label="Cari rekam medis"
        defaultValue={query}
        placeholder="Contoh: siti jerawat, alergi amoxicillin, oktober 2026"
      />

      <section className="space-y-3">
        {result.items.length === 0 ? (
          <p className="rounded-3xl border border-line bg-paper p-5 text-sm text-muted">Rekam medis tidak ditemukan.</p>
        ) : null}
        {result.items.map((record) => (
          <MedicalRecordCard key={record.id} record={record} />
        ))}
      </section>

      <Pager
        basePath="/medical-records"
        page={result.page}
        pages={result.pages}
        total={result.total}
        params={query ? { q: query } : {}}
      />
    </div>
  );
}

function MedicalRecordCard({ record }: { record: MedicalRecordHit }) {
  return (
    <article className="rounded-3xl border border-line bg-paper p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <Link href={`/clients/${record.clientId}`} className="font-medium capitalize text-ink hover:text-gold-deep">
            {record.clientName}
          </Link>
          <p className="text-xs text-muted">
            {record.clientCode} · {formatLongDate(record.visitDate)}
          </p>
        </div>
        <p className="text-sm text-muted">
          {record.skinSummary || "Tanpa tipe kulit"}
          {record.photoCount > 0 ? ` · ${record.photoCount} foto` : ""}
        </p>
      </div>
      {record.excerpt ? (
        <p className="mt-3 text-sm">
          <span className="text-muted">{record.excerptLabel}. </span>
          {record.excerpt}
        </p>
      ) : null}
      <Link
        href={`/clients/${record.clientId}`}
        className="mt-3 inline-flex items-center gap-1 rounded-lg bg-gold/10 px-2.5 py-1 text-xs font-semibold text-gold-deep transition hover:bg-gold/20"
      >
        Buka rekam medis pasien &rarr;
      </Link>
    </article>
  );
}
