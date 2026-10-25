import { readFileSync, writeFileSync } from "node:fs";

const schemaPath = "prisma/schema.prisma";

function loadLocalEnv() {
  if (process.env.DATABASE_URL) return;
  let text = "";
  try {
    text = readFileSync(".env", "utf8");
  } catch {
    return;
  }
  for (const line of text.split(/\n/)) {
    const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

function widenLongText(schema) {
  const fields = [
    "address",
    "notes",
    "note",
    "complaint",
    "workDone",
    "materialsNote",
    "descriptionSnapshot",
    "reason",
    "description",
    "doctorNotes",
    "allergyHistory",
    "diseaseHistory",
    "medicationHistory",
    "lastTreatmentProduct",
    "otherSkinConditions",
    "contraception",
    "acneArea",
    "hyperpigmentationArea",
    "wrinkleArea",
    "scarType",
    "summary",
    "caption",
    "linesJson",
  ].join("|");
  return schema.replace(
    new RegExp(`^(\\s+)(${fields})(\\s+String\\??(?:\\s+@default\\([^)]*\\))?)(?!\\s+@db\\.Text)(\\s*)$`, "gm"),
    "$1$2$3 @db.Text$4",
  );
}

loadLocalEnv();
const databaseUrl = process.env.DATABASE_URL ?? "";
if (!databaseUrl.startsWith("mysql://")) {
  console.log("Database lokal tetap SQLite.");
} else {
  const current = readFileSync(schemaPath, "utf8");
  const widened = widenLongText(current.replace(/provider\s*=\s*"sqlite"/, 'provider = "mysql"'));
  const next = widened.replace(
    /^(\s+linesJson\s+String\s+@default\("\[\]"\))(?!\s+@db\.Text)/m,
    "$1 @db.Text",
  );
  if (next !== current) writeFileSync(schemaPath, next);
  console.log("Skema disiapkan untuk MySQL.");
}
