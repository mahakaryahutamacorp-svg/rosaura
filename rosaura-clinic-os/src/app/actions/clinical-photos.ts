"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/access";
import { ServiceError } from "@/lib/errors";
import { addClinicalPhotos, createClinicalVisit, inspectPhoto, removeClinicalPhoto } from "@/services/clinical-photo.service";

function clientPath(clientId: string) {
  return `/clients/${clientId}`;
}

function fail(clientId: string, error: unknown): never {
  revalidatePath(clientPath(clientId));
  if (error instanceof ServiceError) {
    redirect(`${clientPath(clientId)}?error=${encodeURIComponent(error.message)}`);
  }
  throw error;
}

async function filesFrom(formData: FormData) {
  const selected = formData
    .getAll("photos")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
  return Promise.all(
    selected.map(async (file) => inspectPhoto(Buffer.from(await file.arrayBuffer()))),
  );
}

export async function createSkinVisitAction(formData: FormData) {
  const user = await requireUser();
  const clientId = String(formData.get("clientId") ?? "");
  try {
    await createClinicalVisit(user, {
      clientId,
      visitDate: String(formData.get("visitDate") ?? ""),
      doctorNotes: String(formData.get("doctorNotes") ?? ""),
      files: await filesFrom(formData),
    });
  } catch (error) {
    fail(clientId, error);
  }
  revalidatePath("/clients");
  revalidatePath(clientPath(clientId));
  redirect(`${clientPath(clientId)}?notice=${encodeURIComponent("Kunjungan tersimpan")}`);
}

export async function addVisitPhotosAction(formData: FormData) {
  const user = await requireUser();
  const clientId = String(formData.get("clientId") ?? "");
  try {
    await addClinicalPhotos(user, {
      skinRecordId: String(formData.get("skinRecordId") ?? ""),
      caption: String(formData.get("caption") ?? ""),
      files: await filesFrom(formData),
    });
  } catch (error) {
    fail(clientId, error);
  }
  revalidatePath(clientPath(clientId));
  redirect(`${clientPath(clientId)}?notice=${encodeURIComponent("Foto kunjungan tersimpan")}`);
}

export async function removeVisitPhotoAction(formData: FormData) {
  const user = await requireUser();
  const clientId = String(formData.get("clientId") ?? "");
  try {
    await removeClinicalPhoto(user, String(formData.get("photoId") ?? ""));
  } catch (error) {
    fail(clientId, error);
  }
  revalidatePath(clientPath(clientId));
  redirect(`${clientPath(clientId)}?notice=${encodeURIComponent("Foto dihapus")}`);
}
