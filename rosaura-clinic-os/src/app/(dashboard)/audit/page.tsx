import { redirect } from "next/navigation";
import { Pager } from "@/components/Pager";
import { isOwner, requireUser } from "@/lib/access";
import { formatDateTime } from "@/lib/time";
import { prisma } from "@/lib/db";

const AUDIT_PAGE_SIZE = 40;

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  if (!isOwner(user)) redirect("/dashboard");
  const total = await prisma.auditLog.count();
  const pages = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));
  const requested = Number(params.page);
  const page = Math.min(Number.isFinite(requested) && requested > 0 ? Math.floor(requested) : 1, pages);
  const logs = await prisma.auditLog.findMany({
    include: { actor: { include: { employee: true } } },
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * AUDIT_PAGE_SIZE,
    take: AUDIT_PAGE_SIZE,
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
      <Pager basePath="/audit" page={page} pages={pages} total={total} />
    </div>
  );
}
