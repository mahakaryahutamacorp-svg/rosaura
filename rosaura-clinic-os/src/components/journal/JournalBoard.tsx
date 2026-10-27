import Link from "next/link";
import { saveJournalAction } from "@/app/actions/journal";
import { JOURNAL_POSITIONS, phaseLabel, type JournalPhase, type JournalTask } from "@/lib/journal-sop";
import { fieldClass, primaryButton, secondaryButton } from "@/lib/styles";
import { addDays, formatDateTime, formatLongDate } from "@/lib/time";
import type { JournalDayEntry } from "@/services/journal.service";

function phaseGroups(tasks: JournalTask[]) {
  const groups: Array<{ phase: JournalPhase; tasks: JournalTask[] }> = [];
  for (const task of tasks) {
    const last = groups.at(-1);
    if (last?.phase === task.phase) last.tasks.push(task);
    else groups.push({ phase: task.phase, tasks: [task] });
  }
  return groups;
}

export function JournalBoard({ date, entries }: { date: string; entries: JournalDayEntry[] }) {
  const byPosition = new Map(entries.map((entry) => [entry.position, entry]));
  const latest = entries.reduce<JournalDayEntry | null>((current, entry) => {
    if (!entry.updatedAt) return current;
    if (!current?.updatedAt || entry.updatedAt > current.updatedAt) return entry;
    return current;
  }, null);
  const done = entries.reduce((sum, entry) => sum + entry.checkedKeys.length, 0);
  const total = JOURNAL_POSITIONS.reduce((sum, position) => sum + position.tasks.length, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link className={secondaryButton} href={`/journal?date=${addDays(date, -1)}`}>
            Sebelumnya
          </Link>
          <form action="/journal" method="get" className="flex items-center gap-2">
            <label className="sr-only" htmlFor="journal-date">
              Tanggal jurnal
            </label>
            <input id="journal-date" className={`${fieldClass} w-auto`} type="date" name="date" defaultValue={date} />
            <button className={secondaryButton} type="submit">
              Lihat
            </button>
          </form>
          <Link className={secondaryButton} href={`/journal?date=${addDays(date, 1)}`}>
            Berikutnya
          </Link>
        </div>
        <p className="text-sm text-muted">
          {done}/{total} kegiatan selesai
          {latest?.updatedAt && latest.filledByName ? ` · terakhir ${latest.filledByName}, ${formatDateTime(latest.updatedAt)}` : ""}
        </p>
      </div>

      <form action={saveJournalAction} className="space-y-4">
      <input type="hidden" name="date" value={date} />
      <div className="overflow-x-auto rounded-3xl border border-line bg-paper">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead className="border-b border-line text-xs tracking-wide text-muted uppercase">
            <tr>
              <th className="w-36 px-4 py-3 font-medium">Jabatan</th>
              <th className="w-36 px-3 py-3 font-medium">Waktu</th>
              <th className="px-3 py-3 font-medium">Kegiatan SOP</th>
              <th className="w-24 px-4 py-3 text-center font-medium">Selesai</th>
            </tr>
          </thead>
          <tbody>
            {JOURNAL_POSITIONS.map((position) => {
              const entry = byPosition.get(position.key);
              const checked = new Set(entry?.checkedKeys ?? []);
              const groups = phaseGroups(position.tasks);
              const positionSpan = position.tasks.length + 1;
              const taskRows = groups.flatMap((group, groupIndex) =>
                group.tasks.map((task, index) => (
                  <tr key={`${position.key}:${task.key}`} className="border-b border-line/70">
                    {groupIndex === 0 && index === 0 ? (
                      <td className="px-4 py-3 align-top" rowSpan={positionSpan}>
                        <p className="font-semibold text-ink">{position.label}</p>
                        <p className="mt-1 text-xs text-muted">
                          {checked.size}/{position.tasks.length}
                        </p>
                      </td>
                    ) : null}
                    {index === 0 ? (
                      <td className="px-3 py-3 align-top text-brown" rowSpan={group.tasks.length}>
                        {phaseLabel[group.phase]}
                      </td>
                    ) : null}
                    <td className="px-3 py-3">
                      <label className="block cursor-pointer" htmlFor={`check-${position.key}-${task.key}`}>
                        {task.label}
                      </label>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input
                        id={`check-${position.key}-${task.key}`}
                        className="h-4 w-4 accent-gold"
                        type="checkbox"
                        name="check"
                        value={`${position.key}:${task.key}`}
                        defaultChecked={checked.has(task.key)}
                      />
                    </td>
                  </tr>
                )),
              );

              return taskRows.concat(
                <tr key={`${position.key}:notes`} className="border-b border-line bg-[#fbf7f2] last:border-0">
                  <td className="px-3 py-3" colSpan={3}>
                    <label className="mb-1.5 block text-xs font-medium tracking-wide text-muted uppercase" htmlFor={`notes-${position.key}`}>
                      Catatan lain
                    </label>
                    <textarea
                      id={`notes-${position.key}`}
                      name={`notes:${position.key}`}
                      rows={2}
                      maxLength={2000}
                      defaultValue={entry?.notes ?? ""}
                      placeholder="Tulis kegiatan di luar checklist, misalnya pasien darurat, kerusakan alat, atau serah terima khusus."
                      className={`${fieldClass} h-auto py-2`}
                    />
                  </td>
                </tr>,
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="sticky bottom-4 flex justify-end">
        <button className={`${primaryButton} shadow-sm`} type="submit">
          Simpan jurnal {formatLongDate(date)}
        </button>
      </div>
      </form>
    </div>
  );
}
