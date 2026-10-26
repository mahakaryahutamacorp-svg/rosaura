"use server";

import { requireUser } from "@/lib/access";
import type { DisplayPromoSlide } from "@/lib/display";
import { ServiceError } from "@/lib/errors";
import { inspectPhoto } from "@/services/clinical-photo.service";
import { addDisplayPromos, removeDisplayPromo } from "@/services/display-promo.service";

async function filesFrom(formData: FormData) {
  const selected = formData
    .getAll("photo")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
  return Promise.all(selected.map(async (file) => inspectPhoto(Buffer.from(await file.arrayBuffer()))));
}

export async function addDisplayPromoAction(
  formData: FormData,
): Promise<{ photos: DisplayPromoSlide[] } | { error: string }> {
  try {
    const user = await requireUser();
    const photos = await addDisplayPromos(user, String(formData.get("slot") ?? ""), await filesFrom(formData));
    return { photos };
  } catch (error) {
    if (error instanceof ServiceError) return { error: error.message };
    throw error;
  }
}

export async function removeDisplayPromoAction(photoId: string): Promise<{ ok: true } | { error: string }> {
  try {
    const user = await requireUser();
    await removeDisplayPromo(user, photoId);
    return { ok: true };
  } catch (error) {
    if (error instanceof ServiceError) return { error: error.message };
    throw error;
  }
}
