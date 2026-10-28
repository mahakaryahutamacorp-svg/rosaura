import { smartSearchScore, rankBySmartSearch } from "./src/lib/search";
const cases: Array<[string, string[]]> = [
  ["siti ayu", ["Siti Nur Ayu", "CL-0001"]],
  ["ayu siti", ["Siti Nur Ayu"]],
  ["snа", ["Siti Nur Ayu"]],
  ["sna", ["Siti Nur Ayu"]],
  ["jarawat", ["Jerawat acne pipi"]],
  ["niacinamid", ["Serum Niacinamide 10%"]],
  ["seurm", ["Serum Niacinamide"]],
  ["0812345", ["0812-3456-789"]],
  ["62812345", ["0812-3456-789"]],
  ["cl-0001", ["Siti", "CL-0001"]],
  ["xyz", ["Siti Nur Ayu"]],
  ["ab", ["lorem ipsum ".repeat(30) + "a b"]],
];
for (const [q, f] of cases) console.log(JSON.stringify(q), "=>", smartSearchScore(q, ...f));
console.log(rankBySmartSearch(["Serum Vit C", "Sunscreen", "Serum Niacinamide", "Toner"], "serum nia", (x) => [x]));
