import { redirect } from "next/navigation";
import { isOwner, requireUser } from "@/lib/access";
import { formatDateTime } from "@/lib/time";
import { prisma } from "@/lib/db";

export default async function AuditPage() {
  const user = await requireUser();
  if (!isOwner(user)) redirect("/dashboard");
  const logs = await prisma.auditLog.findMany({
    include: { actor: { include: { employee: true } } },
    orderBy: { occurredAt: "desc" },
    take: 40,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl">Audit</h1>
        <p className="text-sm text-muted">Perubahan booking, pembayaran, catatan, stok, dan peran.</p>
      </div>
      <div className="overflow-hidden rounded-3xl border border-line bg-paper">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="border-b border-line text-xs tracking-wide text-muted uppercase">
            <tr>
              <th className="px-5 py-3 font-medium">Waktu</th>
              <th className="px-3 py-3 font-medium">Pengguna</th>
              <th className="px-3 py-3 font-medium">Aksi</th>
              <th className="px-5 py-3 font-medium">Ringkas</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-b border-line/70 last:border-0">
                <td className="px-5 py-3">{formatDateTime(log.occurredAt)}</td>
                <td className="px-3 py-3">{log.actor.employee.name}</td>
                <td className="px-3 py-3">{log.action}</td>
                <td className="px-5 py-3">{log.summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
