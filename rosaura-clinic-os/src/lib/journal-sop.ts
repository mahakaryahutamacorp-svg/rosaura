export const JOURNAL_PHASES = ["OPEN", "SHIFT", "CLOSE"] as const;

export type JournalPhase = (typeof JOURNAL_PHASES)[number];

export const phaseLabel: Record<JournalPhase, string> = {
  OPEN: "Pembukaan",
  SHIFT: "Selama layanan",
  CLOSE: "Penutupan",
};

export interface JournalTask {
  key: string;
  phase: JournalPhase;
  label: string;
}

export interface JournalPosition {
  key: string;
  label: string;
  tasks: JournalTask[];
}

export const JOURNAL_POSITIONS: JournalPosition[] = [
  {
    key: "ADMIN",
    label: "Admin",
    tasks: [
      { key: "lights", phase: "OPEN", label: "Nyalakan lampu, AC, musik, dan komputer kasir" },
      { key: "public-clean", phase: "OPEN", label: "Cek kebersihan resepsionis, ruang tunggu, dan toilet" },
      { key: "schedule", phase: "OPEN", label: "Buka jadwal booking hari ini dan siapkan daftar ruang treatment" },
      { key: "confirm", phase: "OPEN", label: "Konfirmasi kedatangan pasien lewat telepon atau WhatsApp" },
      { key: "cash", phase: "OPEN", label: "Cek kas kecil, mesin kasir, dan QRIS" },
      { key: "welcome", phase: "SHIFT", label: "Sambut pasien, verifikasi data, dan catat kedatangan" },
      { key: "queue", phase: "SHIFT", label: "Atur antrean serta koordinasikan dokter, perawat, dan terapis" },
      { key: "booking-pay", phase: "SHIFT", label: "Input booking, perubahan jadwal, pembatalan, dan pembayaran" },
      { key: "offer", phase: "SHIFT", label: "Tawarkan paket atau produk sesuai kebutuhan pasien" },
      { key: "complaint", phase: "SHIFT", label: "Catat komplain pasien dan tindak lanjutnya" },
      { key: "reconcile", phase: "CLOSE", label: "Rekap pembayaran tunai, transfer, dan QRIS, lalu cocokkan dengan kas fisik" },
      { key: "close-booking", phase: "CLOSE", label: "Tutup status booking yang selesai, batal, atau tidak datang" },
      { key: "handover", phase: "CLOSE", label: "Rapikan meja, matikan peralatan, kunci klinik, dan catat serah terima" },
    ],
  },
  {
    key: "DOCTOR",
    label: "Dokter",
    tasks: [
      { key: "review-chart", phase: "OPEN", label: "Tinjau jadwal konsultasi dan rekam medis pasien hari ini" },
      { key: "room-ready", phase: "OPEN", label: "Pastikan ruang dokter bersih dan alat pemeriksaan siap" },
      { key: "brief-nurse", phase: "OPEN", label: "Koordinasikan rencana tindakan dengan perawat" },
      { key: "exam", phase: "SHIFT", label: "Lakukan anamnesis dan pemeriksaan kulit" },
      { key: "chart", phase: "SHIFT", label: "Catat keluhan, temuan, diagnosis, dan rencana perawatan" },
      { key: "consent", phase: "SHIFT", label: "Jelaskan prosedur, manfaat, dan risiko, lalu minta persetujuan pasien" },
      { key: "plan", phase: "SHIFT", label: "Tentukan treatment, resep, atau produk yang sesuai" },
      { key: "supervise", phase: "SHIFT", label: "Supervisi tindakan yang dikerjakan perawat atau terapis" },
      { key: "follow-up", phase: "SHIFT", label: "Evaluasi hasil perawatan dan jadwalkan kontrol bila perlu" },
      { key: "incident", phase: "SHIFT", label: "Catat reaksi atau kejadian yang tidak diharapkan" },
      { key: "close-chart", phase: "CLOSE", label: "Lengkapi rekam medis yang belum tertutup" },
      { key: "handover", phase: "CLOSE", label: "Serahkan daftar pasien yang perlu follow-up ke admin" },
    ],
  },
  {
    key: "NURSE",
    label: "Perawat",
    tasks: [
      { key: "ppe", phase: "OPEN", label: "Cuci tangan dan siapkan APD" },
      { key: "trolley", phase: "OPEN", label: "Cek kelengkapan troli tindakan dan alat steril" },
      { key: "room", phase: "OPEN", label: "Siapkan ruang tindakan sesuai jadwal" },
      { key: "stock", phase: "OPEN", label: "Cek stok bahan habis pakai dan laporkan yang menipis" },
      { key: "identity", phase: "SHIFT", label: "Verifikasi identitas pasien dan kontraindikasi sebelum tindakan" },
      { key: "assist", phase: "SHIFT", label: "Dampingi dokter saat konsultasi dan tindakan" },
      { key: "procedure", phase: "SHIFT", label: "Kerjakan tindakan sesuai instruksi dan protokol dokter" },
      { key: "record", phase: "SHIFT", label: "Catat bahan, dosis, dan area yang dikerjakan" },
      { key: "observe", phase: "SHIFT", label: "Observasi pasien setelah tindakan dan edukasi perawatan di rumah" },
      { key: "waste", phase: "SHIFT", label: "Sterilkan alat dan buang limbah medis sesuai jenisnya" },
      { key: "tidy", phase: "CLOSE", label: "Rapikan dan bersihkan ruang tindakan" },
      { key: "handover", phase: "CLOSE", label: "Serah terima pasien atau alat yang masih perlu perhatian" },
    ],
  },
  {
    key: "THERAPIST",
    label: "Terapis",
    tasks: [
      { key: "schedule", phase: "OPEN", label: "Cek jadwal treatment dan catatan perawatan pasien" },
      { key: "room", phase: "OPEN", label: "Siapkan ruang: suhu, musik, handuk, dan linen bersih" },
      { key: "products", phase: "OPEN", label: "Siapkan produk sesuai protokol treatment hari ini" },
      { key: "hands", phase: "SHIFT", label: "Cuci tangan sebelum setiap pasien" },
      { key: "consult", phase: "SHIFT", label: "Konfirmasi keluhan, alergi, dan area yang tidak boleh dikerjakan" },
      { key: "treatment", phase: "SHIFT", label: "Lakukan treatment sesuai protokol dan durasi yang dijadwalkan" },
      { key: "card", phase: "SHIFT", label: "Catat produk yang dipakai pada kartu perawatan" },
      { key: "reaction", phase: "SHIFT", label: "Hentikan treatment jika ada reaksi kulit dan laporkan ke perawat atau dokter" },
      { key: "home-care", phase: "SHIFT", label: "Edukasi perawatan di rumah secara singkat" },
      { key: "linen", phase: "SHIFT", label: "Ganti linen dan rapikan ruang setelah setiap pasien" },
      { key: "tidy", phase: "CLOSE", label: "Bersihkan alat, rapikan produk, dan kumpulkan linen kotor" },
      { key: "restock", phase: "CLOSE", label: "Laporkan produk yang hampir habis ke admin" },
    ],
  },
  {
    key: "CLEANING",
    label: "Cleaning service",
    tasks: [
      { key: "floor", phase: "OPEN", label: "Sapu dan pel lantai resepsionis, ruang tunggu, dan koridor" },
      { key: "surfaces", phase: "OPEN", label: "Bersihkan meja, kaca, dan cermin area publik" },
      { key: "toilet", phase: "OPEN", label: "Bersihkan toilet serta isi sabun, tisu, dan pewangi" },
      { key: "trash", phase: "OPEN", label: "Kosongkan tempat sampah umum dan cek stok alat kebersihan" },
      { key: "between", phase: "SHIFT", label: "Bersihkan ruang treatment setelah pasien selesai" },
      { key: "linen", phase: "SHIFT", label: "Kumpulkan handuk dan seprai kotor" },
      { key: "toilet-round", phase: "SHIFT", label: "Bersihkan toilet secara berkala" },
      { key: "waiting", phase: "SHIFT", label: "Rapikan ruang tunggu" },
      { key: "damage", phase: "SHIFT", label: "Laporkan kerusakan fasilitas ke admin" },
      { key: "rooms", phase: "CLOSE", label: "Bersihkan seluruh ruang treatment dan ruang dokter" },
      { key: "mop", phase: "CLOSE", label: "Pel lantai seluruh klinik dan pisahkan sampah umum dari limbah medis" },
      { key: "laundry", phase: "CLOSE", label: "Kumpulkan linen kotor untuk laundry, lalu matikan lampu ruangan yang sudah bersih" },
    ],
  },
];

const positionByKey = new Map(JOURNAL_POSITIONS.map((position) => [position.key, position]));

export function journalPosition(key: string) {
  return positionByKey.get(key);
}

export function allowedTaskKeys(positionKey: string) {
  const position = journalPosition(positionKey);
  return new Set(position?.tasks.map((task) => task.key) ?? []);
}
