"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/access";
import { ServiceError } from "@/lib/errors";
import { createDoctor, deleteDoctor, updateDoctor } from "@/services/doctor.service";

const DOCTORS_PATH = "/doctors";
const AFFECTED_PATHS = [DOCTORS_PATH, "/employees", "/bookings", "/dashboard", "/audit"];

function refreshDoctorPages() {
  for (const path of AFFECTED_PATHS) revalidatePath(path);
}

function bounce(error: unknown): never {
  if (error instanceof ServiceError) {
    redirect(`${DOCTORS_PATH}?error=${encodeURIComponent(error.message)}`);
  }
  throw error;
}

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

export async function createDoctorAction(formData: FormData) {
  try {
    const user = await requireUser();
    await createDoctor(user, {
      name: text(formData, "name"),
      email: text(formData, "email"),
      phone: text(formData, "phone"),
      password: text(formData, "password"),
      grantOwner: formData.get("grantOwner") === "on",
    });
    refreshDoctorPages();
  } catch (error) {
    bounce(error);
  }
  redirect(`${DOCTORS_PATH}?notice=${encodeURIComponent("Akun dokter dibuat.")}`);
}

export async function updateDoctorAction(formData: FormData) {
  try {
    const user = await requireUser();
    await updateDoctor(user, {
      employeeId: text(formData, "employeeId"),
      name: text(formData, "name"),
      email: text(formData, "email"),
      phone: text(formData, "phone"),
      password: text(formData, "password"),
      grantOwner: formData.get("grantOwner") === "on",
      isActive: formData.get("isActive") === "on",
    });
    refreshDoctorPages();
  } catch (error) {
    bounce(error);
  }
  redirect(`${DOCTORS_PATH}?notice=${encodeURIComponent("Akun dokter diperbarui.")}`);
}

export async function deleteDoctorAction(formData: FormData) {
  let outcome: "deleted" | "deactivated" = "deleted";
  try {
    const user = await requireUser();
    outcome = await deleteDoctor(user, text(formData, "employeeId"));
    refreshDoctorPages();
  } catch (error) {
    bounce(error);
  }
  const notice =
    outcome === "deactivated"
      ? "Dokter sudah punya riwayat di klinik, jadi akunnya dinonaktifkan, bukan dihapus."
      : "Akun dokter dihapus.";
  redirect(`${DOCTORS_PATH}?notice=${encodeURIComponent(notice)}`);
}
