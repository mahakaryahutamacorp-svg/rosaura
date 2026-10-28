export type SearchField = string | null | undefined;

interface PreparedField {
  text: string;
  words: string[];
  initials: string;
  digits: string;
}

const SCORE = {
  exactField: 100,
  fieldPrefix: 80,
  exactWord: 70,
  wordPrefix: 50,
  digits: 40,
  contains: 30,
  initials: 20,
  fuzzyWord: 15,
  fuzzyPrefix: 10,
  phrase: 25,
} as const;

const MAX_INITIALS_WORDS = 8;

export function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function prepareField(value: string): PreparedField | null {
  const text = normalizeSearchText(value);
  if (!text) return null;
  const words = text.split(" ");
  const initials = words.length <= MAX_INITIALS_WORDS ? words.map((word) => word[0] ?? "").join("") : "";
  return { text, words, initials, digits: value.replace(/\D/g, "") };
}

function phoneVariants(token: string) {
  if (token.startsWith("62") && token.length > 4) return [token, `0${token.slice(2)}`];
  return [token];
}

/** Levenshtein dengan batas: berhenti lebih awal begitu jarak pasti melebihi `limit`. */
function withinEditDistance(left: string, right: string, limit: number) {
  if (Math.abs(left.length - right.length) > limit) return false;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    let rowMinimum = row;
    for (let column = 1; column <= right.length; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      const value = Math.min(previous[column] + 1, current[column - 1] + 1, previous[column - 1] + cost);
      current.push(value);
      rowMinimum = Math.min(rowMinimum, value);
    }
    if (rowMinimum > limit) return false;
    previous = current;
  }
  return previous[right.length] <= limit;
}

function typoLimit(token: string) {
  if (token.length >= 7) return 2;
  if (token.length >= 4) return 1;
  return 0;
}

function scoreToken(token: string, field: PreparedField) {
  if (field.text === token) return SCORE.exactField;
  if (field.text.startsWith(token)) return SCORE.fieldPrefix;
  if (field.words.includes(token)) return SCORE.exactWord;
  if (field.words.some((word) => word.startsWith(token))) return SCORE.wordPrefix;
  if (/^\d{3,}$/.test(token) && phoneVariants(token).some((variant) => field.digits.includes(variant))) {
    return SCORE.digits;
  }
  if (field.text.includes(token)) return SCORE.contains;
  if (token.length >= 2 && field.initials.startsWith(token)) return SCORE.initials;

  const limit = typoLimit(token);
  if (limit === 0 || /\d/.test(token)) return 0;
  if (field.words.some((word) => withinEditDistance(token, word, limit))) return SCORE.fuzzyWord;
  if (field.words.some((word) => word.length > token.length && withinEditDistance(token, word.slice(0, token.length), 1))) {
    return SCORE.fuzzyPrefix;
  }
  return 0;
}

/**
 * Skor pencarian cerdas: setiap kata kunci harus cocok di salah satu kolom
 * (urutan bebas), boleh berupa awalan, singkatan inisial, potongan nomor
 * telepon, atau salah ketik ringan. `null` berarti tidak cocok.
 */
export function smartSearchScore(query: string, ...fields: SearchField[]) {
  const phrase = normalizeSearchText(query);
  if (!phrase) return 0;
  const prepared = fields.flatMap((field) => {
    const item = field ? prepareField(field) : null;
    return item ? [item] : [];
  });
  if (prepared.length === 0) return null;

  let score = 0;
  for (const token of phrase.split(" ")) {
    let best = 0;
    for (const field of prepared) {
      best = Math.max(best, scoreToken(token, field));
      if (best === SCORE.exactField) break;
    }
    if (best === 0) return null;
    score += best;
  }

  if (phrase.includes(" ") && prepared.some((field) => field.text.includes(phrase))) score += SCORE.phrase;
  return score;
}

export function matchesSmartSearch(query: string, ...fields: SearchField[]) {
  return smartSearchScore(query, ...fields) !== null;
}

/**
 * Menyaring dan mengurutkan data dari skor tertinggi. Urutan asli dipakai
 * sebagai penentu bila skornya sama, jadi kirim data yang sudah terurut.
 */
export function rankBySmartSearch<T>(items: T[], query: string, fields: (item: T) => SearchField[]) {
  if (!normalizeSearchText(query)) return items;
  return items
    .map((item, index) => ({ item, index, score: smartSearchScore(query, ...fields(item)) }))
    .filter((entry): entry is { item: T; index: number; score: number } => entry.score !== null)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((entry) => entry.item);
}
