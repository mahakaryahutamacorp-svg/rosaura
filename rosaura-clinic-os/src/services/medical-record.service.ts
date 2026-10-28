import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { normalizeSearchText, rankBySmartSearch, smartSearchScore } from "@/lib/search";
import { dayKey, formatLongDate } from "@/lib/time";

export const MEDICAL_RECORD_PAGE_SIZE = 20;
const EXCERPT_LENGTH = 160;

const recordSelect = {
  id: true,
  visitDate: true,
  complaint: true,
  doctorNotes: true,
  skinType: true,
  moisture: true,
  acneStatus: true,
  acneArea: true,
  acneDegree: true,
  hyperpigmentationStatus: true,
  hyperpigmentationArea: true,
  hyperpigmentationDegree: true,
  wrinkleStatus: true,
  wrinkleArea: true,
  wrinkleDegree: true,
  scarStatus: true,
  scarType: true,
  allergyHistory: true,
  diseaseHistory: true,
  medicationHistory: true,
  lastTreatmentProduct: true,
  otherSkinConditions: true,
  contraception: true,
  pregnant: true,
  breastfeeding: true,
  client: { select: { id: true, fullName: true, clientCode: true } },
  _count: { select: { photos: true } },
} satisfies Prisma.SkinRecordSelect;

type RecordRow = Prisma.SkinRecordGetPayload<{ select: typeof recordSelect }>;

export interface MedicalRecordHit {
  id: string;
  visitDate: Date;
  clientId: string;
  clientName: string;
  clientCode: string;
  skinSummary: string;
  photoCount: number;
  excerptLabel: string;
  excerpt: string;
}

function finding(label: string, active: boolean, ...details: string[]) {
  const detail = details.filter(Boolean).join(", ");
  if (!active && !detail) return "";
  return detail ? `${label}: ${detail}` : label;
}

function findingsText(record: RecordRow) {
  return [
    finding("Jerawat", record.acneStatus, record.acneArea, record.acneDegree),
    finding("Hiperpigmentasi", record.hyperpigmentationStatus, record.hyperpigmentationArea, record.hyperpigmentationDegree),
    finding("Kerutan", record.wrinkleStatus, record.wrinkleArea, record.wrinkleDegree),
    finding("Bekas", record.scarStatus, record.scarType),
    record.pregnant ? "Hamil" : "",
    record.breastfeeding ? "Menyusui" : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Sinonim yang hanya dipakai untuk pencocokan, tidak ditampilkan. */
function findingAliases(record: RecordRow) {
  return [
    record.acneStatus ? "acne" : "",
    record.hyperpigmentationStatus ? "flek pigmentasi melasma" : "",
    record.wrinkleStatus ? "keriput wrinkle" : "",
    record.scarStatus ? "scar" : "",
  ].join(" ");
}

function labeledTexts(record: RecordRow) {
  return [
    { label: "Keluhan", value: record.complaint },
    { label: "Catatan dokter", value: record.doctorNotes },
    { label: "Temuan", value: findingsText(record) },
    { label: "Alergi", value: record.allergyHistory },
    { label: "Riwayat penyakit", value: record.diseaseHistory },
    { label: "Obat", value: record.medicationHistory },
    { label: "Produk terakhir", value: record.lastTreatmentProduct },
    { label: "Kondisi lain", value: record.otherSkinConditions },
    { label: "Kontrasepsi", value: record.contraception },
  ].filter((item) => item.value.trim());
}

function searchFields(record: RecordRow) {
  return [
    record.client.fullName,
    record.client.clientCode,
    record.skinType,
    record.moisture,
    formatLongDate(record.visitDate),
    dayKey(record.visitDate),
    findingAliases(record),
    ...labeledTexts(record).map((item) => item.value),
  ];
}

function cutAround(value: string, token: string) {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= EXCERPT_LENGTH) return text;
  const position = token ? text.toLowerCase().indexOf(token) : -1;
  const start = Math.max(0, position - Math.floor(EXCERPT_LENGTH / 3));
  const slice = text.slice(start, start + EXCERPT_LENGTH).trim();
  return `${start > 0 ? "…" : ""}${slice}${start + EXCERPT_LENGTH < text.length ? "…" : ""}`;
}

/** Potongan teks yang paling menjelaskan kenapa rekam ini cocok dengan kata kunci. */
function excerptFor(record: RecordRow, query: string) {
  const texts = labeledTexts(record);
  const tokens = normalizeSearchText(query).split(" ").filter(Boolean);
  for (const item of texts) {
    const token = tokens.find((candidate) => smartSearchScore(candidate, item.value) !== null);
    if (token) return { excerptLabel: item.label, excerpt: cutAround(item.value, token) };
  }
  const fallback = texts[0];
  return fallback ? { excerptLabel: fallback.label, excerpt: cutAround(fallback.value, "") } : { excerptLabel: "", excerpt: "" };
}

function toHit(record: RecordRow, query: string): MedicalRecordHit {
  return {
    id: record.id,
    visitDate: record.visitDate,
    clientId: record.client.id,
    clientName: record.client.fullName,
    clientCode: record.client.clientCode,
    skinSummary: [record.skinType, record.moisture].filter(Boolean).join(" · "),
    photoCount: record._count.photos,
    ...excerptFor(record, query),
  };
}

function safePageNumber(page: number) {
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

export async function searchMedicalRecords(query: string, page: number) {
  const term = query.trim().slice(0, 80);
  const orderBy: Prisma.SkinRecordOrderByWithRelationInput[] = [{ visitDate: "desc" }, { id: "asc" }];

  if (!term) {
    const total = await prisma.skinRecord.count();
    const pages = Math.max(1, Math.ceil(total / MEDICAL_RECORD_PAGE_SIZE));
    const safePage = Math.min(safePageNumber(page), pages);
    const rows = await prisma.skinRecord.findMany({
      select: recordSelect,
      orderBy,
      skip: (safePage - 1) * MEDICAL_RECORD_PAGE_SIZE,
      take: MEDICAL_RECORD_PAGE_SIZE,
    });
    return { total, page: safePage, pages, items: rows.map((row) => toHit(row, "")) };
  }

  const rows = await prisma.skinRecord.findMany({ select: recordSelect, orderBy });
  const ranked = rankBySmartSearch(rows, term, searchFields);
  const total = ranked.length;
  const pages = Math.max(1, Math.ceil(total / MEDICAL_RECORD_PAGE_SIZE));
  const safePage = Math.min(safePageNumber(page), pages);
  const items = ranked
    .slice((safePage - 1) * MEDICAL_RECORD_PAGE_SIZE, safePage * MEDICAL_RECORD_PAGE_SIZE)
    .map((row) => toHit(row, term));
  return { total, page: safePage, pages, items };
}
