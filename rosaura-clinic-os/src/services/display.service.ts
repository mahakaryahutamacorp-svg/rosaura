import type { CustomerBill, CustomerDisplaySnapshot, DisplayLine } from "@/lib/display";
import { prisma } from "@/lib/db";
import { dayRange, formatClock, todayJakarta } from "@/lib/time";

const COUNTER_ID = "counter";
const BED_NAMES = ["Bed 1", "Bed 2", "Bed 3"] as const;
const BILL_TTL_MS = 20_000;

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
    prisma.counterDisplay.findUnique({ where: { id: COUNTER_ID } }),
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
  const current = await prisma.counterDisplay.findUnique({ where: { id: COUNTER_ID } });
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
  const current = await prisma.counterDisplay.findUnique({ where: { id: COUNTER_ID } });
  if (current && !newerStamp(stamp, current.stamp)) return;

  await prisma.counterDisplay.upsert({
    where: { id: COUNTER_ID },
    create: { id: COUNTER_ID, mode: "LOBBY", stamp },
    update: { mode: "LOBBY", clientName: "", linesJson: "[]", total: 0, stamp },
  });
}
