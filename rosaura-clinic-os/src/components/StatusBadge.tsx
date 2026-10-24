import { statusClass, statusLabel } from "@/lib/labels";

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusClass[status] ?? "bg-line text-ink"}`}>
      {statusLabel[status] ?? status}
    </span>
  );
}
