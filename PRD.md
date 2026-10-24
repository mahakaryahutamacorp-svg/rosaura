# Rosaura Clinic OS

Spesifikasi ini mengunci ruang lingkup V1. Coding fitur dan migrasi database tidak dimulai sebelum spike hosting di bagian 12 berstatus lulus.

## 1. Ringkasan

Rosaura Clinic OS adalah aplikasi internal untuk satu klinik kecantikan. V1 menutup satu hari operasional: klien dibooking tanpa bentrok, kunjungan selesai tercatat, tagihan dibayar, dan owner melihat uang masuk hari itu.

Tujuan V1:

- Mencegah dua booking aktif pada petugas atau ruangan yang sama.
- Menyimpan profil klien dan satu catatan per kunjungan selesai.
- Menghitung uang masuk dari pembayaran yang tersimpan, bukan dari angka di tampilan.
- Menjadi fondasi yang masih bisa ditambah stok batch, rekam medis medis, dan laporan tanpa mengubah transaksi lama.

## 2. Keputusan terkunci

### 2.1 Jenis fasilitas

V1 dibangun untuk **satu klinik kecantikan non-medis**: facial, treatment, dan penjualan layanan di meja depan. Tidak ada modul diagnosa, kode diagnosa, atau rekam medis rumah sakit di build default.

Catatan kunjungan operasional tetap ada di V1 karena setiap kunjungan selesai harus punya booking, catatan, dan tagihan. Isinya keluhan singkat, layanan yang dikerjakan, bahan yang dipakai, dan rencana kontrol. Ini catatan operasional, bukan rekam medis.

**Jalur medis tidak masuk build default.** Jalur itu diaktifkan hanya jika pemilik mengonfirmasi ada tindakan medis (dokter, injeksi, laser medis, atau tindakan setara). Jika diaktifkan, yang masuk sebelum go-live klinis hanya:

- finalisasi catatan dan koreksi dengan alasan, waktu, dan pengguna;
- persetujuan tindakan, terpisah dari persetujuan pengolahan data;
- akses catatan klinis terpisah dari akses keuangan.

Foto sebelum/sesudah, kode diagnosa, dan galeri klinis tetap di luar V1, termasuk pada jalur medis.

### 2.2 Uang masuk dan piutang

Headline dashboard owner adalah **uang masuk**: jumlah pembayaran berstatus berhasil pada periode tersebut, dikurangi pembalikan yang sudah tercatat. Tagihan yang belum lunas adalah **piutang**, bukan omzet.

Tagihan, pembayaran, pembalikan, dan pengeluaran adalah entitas berbeda. Pengeluaran tidak masuk V1. Nilai persediaan tidak dihitung di V1, dan metode valuasi belum dikunci.

### 2.3 Hosting

Hasil spike pada 24 Oktober 2026: **belum lulus**.

Workspace produksi belum terhubung ke paket Hostinger. Pratinjau yang bisa dijalankan di komputer ini ada di folder `rosaura-clinic-os`, memakai SQLite, dan tidak menggantikan spike hosting. Gerbang production tetap tertutup.

Konsekuensi yang terkunci:

- Skema produksi dan deployment ke Hostinger tetap tertutup sampai checklist bagian 12 lulus. Pratinjau lokal tidak memakai paket hosting itu.
- Jika spike gagal, aplikasi dipindahkan ke host dengan runtime Node.js yang sesuai. MySQL dipakai hanya jika runtime itu dapat mengakses database dengan stabil. Domain boleh tetap di Hostinger.
- Foto klien tidak disimpan di disk shared hosting. Modul foto belum masuk V1. Saat modul itu dibangun, file berada di penyimpanan objek privat dan MySQL hanya menyimpan referensinya.

## 3. Alur V1

```text
Klien → Booking → Check-in → Catatan kunjungan → Tagihan → Pembayaran → Uang masuk hari ini
```

Rilis operasional (go-live) adalah alur di atas. Stok batch untuk SKU kedaluwarsa atau bernilai tinggi menyusul pada rilis berikutnya, sebelum kedalaman rekam medis dan modul ERP. Go-live tidak menunggu stock opname. Sampai stok batch ada, opname tetap di buku cadangan.

## 4. Yang masuk V1

### 4.1 Login dan empat preset role

Role V1: Owner, Front Office, Klinis, dan Gudang. Satu orang boleh memegang lebih dari satu preset. Editor izin per tindakan tidak dibuat. Preset di-seed dan hanya Owner yang menautkan preset ke karyawan.

