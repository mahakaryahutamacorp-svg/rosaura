import { normalizeCatalogName } from "@/lib/catalog-name";

export function smartSearchScore(query: string, ...fields: Array<string | null | undefined>) {
  const term = normalizeCatalogName(query);
  const haystack = normalizeCatalogName(fields.filter(Boolean).join(" "));
  if (!term) return 0;
  if (!haystack) return null;

  const words = haystack.split(" ");
  const initials = words.map((word) => word[0] ?? "").join("");
  let score = 0;

  for (const token of term.split(" ")) {
    if (haystack === token) {
      score += 100;
      continue;
    }
    if (haystack.startsWith(token)) {
      score += 80;
      continue;
    }
    if (words.some((word) => word === token)) {
      score += 70;
      continue;
    }
    if (words.some((word) => word.startsWith(token))) {
      score += 50;
      continue;
    }
    if (haystack.includes(token)) {
      score += 30;
      continue;
    }
    if (initials.startsWith(token) || (token.length >= 2 && initials.includes(token))) {
      score += 20;
      continue;
    }
    return null;
  }

  return score;
}

export function matchesSmartSearch(query: string, ...fields: Array<string | null | undefined>) {
  return smartSearchScore(query, ...fields) !== null;
}
