import { ServiceError } from "@/lib/errors";

const TIME_ZONE = "Asia/Jakarta";

export function todayJakarta(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function dayKey(date: Date) {
  return todayJakarta(date);
}

export function parseDay(value?: string) {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return todayJakarta();
}

export function jakartaDateTime(date: string, time: string) {
  return new Date(`${date}T${time}:00+07:00`);
}

export function dayRange(date: string) {
  const start = jakartaDateTime(date, "00:00");
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

export function addDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function startOfWeek(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  return addDays(date, diff);
}

export function weekDays(date: string) {
  const start = startOfWeek(date);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

export function minutesInJakarta(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

export function formatClock(date: Date) {
  const total = minutesInJakarta(date);
  const hour = Math.floor(total / 60);
  const minute = total % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function formatLongDate(date: Date | string) {
  const value = typeof date === "string" ? jakartaDateTime(date, "12:00") : date;
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(value);
}

export function formatDateTime(date: Date) {
  return `${formatLongDate(date)} ${formatClock(date)}`;
}

export function formatDateOnlyUtc(date: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function calendarDateUtc(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function isExpired(expiry: Date, today = todayJakarta()) {
  return calendarDateUtc(expiry) < today;
}

export function daysUntilExpiry(expiry: Date, today = todayJakarta()) {
  const start = new Date(`${today}T00:00:00.000Z`).getTime();
  return Math.round((expiry.getTime() - start) / 86_400_000);
}

export function assertClinicHours(start: Date, end: Date) {
  if (end <= start) {
    throw new ServiceError("Durasi tidak valid");
  }
  if (dayKey(start) !== dayKey(end)) {
    throw new ServiceError("Layanan harus selesai pada hari yang sama, sebelum pukul 20:00");
  }
  const startMinute = minutesInJakarta(start);
  const endMinute = minutesInJakarta(end);
  if (startMinute < 9 * 60 || endMinute > 20 * 60) {
    throw new ServiceError("Jadwal harus di antara jam 09:00 dan 20:00");
  }
}
