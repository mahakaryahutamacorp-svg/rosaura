import { prisma } from "@/lib/db";
import type { AppUser } from "@/lib/access";
import { can, isOwner } from "@/lib/access";
import { dayRange, daysUntilExpiry, isExpired, todayJakarta } from "@/lib/time";
import { cashInBetween, outstandingTotal } from "@/services/billing.service";
import { bookingListInclude } from "@/services/booking.service";

export interface QueueRow {
  id: string;
  time: string;
  clientName: string;
  serviceName: string;
  therapistName: string;
  roomName: string;
  status: string;
}

export async function getDashboard(user: AppUser) {
  const today = todayJakarta();
  const { start, end } = dayRange(today);
  const ownOnly = !can(user, ["FRONT_OFFICE"]) && user.roles.includes("CLINICAL");

  if (isOwner(user)) {
    const [bookings, cashIn, piutang, recent] = await Promise.all([
      prisma.booking.findMany({
        where: { startAt: { gte: start, lt: end } },
        include: bookingListInclude,
        orderBy: { startAt: "asc" },
      }),
      cashInBetween(start, end),
      outstandingTotal(),
      recentVisits(true),
    ]);
    return {
      kind: "owner" as const,
      cashIn,
      piutang,
      bookingsToday: bookings.length,
      noShow: bookings.filter((booking) => booking.status === "NO_SHOW").length,
      rows: bookings.map(toQueue),
      recent,
    };
  }

  if (user.roles.includes("WAREHOUSE") && !can(user, ["FRONT_OFFICE", "CLINICAL"])) {
    const products = await prisma.product.findMany({
      include: { batches: true },
      orderBy: { name: "asc" },
    });
    const expiring = products.flatMap((product) =>
      product.batches
        .filter((batch) => daysUntilExpiry(batch.expiryDate) <= 30)
        .map((batch) => ({
          id: batch.id,
          name: product.name,
          batchNumber: batch.batchNumber,
          days: daysUntilExpiry(batch.expiryDate),
          expired: isExpired(batch.expiryDate),
        })),
    );
    const low = products
      .filter((product) => product.qtyOnHand <= product.minStock)
      .map((product) => ({ id: product.id, name: product.name, qty: product.qtyOnHand, min: product.minStock }));
    return { kind: "warehouse" as const, expiring, low };
  }

  const bookings = await prisma.booking.findMany({
    where: {
      startAt: { gte: start, lt: end },
      ...(ownOnly ? { assignments: { some: { employeeId: user.employeeId } } } : {}),
    },
    include: bookingListInclude,
    orderBy: { startAt: "asc" },
  });

  if (user.roles.includes("CLINICAL") && !can(user, ["FRONT_OFFICE"])) {
    return { kind: "clinical" as const, rows: bookings.map(toQueue), recent: await recentVisits(true) };
  }

  const openInvoices = await prisma.invoice.count({ where: { status: "OPEN" } });
  return {
    kind: "front" as const,
    bookingsToday: bookings.length,
    waiting: bookings.filter((booking) => ["BOOKED", "CONFIRMED"].includes(booking.status)).length,
    openInvoices,
    rows: bookings.map(toQueue),
    recent: await recentVisits(false),
  };
}

async function recentVisits(showNotes: boolean) {
  const rows = await prisma.skinRecord.findMany({
    orderBy: { visitDate: "desc" },
    take: 8,
    include: { client: { select: { id: true, fullName: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    clientId: row.client.id,
    clientName: row.client.fullName,
    visitDate: row.visitDate,
    summary: showNotes ? row.complaint || row.doctorNotes.slice(0, 140) : "",
  }));
}

function toQueue(booking: {
  id: string;
  startAt: Date;
  status: string;
  client: { fullName: string };
  room: { name: string } | null;
  services: { serviceNameSnapshot: string }[];
  assignments: { employee: { name: string } }[];
}): QueueRow {
  return {
    id: booking.id,
    time: new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Jakarta",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(booking.startAt),
    clientName: booking.client.fullName,
    serviceName: booking.services.map((item) => item.serviceNameSnapshot).join(", "),
    therapistName: booking.assignments[0]?.employee.name ?? "-",
    roomName: booking.room?.name ?? "-",
    status: booking.status,
  };
}
