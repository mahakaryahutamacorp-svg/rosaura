"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canBill, requireUser } from "@/lib/access";
import type { CustomerBill } from "@/lib/display";
import { clearCounterBill, publishCounterBill } from "@/services/display.service";
import { ServiceError } from "@/lib/errors";
import { z } from "zod";
import { changeBookingStatus, createBooking, rescheduleBooking } from "@/services/booking.service";
import { checkoutSale, createInvoice, recordPayment, reversePayment } from "@/services/billing.service";
import { saveVisitNote, useMaterial } from "@/services/visit.service";
import { createClient, setClientActive } from "@/services/client.service";
import { createService, deleteService, setServiceActive, updateService } from "@/services/catalog.service";
import { adjustStock, createProduct, deleteProduct, receiveStock, updateProduct } from "@/services/inventory.service";
import { updateEmployeeAccess } from "@/services/employee.service";

export interface ActionResult {
  ok: boolean;
  message: string;
}

type Area = "booking" | "billing" | "client" | "catalog" | "inventory" | "employee";

// Halaman yang tampilannya berubah untuk tiap jenis tindakan. /audit selalu ikut.
const AREA_PATHS: Record<Area, string[]> = {
  booking: ["/bookings", "/dashboard"],
  billing: ["/billing", "/dashboard", "/bookings"],
  client: ["/clients", "/bookings", "/billing"],
  catalog: ["/services", "/bookings", "/billing"],
  inventory: ["/inventory", "/billing", "/dashboard"],
  employee: ["/employees", "/bookings", "/dashboard"],
};

function refresh(areas: Area[], bookingId?: string) {
  const paths = new Set<string>(["/audit"]);
  for (const area of areas) for (const path of AREA_PATHS[area]) paths.add(path);
  for (const path of paths) revalidatePath(path);
  if (bookingId) revalidatePath(`/bookings/${bookingId}`);
}

function bounce(path: string, error: unknown): never {
  if (error instanceof ServiceError) {
    redirect(`${path}?error=${encodeURIComponent(error.message)}`);
  }
  throw error;
}

