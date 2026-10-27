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

function isMissingJournal(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String(error.code) : "";
  const message = "message" in error ? String(error.message) : "";
  return code === "P2021" || /does not exist|no such table|unknown table/i.test(message);
}

async function ensureDailyJournalTable() {
  const mysql = (process.env.DATABASE_URL ?? "").startsWith("mysql://");
  if (mysql) {
    await prisma.$executeRawUnsafe(
      "CREATE TABLE IF NOT EXISTS `DailyJournal` (`id` VARCHAR(191) NOT NULL, `journalDate` VARCHAR(191) NOT NULL, `position` VARCHAR(191) NOT NULL, `checkedKeys` TEXT NOT NULL, `notes` TEXT NOT NULL, `filledById` VARCHAR(191) NOT NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), PRIMARY KEY (`id`), UNIQUE KEY `DailyJournal_journalDate_position_key` (`journalDate`, `position`), KEY `DailyJournal_journalDate_idx` (`journalDate`), KEY `DailyJournal_filledById_idx` (`filledById`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
    );
    return;
  }
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "DailyJournal" ("id" TEXT NOT NULL PRIMARY KEY, "journalDate" TEXT NOT NULL, "position" TEXT NOT NULL, "checkedKeys" TEXT NOT NULL DEFAULT '[]', "notes" TEXT NOT NULL DEFAULT '', "filledById" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL)`,
  );
  try {
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "DailyJournal_journalDate_position_key" ON "DailyJournal"("journalDate", "position")`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "DailyJournal_journalDate_idx" ON "DailyJournal"("journalDate")`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "DailyJournal_filledById_idx" ON "DailyJournal"("filledById")`,
    );
  } catch {
    // Indexes might already exist
  }
}

export async function listDailyJournals(date: string): Promise<JournalDayEntry[]> {
  let rows;
  try {
    rows = await prisma.dailyJournal.findMany({
      where: { journalDate: date },
      include: { filledBy: { include: { employee: true } } },
    });
  } catch (error) {
    if (!isMissingJournal(error)) throw error;
    await ensureDailyJournalTable();
    rows = await prisma.dailyJournal.findMany({
      where: { journalDate: date },
      include: { filledBy: { include: { employee: true } } },
    });
  }
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

  const runSave = () =>
    prisma.$transaction(async (tx) => {
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

  try {
    await runSave();
  } catch (error) {
    if (!isMissingJournal(error)) throw error;
    await ensureDailyJournalTable();
    await runSave();
  }
}
