import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

if (!process.env.DATABASE_URL) {
  try {
    const text = readFileSync(".env", "utf8");
    for (const line of text.split(/\n/)) {
      const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // Hostinger memasang variabelnya sendiri.
  }
}

if ((process.env.DATABASE_URL ?? "").startsWith("mysql://")) {
  execSync("npx prisma db push --skip-generate", { stdio: "inherit" });
}
