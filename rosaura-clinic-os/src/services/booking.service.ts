import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ServiceError } from "@/lib/errors";
import type { AppUser } from "@/lib/access";
import { can, canOperateBooking } from "@/lib/access";
import { nextCode } from "@/lib/codes";
import { assertClinicHours, jakartaDateTime } from "@/lib/time";
import { writeAudit } from "@/services/audit";

const BLOCKING = ["BOOKED", "CONFIRMED", "CHECKED_IN", "IN_SERVICE", "COMPLETED"];

const transitions: Record<string, string[]> = {
  BOOKED: ["CONFIRMED", "CANCELLED", "NO_SHOW", "RESCHEDULED"],
  CONFIRMED: ["CHECKED_IN", "CANCELLED", "NO_SHOW", "RESCHEDULED"],
  CHECKED_IN: ["IN_SERVICE", "CANCELLED"],
  IN_SERVICE: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
  RESCHEDULED: [],
};

export const bookingListInclude = {
  client: true,
  room: true,
  services: true,
  assignments: { include: { employee: true } },
} satisfies Prisma.BookingInclude;

export const bookingDetailInclude = {
  client: true,
  room: true,
  services: true,
  assignments: { include: { employee: true } },
  history: {
    include: { changedBy: { include: { employee: true } } },
    orderBy: { changedAt: "desc" as const },
  },
  visit: {
    include: {
      provider: true,
      note: {
        include: {
          usages: { include: { batch: { include: { product: true } } } },
        },
      },
    },
  },
  invoice: {
    include: {
      items: true,
      payments: { include: { reversal: true }, orderBy: { paidAt: "desc" as const } },
    },
  },
} satisfies Prisma.BookingInclude;

function therapistIdOf(booking: { assignments: { employeeId: string }[] }) {
  return booking.assignments[0]?.employeeId ?? "";
}

async function assertNoClash(
  tx: Prisma.TransactionClient,
  start: Date,
  end: Date,
  therapistId: string,
  roomId: string | null,
) {
  const overlap = {
    status: { in: BLOCKING },
    startAt: { lt: end },
    endAt: { gt: start },
  };
  const therapistClash = await tx.booking.findFirst({
    where: { ...overlap, assignments: { some: { employeeId: therapistId } } },
  });
  if (therapistClash) {
    throw new ServiceError(`Jadwal bentrok dengan ${therapistClash.bookingCode} untuk petugas yang sama`);
  }
  if (roomId) {
    const roomClash = await tx.booking.findFirst({
      where: { ...overlap, roomId },
    });
    if (roomClash) {
      throw new ServiceError(`Ruangan sudah terpakai pada ${roomClash.bookingCode}`);
    }
  }
}

export async function listBookings(user: AppUser, start: Date, end: Date) {
  const ownOnly = !can(user, ["FRONT_OFFICE"]) && user.roles.includes("CLINICAL");
  return prisma.booking.findMany({
    where: {
      startAt: { gte: start, lt: end },
      ...(ownOnly ? { assignments: { some: { employeeId: user.employeeId } } } : {}),
    },
    include: bookingListInclude,
    orderBy: { startAt: "asc" },
  });
}

export async function getBooking(user: AppUser, id: string) {
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: bookingDetailInclude,
  });
  if (!booking) return null;
  if (!can(user, ["FRONT_OFFICE"]) && user.roles.includes("CLINICAL")) {
    if (therapistIdOf(booking) !== user.employeeId && booking.visit?.providerId !== user.employeeId) {
      throw new ServiceError("Booking ini di luar jadwal Anda");
    }
  }
  return booking;
}

interface CreateBookingInput {
  clientId: string;
  serviceId: string;
  therapistId: string;
  roomId: string | null;
  date: string;
  time: string;
  notes: string;
}

