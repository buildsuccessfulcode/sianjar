# UI/UX Concept — SiJAR

| Field | Value |
|---|---|
| Design system | Tailwind CSS 4 + komponen lokal bergaya shadcn/ui, layout admin terinspirasi TailAdmin |
| Icons | `lucide-react` |
| Font | System UI / Geist (fallback) |
| Baseline | Mobile-first untuk guru, desktop-first untuk Admin/Waka |
| Bahasa | Indonesia formal tetapi hangat |

---

## 1. Prinsip Desain

1. **Satu layar, satu tugas.** Form jurnal + absensi selesai pada satu halaman tanpa pindah route.
2. **Hadir adalah default.** Guru hanya menandai pengecualian.
3. **Status terbaca tanpa membaca.** Warna + ikon + teks, bukan warna saja.
4. **Aksi berisiko butuh pratinjau/konfirmasi.** Promosi, hapus master data, hapus jadwal.
5. **Aksesibel sejak awal.** Kontras AA, label eksplisit, fokus terlihat, target tap ≥ 44 px.
6. **Feedback segera.** Setiap aksi punya state loading, sukses, dan error.
7. **Mobile dulu untuk guru.** Form jurnal harus nyaman di layar 360 px.

---

## 2. Design Token

### Warna

| Token | Nilai | Pemakaian |
|---|---|---|
| `primary` | `#4F46E5` | Aksi utama, nav aktif |
| `primary-hover` | `#4338CA` | Hover |
| `primary-soft` | `#EEF2FF` | Background nav aktif |
| `success` | `#16A34A` | Hadir, aman |
| `success-soft` | `#DCFCE7` | Badge hadir |
| `warning` | `#D97706` | Sakit, peringatan |
| `warning-soft` | `#FEF3C7` | Badge sakit |
| `danger` | `#DC2626` | Alpa, hapus, error |
| `danger-soft` | `#FEE2E2` | Badge alpa |
| `info` | `#0284C7` | Izin |
| `info-soft` | `#E0F2FE` | Badge izin |
| `neutral-*` | Tailwind slate | Background, border, teks |
| `surface` | `#FFFFFF` | Kartu |
| `canvas` | `#F8FAFC` | Background halaman |

### Tipografi

| Token | Ukuran | Penggunaan |
|---|---|---|
| `text-xs` | 12 px | Metadata, badge |
| `text-sm` | 14 px | Tabel, helper |
| `text-base` | 16 px | Body, input |
| `text-lg` | 18 px | Judul kartu |
| `text-xl` | 20 px | Section header |
| `text-2xl` | 24 px | Page title |

### Spacing, radius, shadow

- Spacing kelipatan 4: 4, 8, 12, 16, 24, 32, 48.
- Radius: `sm 6px`, `md 8px`, `lg 8px` untuk tombol/input, `2xl 16px` untuk kartu, `full` untuk pill.
- Shadow kartu: `0 1px 3px rgba(16,24,40,.05)`.
- Container konten maksimum 1200 px; padding halaman 16 px mobile / 24–32 px desktop.

---

## 3. Information Architecture

```text
/login

/dashboard                    ← redirect/isi sesuai role
├── guru: ringkasan jadwal hari ini
├── waka: coverage hari ini + aksi cepat
└── admin: ringkasan data + coverage

Guru
├── /dashboard                jadwal hari ini + tautan kalender
├── /jadwal                   kalender mingguan milik sendiri
├── /jurnal                   riwayat jurnal milik sendiri
├── /jurnal/isi/[scheduleId]?date=YYYY-MM-DD
├── /jurnal/[id]              detail
└── /rekap/absensi

Admin
├── /admin/tahun-ajaran
├── /admin/jurusan
├── /admin/kelas
├── /admin/mapel
├── /admin/guru
├── /admin/siswa
├── /admin/enrollment
├── /jadwal                   kalender + kelola jadwal
├── /jadwal/jam               susunan jam, istirahat, sholat
├── /jurnal                   monitoring semua jurnal
├── /rekap/absensi
├── /promosi
└── /audit

Waka Kurikulum
├── /dashboard
├── /jadwal                   kalender + kelola jadwal
├── /jadwal/jam               susunan jam, istirahat, sholat
├── /guru-mapel               mapping guru–mapel
├── /jurnal                   monitoring
├── /rekap/absensi
├── /promosi                  pratinjau (tanpa commit)
└── /audit                    read-only
```

