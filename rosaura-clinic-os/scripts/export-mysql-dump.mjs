import { DatabaseSync } from "node:sqlite";
import { writeFileSync } from "node:fs";

const textFields = new Set([
  "Client.address",
  "Booking.notes",
  "BookingStatusHistory.note",
  "VisitNote.complaint",
  "VisitNote.workDone",
  "VisitNote.materialsNote",
  "InvoiceItem.descriptionSnapshot",
  "StockMovement.reason",
  "Product.description",
  "PaymentReversal.reason",
  "SkinRecord.complaint",
  "SkinRecord.doctorNotes",
  "SkinRecord.allergyHistory",
  "SkinRecord.diseaseHistory",
  "SkinRecord.medicationHistory",
  "SkinRecord.lastTreatmentProduct",
  "SkinRecord.otherSkinConditions",
  "SkinRecord.contraception",
  "SkinRecord.acneArea",
  "SkinRecord.hyperpigmentationArea",
  "SkinRecord.wrinkleArea",
  "SkinRecord.scarType",
  "ClinicalPhoto.caption",
  "AuditLog.summary",
]);

const insertOrder = [
  "Role",
  "Employee",
  "User",
  "EmployeeRole",
  "Client",
  "Service",
  "Room",
  "ProductCategory",
  "Product",
  "StockBatch",
  "Booking",
  "BookingService",
  "BookingAssignment",
  "BookingStatusHistory",
  "Visit",
  "VisitNote",
  "Invoice",
  "InvoiceItem",
  "Payment",
  "PaymentReversal",
  "StockMovement",
  "MaterialUsage",
  "SkinRecord",
  "ClinicalPhoto",
  "DisplayPromo",
  "AuditLog",
];

function sqlString(value) {
  return `'${String(value).replace(/\\/g, "\\\\").replace(/'/g, "''").replace(/\u0000/g, "")}'`;
}

function sqlValue(value, columnType) {
  if (value === null || value === undefined) return "NULL";
  if (columnType === "BOOLEAN") {
    if (value === true || value === 1 || value === "1" || value === "true") return "1";
    return "0";
  }
  if (columnType === "INTEGER" || columnType === "INT") return String(Number(value));
  if (columnType === "DATETIME") {
    if (typeof value === "number" || /^\d+$/.test(String(value))) {
      const formatted = new Date(Number(value)).toISOString().replace("T", " ").replace("Z", "");
      return sqlString(formatted);
    }
    const text = String(value).replace("T", " ").replace("Z", "");
    const normalized = text.length === 19 ? `${text}.000` : text;
    return sqlString(normalized);
  }
  return sqlString(value);
}

function mysqlDefault(raw) {
  if (raw === null) return "";
  const text = String(raw);
  if (text === "true") return " DEFAULT 1";
  if (text === "false") return " DEFAULT 0";
  if (text === "CURRENT_TIMESTAMP") return " DEFAULT CURRENT_TIMESTAMP(3)";
  if (/^-?\d+$/.test(text)) return ` DEFAULT ${text}`;
  return ` DEFAULT ${sqlString(text.replace(/^'|'$/g, ""))}`;
}

function mysqlType(table, column, sqliteType, maxLength) {
  if (textFields.has(`${table}.${column}`)) return "TEXT";
  if (sqliteType === "DATETIME") return "DATETIME(3)";
  if (sqliteType === "BOOLEAN") return "TINYINT(1)";
  if (sqliteType === "INTEGER" || sqliteType === "INT") return "INT";
  const length = Math.max(191, maxLength);
  return `VARCHAR(${length})`;
}

const db = new DatabaseSync("prisma/dev.db", { readOnly: true });
const existing = new Set(
  db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%'",
    )
    .all()
    .map((row) => row.name),
);

const lines = [
  "-- Rosaura Clinic OS — impor manual ke MySQL Hostinger (u451393082_Rosabk9).",
  "-- phpMyAdmin: pilih database, tab Impor, berkas ini, format SQL.",
  "SET NAMES utf8mb4;",
  "SET FOREIGN_KEY_CHECKS = 0;",
  "SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';",
  "",
];

const counts = [];

for (const table of insertOrder) {
  if (!existing.has(table)) continue;
  const columns = db.prepare(`PRAGMA table_info("${table}")`).all();
  const indexes = db.prepare(`PRAGMA index_list("${table}")`).all();
  const indexColumns = new Map();
  for (const index of indexes) {
    const cols = db
      .prepare(`PRAGMA index_info("${index.name}")`)
      .all()
      .map((column) => column.name);
    indexColumns.set(index.name, { unique: index.unique === 1, columns: cols, origin: index.origin });
  }

  const lengths = {};
  for (const column of columns) {
    const row = db
      .prepare(`SELECT MAX(LENGTH("${column.name}")) AS length FROM "${table}"`)
      .get();
    lengths[column.name] = Number(row.length ?? 0);
    if (lengths[column.name] > 191 && !textFields.has(`${table}.${column.name}`)) {
      console.log(`panjang ${table}.${column.name}: ${lengths[column.name]}`);
    }
  }

  const columnSql = columns
    .map((column) => {
      const type = mysqlType(table, column.name, column.type, lengths[column.name]);
      const notNull = column.notnull === 1 ? " NOT NULL" : " NULL";
      const defaultSql = column.pk > 0 ? "" : mysqlDefault(column.dflt_value);
      return `  \`${column.name}\` ${type}${notNull}${defaultSql}`;
    })
    .join(",\n");

  const primary = columns.filter((column) => column.pk > 0).sort((a, b) => a.pk - b.pk);
  const keys = [];
  keys[0] = `  PRIMARY KEY (${primary.map((column) => `\`${column.name}\``).join(", ")})`;

  for (const [name, index] of indexColumns) {
    if (index.origin === "pk") continue;
    const quoted = index.columns.map((column) => `\`${column}\``).join(", ");
    keys.push(`  ${index.unique ? "UNIQUE KEY" : "KEY"} \`${name}\` (${quoted})`);
  }

  lines.push(`DROP TABLE IF EXISTS \`${table}\`;`);
  lines.push(`CREATE TABLE \`${table}\` (`);
  lines.push(`${columnSql},\n${keys.join(",\n")}`);
  lines.push(") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");
  lines.push("");

  const rows = db.prepare(`SELECT * FROM "${table}"`).all();
  counts.push(`${table}: ${rows.length}`);
  if (rows.length === 0) continue;

  const names = columns.map((column) => `\`${column.name}\``).join(", ");
  const types = Object.fromEntries(columns.map((column) => [column.name, column.type]));
  const batchSize = 100;
  for (let offset = 0; offset < rows.length; offset += batchSize) {
    const batch = rows.slice(offset, offset + batchSize);
    const values = batch
      .map((row) => `(${columns.map((column) => sqlValue(row[column.name], types[column.name])).join(", ")})`)
      .join(",\n");
    lines.push(`INSERT INTO \`${table}\` (${names}) VALUES\n${values};`);
  }
  lines.push("");
}

lines.push("SET FOREIGN_KEY_CHECKS = 1;");
lines.push("");

const outputPath = "prisma/hostinger-import.sql";
writeFileSync(outputPath, lines.join("\n"), "utf8");
console.log(outputPath);
for (const count of counts) console.log(count);
