import { createDoctorAction } from "@/app/actions/doctors";
import { fieldClass, labelClass, primaryButton } from "@/lib/styles";

export function DoctorCreateForm() {
  return (
    <form action={createDoctorAction} className="grid gap-3 rounded-3xl border border-line bg-paper p-5 md:grid-cols-2">
      <div className="md:col-span-2">
        <h2 className="font-display text-2xl">Dokter baru</h2>
        <p className="text-sm text-muted">Akun langsung bisa masuk dengan email dan kata sandi ini. Kode DOK dibuat otomatis.</p>
      </div>
      <label>
        <span className={labelClass}>Nama</span>
        <input className={fieldClass} name="name" required minLength={3} maxLength={120} placeholder="dr. Nama Lengkap" />
      </label>
      <label>
        <span className={labelClass}>Email login</span>
        <input className={fieldClass} name="email" type="email" required maxLength={190} autoComplete="off" />
      </label>
      <label>
        <span className={labelClass}>Telepon</span>
        <input className={fieldClass} name="phone" inputMode="tel" placeholder="08..." />
      </label>
      <label>
        <span className={labelClass}>Kata sandi awal</span>
        <input
          className={fieldClass}
          name="password"
          type="password"
          required
          minLength={8}
          maxLength={72}
          autoComplete="new-password"
        />
      </label>
      <label className="flex items-center gap-2 text-sm md:col-span-2">
        <input type="checkbox" name="grantOwner" />
        Beri akses owner (kelola karyawan, akun dokter, dan audit)
      </label>
      <button className={`${primaryButton} md:col-span-2 md:w-fit`} type="submit">
        Buat akun dokter
      </button>
    </form>
  );
}