Navigasi:
- **Desktop:** sidebar putih 288 px (dapat diringkas menjadi 80 px) + top bar 72 px berisi judul halaman dan user menu.
- **Mobile:** top bar dengan tombol menu; sidebar menjadi drawer berisi navigasi dan tombol keluar.
- Top bar sengaja tanpa pencarian global, pengalih tema, dan notifikasi agar fokus pada navigasi utama.
- Grup navigasi Kurikulum dan Data Master dapat dilipat; item nav difilter berdasarkan role/permission.
- Item aktif memakai latar indigo lembut dengan ikon dan teks indigo.

---

## 4. Alur Kunci

### 4.1 Dashboard Guru

```text
Senin, 26 Okt 2026
┌─────────────────────────────────────┐
│ 07:30–09:00   [BELUM DIISI]         │
│ Matematika · X IPA 1                │
│ [Isi Jurnal →]                      │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│ 09:15–10:45   [SUDAH DIISI ✓]       │
│ Matematika · XI IPS 2               │
│ [Lihat Jurnal]                      │
└─────────────────────────────────────┘
```

- Jika kosong: “Belum ada jadwal hari ini. Selamat beristirahat.”
- Tombol utama minimal tinggi 44 px.
- Banner ringan jika ada jadwal belum diisi pada hari sebelumnya? (P2; belum).

### 4.2 Form Jurnal + Absensi

Struktur:

```text
← Jurnal — Matematika · X IPA 1
  Senin, 26 Okt 2026 · 07:30–09:00

Materi *
[________________________________]

Aktivitas *
[ Ceramah / Diskusi / Praktik / ... ]

Catatan (opsional)
[________________________________]

Absensi Siswa (32)
Semua hadir. Ubah status hanya untuk siswa yang tidak hadir.
[ringkasan: 3 tidak hadir (1 sakit, 2 alpa)]

┌───────────────────────────────────┐
│ A  Ahmad Fauzi        [Hadir ▾]   │
│ B  Budi Santoso       [Alpa  ▾]   │
│ C  Citra Dewi         [Sakit ▾]   │
└───────────────────────────────────┘

[ Batalkan ]            [ Simpan Jurnal ]
```

Interaksi:
- Setiap baris siswa memiliki `<select>` status: Hadir, Sakit, Izin, Alpa, Dispensasi.
- Baris dengan status tidak hadir mendapat aksen kiri + badge berwarna.
- Ringkasan dihitung langsung di client.
- Catatan opsional per siswa muncul saat status bukan Hadir (input teks).
- Submit mengirim semua status; server hanya menyimpan yang tidak hadir.
- Jika jurnal sudah ada, form dalam mode edit dan field terisi.
- Konfirmasi ringan sebelum simpan jika ada siswa tidak hadir; server tetap memvalidasi.

### 4.3 Detail Jurnal

- Header: mapel, kelas, tanggal, jam, guru.
- Blok materi, aktivitas, catatan.
- Statistik: hadir, sakit, izin, alpa, dispensasi.
- Tabel siswa dengan status.
- Tombol Edit (owner/Admin).

### 4.4 Monitoring Waka/Admin

```text
Monitoring Jurnal · [tanggal]
┌──────────┬──────────┬──────────┬──────────────┐
│ 42 slot  │ 38 diisi │ 4 belum  │ Coverage 90% │
└──────────┴──────────┴──────────┴──────────────┘
[progress bar]

Belum diisi:
• Pak Andi — Fisika · XI IPA 2 (07:30)
• Bu Rina — Biologi · X IPA 3 (09:15)

Filter: [Kelas] [Mapel] [Guru]
```

- Data dihitung untuk tanggal dan semester yang dipilih.
- Waka/Admin dapat membuka detail jurnal yang sudah diisi.

### 4.4a Kalender Jadwal Mengajar

**Desktop/tablet (≥ 1024 px)**

