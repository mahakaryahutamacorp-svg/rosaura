import { canFillJournal, type AppUser } from "@/lib/access";
import { prisma } from "@/lib/db";
import { ServiceError } from "@/lib/errors";
import { JOURNAL_POSITIONS, allowedTaskKeys } from "@/lib/journal-sop";
import { writeAudit } from "@/services/audit";

export interface JournalDraft {
  position: string;
  checkedKeys: string[];
  notes: string;
}

export interface JournalDayEntry extends JournalDraft {
  filledByName: string | null;
  updatedAt: Date | null;
}

function parseCheckedKeys(raw: string) {
  try {
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

export async function listDailyJournals(date: string): Promise<JournalDayEntry[]> {
  const rows = await prisma.dailyJournal.findMany({
    where: { journalDate: date },
    include: { filledBy: { include: { employee: true } } },
  });
  const byPosition = new Map(rows.map((row) => [row.position, row]));

  return JOURNAL_POSITIONS.map((position) => {
    const row = byPosition.get(position.key);
    const allowed = allowedTaskKeys(position.key);
    return {
      position: position.key,
      checkedKeys: row ? parseCheckedKeys(row.checkedKeys).filter((key) => allowed.has(key)) : [],
      notes: row?.notes ?? "",
      filledByName: row?.filledBy.employee.name ?? null,
      updatedAt: row?.updatedAt ?? null,
    };
  });
}

export async function saveDailyJournals(actor: AppUser, date: string, drafts: JournalDraft[]) {
  if (!canFillJournal(actor)) throw new ServiceError("Jurnal harian diisi oleh admin");

  const byPosition = new Map(drafts.map((draft) => [draft.position, draft]));
  const entries = JOURNAL_POSITIONS.map((position) => {
    const draft = byPosition.get(position.key);
    const allowed = allowedTaskKeys(position.key);
    const checkedKeys = [...new Set((draft?.checkedKeys ?? []).filter((key) => allowed.has(key)))];
    const notes = (draft?.notes ?? "").trim();
    if (notes.length > 2000) throw new ServiceError(`Catatan ${position.label} maksimal 2000 karakter`);
    return { position: position.key, label: position.label, checkedKeys, notes, total: position.tasks.length };
  });

  await prisma.$transaction(async (tx) => {
    for (const entry of entries) {
      await tx.dailyJournal.upsert({
        where: { journalDate_position: { journalDate: date, position: entry.position } },
        create: {
          journalDate: date,
          position: entry.position,
          checkedKeys: JSON.stringify(entry.checkedKeys),
          notes: entry.notes,
          filledById: actor.userId,
        },
        update: {
          checkedKeys: JSON.stringify(entry.checkedKeys),
          notes: entry.notes,
          filledById: actor.userId,
        },
      });
    }
    const summary = entries.map((entry) => `${entry.label} ${entry.checkedKeys.length}/${entry.total}`).join(", ");
    await writeAudit(tx, actor.userId, "JOURNAL_SAVE", "daily_journal", date, summary);
  });
}
