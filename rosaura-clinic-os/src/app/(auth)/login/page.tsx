import { LoginForm } from "@/components/auth/LoginForm";
import { prisma } from "@/lib/db";
import { readSessionUserId } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const userId = await readSessionUserId();
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { employee: true },
    });
    if (user?.isActive && user.employee.isActive) redirect("/dashboard");
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
      <section className="relative hidden overflow-hidden bg-[#3f3128] text-[#f6efe6] lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div>
          <p className="text-xs tracking-[0.28em] uppercase text-[#e6d3bc]">Rosaura Skin Clinic</p>
          <h1 className="font-display mt-6 max-w-md text-6xl leading-none">Satu meja, satu hari operasional.</h1>
        </div>
        <p className="max-w-sm text-sm leading-6 text-[#eadfD3]">
          Booking tanpa jadwal bentrok, catatan kunjungan, lalu uang masuk yang terpisah dari piutang.
        </p>
      </section>
      <section className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          <p className="font-display text-4xl text-ink lg:hidden">Rosaura</p>
          <h2 className="mt-2 mb-6 text-lg text-brown">Masuk ke Clinic OS</h2>
          <LoginForm />
          <p className="mt-6 text-xs text-muted">Pratinjau lokal di komputer ini. Arsip pasien, kunjungan, dan produk ada di SQLite, bukan server klinik.</p>
        </div>
      </section>
    </main>
  );
}