| Kemampuan | Owner | Front Office | Klinis | Gudang |
| --- | --- | --- | --- | --- |
| Dashboard uang masuk | Ya | Tidak | Tidak | Tidak |
| Booking semua petugas | Ya | Ya | Jadwal sendiri | Tidak |
| Profil klien | Ya | Ya | Ya | Tidak |
| Isi klinis catatan kunjungan | Ya | Tidak | Ya | Tidak |
| Tagihan dan pembayaran | Ya | Ya | Tidak | Tidak |
| Pembalikan pembayaran hari yang sama | Ya | Tidak | Tidak | Tidak |
| Stok batch dan saldo | Ya | Tidak | Memakai bahan | Ya |
| Data karyawan dan preset | Ya | Tidak | Tidak | Tidak |
| Audit | Ya | Tidak | Tidak | Tidak |

Front Office mencakup kerja resepsionis dan kasir. Klinis mencakup terapis dan, jika jalur medis aktif, dokter. Gudang hanya melihat inventory. Akun nonaktif tidak dapat login. Riwayat transaksi akun itu tetap tersimpan.

### 4.2 Klien

- Kode klien, nama, telepon, tanggal lahir, tanggal daftar, status aktif.
- Persetujuan pengolahan data: waktu, versi teks, dan pencabutan jika terjadi.
- Pencarian nama, kode, atau telepon, dengan peringatan jika telepon sudah terdaftar.
- Tidak ada hapus permanen. Klien yang berhenti dinonaktifkan.

### 4.3 Katalog layanan

- Kode, nama, durasi standar dalam menit, harga jual, status aktif.
- Harga dan durasi pada booking serta tagihan disimpan sebagai snapshot. Perubahan katalog tidak mengubah transaksi lama.

### 4.4 Booking dan kalender

Kalender harian dan mingguan, ditambah modal booking. Modal dapat dibuka dari tombol tambah, slot kalender, atau kartu booking, di desktop dan layar HP. Meja depan adalah layar utama: kalender dan kasir dioptimalkan untuk input cepat di desktop atau tablet. Layar HP diutamakan untuk jadwal hari ini milik Klinis dan ringkasan owner.

Setiap booking menyimpan nomor unik, klien, mulai, selesai, durasi, layanan, petugas, ruangan jika dipakai, status, catatan operasional, sumber (internal), pembuat, dan waktu buat.

Status:

`BOOKED → CONFIRMED → CHECKED_IN → IN_SERVICE → COMPLETED`

Status lain: `CANCELLED`, `NO_SHOW`, `RESCHEDULED`. Penjadwalan ulang menyimpan histori booking sebelumnya. Pembatalan tidak menghapus catatan atau tagihan yang sudah ada.

Aturan:

1. Booking aktif tidak boleh tumpang tindih pada petugas yang sama atau ruangan yang sama.
2. Durasi memakai durasi layanan. Waktu persiapan, jika nanti diperlukan, masuk ke perhitungan selesai, bukan ke tampilan saja.
3. Penolakan konflik terjadi di server, di dalam transaksi database.
4. Dua permintaan bersamaan untuk petugas atau ruangan yang sama tidak boleh menghasilkan dua booking aktif.
5. Perubahan jadwal, petugas, ruangan, dan status menulis histori.

Kunci MySQL: indeks pada `start_at` tidak cukup. Dalam satu transaksi, kunci baris petugas dan baris ruangan yang dipesan, lalu tolak jika ada booking aktif yang intervalnya beririsan. Uji dua permintaan bersamaan adalah syarat rilis kalender.

Tampilan bulan, booking publik, dan pengingat WhatsApp tidak masuk V1.

### 4.5 Catatan kunjungan operasional

Satu kunjungan terhubung ke satu booking dan satu klien. Catatan operasional menyimpan keluhan singkat, layanan yang dikerjakan, bahan yang dicatat, rencana kontrol, petugas, dan waktu.

Isi klinis catatan (keluhan, detail pengerjaan, rencana kontrol) hanya dapat dibaca Owner dan Klinis. Front Office melihat status kunjungan dan layanan, bukan isi klinis. Gudang tidak membuka catatan.

### 4.6 Kasir sederhana