```text
Kalender Mingguan · Ganjil 2026/2027
┌──────┬────────┬────────┬────────┬────────┬────────┐
│ Jam  │ Senin  │ Selasa │ Rabu   │ Kamis  │ Jumat  │
├──────┼────────┼────────┼────────┼────────┼────────┤
│07:00 │ Mat X  │ Fis XI │ Mat X  │ ...    │ ...    │
│07:40 │        │        │        │        │        │
│08:20 │ ── Istirahat ───────────────────────────── │
│08:35 │ B.Indo │ ...    │ ...    │        │        │
│11:30 │ ── Sholat Dzuhur & Istirahat ───────────── │
│12:45 │ ...    │        │        │        │        │
└──────┴────────┴────────┴────────┴────────┴────────┘
```

**Mobile (< 1024 px)**

- Tab hari dapat digeser: `Sen · Sel · Rab · Kam · Jum · Sab`, masing-masing menampilkan jumlah jadwal.
- Satu hari ditampilkan sebagai timeline vertikal dengan gutter jam.
- Blok jadwal memuat mapel, kelas, guru (untuk Waka/Admin) atau rentang jam (untuk guru), dan ruang.
- Istirahat diberi pita amber; sholat/ibadah diberi pita sky.
- Slot istirahat/sholat tidak bisa dipilih sebagai jam mengajar dan tidak memiliki aksi jurnal.
- Warna blok mapel berbeda per mapel agar mudah dipindai; teks tetap menjadi informasi utama.

**Susunan jam (Admin/Waka)**

- Halaman `/jadwal/jam`: pilih semester, lalu CRUD entri `LESSON`, `BREAK`, `PRAYER`.
- Form memuat nama, jenis, nomor jam pelajaran (wajib untuk `LESSON`), jam mulai, dan jam selesai.
- Jika belum ada susunan jam, tersedia tombol **Gunakan Contoh Jam** yang membuat 8 jam pelajaran, dua istirahat, dan sholat dzuhur.
- Jam tidak boleh overlap. Nomor jam pelajaran unik per semester.

### 4.5 Rekap Absensi

- Filter bar: dari, sampai, kelas, mapel.
- Ringkasan total ketidakhadiran.
- Tabel: siswa, NISN, kelas, sakit, izin, alpa, dispensasi, total.
- Tombol “Export CSV” menghasilkan file sesuai filter.
- Guru dibatasi pada kelas/mapel yang diajar.

### 4.6 Alur Naik Kelas

**Step 1 — Pilih tahun asal & tujuan**

```text
Dari: [2025/2026]    Ke: [2026/2027]
[ Tampilkan Pratinjau ]
```

**Step 2 — Pratinjau**

```text
Kelas Asal     Aksi       Kelas Tujuan    Siswa
X IPA 1        Promote    XI IPA 1        32
XI IPA 1       Promote    XII IPA 1       30
XII IPA 1      Graduate   —               28

Ringkasan: 62 promote · 30 graduate
Konflik: 0
[ ← Kembali ] [ Commit Promosi ]
```

- Mapping kelas dibuat otomatis dari aturan yang tersimpan atau tingkat kelas (grade + 1, section sama bila tersedia).
- Commit hanya untuk Admin.
- Waka dapat melihat pratinjau.
- Setelah commit: halaman hasil + tombol “Batalkan Batch” jika tahun tujuan belum aktif.
- Override per siswa direncanakan P1; saat ini aksi mengikuti mapping per kelas.

### 4.7 Master Data

Pola halaman konsisten:
1. Judul + deskripsi + tombol “Tambah”.
2. Filter/pencarian sederhana.
3. Tabel dengan aksi Edit / Nonaktifkan.
4. Form tambah/edit tampil di modal popup di atas daftar; modal menutup otomatis setelah berhasil.
5. Konfirmasi hapus/nonaktifkan memakai modal konfirmasi.

Soft delete menyembunyikan data dari daftar operasional, tetapi baris histori dan relasinya tetap tersimpan. Filter khusus data nonaktif direncanakan P1.

### 4.7a Enrollment

**Tambah massal**

