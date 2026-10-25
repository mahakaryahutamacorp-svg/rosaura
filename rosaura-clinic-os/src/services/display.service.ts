import type { CustomerBill, CustomerDisplaySnapshot, DisplayLine } from "@/lib/display";
import { prisma } from "@/lib/db";
import { dayRange, formatClock, todayJakarta } from "@/lib/time";

const COUNTER_ID = "counter";
const BED_NAMES = ["Bed 1", "Bed 2", "Bed 3"] as const;
const BILL_TTL_MS = 20_000;

function isMissingCounter(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String(error.code) : "";
  const message = "message" in error ? String(error.message) : "";
  return code === "P2021" || /does not exist|no such table|unknown table/i.test(message);
}

async function ensureCounterTable() {
  const mysql = (process.env.DATABASE_URL ?? "").startsWith("mysql://");
  if (mysql) {
    await prisma.$executeRawUnsafe(
      "CREATE TABLE IF NOT EXISTS `CounterDisplay` (`id` VARCHAR(191) NOT NULL, `mode` VARCHAR(191) NOT NULL DEFAULT 'LOBBY', `clientName` VARCHAR(191) NOT NULL DEFAULT '', `linesJson` TEXT NOT NULL, `total` INT NOT NULL DEFAULT 0, `stamp` VARCHAR(191) NOT NULL DEFAULT '0', `updatedAt` DATETIME(3) NOT NULL, PRIMARY KEY (`id`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
    );
    return;
  }
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "CounterDisplay" ("id" TEXT NOT NULL PRIMARY KEY, "mode" TEXT NOT NULL DEFAULT 'LOBBY', "clientName" TEXT NOT NULL DEFAULT '', "linesJson" TEXT NOT NULL DEFAULT '[]', "total" INTEGER NOT NULL DEFAULT 0, "stamp" TEXT NOT NULL DEFAULT '0', "updatedAt" DATETIME NOT NULL)`,
  );
}

async function readCounter() {
  if (typeof prisma.counterDisplay?.findUnique !== "function") return null;
  try {
    return await prisma.counterDisplay.findUnique({ where: { id: COUNTER_ID } });
  } catch (error) {
    if (!isMissingCounter(error)) throw error;
    await ensureCounterTable();
    return prisma.counterDisplay.findUnique({ where: { id: COUNTER_ID } });
  }
}

function newerStamp(incoming: string, current: string) {
  try {
    return BigInt(incoming) > BigInt(current);
  } catch {
    return false;
  }
}

function readLines(raw: string): DisplayLine[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const row = item as { name?: unknown; quantity?: unknown; amount?: unknown };
      if (typeof row.name !== "string" || typeof row.quantity !== "number" || typeof row.amount !== "number") return [];
      return [{ name: row.name, quantity: row.quantity, amount: row.amount }];
    });
  } catch {
    return [];
  }
}

export async function getCustomerDisplay(): Promise<CustomerDisplaySnapshot> {
  const { start, end } = dayRange(todayJakarta());
  const [bookings, display] = await Promise.all([
    prisma.booking.findMany({
      where: {
        startAt: { gte: start, lt: end },
        status: { in: ["CHECKED_IN", "IN_SERVICE"] },
      },
      select: {
        id: true,
        startAt: true,
        status: true,
        client: { select: { fullName: true } },
        room: { select: { name: true } },
      },
      orderBy: { startAt: "asc" },
    }),
    readCounter(),
  ]);

  const queue = bookings
    .filter((booking) => booking.status === "CHECKED_IN")
    .map((booking) => ({
      id: booking.id,
      name: booking.client.fullName,
      time: formatClock(booking.startAt),
    }));

  const beds = BED_NAMES.map((name) => {
    const occupant = [...bookings].reverse().find((booking) => booking.status === "IN_SERVICE" && booking.room?.name === name);
    return { name, clientName: occupant?.client.fullName ?? null };
  });

  const billIsFresh = Boolean(display && display.mode === "BILL" && Date.now() - display.updatedAt.getTime() < BILL_TTL_MS);
  const bill: CustomerBill | null = billIsFresh && display
    ? { clientName: display.clientName, lines: readLines(display.linesJson), total: display.total }
    : null;

  return { queue, beds, bill };
}

export async function publishCounterBill(input: CustomerBill & { stamp: string }) {
  const current = await readCounter();
  if (current && !newerStamp(input.stamp, current.stamp)) return;

  const data = {
    mode: "BILL",
    clientName: input.clientName,
    linesJson: JSON.stringify(input.lines),
    total: input.total,
    stamp: input.stamp,
  };

  await prisma.counterDisplay.upsert({
    where: { id: COUNTER_ID },
    create: { id: COUNTER_ID, ...data },
    update: data,
  });
}

export async function clearCounterBill(stamp: string) {
  const current = await readCounter();
  if (current && !newerStamp(stamp, current.stamp)) return;

  await prisma.counterDisplay.upsert({
    where: { id: COUNTER_ID },
    create: { id: COUNTER_ID, mode: "LOBBY", stamp },
    update: { mode: "LOBBY", clientName: "", linesJson: "[]", total: 0, stamp },
  });
}
