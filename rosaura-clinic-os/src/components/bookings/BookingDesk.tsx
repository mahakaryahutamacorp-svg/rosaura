"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  createBookingAction,
  quickCreateClientAction,
  quickCreateServiceAction,
} from "@/app/actions/operations";
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

  // Daftar klien & layanan lokal untuk pembaruan instan tanpa refresh penuh
  const [clientList, setClientList] = useState<ClientOption[]>(clients);
  const [serviceList, setServiceList] = useState<ServiceOption[]>(services);

  useEffect(() => {
    setClientList(clients);
  }, [clients]);

  useEffect(() => {
    setServiceList(services);
  }, [services]);

  // Mode & form Pasien Baru
  const [showNewClient, setShowNewClient] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [newClientPending, setNewClientPending] = useState(false);
  const [newClientError, setNewClientError] = useState("");
  const [newClientDraft, setNewClientDraft] = useState({
    fullName: "",
    phone: "",
    dateOfBirth: "",
    consent: true,
  });

  // Mode & form Layanan Baru
  const [showNewService, setShowNewService] = useState(false);
  const [serviceSearch, setServiceSearch] = useState("");
  const [newServicePending, setNewServicePending] = useState(false);
  const [newServiceError, setNewServiceError] = useState("");
  const [newServiceDraft, setNewServiceDraft] = useState({
    code: "",
    name: "",
    durationMinutes: 60,
    price: 150000,
  });

  const [draft, setDraft] = useState({
    date,
    time: "10:00",
    therapistId: lockedTherapistId ?? therapists[0]?.id ?? "",
    serviceId: services[0]?.id ?? "",
    clientId: clients[0]?.id ?? "",
    roomId: rooms[0]?.id ?? "",
  });

  // Filter klien
  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return clientList;
    return clientList.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.clientCode.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)),
    );
  }, [clientList, clientSearch]);

  // Filter layanan
  const filteredServices = useMemo(() => {
    const q = serviceSearch.trim().toLowerCase();
    if (!q) return serviceList;
    return serviceList.filter((s) => s.name.toLowerCase().includes(q));
  }, [serviceList, serviceSearch]);

  const selectedService = serviceList.find((service) => service.id === draft.serviceId);

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
    setShowNewClient(false);
    setShowNewService(false);
    setNewClientError("");
    setNewServiceError("");
    setClientSearch("");
    setServiceSearch("");
    setDraft((current) => ({
      ...current,
      date,
      therapistId: lockedTherapistId ?? current.therapistId ?? therapists[0]?.id ?? "",
      serviceId: current.serviceId || serviceList[0]?.id || "",
      clientId: current.clientId || clientList[0]?.id || "",
      roomId: current.roomId || rooms[0]?.id || "",
      ...next,
    }));
    setOpen(true);
  }

  // Handler Pendaftaran Pasien Baru Instan
  async function handleQuickCreateClient() {
    setNewClientError("");
    if (!newClientDraft.fullName.trim() || newClientDraft.fullName.trim().length < 3) {
      setNewClientError("Nama lengkap minimal 3 karakter.");
      return;
    }
    if (!newClientDraft.phone.trim()) {
      setNewClientError("Nomor HP/WhatsApp wajib diisi.");
      return;
    }
    if (!newClientDraft.consent) {
      setNewClientError("Persetujuan pemrosesan data rekam medis wajib dicentang.");
      return;
    }

    setNewClientPending(true);
    const result = await quickCreateClientAction(newClientDraft);
    setNewClientPending(false);

    if (!result.ok || !result.client) {
      setNewClientError(result.message);
      return;
    }

    const created = {
      id: result.client.id,
      name: result.client.name,
      clientCode: result.client.clientCode,
      phone: result.client.phone,
    };

    setClientList((prev) => [created, ...prev.filter((c) => c.id !== created.id)]);
    setDraft((current) => ({ ...current, clientId: created.id }));
    setShowNewClient(false);
    setNewClientDraft({ fullName: "", phone: "", dateOfBirth: "", consent: true });
  }

  // Handler Penambahan Layanan Baru Instan
  async function handleQuickCreateService() {
    setNewServiceError("");
    const code = newServiceDraft.code.trim().toUpperCase();
    const name = newServiceDraft.name.trim();

    if (!code || code.length < 2) {
      setNewServiceError("Kode layanan minimal 2 karakter (contoh: FAC-01).");
      return;
    }
    if (!name || name.length < 3) {
      setNewServiceError("Nama layanan minimal 3 karakter.");
      return;
    }
    if (newServiceDraft.durationMinutes < 15 || newServiceDraft.durationMinutes > 240) {
      setNewServiceError("Durasi layanan harus antara 15 dan 240 menit.");
      return;
    }
    if (newServiceDraft.price <= 0) {
      setNewServiceError("Tarif layanan harus lebih dari 0.");
      return;
    }

    setNewServicePending(true);
    const result = await quickCreateServiceAction({
      code,
      name,
      durationMinutes: newServiceDraft.durationMinutes,
      price: newServiceDraft.price,
    });
    setNewServicePending(false);

    if (!result.ok || !result.service) {
      setNewServiceError(result.message);
      return;
    }

    const created = {
      id: result.service.id,
      name: result.service.name,
      durationMinutes: result.service.durationMinutes,
      price: result.service.price,
    };

    setServiceList((prev) => [created, ...prev.filter((s) => s.id !== created.id)]);
    setDraft((current) => ({ ...current, serviceId: created.id }));
    setShowNewService(false);
    setNewServiceDraft({ code: "", name: "", durationMinutes: 60, price: 150000 });
  }

  async function onSubmit(formData: FormData) {
    setError("");

    // Validasi kelengkapan sebelum submit
    const clientId = String(formData.get("clientId") || draft.clientId || "");
    const serviceId = String(formData.get("serviceId") || draft.serviceId || "");

    if (!clientId) {
      setError("Silakan pilih pasien atau gunakan tombol '+ Pasien Baru' di atas.");
      return;
    }
    if (!serviceId) {
      setError("Silakan pilih layanan atau gunakan tombol '+ Layanan Baru' di atas.");
      return;
    }

    setPending(true);
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
              {/* Bagian Klien */}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label htmlFor="clientId" className={labelClass}>
                    Klien / Pasien <span className="text-[#8a3d36]">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewClient(!showNewClient);
                      setNewClientError("");
                    }}
                    className="flex items-center gap-1 rounded-lg bg-champagne/50 px-2 py-0.5 text-xs font-semibold text-gold-deep transition hover:bg-champagne hover:text-ink"
                  >
                    {showNewClient ? "✕ Batal (Pilih Klien)" : "+ Pasien Baru"}
                  </button>
                </div>

                {showNewClient ? (
                  <div className="space-y-2.5 rounded-2xl border border-gold-deep/30 bg-ivory/80 p-3.5 shadow-inner">
                    <div className="flex items-center justify-between border-b border-line/60 pb-1.5">
                      <p className="text-xs font-bold uppercase tracking-wider text-brown">
                        Pendaftaran Pasien Baru
                      </p>
                      <span className="text-[11px] text-muted">Langsung aktif & terjadwal</span>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-ink">Nama Lengkap *</label>
                      <input
                        type="text"
                        placeholder="Contoh: Siti Rahmawati"
                        className={fieldClass}
                        value={newClientDraft.fullName}
                        onChange={(e) => setNewClientDraft({ ...newClientDraft, fullName: e.target.value })}
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div>
                        <label className="text-xs font-medium text-ink">Nomor HP / WhatsApp *</label>
                        <input
                          type="tel"
                          placeholder="0812xxxxxxxx"
                          className={fieldClass}
                          value={newClientDraft.phone}
                          onChange={(e) => setNewClientDraft({ ...newClientDraft, phone: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-ink">Tanggal Lahir (Opsional)</label>
                        <input
                          type="date"
                          className={fieldClass}
                          value={newClientDraft.dateOfBirth}
                          onChange={(e) => setNewClientDraft({ ...newClientDraft, dateOfBirth: e.target.value })}
                        />
                      </div>
                    </div>

                    <label className="flex cursor-pointer items-center gap-2 pt-1 text-xs text-ink">
                      <input
                        type="checkbox"
                        checked={newClientDraft.consent}
                        onChange={(e) => setNewClientDraft({ ...newClientDraft, consent: e.target.checked })}
                        className="rounded accent-gold-deep"
                      />
                      <span>Persetujuan pemrosesan data rekam medis klinik</span>
                    </label>

                    {newClientError ? <p className="text-xs text-[#8a3d36]">{newClientError}</p> : null}

                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        disabled={newClientPending}
                        onClick={handleQuickCreateClient}
                        className={`${primaryButton} flex-1 justify-center py-2 text-xs`}
                      >
                        {newClientPending ? "Mendaftarkan..." : "✓ Simpan & Pilih Pasien"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowNewClient(false)}
                        className={`${secondaryButton} py-2 text-xs`}
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {clientList.length > 5 ? (
                      <input
                        type="text"
                        placeholder="🔍 Ketik untuk cari nama / no HP..."
                        className="w-full rounded-xl border border-line bg-white/70 px-3 py-1.5 text-xs text-ink placeholder:text-muted focus:border-gold-deep focus:outline-none"
                        value={clientSearch}
                        onChange={(e) => setClientSearch(e.target.value)}
                      />
                    ) : null}
                    <select
                      id="clientId"
                      name="clientId"
                      className={fieldClass}
                      value={draft.clientId}
                      onChange={(event) => setDraft({ ...draft, clientId: event.target.value })}
                    >
                      <option value="">
                        {filteredClients.length === 0
                          ? "-- Pasien tidak ditemukan --"
                          : `-- Pilih Pasien (${filteredClients.length} terdaftar) --`}
                      </option>
                      {filteredClients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.phone ? `${client.name} · ${client.phone}` : `${client.name} · ${client.clientCode}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Bagian Layanan */}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label htmlFor="serviceId" className={labelClass}>
                    Layanan Treatment <span className="text-[#8a3d36]">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewService(!showNewService);
                      setNewServiceError("");
                    }}
                    className="flex items-center gap-1 rounded-lg bg-champagne/50 px-2 py-0.5 text-xs font-semibold text-gold-deep transition hover:bg-champagne hover:text-ink"
                  >
                    {showNewService ? "✕ Batal (Pilih Layanan)" : "+ Layanan Baru"}
                  </button>
                </div>

                {showNewService ? (
                  <div className="space-y-2.5 rounded-2xl border border-gold-deep/30 bg-ivory/80 p-3.5 shadow-inner">
                    <div className="flex items-center justify-between border-b border-line/60 pb-1.5">
                      <p className="text-xs font-bold uppercase tracking-wider text-brown">
                        Tambah Layanan Cepat
                      </p>
                      <span className="text-[11px] text-muted">Masuk ke katalog & langsung terpilih</span>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <div>
                        <label className="text-xs font-medium text-ink">Kode *</label>
                        <input
                          type="text"
                          placeholder="FAC-02"
                          className={fieldClass}
                          value={newServiceDraft.code}
                          onChange={(e) =>
                            setNewServiceDraft({ ...newServiceDraft, code: e.target.value.toUpperCase() })
                          }
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-xs font-medium text-ink">Nama Layanan *</label>
                        <input
                          type="text"
                          placeholder="Contoh: Laser Brightening Treatment"
                          className={fieldClass}
                          value={newServiceDraft.name}
                          onChange={(e) => setNewServiceDraft({ ...newServiceDraft, name: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div>
                        <label className="text-xs font-medium text-ink">Durasi (menit) *</label>
                        <input
                          type="number"
                          min={15}
                          max={240}
                          step={15}
                          className={fieldClass}
                          value={newServiceDraft.durationMinutes}
                          onChange={(e) =>
                            setNewServiceDraft({ ...newServiceDraft, durationMinutes: Number(e.target.value) })
                          }
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-ink">Tarif Layanan (Rp) *</label>
                        <input
                          type="number"
                          min={0}
                          step={10000}
                          className={fieldClass}
                          value={newServiceDraft.price}
                          onChange={(e) =>
                            setNewServiceDraft({ ...newServiceDraft, price: Number(e.target.value) })
                          }
                        />
                      </div>
                    </div>

                    {newServiceError ? <p className="text-xs text-[#8a3d36]">{newServiceError}</p> : null}

                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        disabled={newServicePending}
                        onClick={handleQuickCreateService}
                        className={`${primaryButton} flex-1 justify-center py-2 text-xs`}
                      >
                        {newServicePending ? "Menyimpan..." : "✓ Simpan & Pilih Layanan"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowNewService(false)}
                        className={`${secondaryButton} py-2 text-xs`}
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                ) : serviceList.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gold-deep/50 bg-champagne/30 p-3 text-center">
                    <p className="text-xs font-medium text-brown">
                      Belum ada katalog layanan di klinik.
                    </p>
                    <p className="mt-1 text-[11px] text-muted">
                      Tambahkan layanan pertama Anda agar booking dapat dijadwalkan.
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowNewService(true)}
                      className={`${primaryButton} mt-2 text-xs py-1.5 px-3`}
                    >
                      + Buat Layanan Pertama
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {serviceList.length > 5 ? (
                      <input
                        type="text"
                        placeholder="🔍 Ketik untuk cari layanan..."
                        className="w-full rounded-xl border border-line bg-white/70 px-3 py-1.5 text-xs text-ink placeholder:text-muted focus:border-gold-deep focus:outline-none"
                        value={serviceSearch}
                        onChange={(e) => setServiceSearch(e.target.value)}
                      />
                    ) : null}
                    <select
                      id="serviceId"
                      name="serviceId"
                      className={fieldClass}
                      value={draft.serviceId}
                      onChange={(event) => setDraft({ ...draft, serviceId: event.target.value })}
                    >
                      <option value="">
                        {filteredServices.length === 0
                          ? "-- Layanan tidak ditemukan --"
                          : `-- Pilih Layanan (${filteredServices.length} tersedia) --`}
                      </option>
                      {filteredServices.map((service) => (
                        <option key={service.id} value={service.id}>
                          {service.name} · {service.durationMinutes} mnt · {formatRupiah(service.price)}
                        </option>
                      ))}
                    </select>

                    {selectedService ? (
                      <div className="flex items-center justify-between rounded-xl bg-ivory px-3 py-1.5 text-xs text-brown">
                        <span>
                          Durasi: <strong>{selectedService.durationMinutes} menit</strong>
                        </span>
                        <span>
                          Tarif: <strong>{formatRupiah(selectedService.price)}</strong>
                        </span>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
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
