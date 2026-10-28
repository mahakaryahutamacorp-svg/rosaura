import { redirect } from "next/navigation";
import { DoctorCard } from "@/components/doctors/DoctorCard";
import { DoctorCreateForm } from "@/components/doctors/DoctorCreateForm";
import { Flash } from "@/components/Flash";
import { SearchBox } from "@/components/search/SearchBox";
import { canManageDoctors, requireUser } from "@/lib/access";
import { rankBySmartSearch } from "@/lib/search";
import { listDoctors } from "@/services/doctor.service";

export default async function DoctorsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string; q?: string }>;
}) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  if (!canManageDoctors(user)) redirect("/dashboard");
  const query = (params.q ?? "").trim().slice(0, 80);
  const doctors = await listDoctors(user);
  const visible = rankBySmartSearch(doctors, query, (doctor) => [
    doctor.name,
    doctor.employeeCode,
    doctor.user?.email,
    doctor.phone,
  ]);
  const activeCount = doctors.filter((doctor) => doctor.isActive && doctor.user?.isActive).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl">Akun Dokter</h1>
        <p className="text-sm text-muted">
          {doctors.length} dokter, {activeCount} aktif. Dokter baru mendapat akses klinis; akses owner bersifat opsional.
        </p>
      </div>
      <Flash error={params.error} notice={params.notice} />
      <DoctorCreateForm />
      <SearchBox basePath="/doctors" label="Cari dokter" defaultValue={query} placeholder="Nama, kode DOK, email, atau telepon" />
      <section className="grid gap-4">
        {visible.length === 0 ? <p className="text-sm text-muted">Dokter tidak ditemukan.</p> : null}
        {visible.map((doctor) => (
          <DoctorCard key={doctor.id} doctor={doctor} isSelf={doctor.id === user.employeeId} />
        ))}
      </section>
    </div>
  );
}
