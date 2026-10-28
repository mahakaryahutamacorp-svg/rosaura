import { deleteDoctorAction, updateDoctorAction } from "@/app/actions/doctors";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { roleNames } from "@/lib/labels";
import { fieldClass, labelClass, quietButton } from "@/lib/styles";
import type { DoctorRecord } from "@/services/doctor.service";

export function DoctorCard({ doctor, isSelf }: { doctor: DoctorRecord; isSelf: boolean }) {
  const roles = doctor.roles.map((item) => item.role.name);
  const isActive = doctor.isActive && Boolean(doctor.user?.isActive);

  return (
    <article className="rounded-3xl border border-line bg-paper p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">
            {doctor.name}
            {isSelf ? <span className="ml-2 text-xs font-normal text-muted">(akun Anda)</span> : null}
          </h2>
          <p className="text-sm text-muted">
            {doctor.employeeCode} · {doctor.user?.email ?? "tanpa akun login"}
            {doctor.phone ? ` · ${doctor.phone}` : ""}
          </p>
          <p className="text-xs text-muted">
            Akses: {roleNames(roles)} · {doctor._count.visits} kunjungan · {doctor._count.assignments} booking
          </p>
        </div>
        <span
          className={`rounded-lg px-2 py-0.5 text-xs ${
            isActive ? "bg-[#e5efe4] text-[#2f5d3a]" : "bg-[#eceae6] text-[#4d463f]"
          }`}
        >
          {isActive ? "Aktif" : "Nonaktif"}
        </span>
      </div>

      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-medium text-gold-deep">Ubah atau hapus</summary>
        <form action={updateDoctorAction} className="mt-4 grid gap-3 md:grid-cols-2">
          <input type="hidden" name="employeeId" value={doctor.id} />
          <label>
            <span className={labelClass}>Nama</span>
            <input className={fieldClass} name="name" defaultValue={doctor.name} required minLength={3} maxLength={120} />
          </label>
          <label>
            <span className={labelClass}>Email login</span>
            <input className={fieldClass} name="email" type="email" defaultValue={doctor.user?.email ?? ""} required />
          </label>
          <label>
            <span className={labelClass}>Telepon</span>
            <input className={fieldClass} name="phone" inputMode="tel" defaultValue={doctor.phone ?? ""} />
          </label>
          <label>
            <span className={labelClass}>Kata sandi baru</span>
            <input
              className={fieldClass}
              name="password"
              type="password"
              minLength={8}
              maxLength={72}
              autoComplete="new-password"
              placeholder="Kosongkan bila tidak diganti"
            />
          </label>
          <div className="flex flex-wrap gap-4 text-sm md:col-span-2">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="isActive" defaultChecked={isActive} disabled={isSelf} />
              Aktif
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="grantOwner" defaultChecked={roles.includes("OWNER")} disabled={isSelf} />
              Akses owner
            </label>
            {isSelf ? (
              <>
                <input type="hidden" name="isActive" value="on" />
                <input type="hidden" name="grantOwner" value="on" />
              </>
            ) : null}
          </div>
          <button className={`${quietButton} w-fit`} type="submit">
            Simpan perubahan
          </button>
        </form>
        {isSelf ? null : (
          <form action={deleteDoctorAction} className="mt-3">
            <input type="hidden" name="employeeId" value={doctor.id} />
            <ConfirmSubmitButton
              message={`Hapus akun ${doctor.name}? Bila sudah punya riwayat di klinik, akun hanya dinonaktifkan.`}
            >
              Hapus akun
            </ConfirmSubmitButton>
          </form>
        )}
      </details>
    </article>
  );
}
