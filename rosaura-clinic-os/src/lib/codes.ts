/**
 * Membuat kode berurutan (CL-0001, INV-0001, ...) yang tidak bentrok.
 * Penghitung berbasis count() bisa menghasilkan kode ganda bila ada data yang
 * dihapus/diimpor atau dua permintaan berjalan bersamaan. Di sini setiap
 * kandidat diperiksa dulu; bila terus bentrok dipakai penanda waktu yang unik.
 * Batas unique di database tetap menjadi pengaman terakhir.
 */
export async function nextCode(
  prefix: string,
  currentCount: number,
  exists: (code: string) => Promise<boolean>,
) {
  let number = currentCount + 1;
  for (let attempt = 0; attempt < 25; attempt += 1, number += 1) {
    const code = `${prefix}-${String(number).padStart(4, "0")}`;
    if (!(await exists(code))) return code;
  }
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}
