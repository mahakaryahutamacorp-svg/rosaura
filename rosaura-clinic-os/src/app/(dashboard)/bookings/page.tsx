import { BookingDesk } from "@/components/bookings/BookingDesk";
import { can, canBook, requireUser } from "@/lib/access";
import { dayRange, parseDay, startOfWeek, weekDays } from "@/lib/time";
import { listBookings } from "@/services/booking.service";
import { listActiveClients } from "@/services/client.service";
import { listRooms, listServices, listTherapists } from "@/services/catalog.service";
import { redirect } from "next/navigation";

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; view?: string }>;
}) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  if (!canBook(user)) redirect("/dashboard");

  const date = parseDay(params.date);
  const view = params.view === "week" ? "week" : "day";
  const week = weekDays(date);
  const range = view === "week" ? dayRange(startOfWeek(date)) : dayRange(date);
  const end = view === "week" ? new Date(range.start.getTime() + 7 * 24 * 60 * 60 * 1000) : range.end;
  const ownOnly = !can(user, ["FRONT_OFFICE"]);

  const [bookings, clients, services, rooms, therapists] = await Promise.all([
    listBookings(user, range.start, end),
    listActiveClients(),
    listServices(),
    listRooms(),
    listTherapists(),
  ]);

  const visibleTherapists = ownOnly ? therapists.filter((therapist) => therapist.id === user.employeeId) : therapists;

  return (
    <BookingDesk
      date={date}
      view={view}
      week={week}
      canCreate
      lockedTherapistId={ownOnly ? user.employeeId : undefined}
      therapists={visibleTherapists.map((therapist) => ({ id: therapist.id, name: therapist.name }))}
      rooms={rooms.map((room) => ({ id: room.id, name: room.name }))}
      services={services.map((service) => ({
        id: service.id,
        name: service.name,
        durationMinutes: service.durationMinutes,
        price: service.price,
      }))}
      clients={clients.map((client) => ({
        id: client.id,
        name: client.fullName,
        clientCode: client.clientCode,
        phone: client.phone,
      }))}
      bookings={bookings.map((booking) => ({
        id: booking.id,
        code: booking.bookingCode,
        startAt: booking.startAt.toISOString(),
        endAt: booking.endAt.toISOString(),
        status: booking.status,
        clientName: booking.client.fullName,
        serviceName: booking.services.map((item) => item.serviceNameSnapshot).join(", "),
        therapistId: booking.assignments[0]?.employeeId ?? "",
        therapistName: booking.assignments[0]?.employee.name ?? "",
        roomName: booking.room?.name ?? "",
      }))}
    />
  );
}
