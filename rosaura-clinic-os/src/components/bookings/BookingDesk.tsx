"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { createBookingAction } from "@/app/actions/operations";
import { StatusBadge } from "@/components/StatusBadge";
import { formatRupiah } from "@/lib/format";
import { fieldClass, labelClass, primaryButton, secondaryButton } from "@/lib/styles";
import { addDays, formatClock, formatLongDate, todayJakarta } from "@/lib/time";

export interface DeskBooking {
  id: string;
  code: string;
  startAt: string;
  endAt: string;
  status: string;
  clientName: string;
  serviceName: string;
  therapistId: string;
  therapistName: string;
  roomName: string;
}

interface Option {
  id: string;
  name: string;
}

interface ServiceOption extends Option {
  durationMinutes: number;
  price: number;
}

interface ClientOption extends Option {
  clientCode: string;
  phone: string;
}

const START_HOUR = 9;
const END_HOUR = 20;
const HOUR_PX = 68;

function minutesFromIso(iso: string) {
  const date = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

function dayKeyFromIso(iso: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export function BookingDesk({
  date,
  view,
  week,
  bookings,
  therapists,
  services,
  clients,
  rooms,
  canCreate,
  lockedTherapistId,
}: {
  date: string;
  view: "day" | "week";
  week: string[];
  bookings: DeskBooking[];
  therapists: Option[];
  services: ServiceOption[];
  clients: ClientOption[];
  rooms: Option[];
  canCreate: boolean;
  lockedTherapistId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [draft, setDraft] = useState({
    date,
    time: "10:00",
    therapistId: lockedTherapistId ?? therapists[0]?.id ?? "",
    serviceId: services[0]?.id ?? "",
    clientId: clients[0]?.id ?? "",
    roomId: rooms[0]?.id ?? "",
  });

  const selectedService = services.find((service) => service.id === draft.serviceId);
  const times = useMemo(() => {
    const values: string[] = [];
    for (let minute = START_HOUR * 60; minute < END_HOUR * 60; minute += 30) {
      const hour = Math.floor(minute / 60);
      const rest = minute % 60;
      values.push(`${String(hour).padStart(2, "0")}:${String(rest).padStart(2, "0")}`);
    }
    return values;
  }, []);

  function openCreate(next?: Partial<typeof draft>) {
    setError("");
    setDraft((current) => ({
      ...current,
      date,
      therapistId: lockedTherapistId ?? current.therapistId,
      ...next,
    }));
    setOpen(true);
  }

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError("");
    const result = await createBookingAction(formData);
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  const previous = addDays(date, view === "week" ? -7 : -1);
  const next = addDays(date, view === "week" ? 7 : 1);

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl text-ink">Kalender</h1>
          <p className="text-sm text-muted">{formatLongDate(date)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link className={secondaryButton} href={`/bookings?date=${previous}&view=${view}`}>
            Sebelumnya
          </Link>
          <Link className={secondaryButton} href={`/bookings?date=${todayJakarta()}&view=${view}`}>
            Hari ini
          </Link>
          <Link className={secondaryButton} href={`/bookings?date=${next}&view=${view}`}>
            Berikutnya
          </Link>
          <Link className={view === "day" ? primaryButton : secondaryButton} href={`/bookings?date=${date}&view=day`}>
            Hari
          </Link>
          <Link className={view === "week" ? primaryButton : secondaryButton} href={`/bookings?date=${date}&view=week`}>
            Minggu
          </Link>
          {canCreate ? (
            <button className={primaryButton} type="button" onClick={() => openCreate()}>
              Tambah booking
            </button>
          ) : null}
        </div>
      </div>

      {view === "day" ? (
        <DayGrid
          bookings={bookings.filter((booking) => dayKeyFromIso(booking.startAt) === date)}
          therapists={therapists}
          canCreate={canCreate}
          onSlot={(therapistId, time) => openCreate({ therapistId, time, date })}
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-7">
          {week.map((day) => (
            <section key={day} className="rounded-2xl border border-line bg-paper p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">{formatLongDate(day).split(",")[0]}</h2>
                {canCreate ? (
                  <button className="text-xs text-gold-deep" type="button" onClick={() => openCreate({ date: day })}>
                    Tambah
                  </button>
                ) : null}
              </div>
              <div className="space-y-2">
                {bookings.filter((booking) => dayKeyFromIso(booking.startAt) === day).map((booking) => (
                  <Link key={booking.id} href={`/bookings/${booking.id}`} className="block rounded-xl bg-ivory p-2">
                    <p className="text-xs text-muted">
                      {formatClock(new Date(booking.startAt))} · {booking.therapistName}
                    </p>
                    <p className="text-sm font-medium">{booking.clientName}</p>
                    <p className="text-xs text-brown">{booking.serviceName}</p>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {open ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40 p-3 sm:items-center" role="presentation">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="booking-title"
            className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-paper p-5 shadow-xl"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs tracking-[0.16em] text-muted uppercase">Booking baru</p>
                <h2 id="booking-title" className="font-display text-3xl">
                  Jadwalkan klien
                </h2>
              </div>
              <button className={secondaryButton} type="button" onClick={() => setOpen(false)}>
                Tutup
              </button>
            </div>
            <form action={onSubmit} className="grid gap-3">
              <Field label="Klien" name="clientId">
                <select
                  id="clientId"
                  name="clientId"
                  className={fieldClass}
                  value={draft.clientId}
                  onChange={(event) => setDraft({ ...draft, clientId: event.target.value })}
                >
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name} · {client.phone}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Layanan" name="serviceId">
                <select
                  id="serviceId"
                  name="serviceId"
                  className={fieldClass}
                  value={draft.serviceId}
                  onChange={(event) => setDraft({ ...draft, serviceId: event.target.value })}
                >
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name} · {service.durationMinutes} mnt · {formatRupiah(service.price)}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Tanggal" name="date">
                  <input
                    id="date"
                    name="date"
                    type="date"
                    className={fieldClass}
                    value={draft.date}
                    onChange={(event) => setDraft({ ...draft, date: event.target.value })}
                    required
                  />
                </Field>
                <Field label="Jam mulai" name="time">
                  <select
                    id="time"
                    name="time"
                    className={fieldClass}
                    value={draft.time}
                    onChange={(event) => setDraft({ ...draft, time: event.target.value })}
                  >
                    {times.map((time) => (
                      <option key={time}>{time}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <p className="text-sm text-muted">
                Selesai pukul mengikuti durasi layanan
                {selectedService ? `: ${selectedService.durationMinutes} menit.` : "."} Jam praktik 09:00–20:00.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Terapis" name="therapistId">
                  <select
                    id="therapistId"
                    name="therapistId"
                    className={fieldClass}
                    value={lockedTherapistId ?? draft.therapistId}
                    onChange={(event) => setDraft({ ...draft, therapistId: event.target.value })}
                    disabled={Boolean(lockedTherapistId)}
                  >
                    {therapists.map((therapist) => (
                      <option key={therapist.id} value={therapist.id}>
                        {therapist.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Ruangan" name="roomId">
                  <select
                    id="roomId"
                    name="roomId"
                    className={fieldClass}
                    value={draft.roomId}
                    onChange={(event) => setDraft({ ...draft, roomId: event.target.value })}
                  >
                    <option value="">Tanpa ruangan</option>
                    {rooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              {lockedTherapistId ? <input type="hidden" name="therapistId" value={lockedTherapistId} /> : null}
              <Field label="Catatan operasional" name="notes">
                <textarea id="notes" name="notes" className={`${fieldClass} h-20 py-2`} />
              </Field>
              {error ? <p className="text-sm text-[#8a3d36]">{error}</p> : null}
              <button className={primaryButton} type="submit" disabled={pending}>
                {pending ? "Memeriksa jadwal..." : "Simpan booking"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, name, children }: { label: string; name: string; children: React.ReactNode }) {
  return (
    <label className="block" htmlFor={name}>
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}

function DayGrid({
  bookings,
  therapists,
  canCreate,
  onSlot,
}: {
  bookings: DeskBooking[];
  therapists: Option[];
  canCreate: boolean;
  onSlot: (therapistId: string, time: string) => void;
}) {
  const height = (END_HOUR - START_HOUR) * HOUR_PX;
  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, index) => START_HOUR + index);

  return (
    <div className="overflow-x-auto rounded-3xl border border-line bg-paper">
      <div className="min-w-[760px]">
        <div className="grid border-b border-line" style={{ gridTemplateColumns: `72px repeat(${therapists.length}, minmax(160px, 1fr))` }}>
          <div />
          {therapists.map((therapist) => (
            <div key={therapist.id} className="border-l border-line px-3 py-3 text-sm font-semibold">
              {therapist.name}
            </div>
          ))}
        </div>
        <div className="grid" style={{ gridTemplateColumns: `72px repeat(${therapists.length}, minmax(160px, 1fr))` }}>
          <div className="relative" style={{ height }}>
            {hours.map((hour) => (
              <span key={hour} className="absolute right-2 text-xs text-muted" style={{ top: (hour - START_HOUR) * HOUR_PX - 6 }}>
                {String(hour).padStart(2, "0")}:00
              </span>
            ))}
          </div>
          {therapists.map((therapist) => (
            <div key={therapist.id} className="relative border-l border-line" style={{ height }}>
              {hours.slice(0, -1).map((hour) => (
                <div key={hour} className="absolute right-0 left-0 border-t border-line/80" style={{ top: (hour - START_HOUR) * HOUR_PX }} />
              ))}
              {canCreate
                ? Array.from({ length: (END_HOUR - START_HOUR) * 2 }, (_, index) => {
                    const minute = START_HOUR * 60 + index * 30;
                    const time = `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
                    return (
                      <button
                        key={time}
                        type="button"
                        aria-label={`Booking ${therapist.name} ${time}`}
                        className="absolute right-0 left-0 h-[34px] hover:bg-champagne/30"
                        style={{ top: index * (HOUR_PX / 2) }}
                        onClick={() => onSlot(therapist.id, time)}
                      />
                    );
                  })
                : null}
              {bookings
                .filter((booking) => booking.therapistId === therapist.id)
                .map((booking) => {
                  const start = minutesFromIso(booking.startAt);
                  const end = minutesFromIso(booking.endAt);
                  const top = ((start - START_HOUR * 60) / 60) * HOUR_PX;
                  const blockHeight = Math.max(((end - start) / 60) * HOUR_PX - 4, 36);
                  return (
                    <Link
                      key={booking.id}
                      href={`/bookings/${booking.id}`}
                      className="absolute right-1 left-1 z-10 overflow-hidden rounded-xl border border-white/80 bg-champagne/90 px-2 py-1 shadow-sm"
                      style={{ top, height: blockHeight }}
                    >
                      <p className="truncate text-xs font-semibold">{booking.clientName}</p>
                      <p className="truncate text-[11px] text-brown">
                        {formatClock(new Date(booking.startAt))} · {booking.serviceName}
                      </p>
                      <StatusBadge status={booking.status} />
                    </Link>
                  );
                })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