```text
Enrollment Massal
Kelas: [X IPA 1]   Status: [Aktif]
Cari siswa: [ nama / NISN ]
12 siswa dipilih · 40 siswa tersedia     [Pilih semua hasil] [Bersihkan]
┌──────────────────────────────────────────────────────────┐
│ [x] Budi Santoso     0012345678        Belum terdaftar   │
│ [ ] Siti Aminah      0012345679        Belum terdaftar   │
│ [ ] Andi Pratama     0012345680        Terdaftar · X IPA 2 │
└──────────────────────────────────────────────────────────┘
Siswa yang sudah terdaftar pada tahun ajaran ini dilewati.
```

- Modal besar, daftar siswa dapat dicari dan digulir.
- Siswa yang sudah terdaftar ditandai dan tidak dapat dipilih.
- Hasil ditampilkan lewat toast: jumlah dibuat, diaktifkan kembali, dan dilewati.

**Ubah dan pindah kelas**

- Aksi **Ubah** per baris membuka modal kelas + status untuk enrollment tahun berjalan.
- Centang beberapa baris lalu pilih kelas tujuan untuk **pindah kelas massal**.
- Pindah kelas hanya berlaku dalam tahun ajaran yang sama; perubahan dicatat sebagai update enrollment, bukan enrollment baru.
- Kenaikan ke tahun ajaran berikutnya tetap melalui `/promosi`.

---

## 5. Komponen Inventory

| Komponen | Lokasi | Fungsi |
|---|---|---|
| `AppShell` | `components/domain/app-shell.tsx` | Sidebar lipat, top bar, mobile drawer, user menu |
| `PageHeader` | `components/ui/page-header.tsx` | Judul, deskripsi, aksi kanan |
| `Card` | `components/ui/card.tsx` | Container konten |
| `Button` | `components/ui/button.tsx` | Varian primary, secondary, ghost, danger |
| `Input`, `Textarea`, `Select` | `components/ui/form.tsx` | Form primitives dengan label/error |
| `Badge` / `StatusPill` | `components/ui/badge.tsx` | Status berwarna + teks |
| `Table` | `components/ui/table.tsx` | Tabel data responsive |
| `EmptyState` | `components/ui/empty-state.tsx` | Data kosong + CTA |
| `Alert` | `components/ui/alert.tsx` | Info, warning, error |
| `SubmitButton` | `components/ui/submit-button.tsx` | Pending state dengan `useFormStatus` |
| `ToastProvider` / `FlashToast` | `components/ui/toast.tsx`, `flash-toast.tsx` | Notifikasi global sukses/gagal dari flash URL |
| `Modal` | `components/ui/modal.tsx` | Dialog native `<dialog>` dengan backdrop, Escape, dan fokus |
| `ModalForm` | `components/ui/modal-form.tsx` | Bungkus `ActionForm` untuk tambah/edit dalam modal |
| `ConfirmSubmit` | `components/ui/confirm-submit.tsx` | Tombol aksi berisiko + modal konfirmasi |
| `ScheduleCard` | `components/domain/schedule-card.tsx` | Kartu jadwal guru |
| `TeachingCalendar` | `components/domain/teaching-calendar.tsx` | Kalender mingguan responsif + istirahat/sholat |
| `AttendanceForm` | `components/domain/attendance-form.tsx` | Form jurnal + absensi client-side |
| `BulkEnrollmentForm` | `components/domain/bulk-enrollment-form.tsx` | Checklist siswa + pencarian untuk enrollment massal |
| `EnrollmentTable` | `components/domain/enrollment-table.tsx` | Tabel enrollment, ubah/pindah kelas, seleksi massal |
| `JournalTable` | halaman jurnal | Daftar/riwayat jurnal |
| `PromotionPreview` | halaman promosi | Ringkasan mapping + commit |

Presentational component tidak boleh melakukan query DB. Data fetching ada di Server Component/data access.

---

## 6. State dan Feedback

### Empty states
- Guru tanpa jadwal: “Belum ada jadwal hari ini. Selamat beristirahat.”
- Kalender tanpa jadwal pada filter: “Belum ada jadwal pada filter ini.”
- Susunan jam kosong: “Belum ada susunan jam” + CTA **Gunakan Contoh Jam**.
- Jurnal kosong: “Belum ada jurnal. Isi jurnal pertamamu.”
- Master kosong: “Belum ada data. Tambah data pertama.”