export async function createBooking(actor: AppUser, input: CreateBookingInput) {
  if (!can(actor, ["FRONT_OFFICE"]) && actor.employeeId !== input.therapistId) {
    throw new ServiceError("Anda hanya dapat membuat booking untuk jadwal sendiri");
  }

  return prisma.$transaction(async (tx) => {
    const [client, service, therapist, room] = await Promise.all([
      tx.client.findFirst({ where: { id: input.clientId, isActive: true } }),
      tx.service.findFirst({ where: { id: input.serviceId, isActive: true } }),
      tx.employee.findFirst({
        where: {
          id: input.therapistId,
          isActive: true,
          roles: { some: { role: { name: "CLINICAL" } } },
        },
      }),
      input.roomId ? tx.room.findFirst({ where: { id: input.roomId, isActive: true } }) : Promise.resolve(null),
    ]);

    if (!client) throw new ServiceError("Klien tidak ditemukan atau sudah nonaktif");
    if (!service) throw new ServiceError("Layanan tidak tersedia");
    if (!therapist) throw new ServiceError("Petugas klinis tidak tersedia");
    if (input.roomId && !room) throw new ServiceError("Ruangan tidak tersedia");

    const start = jakartaDateTime(input.date, input.time);
    const end = new Date(start.getTime() + service.durationMinutes * 60 * 1000);
    assertClinicHours(start, end);
    await assertNoClash(tx, start, end, therapist.id, room?.id ?? null);

    const bookingCode = await nextCode("BK", await tx.booking.count(), async (code) =>
      Boolean(await tx.booking.findUnique({ where: { bookingCode: code }, select: { id: true } })),
    );
    const booking = await tx.booking.create({
      data: {
        bookingCode,
        clientId: client.id,
        roomId: room?.id,
        startAt: start,
        endAt: end,
        status: "BOOKED",
        notes: input.notes,
        source: "internal",
        createdById: actor.userId,
        services: {
          create: {
            serviceId: service.id,
            serviceNameSnapshot: service.name,
            priceSnapshot: service.price,
            durationSnapshot: service.durationMinutes,
          },
        },
        assignments: { create: { employeeId: therapist.id, assignmentType: "THERAPIST" } },
        history: { create: { newStatus: "BOOKED", changedById: actor.userId, note: "Booking dibuat" } },
      },
    });

    await writeAudit(tx, actor.userId, "CREATE_BOOKING", "booking", booking.id, booking.bookingCode);
    return booking;
  });
}

export async function changeBookingStatus(actor: AppUser, bookingId: string, nextStatus: string) {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: {
        assignments: true,
        visit: { include: { note: true } },
        invoice: { include: { payments: { include: { reversal: true } } } },
      },
    });
    if (!booking) throw new ServiceError("Booking tidak ditemukan");
    if (!canOperateBooking(actor, therapistIdOf(booking))) {
      throw new ServiceError("Anda tidak dapat mengubah booking ini");
    }
    if (!transitions[booking.status]?.includes(nextStatus)) {
      throw new ServiceError("Perubahan status tidak diizinkan dari status sekarang");
    }
    if (nextStatus === "COMPLETED" && !booking.visit?.note) {
      throw new ServiceError("Isi catatan kunjungan sebelum menyelesaikan booking");
    }
    if ((nextStatus === "CANCELLED" || nextStatus === "NO_SHOW") && booking.invoice) {
      const net = booking.invoice.payments
        .filter((payment) => payment.status === "SUCCESS" && !payment.reversal)
        .reduce((sum, payment) => sum + payment.amount, 0);
      if (net > 0) {
        throw new ServiceError("Pembayaran sudah tercatat. Balikkan dulu sebelum mengubah booking.");
      }
      await tx.invoice.update({ where: { id: booking.invoice.id }, data: { status: "VOID" } });
    }

    await tx.booking.update({ where: { id: booking.id }, data: { status: nextStatus } });
    await tx.bookingStatusHistory.create({
      data: {
        bookingId: booking.id,
        oldStatus: booking.status,
        newStatus: nextStatus,
        changedById: actor.userId,
      },
    });

    if (nextStatus === "CHECKED_IN" && !booking.visit) {
      await tx.visit.create({
        data: {
          clientId: booking.clientId,
          bookingId: booking.id,
          providerId: therapistIdOf(booking),
          visitedAt: new Date(),
          status: "OPEN",
        },
      });
    }
    if (nextStatus === "COMPLETED" && booking.visit) {
      await tx.visit.update({ where: { id: booking.visit.id }, data: { status: "DONE" } });
    }

    await writeAudit(tx, actor.userId, "BOOKING_STATUS", "booking", booking.id, `${booking.status} -> ${nextStatus}`);
  });
}