- Tagihan dibuat dari booking yang sudah check-in atau selesai. Total dihitung di server dari snapshot harga, bukan dari angka yang dikirim browser.
- Satu tagihan punya status tagihan (`OPEN`, `PAID`, `VOID`) yang terpisah dari status tiap pembayaran.
- Pembayaran dicatat manual: tunai, transfer, atau QRIS. Pembayaran sebagian diperbolehkan. Sisa tagihan adalah piutang.
- Permintaan pembayaran memakai idempotency key agar kiriman ulang tidak membuat pembayaran ganda.
- Pembalikan hanya oleh Owner, hanya pada hari kalender yang sama di Asia/Jakarta, dan hanya dengan transaksi pembalik yang merujuk pembayaran asal. Pembayaran asal tidak dihapus.
- Struk dapat diunduh atau dicetak dari data tagihan dan pembayaran.

Refund multi-langkah, tutup kas, pengeluaran operasional, payment gateway, diskon bertingkat, dan perubahan harga setelah tagihan terbit tidak masuk V1. Diskon tidak ada di V1: harga mengikuti snapshot layanan.

### 4.7 Dashboard owner

Tiga angka, dihitung dari database, untuk hari ini di Asia/Jakarta, dengan filter tanggal:

- booking hari ini per status;
- uang masuk hari ini;
- no-show hari ini.

Grafik mingguan, layanan terlaris, produktivitas karyawan, dan laporan CSV tidak masuk V1.

### 4.8 Stok batch terbatas

Rilis ini menyusul go-live operasional, dan tetap sebelum modul ERP.

- Semua barang punya kode, nama, kategori, satuan, dan status aktif.
- SKU kedaluwarsa atau bernilai tinggi (serum, injeksi, masker treatment, setara) ditandai `track_batch`.
- Batch menyimpan nomor batch, tanggal kedaluwarsa, saldo, dan biaya satuan sebagai catatan pembelian. Biaya satuan tidak dipakai untuk laporan nilai persediaan.
- Saldo hanya berubah lewat mutasi pada transaksi database yang sama dengan perubahan saldo. Mutasi lama tidak dihapus. Koreksi adalah mutasi baru dengan alasan.
- Pengeluaran batch memakai FEFO. Stok tidak boleh negatif. Batch kedaluwarsa tidak dapat dipilih saat pemakaian treatment.
- SKU lain hanya menyimpan saldo sederhana, tetapi saldo itu tetap berubah lewat mutasi.
- Peringatan stok minimum dan kedaluwarsa tampil untuk SKU `track_batch`.

Purchase order, stock opname, karantina, valuasi rata-rata tertimbang, laporan nilai persediaan, dan pemasok sebagai modul pembelian tidak masuk V1.

## 5. Jalur medis bersyarat

Bagian ini tidak dikerjakan pada build default. Aktif hanya setelah pemilik menyatakan ada tindakan medis.

Sebelum go-live klinis:

- Catatan yang difinalisasi tidak ditimpa. Koreksi menyimpan alasan, waktu, dan pengguna.
- Persetujuan tindakan tersimpan terpisah dari persetujuan pengolahan data. Persetujuan foto tidak dibuat, karena foto belum ada.
- Role Front Office dan Gudang tidak dapat membaca isi klinis. Klinis tidak melihat dashboard uang masuk.
- Akses baca dan koreksi catatan klinis masuk audit log.

Di luar jalur ini pun, isi klinis catatan operasional sudah disembunyikan dari Front Office dan Gudang (bagian 4.5).

## 6. Ditunda

Fitur berikut tidak masuk migrasi pertama dan tidak masuk layar V1:

- Absensi, shift, keterlambatan, produktivitas, komisi, dan payroll.
- Purchase order, stock opname, karantina, valuasi persediaan, dan laporan nilai stok.
- Refund sebagai alur persetujuan, tutup kas, dan pengeluaran.
- Laporan CSV, segmentasi klien, dan ekspor data pribadi.
- Foto klinis dan penyimpanan file klien.
- Kode diagnosa, asesmen medis otomatis, dan galeri klinis.
- WhatsApp, booking publik, loyalitas, paket treatment, payment gateway, dan aplikasi native.
- Multi-cabang, termasuk kolom `branch_id`.
- Editor izin per tindakan.

Keputusan yang menjaga jalan ke fitur itu: snapshot harga, mutasi stok immutable, role di tabel terpisah, pembayaran terpisah dari tagihan, dan tidak ada hapus permanen pada klien atau transaksi. `branch_id` tidak ditambahkan sekarang.

Hapus data tidak dibangun. Kebijakan retensi rekam medis dan UU Perlindungan Data Pribadi ditulis satu halaman sebelum ada alur hapus. Sampai saat itu, data dinonaktifkan.

## 7. Kebutuhan nonfungsional V1