### Loading
- Tombol submit memakai spinner inline dan disabled selama pending.
- Tabel/list memakai `loading.tsx` atau skeleton sederhana.
- Aksi promosi menampilkan “Memproses N siswa…”.

### Error dan sukses
- Validasi form: pesan inline di bawah field, `aria-describedby`.
- Error transaksi dan konflik: toast global merah; detail teknis tidak ditampilkan.
- Sukses simpan/hapus/aktivasi: toast global hijau, termasuk dari redirect Server Action.
- Konflik jurnal ganda: arahkan ke jurnal yang sudah ada.
- Akses ditolak: halaman 403 sederhana / redirect ke dashboard.

### Konfirmasi
- Hapus/nonaktifkan data: modal konfirmasi dengan nama entitas.
- Aksi lain yang berisiko (aktivasi tahun/semester, buat contoh jam, simpan jurnal dengan siswa tidak hadir, cancel batch): modal konfirmasi.
- Commit promosi: tampilkan ringkasan + checkbox "Saya sudah memeriksa".

---

## 7. Aksesibilitas

- Kontras teks ≥ AA.
- Semua input punya `<label>` eksplisit; placeholder bukan pengganti label.
- Fokus ring jelas (`focus-visible:ring-2`).
- Form jurnal dan promosi dapat diselesaikan dengan keyboard.
- Status memakai ikon + teks.
- `role="status"`/`aria-live="polite"` untuk pesan sukses/error.
- Target tap ≥ 44×44 px.
- Tabel memiliki `<caption>` atau heading yang jelas.

---

## 8. Responsive Strategy

| Breakpoint | Fokus |
|---|---|
| `< 640px` | Form jurnal, dashboard guru, absensi satu kolom, kalender per hari |
| `640–1024px` | Monitoring, tabel ringkas, wizard, kalender per hari dengan tab lebih lega |
| `> 1024px` | Sidebar tetap, tabel lebar, master data, grid kalender mingguan |

Prinsip: fitur guru sempurna di mobile; fitur admin dioptimalkan untuk desktop tetapi tetap dapat dipakai di tablet. Kalender tidak boleh memaksa scroll horizontal pada mobile: gunakan tab hari dan timeline satu kolom. Pada tablet, grid mingguan boleh digeser horizontal.

---

## 9. Microcopy

- Label tombol berupa kata kerja: `Simpan`, `Isi Jurnal`, `Commit Promosi`.
- Sukses: “Jurnal tersimpan. Terima kasih.”
- Error: “Gagal menyimpan. Periksa koneksi lalu coba lagi.”
- Konflik: “Jurnal untuk pertemuan ini sudah ada. Kamu bisa mengeditnya.”
- Tanggal lokal: “Senin, 26 Okt 2026”, bukan ISO.
- Hindari jargon teknis pada UI guru.

---

## 10. Warna Status

| Status | Warna | Ikon |
|---|---|---|
| Hadir | success | `Check` |
| Sakit | warning | `Thermometer` |
| Izin | info | `FileText` |
| Alpa | danger | `XCircle` |
| Dispensasi | neutral | `BadgeCheck` |
| Belum diisi | danger-soft | `CircleAlert` |
| Sudah diisi | success-soft | `CircleCheck` |
| Istirahat | warning-soft | `Coffee` |
| Sholat / ibadah | info-soft | `Moon` |

---

## 11. Definition of Done UI

- [x] Alur guru isi jurnal selesai dalam ≤ 3 tap setelah dashboard.
- [x] Form jurnal tanpa scroll horizontal di 360 px.
- [x] State loading, empty, error, success tersedia.
- [x] Aksi berisiko memiliki konfirmasi.
- [x] Form menggunakan label eksplisit dan dapat dioperasikan keyboard.
- [x] Status memakai warna + teks + ikon.
- [x] Jadwal mengajar tampil sebagai kalender dan tetap nyaman di 360 px (tab hari + timeline).
- [x] Istirahat dan waktu sholat terlihat tanpa dihitung sebagai jam mengajar.
- [x] Susunan jam dapat diatur Admin/Waka dan divalidasi terhadap overlap.

