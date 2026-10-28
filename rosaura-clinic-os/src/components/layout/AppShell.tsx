import { SideNav } from "@/components/layout/SideNav";
import { logoutAction } from "@/app/actions/auth";
import {
  can,
  canBill,
  canBook,
  canFillJournal,
  canManageDoctors,
  canSeeClinical,
  canSeeStock,
  isOwner,
  type AppUser,
} from "@/lib/access";
import { formatLongDate } from "@/lib/time";
import { secondaryButton } from "@/lib/styles";

export function AppShell({ user, children }: { user: AppUser; children: React.ReactNode }) {
  const items = [
    { href: "/dashboard", label: "Ringkasan", show: true },
    { href: "/journal", label: "Jurnal", show: canFillJournal(user) },
    { href: "/bookings", label: "Booking", show: canBook(user) },
    {
      href: "/clients",
      label: user.roles.includes("CLINICAL") ? "Pasien" : "Klien",
      show: can(user, ["FRONT_OFFICE", "CLINICAL"]),
    },
    { href: "/medical-records", label: "Rekam Medis", show: canSeeClinical(user) },
    { href: "/billing", label: "Kasir", show: canBill(user) },
    { href: "/services", label: "Layanan", show: can(user, ["FRONT_OFFICE"]) },
    { href: "/inventory", label: "Stok", show: canSeeStock(user) },
    { href: "/employees", label: "Karyawan", show: isOwner(user) },
    { href: "/doctors", label: "Akun Dokter", show: canManageDoctors(user) },
    { href: "/audit", label: "Audit", show: isOwner(user) },
  ].filter((item) => item.show);

  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
      <aside className="no-print border-b border-line bg-[#fbf7f2] md:min-h-screen md:border-r md:border-b-0">
        <div className="flex items-center justify-between gap-4 px-4 py-4 md:block md:px-5 md:py-6">
          <div>
            <p className="font-display text-3xl leading-none text-ink">Rosaura</p>
            <p className="mt-1 text-[11px] tracking-[0.22em] text-muted uppercase">Skin Clinic</p>
          </div>
          <p className="text-xs text-muted md:mt-6">{formatLongDate(new Date())}</p>
        </div>
        <div className="px-3 pb-3 md:px-4">
          <SideNav items={items} />
        </div>
        <div className="hidden px-5 pb-6 md:block">
          <div className="mt-8 rounded-2xl bg-white/80 p-3">
            <p className="text-sm font-medium">{user.name}</p>
            <p className="text-xs text-muted">{user.position}</p>
          </div>
          <form action={logoutAction} className="mt-3">
            <button className={`${secondaryButton} w-full`} type="submit">
              Keluar
            </button>
          </form>
        </div>
      </aside>
      <div className="min-w-0">
        <div className="no-print flex items-center justify-between border-b border-line px-4 py-3 md:hidden">
          <p className="text-sm font-medium">{user.name}</p>
          <form action={logoutAction}>
            <button className="text-sm text-brown" type="submit">
              Keluar
            </button>
          </form>
        </div>
        <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
