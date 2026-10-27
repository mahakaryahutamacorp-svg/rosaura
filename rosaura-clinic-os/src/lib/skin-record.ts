export const SKIN_TYPES = ["Normal", "Dry", "Oily", "Kombinasi", "Sensitive"];
export const MOISTURE_LEVELS = ["Kurang", "Cukup", "Baik"];
export const SEVERITY_LEVELS = ["Ringan", "Sedang", "Berat"];

export const SKIN_TEXT_FIELDS = [
  "complaint",
  "doctorNotes",
  "skinType",
  "moisture",
  "acneArea",
  "acneDegree",
  "hyperpigmentationArea",
  "hyperpigmentationDegree",
  "wrinkleArea",
  "wrinkleDegree",
  "scarType",
  "allergyHistory",
  "diseaseHistory",
  "medicationHistory",
  "lastTreatmentProduct",
  "otherSkinConditions",
  "contraception",
] as const;

export const SKIN_FLAG_FIELDS = [
  "acneStatus",
  "hyperpigmentationStatus",
  "wrinkleStatus",
  "scarStatus",
  "pregnant",
  "breastfeeding",
] as const;

export type SkinTextField = (typeof SKIN_TEXT_FIELDS)[number];
export type SkinFlagField = (typeof SKIN_FLAG_FIELDS)[number];
export type SkinRecordValues = Record<SkinTextField, string> & Record<SkinFlagField, boolean>;

export function skinRecordFromForm(formData: FormData): SkinRecordValues {
  const values = {} as SkinRecordValues;
  for (const field of SKIN_TEXT_FIELDS) {
    values[field] = String(formData.get(field) ?? "").trim().slice(0, 2000);
  }
  for (const field of SKIN_FLAG_FIELDS) {
    values[field] = formData.get(field) === "on";
  }
  return values;
}

export function hasClinicalContent(values: SkinRecordValues) {
  return SKIN_TEXT_FIELDS.some((field) => values[field]) || SKIN_FLAG_FIELDS.some((field) => values[field]);
}
