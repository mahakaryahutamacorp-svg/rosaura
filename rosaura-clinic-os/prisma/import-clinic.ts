import { readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";

interface LegacyPatient {
  id: string;
  patient_id: string;
  full_name: string;
  phone: string;
  address: string;
  gender: string;
  birth_date: string;
  created: string;
}

interface LegacyRecord {
  id: string;
  patient: string;
  visit_date: string;
  created: string;
  complaint: string;
  doctor_notes: string;
  skin_type: string;
  moisture: string;
  acne_status: boolean;
  acne_area: string;
  acne_degree: string;
  hyperpigmentation_status: boolean;
  hyperpigmentation_area: string;
  hyperpigmentation_degree: string;
  wrinkle_status: boolean;
  wrinkle_area: string;
  wrinkle_degree: string;
  scar_status: boolean;
  scar_type: string;
  allergy_history: string;
  disease_history: string;
  medication_history: string;
  last_treatment_product: string;
  other_skin_conditions: string;
  contraception: string;
  pregnant: boolean;
  breastfeeding: boolean;
  photo_before: string;
  photo_after: string;
}

interface LegacyProduct {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  stock: number;
  created: string;
}

function readJson<T>(fileName: string): T[] {
  const filePath = path.join(process.cwd(), fileName);
  return JSON.parse(readFileSync(filePath, "utf8")) as T[];
}

function text(value: string | null | undefined) {
  return (value ?? "").trim();
}

function dateOrNull(value: string) {
  if (!value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function importClinicData(prisma: PrismaClient, actorUserId: string) {
  const patients = readJson<LegacyPatient>("435_patients_records.json");
  const records = readJson<LegacyRecord>("680_medical_records_records.json");
  const products = readJson<LegacyProduct>("135_products_records.json");

  await prisma.materialUsage.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.stockBatch.deleteMany();
  await prisma.product.deleteMany();
  await prisma.productCategory.deleteMany();
  await prisma.paymentReversal.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.clinicalPhoto.deleteMany();
  await rm(path.join(process.cwd(), "storage", "clinical-photos"), { recursive: true, force: true });
  await prisma.skinRecord.deleteMany();
  await prisma.visitNote.deleteMany();
  await prisma.visit.deleteMany();
  await prisma.bookingStatusHistory.deleteMany();
  await prisma.bookingAssignment.deleteMany();
  await prisma.bookingService.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.client.deleteMany();

  const knownPatients = new Set(patients.map((patient) => patient.id));
  const clientRows = patients.map((patient) => ({
    clientCode: text(patient.patient_id),
    fullName: text(patient.full_name) || "Tanpa nama",
    phone: text(patient.phone),
    address: text(patient.address),
    gender: text(patient.gender),
    externalId: patient.id,
    dateOfBirth: dateOrNull(patient.birth_date ?? ""),
    registeredAt: dateOrNull(patient.created) ?? new Date(),
    isActive: true,
  }));

  for (let index = 0; index < clientRows.length; index += 40) {
    await prisma.client.createMany({ data: clientRows.slice(index, index + 40) });
  }

  const clients = await prisma.client.findMany({ select: { id: true, externalId: true } });
  const clientByExternal = new Map(
    clients.flatMap((client) => (client.externalId ? [[client.externalId, client.id] as const] : [])),
  );

  const recordRows = records.flatMap((record) => {
    const clientId = clientByExternal.get(record.patient);
    if (!clientId || !knownPatients.has(record.patient)) return [];
    const visitDate = dateOrNull(record.visit_date) ?? dateOrNull(record.created) ?? new Date();
    return [
      {
        clientId,
        externalId: record.id,
        visitDate,
        complaint: text(record.complaint),
        doctorNotes: text(record.doctor_notes),
        skinType: text(record.skin_type),
        moisture: text(record.moisture),
        acneStatus: Boolean(record.acne_status),
        acneArea: text(record.acne_area),
        acneDegree: text(record.acne_degree),
        hyperpigmentationStatus: Boolean(record.hyperpigmentation_status),
        hyperpigmentationArea: text(record.hyperpigmentation_area),
        hyperpigmentationDegree: text(record.hyperpigmentation_degree),
        wrinkleStatus: Boolean(record.wrinkle_status),
        wrinkleArea: text(record.wrinkle_area),
        wrinkleDegree: text(record.wrinkle_degree),
        scarStatus: Boolean(record.scar_status),
        scarType: text(record.scar_type),
        allergyHistory: text(record.allergy_history),
        diseaseHistory: text(record.disease_history),
        medicationHistory: text(record.medication_history),
        lastTreatmentProduct: text(record.last_treatment_product),
        otherSkinConditions: text(record.other_skin_conditions),
        contraception: text(record.contraception),
        pregnant: Boolean(record.pregnant),
        breastfeeding: Boolean(record.breastfeeding),
        photoBefore: text(record.photo_before),
        photoAfter: text(record.photo_after),
        createdAt: dateOrNull(record.created) ?? visitDate,
      },
    ];
  });

  for (let index = 0; index < recordRows.length; index += 20) {
    await prisma.skinRecord.createMany({ data: recordRows.slice(index, index + 20) });
  }

  const categories = [...new Set(products.map((product) => text(product.category) || "Lainnya"))];
  const categoryByName = new Map<string, string>();
  for (const name of categories) {
    const category = await prisma.productCategory.create({ data: { name } });
    categoryByName.set(name, category.id);
  }

  for (const product of products) {
    const categoryName = text(product.category) || "Lainnya";
    const created = await prisma.product.create({
      data: {
        sku: product.id,
        name: text(product.name) || "Produk tanpa nama",
        categoryId: categoryByName.get(categoryName) ?? "",
        unit: "pcs",
        trackBatch: false,
        qtyOnHand: Math.max(0, Math.trunc(product.stock)),
        sellPrice: Math.max(0, Math.trunc(product.price)),
        description: text(product.description),
        externalId: product.id,
        minStock: 0,
      },
    });
    const quantity = Math.max(0, Math.trunc(product.stock));
    if (quantity > 0) {
      await prisma.stockMovement.create({
        data: {
          productId: created.id,
          movementType: "RECEIPT",
          quantity,
          createdById: actorUserId,
          reason: "Saldo awal dari arsip produk",
        },
      });
    }
  }

  return `Arsip klinik: ${clientRows.length} klien, ${recordRows.length} rekam kunjungan, ${products.length} produk.`;
}
