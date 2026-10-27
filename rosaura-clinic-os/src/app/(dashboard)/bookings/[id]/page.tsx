import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  changeStatusAction,
  createInvoiceAction,
  rescheduleAction,
  saveNoteAction,
  useMaterialAction,
} from "@/app/actions/operations";
import { Flash } from "@/components/Flash";
import { StatusBadge } from "@/components/StatusBadge";
import { canBill, canBook, canEditClinical, canOperateBooking, requireUser } from "@/lib/access";
import { ServiceError } from "@/lib/errors";
import { formatRupiah } from "@/lib/format";
import { paymentLabel } from "@/lib/labels";
import { fieldClass, labelClass, primaryButton, quietButton, secondaryButton } from "@/lib/styles";
import { calendarDateUtc, formatClock, formatDateOnlyUtc, formatDateTime, formatLongDate } from "@/lib/time";
import { netPaid } from "@/services/billing.service";
import { getBooking } from "@/services/booking.service";
import { listRooms, listTherapists } from "@/services/catalog.service";
import { usableBatchOptions } from "@/services/inventory.service";

const moves: Record<string, Array<{ status: string; label: string }>> = {
  BOOKED: [
    { status: "CONFIRMED", label: "Konfirmasi" },
    { status: "CANCELLED", label: "Batalkan" },
    { status: "NO_SHOW", label: "Tidak datang" },
  ],
  CONFIRMED: [
    { status: "CHECKED_IN", label: "Check-in" },
    { status: "CANCELLED", label: "Batalkan" },
    { status: "NO_SHOW", label: "Tidak datang" },
  ],
  CHECKED_IN: [{ status: "IN_SERVICE", label: "Mulai layanan" }],
  IN_SERVICE: [{ status: "COMPLETED", label: "Selesai" }],
};