- Bahasa Indonesia, zona waktu Asia/Jakarta, mata uang Rupiah.
- Nominal uang memakai `DECIMAL`, bukan float.
- Waktu disimpan sebagai UTC dan ditampilkan sebagai Asia/Jakarta di seluruh halaman.
- Kalender dan kasir dirancang untuk meja depan. Layout HP tetap bisa dipakai untuk jadwal Klinis dan ringkasan owner.
- Form memvalidasi input, menampilkan error yang jelas, dan menolak kiriman ganda pada simpan.
- Password di-hash dengan algoritma modern. Percobaan login dibatasi. Cookie sesi aman. Production memakai HTTPS.
- Query terparameterisasi. `user_id`, role, harga, total, dan saldo dari browser tidak dipercaya.
- Rahasia hanya di environment variable.
- Backup database harian, disimpan terpisah dari server aplikasi, dan diuji pulih sebelum go-live. Target awal: kehilangan data maksimal 24 jam.

## 8. Arsitektur

Stack yang dipakai setelah spike lulus:

| Komponen | Pilihan |
| --- | --- |
| Framework | Next.js App Router |
| Bahasa | TypeScript strict |
| UI | Tailwind CSS dan shadcn/ui |
| Form | React Hook Form dan Zod |
| Database | MySQL, InnoDB, utf8mb4 |
| Akses data | Prisma, selama adapter MySQL cocok dengan runtime hasil spike |
| Autentikasi | Auth.js atau sesi server yang setara, akun karyawan |
| Uji | Vitest dan Playwright |

Postgres baru dipertimbangkan jika aplikasi pindah host dan kunci interval MySQL tidak lolos uji konkurensi. Keputusan itu tidak diambil sebelum spike.

Mutasi V1 memakai Server Actions. Route Handler dipakai untuk unggah file nanti dan untuk endpoint yang memang harus HTTP. Respons error tetap memakai status yang tepat: 400, 401, 403, 404, 409 untuk konflik booking atau pembayaran ganda, dan 500 tanpa pesan SQL atau stack trace.

Sebelum mengunci komponen kalender, pastikan tampilan per petugas dan per ruangan tersedia pada lisensi yang dipakai. Jangan mengunci FullCalendar jika tampilan resource hanya ada di paket berbayar yang tidak dibeli.

Struktur awal:

```text
rosaura-clinic-os/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── src/
│   ├── app/
│   │   ├── (auth)/login/
│   │   └── (dashboard)/
│   │       ├── dashboard/
│   │       ├── bookings/
│   │       ├── clients/
│   │       ├── visits/
│   │       ├── billing/
│   │       ├── inventory/
│   │       ├── employees/
│   │       └── services/
│   ├── components/
│   ├── lib/
│   └── services/
│       ├── booking.service.ts
│       ├── billing.service.ts
│       ├── visit.service.ts
│       └── inventory.service.ts
└── tests/
```

Business logic berada di service. Komponen UI tidak memanggil database langsung. Seeder hanya berisi preset role, layanan contoh, dan pengguna uji. Data klien asli tidak masuk repository.

## 9. Data V1

Migrasi pertama hanya tabel di bawah. Tabel fase berikut tidak dibuat dulu.

Identitas: `users`, `employees`, `roles`, `permissions`, `user_roles`, `role_permissions`.

Operasional: `clients`, `client_consents`, `services`, `rooms`, `bookings`, `booking_services`, `booking_assignments`, `booking_status_history`, `visits`, `visit_notes`.

Keuangan: `invoices`, `invoice_items`, `payments`, `payment_reversals`, `idempotency_keys`.

Stok, pada migrasi rilis stok: `product_categories`, `products`, `stock_batches`, `stock_movements`.

Audit: `audit_logs` untuk perubahan preset, pembalikan pembayaran, koreksi catatan, akses isi klinis, dan penyesuaian stok.

Kolom uang `DECIMAL(15,2)`. Kode unik pada klien, karyawan, layanan, booking, SKU, dan nomor tagihan. Foreign key menyala. Entitas berhistori dinonaktifkan, bukan dihapus berantai.

`qty_available` pada batch harus sama dengan hasil mutasi. Keduanya ditulis dalam satu transaksi.

Tidak ada tabel shift, absensi, purchase order, stock opname, expenses, cash session, clinical photo, diagnosis, atau cabang pada migrasi V1.

## 10. Server Actions V1

Setiap action memeriksa sesi, preset, dan validasi Zod, lalu memanggil service.

