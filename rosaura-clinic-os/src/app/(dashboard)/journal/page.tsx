import { JournalBoard } from "@/components/journal/JournalBoard";
import { Flash } from "@/components/Flash";
import { canFillJournal, requireUser } from "@/lib/access";
import { formatLongDate, parseDay } from "@/lib/time";
import { listDailyJournals } from "@/services/journal.service";
import { redirect } from "next/navigation";

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; error?: string; notice?: string }>;
}) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  if (!canFillJournal(user)) redirect("/dashboard");

  const date = parseDay(params.date);
  const entries = await listDailyJournals(date);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs tracking-[0.18em] text-muted uppercase">{formatLongDate(date)}</p>
        <h1 className="font-display text-4xl">Jurnal harian</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Checklist SOP admin, dokter, perawat, terapis, dan cleaning service. Centang kegiatan yang sudah dikerjakan, lalu isi catatan jika ada hal lain.
        </p>
      </div>
      <Flash error={params.error} notice={params.notice} />
      <JournalBoard date={date} entries={entries} />
    </div>
  );
}
