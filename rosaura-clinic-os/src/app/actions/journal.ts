"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/access";
import { ServiceError } from "@/lib/errors";
import { JOURNAL_POSITIONS } from "@/lib/journal-sop";
import { saveDailyJournals } from "@/services/journal.service";

export async function saveJournalAction(formData: FormData) {
  const date = String(formData.get("date") ?? "");
  const path = /^\d{4}-\d{2}-\d{2}$/.test(date) ? `/journal?date=${date}` : "/journal";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    redirect(`${path}?error=${encodeURIComponent("Tanggal tidak valid")}`);
  }

  const checked = new Set(formData.getAll("check").map(String));
  const drafts = JOURNAL_POSITIONS.map((position) => ({
    position: position.key,
    checkedKeys: position.tasks.filter((task) => checked.has(`${position.key}:${task.key}`)).map((task) => task.key),
    notes: String(formData.get(`notes:${position.key}`) ?? ""),
  }));

  try {
    const user = await requireUser();
    await saveDailyJournals(user, date, drafts);
  } catch (error) {
    if (error instanceof ServiceError) {
      redirect(`${path}&error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }

  revalidatePath("/journal");
  redirect(`${path}&notice=${encodeURIComponent("Jurnal harian tersimpan.")}`);
}