- Login dan logout.
- Klien: daftar, buat, ubah profil, nonaktifkan.
- Layanan dan ruangan: daftar, buat, nonaktifkan.
- Booking: buat, ubah jadwal, ubah status, jadwalkan ulang.
- Kunjungan: buat catatan dari booking, ubah catatan yang belum dikunci jalur medis.
- Tagihan: buat dari booking. Pembayaran: catat dengan idempotency key. Pembalikan: Owner, hari yang sama.
- Dashboard: booking per status, uang masuk, no-show.
- Stok (rilis berikut): penerimaan saldo, pemakaian bahan, koreksi dengan alasan, daftar batch kedaluwarsa.

Daftar memakai pagination. Pembayaran, pemakaian bahan, dan booking memakai transaksi database.

## 11. Desain

Arah visual Rosaura Skin Clinic: ivory, champagne beige, cokelat hangat, aksen emas seperlunya, kartu sederhana, font sans-serif. Status booking memakai label warna yang sama di kalender dan daftar. Tampilan klinis tenang dan mudah dibaca. Kecepatan input di meja depan lebih penting daripada tampilan mewah.

## 12. Spike hosting

Spike dijalankan pada paket yang akan dipakai produksi, sebelum migrasi pertama.

Checklist lulus:

1. Aplikasi Next.js production berjalan dengan versi Node yang kompatibel.
2. Aplikasi membaca environment variable tanpa menyimpan rahasia di git.
3. Aplikasi terhubung ke MySQL paket itu dan dapat membuat serta membaca satu tabel uji.
4. Log dan restart aplikasi dapat diakses.
5. Satu unggah file uji bertahan setelah restart. Jika tidak, disk lokal dinyatakan tidak layak untuk file klien.

Hasil 24 Oktober 2026: belum lulus. Paket belum terhubung ke workspace ini. Gerbang coding tetap tertutup.

Jika salah satu butir gagal, aplikasi tidak dipaksakan di Hostinger. Host aplikasi diganti. MySQL tetap hanya bila koneksinya stabil dari host baru. File klien tidak ditempatkan di disk yang hilang saat restart.

## 13. Urutan rilis

1. Spike hosting, lalu login Owner.
2. Klien, layanan, dan kalender yang menolak double-book, termasuk uji dua request bersamaan.
3. Check-in, catatan kunjungan, tagihan, pembayaran, pembalikan hari yang sama, dan angka uang masuk.
4. Stok batch untuk SKU kedaluwarsa atau mahal, terhubung ke pemakaian pada catatan kunjungan.
5. Jika ada tindakan medis: finalisasi, koreksi, persetujuan tindakan, dan audit akses klinis.
6. Setelah V1 dipakai di meja depan: refund penuh, tutup kas, pengeluaran, laporan, lalu WhatsApp dan cabang kedua.

Durasi tidak dijanjikan. Urutan di atas yang dijanjikan.

## 14. Selesai untuk go-live

Go-live operasional tercapai bila:

- Resepsionis dapat menjalankan booking sampai pembayaran pada data uji dan pada uji terima di meja depan.
- Dua booking bersamaan pada petugas atau ruangan yang sama menghasilkan satu booking dan satu penolakan.
- Total tagihan dan uang masuk dihitung di server. Kiriman pembayaran ulang tidak menggandakan uang.
- Isi klinis catatan tidak terbuka untuk Front Office dan Gudang.
- Akun nonaktif tidak dapat login.
- Build production berhasil, rahasia tidak ada di repository, dan backup basis data uji berhasil dipulihkan.
- Buku cadangan hanya masih dipakai untuk stock opname, sampai rilis stok batch.

Go-live stok batch menambah: bahan kedaluwarsa tidak dapat dipilih, saldo tidak negatif, dan setiap perubahan saldo punya mutasi.

Jalur medis, jika diaktifkan, menambah uji finalisasi, koreksi berjejak, dan audit akses sebelum dipakai untuk tindakan medis.

## 15. Ukuran keberhasilan

- Nol double-booking pada petugas atau ruangan yang sama selama bulan pertama pemakaian.
- Selisih uang masuk di sistem terhadap hitungan kas harian berada di bawah ambang yang Owner tetapkan.
- Setiap kunjungan selesai punya satu booking, satu catatan, dan satu tagihan.
- Setelah rilis stok: bahan kedaluwarsa tidak bisa dipilih saat treatment.
- Staf nonklinis tidak bisa membuka isi klinis catatan.

Baseline yang masih perlu diisi pemilik sebelum estimasi waktu: jumlah booking per hari, jumlah staf, jumlah SKU kedaluwarsa, dan ada atau tidaknya tindakan medis. Jawaban terakhir hanya mengaktifkan bagian 5. Ia tidak mengubah alur booking sampai pembayaran.
