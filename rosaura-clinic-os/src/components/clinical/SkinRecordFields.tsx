import { MOISTURE_LEVELS, SEVERITY_LEVELS, SKIN_TYPES, type SkinRecordValues } from "@/lib/skin-record";
import { fieldClass, labelClass } from "@/lib/styles";

const textareaClass = `${fieldClass} h-20 py-2`;

function Choice({ name, label, options, value }: { name: string; label: string; options: string[]; value: string }) {
  const choices = value && !options.includes(value) ? [value, ...options] : options;
  return (
    <label>
      <span className={labelClass}>{label}</span>
      <select className={fieldClass} name={name} defaultValue={value}>
        <option value="">-</option>
        {choices.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function Text({ name, label, value, placeholder }: { name: string; label: string; value: string; placeholder?: string }) {
  return (
    <label>
      <span className={labelClass}>{label}</span>
      <input className={fieldClass} name={name} defaultValue={value} placeholder={placeholder} maxLength={2000} />
    </label>
  );
}

function LongText({ name, label, value, placeholder }: { name: string; label: string; value: string; placeholder?: string }) {
  return (
    <label>
      <span className={labelClass}>{label}</span>
      <textarea className={textareaClass} name={name} defaultValue={value} placeholder={placeholder} maxLength={2000} />
    </label>
  );
}

function Flag({ name, label, checked }: { name: string; label: string; checked: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm font-medium text-brown">
      <input className="h-4 w-4 accent-gold" type="checkbox" name={name} defaultChecked={checked} />
      {label}
    </label>
  );
}

function Finding({
  label,
  flag,
  area,
  degree,
  values,
}: {
  label: string;
  flag: "acneStatus" | "hyperpigmentationStatus" | "wrinkleStatus";
  area: "acneArea" | "hyperpigmentationArea" | "wrinkleArea";
  degree: "acneDegree" | "hyperpigmentationDegree" | "wrinkleDegree";
  values?: SkinRecordValues;
}) {
  return (
    <div className="grid gap-3 rounded-2xl border border-line/80 p-3 sm:grid-cols-[140px_1fr_160px] sm:items-end">
      <Flag name={flag} label={label} checked={values?.[flag] ?? false} />
      <Text name={area} label="Area" value={values?.[area] ?? ""} placeholder="Pipi, dahi, dagu" />
      <Choice name={degree} label="Tingkat" options={SEVERITY_LEVELS} value={values?.[degree] ?? ""} />
    </div>
  );
}

export function SkinRecordFields({ values }: { values?: SkinRecordValues }) {
  return (
    <div className="space-y-5">
      <fieldset className="grid gap-3 md:grid-cols-2">
        <legend className="mb-2 text-xs font-semibold tracking-[0.14em] text-muted uppercase">Anamnesis</legend>
        <LongText name="complaint" label="Keluhan" value={values?.complaint ?? ""} placeholder="Keluhan utama pasien" />
        <LongText
          name="doctorNotes"
          label="Catatan dokter / tindakan"
          value={values?.doctorNotes ?? ""}
          placeholder="Diagnosis, tindakan, resep, rencana kontrol"
        />
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-2 text-xs font-semibold tracking-[0.14em] text-muted uppercase">Pemeriksaan kulit</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Choice name="skinType" label="Tipe kulit" options={SKIN_TYPES} value={values?.skinType ?? ""} />
          <Choice name="moisture" label="Kelembapan" options={MOISTURE_LEVELS} value={values?.moisture ?? ""} />
        </div>
        <Finding label="Jerawat" flag="acneStatus" area="acneArea" degree="acneDegree" values={values} />
        <Finding
          label="Hiperpigmentasi"
          flag="hyperpigmentationStatus"
          area="hyperpigmentationArea"
          degree="hyperpigmentationDegree"
          values={values}
        />
        <Finding label="Kerutan" flag="wrinkleStatus" area="wrinkleArea" degree="wrinkleDegree" values={values} />
        <div className="grid gap-3 rounded-2xl border border-line/80 p-3 sm:grid-cols-[140px_1fr] sm:items-end">
          <Flag name="scarStatus" label="Bekas jerawat" checked={values?.scarStatus ?? false} />
          <Text name="scarType" label="Jenis bekas" value={values?.scarType ?? ""} placeholder="Ice pick, box, rolling" />
        </div>
        <Text
          name="otherSkinConditions"
          label="Kondisi kulit lain"
          value={values?.otherSkinConditions ?? ""}
          placeholder="Pori besar, kemerahan, dll."
        />
      </fieldset>

      <fieldset className="grid gap-3 md:grid-cols-2">
        <legend className="mb-2 text-xs font-semibold tracking-[0.14em] text-muted uppercase">Riwayat</legend>
        <Text name="allergyHistory" label="Alergi" value={values?.allergyHistory ?? ""} placeholder="Obat, kosmetik, makanan" />
        <Text name="diseaseHistory" label="Riwayat penyakit" value={values?.diseaseHistory ?? ""} />
        <Text name="medicationHistory" label="Obat yang sedang dipakai" value={values?.medicationHistory ?? ""} />
        <Text
          name="lastTreatmentProduct"
          label="Produk / treatment terakhir"
          value={values?.lastTreatmentProduct ?? ""}
          placeholder="Facial wash, sunscreen, cream malam"
        />
        <Text name="contraception" label="Kontrasepsi" value={values?.contraception ?? ""} />
        <div className="flex flex-wrap items-end gap-5 pb-3">
          <Flag name="pregnant" label="Hamil" checked={values?.pregnant ?? false} />
          <Flag name="breastfeeding" label="Menyusui" checked={values?.breastfeeding ?? false} />
        </div>
      </fieldset>
    </div>
  );
}
