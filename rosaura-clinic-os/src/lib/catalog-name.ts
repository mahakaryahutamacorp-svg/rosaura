export function normalizeCatalogName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function preferDisplayName(current: string, next: string) {
  const score = (value: string) => (value.match(/[A-Z]/g) ?? []).length;
  const left = current.trim();
  const right = next.trim();
  return score(right) > score(left) ? right : left;
}