interface RescheduleInput {
  bookingId: string;
  date: string;
  time: string;
  therapistId: string;
  roomId: string | null;
}

export async function rescheduleBooking(actor: AppUser, input: RescheduleInput) {
  if (!can(actor, ["FRONT_OFFICE"])) {
    throw new ServiceError("Penjadwalan ulang dilakukan oleh front office atau owner");
  }

  return prisma.$transaction(async (tx) => {
    const current = await tx.booking.findUnique({
      where: { id: input.bookingId },
      include: { services: true, assignments: true },
    });
    if (!current) throw new ServiceError("Booking tidak ditemukan");
    if (!["BOOKED", "CONFIRMED"].includes(current.status)) {
      throw new ServiceError("Hanya booking yang belum check-in yang dapat dijadwalkan ulang");
    }

    const therapist = await tx.employee.findFirst({
      where: {
        id: input.therapistId,
        isActive: true,
        roles: { some: { role: { name: "CLINICAL" } } },
      },
    });
    if (!therapist) throw new ServiceError("Petugas klinis tidak tersedia");
    const room = input.roomId
      ? await tx.room.findFirst({ where: { id: input.roomId, isActive: true } })
      : null;
    if (input.roomId && !room) throw new ServiceError("Ruangan tidak tersedia");

    const duration = current.services.reduce((sum, item) => sum + item.durationSnapshot, 0);
    const start = jakartaDateTime(input.date, input.time);
    const end = new Date(start.getTime() + duration * 60 * 1000);
    assertClinicHours(start, end);
    await assertNoClash(tx, start, end, therapist.id, room?.id ?? null);

    await tx.booking.update({ where: { id: current.id }, data: { status: "RESCHEDULED" } });
    const newCode = await nextCode("BK", await tx.booking.count(), async (code) =>
      Boolean(await tx.booking.findUnique({ where: { bookingCode: code }, select: { id: true } })),
    );
    const created = await tx.booking.create({
      data: {
        bookingCode: newCode,
        clientId: current.clientId,
        roomId: room?.id,
        startAt: start,
        endAt: end,
        status: "BOOKED",
        notes: current.notes,
        source: "internal",
        createdById: actor.userId,
        services: {
          create: current.services.map((item) => ({
            serviceId: item.serviceId,
            serviceNameSnapshot: item.serviceNameSnapshot,
            priceSnapshot: item.priceSnapshot,
            durationSnapshot: item.durationSnapshot,
          })),
        },
        assignments: { create: { employeeId: therapist.id, assignmentType: "THERAPIST" } },
        history: {
          create: {
            newStatus: "BOOKED",
            changedById: actor.userId,
            note: `Dibuat dari penjadwalan ulang ${current.bookingCode}`,
          },
        },
      },
    });
    await tx.bookingStatusHistory.create({
      data: {
        bookingId: current.id,
        oldStatus: current.status,
        newStatus: "RESCHEDULED",
        changedById: actor.userId,
        note: `Dipindah ke ${created.bookingCode}`,
      },
    });
    await writeAudit(tx, actor.userId, "RESCHEDULE", "booking", created.id, `${current.bookingCode} -> ${created.bookingCode}`);
    return created;
  });
}