export async function createBookingAction(formData: FormData): Promise<ActionResult> {
  const parsed = z
    .object({
      clientId: z.string().min(1),
      serviceId: z.string().min(1),
      therapistId: z.string().min(1),
      roomId: z.string(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      time: z.string().regex(/^\d{2}:\d{2}$/),
      notes: z.string(),
    })
    .safeParse({
      clientId: String(formData.get("clientId") ?? ""),
      serviceId: String(formData.get("serviceId") ?? ""),
      therapistId: String(formData.get("therapistId") ?? ""),
      roomId: String(formData.get("roomId") ?? ""),
      date: String(formData.get("date") ?? ""),
      time: String(formData.get("time") ?? ""),
      notes: String(formData.get("notes") ?? ""),
    });
  if (!parsed.success) {
    return { ok: false, message: "Lengkapi klien, layanan, tanggal, dan jam." };
  }

  try {
    const user = await requireUser();
    await createBooking(user, {
      ...parsed.data,
      roomId: parsed.data.roomId || null,
    });
    refresh(["booking"]);
    return { ok: true, message: "Booking tersimpan." };
  } catch (error) {
    if (error instanceof ServiceError) return { ok: false, message: error.message };
    throw error;
  }
}

export async function changeStatusAction(formData: FormData) {
  const bookingId = String(formData.get("bookingId") ?? "");
  try {
    const user = await requireUser();
    await changeBookingStatus(user, bookingId, String(formData.get("status") ?? ""));
    refresh(["booking"], bookingId);
  } catch (error) {
    bounce(`/bookings/${bookingId}`, error);
  }
  redirect(`/bookings/${bookingId}?notice=${encodeURIComponent("Status diperbarui.")}`);
}

export async function rescheduleAction(formData: FormData) {
  const bookingId = String(formData.get("bookingId") ?? "");
  try {
    const user = await requireUser();
    const roomId = String(formData.get("roomId") ?? "");
    const created = await rescheduleBooking(user, {
      bookingId,
      date: String(formData.get("date") ?? ""),
      time: String(formData.get("time") ?? ""),
      therapistId: String(formData.get("therapistId") ?? ""),
      roomId: roomId || null,
    });
    refresh(["booking"], bookingId);
    redirect(`/bookings/${created.id}?notice=${encodeURIComponent("Booking dijadwalkan ulang.")}`);
  } catch (error) {
    bounce(`/bookings/${bookingId}`, error);
  }
}

export async function saveNoteAction(formData: FormData) {
  const bookingId = String(formData.get("bookingId") ?? "");
  try {
    const user = await requireUser();
    await saveVisitNote(user, {
      bookingId,
      complaint: String(formData.get("complaint") ?? ""),
      workDone: String(formData.get("workDone") ?? ""),
      materialsNote: String(formData.get("materialsNote") ?? ""),
      followUpOn: String(formData.get("followUpOn") ?? ""),
    });
    refresh(["booking"], bookingId);
  } catch (error) {
    bounce(`/bookings/${bookingId}`, error);
  }
  redirect(`/bookings/${bookingId}?notice=${encodeURIComponent("Catatan tersimpan.")}`);
}

export async function useMaterialAction(formData: FormData) {
  const bookingId = String(formData.get("bookingId") ?? "");
  try {
    const user = await requireUser();
    await useMaterial(user, bookingId, String(formData.get("productId") ?? ""), Number(formData.get("quantity")));
    refresh(["booking", "inventory"], bookingId);
  } catch (error) {
    bounce(`/bookings/${bookingId}`, error);
  }
  redirect(`/bookings/${bookingId}?notice=${encodeURIComponent("Pemakaian bahan tercatat.")}`);
}

export async function createInvoiceAction(formData: FormData) {
  const bookingId = String(formData.get("bookingId") ?? "");
  try {
    const user = await requireUser();
    const invoice = await createInvoice(user, bookingId);
    refresh(["billing"], bookingId);
    redirect(`/billing/${invoice.id}?notice=${encodeURIComponent("Tagihan dibuat.")}`);
  } catch (error) {
    bounce(`/bookings/${bookingId}`, error);
  }
}

export async function recordPaymentAction(formData: FormData) {
  const invoiceId = String(formData.get("invoiceId") ?? "");
  try {
    const user = await requireUser();
    await recordPayment(user, {
      invoiceId,
      method: String(formData.get("method") ?? ""),
      amount: Number(formData.get("amount") || 0),
      transferAmount: Number(formData.get("transferAmount") || 0),
      discount: Number(formData.get("discount") || 0),
      idempotencyKey: String(formData.get("idempotencyKey") ?? ""),
    });
    refresh(["billing"]);
    revalidatePath(`/billing/${invoiceId}`);
  } catch (error) {
    bounce(`/billing/${invoiceId}`, error);
  }
  redirect(`/billing/${invoiceId}?notice=${encodeURIComponent("Pembayaran tercatat.")}`);
}

export async function checkoutSaleAction(_state: ActionResult, formData: FormData): Promise<ActionResult> {
  let lines: Array<{ kind: "product" | "service"; id: string; quantity: number }> = [];
  try {
    const parsed = JSON.parse(String(formData.get("lines") ?? "[]")) as unknown;
    if (!Array.isArray(parsed)) throw new Error("invalid");
    lines = parsed.map((line) => {
      const item = line as { kind?: unknown; id?: unknown; productId?: unknown; quantity?: unknown };
      const kind = item.kind === "service" ? "service" : "product";
      return { kind, id: String(item.id ?? item.productId ?? ""), quantity: Number(item.quantity) };
    });
  } catch {
    return { ok: false, message: "Keranjang tidak valid." };
  }

  try {
    const user = await requireUser();
    const invoice = await checkoutSale(user, {
      clientId: String(formData.get("clientId") ?? ""),
      lines,
      discount: Number(formData.get("discount") || 0),
      method: String(formData.get("method") ?? ""),
      amount: Number(formData.get("amount") || 0),
      transferAmount: Number(formData.get("transferAmount") || 0),
      idempotencyKey: String(formData.get("idempotencyKey") ?? ""),
    });
    refresh(["billing", "inventory"]);
    revalidatePath(`/billing/${invoice.id}`);
    const stockNote = lines.some((line) => line.kind === "product") ? " Stok produk sudah dipotong." : "";
    redirect(`/billing/${invoice.id}?notice=${encodeURIComponent(`Penjualan tersimpan.${stockNote}`)}`);
  } catch (error) {
    if (error instanceof ServiceError) return { ok: false, message: error.message };
    throw error;
  }
}

export async function reversePaymentAction(formData: FormData) {
  const invoiceId = String(formData.get("invoiceId") ?? "");
  try {
    const user = await requireUser();
    await reversePayment(user, String(formData.get("paymentId") ?? ""), String(formData.get("reason") ?? ""));
    refresh(["billing"]);
    revalidatePath(`/billing/${invoiceId}`);
  } catch (error) {
    bounce(`/billing/${invoiceId}`, error);
  }
  redirect(`/billing/${invoiceId}?notice=${encodeURIComponent("Pembayaran dibalik.")}`);
}

export async function createClientAction(formData: FormData) {
  try {
    const user = await requireUser();
    await createClient(user, {
      fullName: String(formData.get("fullName") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      dateOfBirth: String(formData.get("dateOfBirth") ?? ""),
      consent: formData.get("consent") === "on",
    });
    refresh(["client"]);
  } catch (error) {
    bounce("/clients", error);
  }
  redirect("/clients?notice=" + encodeURIComponent("Klien terdaftar."));
}

export async function setClientActiveAction(formData: FormData) {
  try {
    const user = await requireUser();
    await setClientActive(user, String(formData.get("clientId") ?? ""), formData.get("isActive") === "true");
    refresh(["client"]);
  } catch (error) {
    bounce("/clients", error);
  }
  redirect("/clients");
}

export async function createServiceAction(formData: FormData) {
  try {
    const user = await requireUser();
    await createService(user, {
      code: String(formData.get("code") ?? ""),
      name: String(formData.get("name") ?? ""),
      durationMinutes: Number(formData.get("durationMinutes")),
      price: Number(formData.get("price")),
    });
    refresh(["catalog"]);
  } catch (error) {
    bounce("/services", error);
  }
  redirect("/services?notice=" + encodeURIComponent("Layanan ditambahkan."));
}

export async function updateServiceAction(formData: FormData) {
  try {
    const user = await requireUser();
    await updateService(user, {
      serviceId: String(formData.get("serviceId") ?? ""),
      code: String(formData.get("code") ?? ""),
      name: String(formData.get("name") ?? ""),
      durationMinutes: Number(formData.get("durationMinutes")),
      price: Number(formData.get("price")),
    });
    refresh(["catalog"]);
  } catch (error) {
    bounce("/services", error);
  }
  redirect("/services?notice=" + encodeURIComponent("Layanan diperbarui."));
}

export async function deleteServiceAction(formData: FormData) {
  try {
    const user = await requireUser();
    await deleteService(user, String(formData.get("serviceId") ?? ""));
    refresh(["catalog"]);
  } catch (error) {
    bounce("/services", error);
  }
  redirect("/services?notice=" + encodeURIComponent("Layanan dihapus."));
}

export async function createProductAction(formData: FormData) {
  try {
    const user = await requireUser();
    await createProduct(user, {
      name: String(formData.get("name") ?? ""),
      category: String(formData.get("category") ?? ""),
      sellPrice: Number(formData.get("sellPrice")),
      quantity: Number(formData.get("quantity") || 0),
      unit: String(formData.get("unit") ?? "pcs"),
    });
    refresh(["inventory"]);
  } catch (error) {
    bounce("/inventory", error);
  }
  redirect("/inventory?notice=" + encodeURIComponent("Produk ditambahkan."));
}

export async function updateProductAction(formData: FormData) {
  try {
    const user = await requireUser();
    await updateProduct(user, {
      productId: String(formData.get("productId") ?? ""),
      name: String(formData.get("name") ?? ""),
      category: String(formData.get("category") ?? ""),
      sellPrice: Number(formData.get("sellPrice")),
      unit: String(formData.get("unit") ?? "pcs"),
    });
    refresh(["inventory"]);
  } catch (error) {
    bounce("/inventory", error);
  }
  redirect("/inventory?notice=" + encodeURIComponent("Produk diperbarui."));
}

export async function deleteProductAction(formData: FormData) {
  try {
    const user = await requireUser();
    await deleteProduct(user, String(formData.get("productId") ?? ""));
    refresh(["inventory"]);
  } catch (error) {
    bounce("/inventory", error);
  }
  redirect("/inventory?notice=" + encodeURIComponent("Produk dihapus."));
}

export async function setServiceActiveAction(formData: FormData) {
  try {
    const user = await requireUser();
    await setServiceActive(user, String(formData.get("serviceId") ?? ""), formData.get("isActive") === "true");
    refresh(["catalog"]);
  } catch (error) {
    bounce("/services", error);
  }
  redirect("/services");
}

export async function receiveStockAction(formData: FormData) {
  try {
    const user = await requireUser();
    await receiveStock(user, {
      productId: String(formData.get("productId") ?? ""),
      quantity: Number(formData.get("quantity")),
      batchNumber: String(formData.get("batchNumber") ?? ""),
      expiryDate: String(formData.get("expiryDate") ?? ""),
      unitCost: Number(formData.get("unitCost") || 0),
    });
    refresh(["inventory"]);
  } catch (error) {
    bounce("/inventory", error);
  }
  redirect("/inventory?notice=" + encodeURIComponent("Stok diterima."));
}

export async function adjustStockAction(formData: FormData) {
  try {
    const user = await requireUser();
    const [productId, batchId = ""] = String(formData.get("target") ?? "").split("|");
    await adjustStock(user, {
      productId,
      batchId,
      quantity: Number(formData.get("quantity")),
      reason: String(formData.get("reason") ?? ""),
    });
    refresh(["inventory"]);
  } catch (error) {
    bounce("/inventory", error);
  }
  redirect("/inventory?notice=" + encodeURIComponent("Stok disesuaikan."));
}

const displayLineSchema = z.object({
  name: z.string().trim().min(1).max(120),
  quantity: z.number().int().positive().max(999),
  amount: z.number().int().min(-1_000_000_000).max(1_000_000_000),
});

const displayBillSchema = z.object({
  clientName: z.string().trim().min(1).max(120),
  lines: z.array(displayLineSchema).max(40),
  total: z.number().int().min(0).max(1_000_000_000),
  stamp: z.string().regex(/^\d{10,24}$/),
});

export async function publishCustomerDisplayAction(input: CustomerBill & { stamp: string }) {
  const user = await requireUser();
  if (!canBill(user)) return;
  const parsed = displayBillSchema.safeParse(input);
  if (!parsed.success) return;
  await publishCounterBill(parsed.data);
}

export async function clearCustomerDisplayAction(stamp: string) {
  const user = await requireUser();
  if (!canBill(user)) return;
  if (!/^\d{10,24}$/.test(stamp)) return;
  await clearCounterBill(stamp);
}

export async function updateEmployeeAction(formData: FormData) {
  try {
    const user = await requireUser();
    await updateEmployeeAccess(
      user,
      String(formData.get("employeeId") ?? ""),
      formData.getAll("roles").map(String),
      formData.get("isActive") === "on",
    );
    refresh(["employee"]);
  } catch (error) {
    bounce("/employees", error);
  }
  redirect("/employees?notice=" + encodeURIComponent("Akses karyawan diperbarui."));
}