export default async function BookingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const [user, { id }, query] = await Promise.all([requireUser(), params, searchParams]);
  if (!canBook(user)) redirect("/dashboard");

  let booking: Awaited<ReturnType<typeof getBooking>>;
  try {
    booking = await getBooking(user, id);
  } catch (error) {
    if (error instanceof ServiceError) {
      return (
        <div className="space-y-3">
          <h1 className="font-display text-4xl">Di luar jadwal Anda</h1>
          <p className="text-sm text-brown">{error.message}</p>
          <Link className={secondaryButton} href="/bookings">
            Kembali ke kalender
          </Link>
        </div>
      );
    }
    throw error;
  }
  if (!booking) notFound();

  const therapistId = booking.assignments[0]?.employeeId ?? "";
  const canOperate = canOperateBooking(user, therapistId);
  const showClinical = canEditClinical(user, booking.visit?.providerId ?? "", therapistId);
  const [therapists, rooms, batches] = await Promise.all([
    listTherapists(),
    listRooms(),
    showClinical ? usableBatchOptions() : Promise.resolve([]),
  ]);
  const invoice = booking.invoice;
  const remaining = invoice ? invoice.grandTotal - netPaid(invoice.payments) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/bookings" className="text-sm text-gold-deep">
            Kembali ke kalender
          </Link>
          <div className="mt-2 flex flex-wrap items-baseline gap-3">
            <h1 className="font-display text-4xl">{booking.client.fullName}</h1>
            <Link
              href={`/clients/${booking.clientId}`}
              className="inline-flex items-center gap-1 rounded-xl bg-gold/15 px-3 py-1 text-xs font-semibold text-gold-deep transition hover:bg-gold/25"
            >
              Buka Rekam Medis &rarr;
            </Link>
          </div>
          <p className="text-sm text-muted">
            {booking.bookingCode} · {formatLongDate(booking.startAt)} · {formatClock(booking.startAt)}–
            {formatClock(booking.endAt)}
          </p>
        </div>
        <StatusBadge status={booking.status} />
      </div>
      <Flash error={query.error} notice={query.notice} />

      <section className="grid gap-3 rounded-3xl border border-line bg-paper p-5 md:grid-cols-4">
        <Info label="Layanan" value={booking.services.map((item) => item.serviceNameSnapshot).join(", ")} />
        <Info label="Petugas" value={booking.assignments[0]?.employee.name ?? "-"} />
        <Info label="Ruangan" value={booking.room?.name ?? "Tanpa ruangan"} />
        <Info
          label="Harga tersimpan"
          value={formatRupiah(booking.services.reduce((sum, item) => sum + item.priceSnapshot, 0))}
        />
      </section>

      {canOperate && (moves[booking.status]?.length ?? 0) > 0 ? (
        <div className="no-print flex flex-wrap gap-2">
          {moves[booking.status].map((move) => (
            <form key={move.status} action={changeStatusAction}>
              <input type="hidden" name="bookingId" value={booking.id} />
              <input type="hidden" name="status" value={move.status} />
              <button className={move.status === "CANCELLED" || move.status === "NO_SHOW" ? quietButton : primaryButton} type="submit">
                {move.label}
              </button>
            </form>
          ))}
        </div>
      ) : null}

      {canBill(user) && ["BOOKED", "CONFIRMED"].includes(booking.status) ? (
        <form action={rescheduleAction} className="no-print grid gap-3 rounded-3xl border border-line bg-paper p-5 md:grid-cols-4">
          <input type="hidden" name="bookingId" value={booking.id} />
          <h2 className="font-display text-2xl md:col-span-4">Jadwalkan ulang</h2>
          <label>
            <span className={labelClass}>Tanggal</span>
            <input className={fieldClass} type="date" name="date" defaultValue={calendarDateUtc(booking.startAt).slice(0, 10)} required />
          </label>
          <label>
            <span className={labelClass}>Jam</span>
            <input className={fieldClass} type="time" name="time" defaultValue={formatClock(booking.startAt)} required />
          </label>
          <label>
            <span className={labelClass}>Terapis</span>
            <select className={fieldClass} name="therapistId" defaultValue={therapistId}>
              {therapists.map((therapist) => (
                <option key={therapist.id} value={therapist.id}>
                  {therapist.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={labelClass}>Ruangan</span>
            <select className={fieldClass} name="roomId" defaultValue={booking.roomId ?? ""}>
              <option value="">Tanpa ruangan</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </label>
          <button className={`${secondaryButton} md:col-span-4 md:w-fit`} type="submit">
            Simpan jadwal baru
          </button>
        </form>
      ) : null}

      <section className="rounded-3xl border border-line bg-paper p-5">
        <h2 className="font-display text-2xl">Catatan kunjungan</h2>
        {showClinical ? (
          booking.visit ? (
            <form action={saveNoteAction} className="mt-4 grid gap-3">
              <input type="hidden" name="bookingId" value={booking.id} />
              <label>
                <span className={labelClass}>Keluhan</span>
                <textarea className={`${fieldClass} h-20 py-2`} name="complaint" defaultValue={booking.visit.note?.complaint ?? ""} />
              </label>
              <label>
                <span className={labelClass}>Pengerjaan</span>
                <textarea className={`${fieldClass} h-20 py-2`} name="workDone" defaultValue={booking.visit.note?.workDone ?? ""} />
              </label>
              <label>
                <span className={labelClass}>Catatan bahan</span>
                <textarea className={`${fieldClass} h-16 py-2`} name="materialsNote" defaultValue={booking.visit.note?.materialsNote ?? ""} />
              </label>
              <label>
                <span className={labelClass}>Rencana kontrol</span>
                <input
                  className={fieldClass}
                  type="date"
                  name="followUpOn"
                  defaultValue={booking.visit.note?.followUpOn ? calendarDateUtc(booking.visit.note.followUpOn) : ""}
                />
              </label>
              <button className={`${primaryButton} w-fit`} type="submit">
                Simpan catatan
              </button>
            </form>
          ) : (
            <p className="mt-3 text-sm text-muted">Catatan dibuka setelah check-in.</p>
          )
        ) : (
          <p className="mt-3 text-sm text-muted">
            {booking.visit?.note ? "Catatan klinis sudah diisi. Isi keluhan tidak ditampilkan untuk front office." : "Catatan klinis belum diisi."}
          </p>
        )}

        {showClinical && booking.visit?.note ? (
          <div className="mt-5 space-y-3">
            <h3 className="text-sm font-semibold text-brown">Bahan terpakai</h3>
            <ul className="space-y-1 text-sm">
              {booking.visit.note.usages.map((usage) => (
                <li key={usage.id}>
                  {usage.batch.product.name} · batch {usage.batch.batchNumber} · {usage.quantityUsed} {usage.batch.product.unit}
                </li>
              ))}
              {booking.visit.note.usages.length === 0 ? <li className="text-muted">Belum ada pemakaian batch.</li> : null}
            </ul>
            {batches.length > 0 ? (
              <form action={useMaterialAction} className="grid gap-3 md:grid-cols-[1fr_120px_auto] md:items-end">
                <input type="hidden" name="bookingId" value={booking.id} />
                <label>
                  <span className={labelClass}>Batch FEFO</span>
                  <select className={fieldClass} name="productId">
                    {batches.map((item) => (
                      <option key={item.productId} value={item.productId}>
                        {item.productName} · {item.batch.batchNumber} · sisa {item.batch.qtyAvailable} ·{" "}
                        {formatDateOnlyUtc(item.batch.expiryDate)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className={labelClass}>Jumlah</span>
                  <input className={fieldClass} name="quantity" type="number" min={1} defaultValue={1} />
                </label>
                <button className={secondaryButton} type="submit">
                  Pakai
                </button>
              </form>
            ) : null}
          </div>
        ) : null}
      </section>

      {canBill(user) ? (
        <section className="rounded-3xl border border-line bg-paper p-5">
          <h2 className="font-display text-2xl">Tagihan</h2>
          {invoice ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
              <p>
                {invoice.invoiceNumber} · {paymentLabel.CASH ? "" : ""}
                Sisa {formatRupiah(remaining)}
              </p>
              <Link className={secondaryButton} href={`/billing/${invoice.id}`}>
                Buka kasir
              </Link>
            </div>
          ) : ["CHECKED_IN", "IN_SERVICE", "COMPLETED"].includes(booking.status) ? (
            <form action={createInvoiceAction} className="mt-3">
              <input type="hidden" name="bookingId" value={booking.id} />
              <button className={primaryButton} type="submit">
                Buat tagihan dari harga tersimpan
              </button>
            </form>
          ) : (
            <p className="mt-3 text-sm text-muted">Tagihan tersedia setelah check-in.</p>
          )}
        </section>
      ) : null}

      <section className="rounded-3xl border border-line bg-paper p-5">
        <h2 className="font-display text-2xl">Riwayat status</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {booking.history.map((item) => (
            <li key={item.id} className="flex flex-wrap justify-between gap-2">
              <span>
                {item.oldStatus ?? "Baru"} → {item.newStatus}
                {item.note ? ` · ${item.note}` : ""}
              </span>
              <span className="text-muted">
                {item.changedBy.employee.name} · {formatDateTime(item.changedAt)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs tracking-[0.14em] text-muted uppercase">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
