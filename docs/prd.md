# Product Requirements Document (PRD) — SiJAR

| Field | Value |
|---|---|
| Versi | 1.2 |
| Status | Aktif — menjadi acuan implementasi |
| Tanggal | 2026-10-26 |
| Nama produk | SiJAR — Sistem Informasi Jurnal Mengajar, Jadwal, dan Absensi |
| Target pengguna | Satu sekolah (single-tenant), 1.500 siswa / 80 guru / 60 kelas |
| Tech stack | Next.js 16 (App Router), React 19, Tailwind CSS 4, Auth.js v5, Drizzle ORM, Neon PostgreSQL |

---

## 1. Ringkasan Eksekutif

SiJAR menggantikan pencatatan jurnal mengajar, jadwal guru, dan absensi siswa yang masih manual. Nilai utamanya adalah **single input, multi output**: guru mengisi satu jurnal per pertemuan, dan sistem otomatis menyimpan riwayat mengajar, mencatat siswa tidak hadir, serta menyajikan data monitoring untuk Waka Kurikulum dan Admin.

Aplikasi dirancang untuk berjalan di stack gratis pada tahap pilot: Vercel Hobby + Neon Free. Jalur upgrade ke paket berbayar didokumentasikan, tetapi bukan bagian dari v1.

---

## 2. Masalah yang Diselesaikan

1. **Duplikasi pencatatan** — jurnal dan absensi ditulis di tempat terpisah sehingga sering tidak sinkron.
2. **Tidak ada visibilitas real-time** — Waka Kurikulum tidak tahu slot mana yang benar-benar diisi jurnalnya.
3. **Absensi tidak granular per mapel** — absensi harian tidak cukup untuk menelusuri alpa pada mapel tertentu.
4. **Riwayat naik kelas hilang** — kelas siswa disimpan sebagai satu kolom yang ditimpa tiap tahun.
5. **Proses naik kelas manual dan rawan** — tidak ada pratinjau, audit, atau rollback.

---

## 3. Tujuan dan Metrik

### Tujuan produk

- **G1** Guru dapat mengisi jurnal + absensi dalam < 2 menit per pertemuan.
- **G2** Waka Kurikulum melihat coverage jurnal harian tanpa bertanya manual.
- **G3** Riwayat absensi per siswa/mapel dapat ditelusuri lintas tahun ajaran.
- **G4** Naik kelas dilakukan sekali setahun secara atomik dan auditable.

### Metrik pasca-pilot (3 bulan)

| Metrik | Target |
|---|---|
| Slot jadwal yang diisi jurnal per minggu | ≥ 90% |
| Rata-rata waktu isi jurnal per pertemuan | ≤ 2 menit |
| Error rate transaksi jurnal + absensi | < 0,5% |
| Keluhan duplikasi data per bulan | 0 |

---

## 4. Non-Tujuan v1

- Aplikasi mobile native (Android/iOS). Cukup responsive/PWA-ready.
- Notifikasi WhatsApp/SMS otomatis ke orang tua.
- Modul keuangan, PPDB, inventaris, raport, e-learning.
- Multi-sekolah (multi-tenant).
- Integrasi Dapodik.
- Import CSV guru (P1; import Excel siswa sudah tersedia).
- Override status promosi per siswa melalui UI (P1; backend mendukung status per enrollment).
- Edit jurnal dengan batas waktu 7 hari (P1; v1 mengizinkan guru pemilik/Admin tanpa batas).

---

## 5. Persona dan Peran

| Peran | Deskripsi | Akses utama |
|---|---|---|
| **ADMIN** | Operator sekolah/TU | Semua modul, master data, eksekusi dan pembatalan promosi, audit |
| **WAKA_KURIKULUM** | Penanggung jawab jadwal dan monitoring KBM; bisa juga mengajar | Kelola jadwal, monitoring jurnal, rekap, persiapan promosi |
| **GURU** | Pengguna utama | Jadwal dan jurnal miliknya, absensi kelas yang diajar, rekap kelas yang diajar |

**Multi-role:** satu user dapat memiliki beberapa role melalui `user_roles`. Waka yang mengajar harus memiliki `WAKA_KURIKULUM` + `GURU`. Permission dihitung sebagai gabungan semua role.

**Catatan implementasi:** role guru ditentukan oleh role `GURU`, bukan semata-mata adanya `teacher_profiles`. Seed dan CRUD guru selalu membuat keduanya.

---

## 6. User Stories dan Acceptance Criteria

### US-01 Login dan Session

**Sebagai** pengguna, **saya ingin** login dengan email dan password **agar** dapat mengakses aplikasi sesuai peran.

- Login gagal menampilkan pesan generik: “Email atau password salah.”
- Session JWT bertahan 7 hari dan disimpan pada cookie httpOnly.
- Setelah login, pengguna diarahkan ke `/dashboard`.
- Logout menghapus cookie session.
- User nonaktif (`is_active = false`) atau soft-deleted tidak bisa login.

### US-02 Guru Melihat Jadwal Hari Ini

**Sebagai** guru, **saya ingin** melihat jadwal mengajar hari ini **agar** tahu kelas mana yang harus diisi jurnalnya.

- Menampilkan jam, mapel, kelas, dan status `Belum diisi` / `Sudah diisi`.
- Hanya jadwal milik guru yang login.
- Hanya jadwal pada semester aktif.
- Hari mengikuti zona waktu Asia/Jakarta.
- Jika tidak ada jadwal, tampil empty state.

### US-02b Guru Melihat Jadwal Mingguan dalam Kalender

**Sebagai** guru, **saya ingin** melihat jadwal mengajar mingguan dalam tampilan kalender **agar** jam mengajar, istirahat, dan waktu sholat mudah dibaca dari ponsel.

- `/jadwal` dapat diakses semua role; guru hanya melihat jadwal miliknya.
- Tampilan kalender menampilkan hari, jam pelajaran, istirahat, dan waktu sholat dari susunan jam semester.
- Desktop/tablet menampilkan grid mingguan; mobile menampilkan tab hari + timeline vertikal.
- Slot istirahat dan sholat diberi warna berbeda dan tidak dihitung sebagai jam mengajar.
- Jika susunan jam belum diatur, tampil daftar jadwal sederhana dan ajakan mengatur jam.
- Kalender mengikuti filter semester; Admin/Waka dapat memfilter guru, kelas, dan hari.

### US-03 Guru Mengisi Jurnal dan Absensi

**Sebagai** guru, **saya ingin** mengisi jurnal dan menandai siswa tidak hadir dalam satu form **agar** tidak perlu input dua kali.

- Field: materi (wajib), aktivitas (wajib), catatan (opsional).
- Semua siswa default `HADIR`; guru hanya mengubah yang tidak hadir.
- Status tidak hadir: `SAKIT`, `IZIN`, `ALPA`, `DISPENSASI`.
- Jurnal + absensi disimpan dalam **satu transaksi**.
- Hanya baris tidak hadir yang disimpan ke `attendance_records`.
- Jurnal ganda untuk `(schedule_id, date)` ditolak, kecuali sedang mengedit jurnal yang sama.
- Guru tidak bisa mengisi jurnal jadwal guru lain.
- Setelah simpan, pengguna diarahkan ke detail jurnal.
- Edit jurnal hanya oleh guru pemilik jurnal atau Admin.

### US-04 Waka Mengelola Jadwal

**Sebagai** Waka Kurikulum, **saya ingin** membuat jadwal per semester **agar** guru punya acuan mengajar.

- Jadwal terikat ke semester, kelas, mapel, guru, hari, dan rentang jam pelajaran.
- Admin/Waka mengatur susunan jam per semester: jam pelajaran, istirahat, dan waktu sholat/ibadah; tiap entri memiliki jam mulai dan selesai.
- Jam pelajaran memiliki nomor urut yang dipakai `period_start`/`period_end` pada jadwal.
- Sistem menolak bentrok guru pada semester, hari, dan jam yang overlap.
- Sistem menolak bentrok kelas pada semester, hari, dan jam yang overlap.
- Jadwal ditampilkan dalam kalender mingguan yang menyertakan istirahat dan waktu sholat.
- Jadwal yang sudah memiliki jurnal tidak boleh dihapus.
- Perubahan guru pada slot ber-jurnal diperbolehkan, karena `journals.teacher_id` adalah snapshot.

### US-05 Monitoring Jurnal

**Sebagai** Waka/Admin, **saya ingin** melihat coverage jurnal hari ini **agar** bisa menindaklanjuti guru yang belum mengisi.

- Ringkasan: total slot hari ini, sudah diisi, belum diisi, persentase coverage.
- Daftar slot yang belum diisi beserta guru, mapel, kelas, dan jam.
- Filter kelas, mapel, dan guru.
- Bisa memilih tanggal monitoring.

### US-06 Rekap Absensi

**Sebagai** Waka/Admin/Guru, **saya ingin** melihat rekap ketidakhadiran **agar** bisa dianalisis.

- Filter: rentang tanggal, kelas, mapel.
- Kolom: siswa, NISN, kelas, sakit, izin, alpa, dispensasi, total tidak hadir.
- Guru hanya melihat kelas/mapel yang diajar.
- Export CSV mengikuti filter yang sama.

### US-07 Naik Kelas

**Sebagai** Admin, **saya ingin** memproses naik kelas massal **agar** siswa otomatis terdaftar di kelas tahun ajaran baru.

- Pilih tahun ajaran asal dan tujuan.
- Mapping kelas diturunkan dari `class_promotion_rules`; jika belum ada, sistem membuat mapping default berdasarkan `grade_level`:
  - kelas dengan grade < 12 → `PROMOTE` ke kelas tujuan dengan grade + 1 dan section yang sama bila tersedia;
  - kelas grade 12 → `GRADUATE`.
- Pratinjau menampilkan jumlah siswa per kelas dan ringkasan aksi.
- Commit atomik: membuat `promotion_batches` berstatus `COMMITTED`, membuat enrollment baru, dan menandai enrollment asal `COMPLETED`/`GRADUATED`.
- Batch dapat dibatalkan selama tahun ajaran tujuan belum aktif.
- Tidak boleh commit jika tahun tujuan sudah aktif.
- Enrollment asal tidak dihapus.
- Semua commit/cancel dicatat di `audit_logs`.
- Hanya Admin dapat commit/cancel promosi.

### US-08 Master Data

**Sebagai** Admin, **saya ingin** CRUD tahun ajaran, semester, jurusan, kelas, mapel, guru, siswa, dan enrollment **agar** data dasar siap sebelum operasional.

- Soft delete (`deleted_at`) untuk entitas yang punya relasi historis; data yang di-soft-delete tidak ditampilkan pada daftar operasional. Daftar menyediakan filter status aktif/nonaktif.
- Menonaktifkan guru/siswa mengubah `is_active` tanpa soft delete agar tetap dapat ditemukan lewat filter Nonaktif.
- Master siswa mendukung aksi massal untuk mengaktifkan atau menonaktifkan beberapa siswa pada halaman aktif.
- Master data yang sudah direferensikan tidak di-hard-delete.
- Semua daftar master mendukung pencarian server-side, filter, sorting, pagination, dan pilihan jumlah baris per halaman.
- Validasi unik: nama tahun ajaran, kode jurusan, kode mapel, NISN, NIP, email user, dan kombinasi kelas.
- Hanya satu tahun ajaran aktif dan hanya satu semester aktif pada satu waktu.
- Guru = `users` + role `GURU` + `teacher_profiles`.

### US-09 Audit Log

**Sebagai** Admin/Waka, **saya ingin** melihat log aksi kritis **agar** perubahan penting dapat ditelusuri.

- Mencatat minimal: create/update/delete jadwal, commit/cancel promosi, perubahan status tahun ajaran.
- Menampilkan waktu, aktor, action, entity, dan payload ringkas.
- Waka hanya read-only.

---

## 7. Functional Requirements

Prioritas: **P0** wajib v1, **P1** nice-to-have, **P2** roadmap.

### FR-01 Auth dan RBAC — P0

- Email/password dengan bcrypt (cost 10).
- Auth.js v5 Credentials provider, JWT session 7 hari, cookie httpOnly.
- Multi-role via `user_roles`.
- `assertPermission(permission)` di data access layer dan setiap server action.
- Session diperbarui dari DB pada saat login; user nonaktif ditolak.

### FR-02 Master Data — P0

- CRUD tahun ajaran + aktivasi (hanya satu aktif).
- CRUD semester + aktivasi.
- CRUD jurusan, kelas, mapel, guru, siswa.
- Enrollment manual satuan dan massal (checklist siswa per kelas), termasuk ubah kelas/status, pindah kelas massal, dan ubah status massal pada tahun ajaran yang sama. Enrollment massal melewati siswa yang sudah terdaftar dan melaporkan jumlahnya.
- Mapping guru–mapel dapat ditambahkan massal (satu guru, banyak mapel) dengan melewati mapping yang sudah ada.
- Enrollment melalui promosi untuk kenaikan tahun ajaran.
- Semua tabel master memiliki `created_at`, `updated_at`, `deleted_at` bila relevan.

### FR-03 Jadwal — P0

- CRUD jadwal per semester.
- Validasi bentrok guru dan kelas dengan overlap periode.
- CRUD susunan jam per semester dengan jenis `LESSON`, `BREAK`, atau `PRAYER`; mendukung istirahat dan waktu sholat.
- Seed contoh susunan jam memuat 8 jam pelajaran, dua istirahat, dan sholat dzuhur.
- Tampilan kalender mingguan (grid di desktop/tablet, tab hari + timeline di mobile).
- Filter guru/kelas/mapel/hari + pencarian untuk Admin/Waka; guru hanya melihat jadwal sendiri.
- Tampilan daftar tetap tersedia di bawah kalender untuk Admin/Waka yang mengelola slot, dengan sorting, grouping per hari, dan pagination server-side.
- Jika susunan jam sudah diatur, nomor jam pada jadwal harus ada di susunan jam (`LESSON`); jika belum diatur, jadwal tetap boleh dibuat.
- Copy jadwal dan susunan jam dari semester sebelumnya — P1 (diimplementasikan).
  - Sumber dipilih dari semester yang lebih awal; default semester terdekat.
  - Susunan jam disalin hanya jika semester tujuan belum memiliki susunan jam.
  - Kelas tujuan dipetakan mengikuti aturan promosi atau kenaikan tingkat (X → XI); kelas tanpa padanan dilewati.
  - Jadwal dengan guru-mapel tidak terpetakan, nomor jam tidak tersedia, atau bentrok dengan jadwal tujuan dilewati dan dilaporkan.
  - Penyalinan memakai satu transaksi dan dicatat di audit log.
- Susunan jam berbeda per hari (mis. Jumat lebih pendek) — P1.

### FR-04 Jurnal dan Absensi — P0

- Form jurnal per slot jadwal dan tanggal.
- Absensi exception-based.
- Transaksi atomik.
- Unique `(schedule_id, date)`.
- Riwayat jurnal per guru dan monitoring semua jurnal.
- Riwayat mendukung pencarian materi/aktivitas/guru/mapel/kelas, filter semester/tanggal/guru/kelas/mapel, sorting, grouping per tanggal, dan pagination server-side.
- Detail jurnal menampilkan daftar hadir dan tidak hadir.
- Window edit 7 hari — P1.

### FR-05 Naik Kelas — P0

- Mapping `class_promotion_rules`.
- Pratinjau (dry-run) sebelum commit.
- Commit atomik + audit batch.
- Cancel batch jika tahun tujuan belum aktif.
- Export hasil promosi — P1.

### FR-06 Rekap dan Laporan — P0

- Rekap absensi per siswa/kelas/mapel/periode.
- Ringkasan rekap per kelas, pencarian siswa, sorting, dan pagination server-side.
- Rekap jurnal per guru/periode.
- Export CSV rekap absensi mengikuti seluruh filter aktif (termasuk pencarian).
- Dashboard monitoring coverage harian.

### FR-07 Audit Log — P1 (diimplementasikan untuk aksi kritis)

- Jadwal, promosi, dan aktivasi tahun ajaran.
- Filter aktor/aksi/entitas/tanggal, pencarian, sorting, dan pagination server-side.

### FR-08 Import Excel Siswa — P1 (diimplementasikan)

- Admin dapat mengunduh template `.xlsx` dan mengunggahnya kembali dari halaman `/admin/siswa`.
- Kolom template: NISN, Nama Lengkap, Jenis Kelamin (L/P), Tanggal Lahir (opsional, `YYYY-MM-DD`), dan Kelas (opsional).
- Template mengikuti tahun ajaran yang dipilih pada filter; sheet **Kelas** memuat daftar kelas yang valid.
- Jika kolom Kelas diisi, import sekaligus membuat enrollment pada tahun ajaran tersebut dalam transaksi yang sama. Nama kelas harus cocok dengan kelas yang tersedia.
- Siswa dengan NISN yang sudah terdaftar tidak dibuat ulang, tetapi tetap dapat di-enroll bila kolom Kelas diisi dan belum punya enrollment pada tahun ajaran itu.
- Validasi seluruh baris sebelum insert; file dengan baris bermasalah ditolak dengan laporan nomor baris.
- NISN duplikat di dalam file dianggap error.
- Maksimal 5000 baris dan 5 MB per file. Import siswa dan enrollment dicatat di audit log.

### FR-09 Notifikasi In-App — P2

- Banner jadwal belum diisi sudah ditampilkan sebagai bagian dashboard guru.

### 7.1 Permission Matrix

| Permission | ADMIN | WAKA_KURIKULUM | GURU |
|---|---|---|---|
| `manage:master_data` | ✅ | ❌ | ❌ |
| `manage:jadwal` | ✅ | ✅ | ❌ |
| `manage:mapping_guru_mapel` | ✅ | ✅ | ❌ |
| `read:jadwal_own` | ✅ | ✅ | ✅ |
| `create:jurnal_own` | ✅ | ✅ (jika GURU) | ✅ |
| `read:jurnal_all` | ✅ | ✅ | ❌ |
| `create:absensi_own_jurnal` | ✅ | ✅ (jika GURU) | ✅ |
| `read:rekap_absensi` | ✅ | ✅ | ✅ (kelas diajar) |
| `manage:promotion_rules` | ✅ | ✅ | ❌ |
| `execute:promotion` | ✅ | ❌ | ❌ |
| `cancel:promotion_batch` | ✅ | ❌ | ❌ |
| `read:audit_log` | ✅ | ✅ (read-only) | ❌ |

**Aturan tambahan:** selain permission, server action wajib memeriksa kepemilikan resource (misalnya `journal.teacher_id === user.id`) untuk aksi “own”.

---

## 8. Non-Functional Requirements

| Aspek | Target |
|---|---|
| Performa | TTFB halaman utama < 2 detik; query DB < 200 ms |
| Skalabilitas | 1.500 siswa, 80 guru, 60 kelas, ±50.000 jurnal/tahun; daftar data memakai pagination server-side (default 20, opsi 10/20/50/100) |
| Availability | 99% best effort pada Hobby tier |
| Keamanan | bcrypt, cookie httpOnly, CSRF bawaan Server Actions/Auth.js, otorisasi di DAL/action |
| Aksesibilitas | WCAG 2.1 AA untuk alur utama |
| Auditabilitas | Aksi kritis tercatat di `audit_logs` |
| Backup | Neon PITR sesuai tier + export CSV rekap |
| Zona waktu | Tanggal “hari ini” dihitung pada `Asia/Jakarta` |

---

## 9. Batasan Teknis dan Keputusan

- **Vercel Hobby** hanya untuk non-komersial. Upgrade wajib jika dikomersialkan.
- **Neon Free**: 1 GB storage, 100 CU-hours/bulan. Gunakan HTTP driver untuk query biasa dan Pool driver untuk transaksi.
- **Auth.js v5** Credentials, tanpa email verification.
- **Tanpa Redis/queue**. Semua proses sinkron; promosi memakai batch insert dalam satu transaksi.
- **Cache Components dimatikan** karena hampir semua halaman dashboard bergantung pada session dan data real-time. Halaman dashboard memakai dynamic rendering; caching dilakukan secara selektif bila diperlukan.
- **Form:** native `<form>` + Server Actions + `useActionState`; Zod menjadi single source of truth validasi. Tidak memakai react-hook-form pada v1.
- **UI primitives:** komponen lokal `components/ui` bergaya shadcn/ui, tanpa Radix pada v1.
- **Asumsi:** sekolah memiliki koneksi internet yang stabil.

---

## 10. Rencana Rilis

| Milestone | Isi | Status |
|---|---|---|
| **M0 Fondasi** | Setup stack, auth, RBAC, schema, app shell, seed | Selesai |
| **M1 Jadwal** | CRUD jadwal, susunan jam + istirahat/sholat, kalender responsif, validasi bentrok | Selesai |
| **M2 Jurnal + Absensi** | Alur guru, transaksi atomik, monitoring, riwayat | Selesai |
| **M3 Naik Kelas** | Mapping, pratinjau, commit, cancel, audit | Selesai (override per siswa P1) |
| **M4 Rekap + Laporan** | Rekap absensi, coverage jurnal, export CSV | Selesai |
| **M5 Pilot** | UAT, perbaikan, dokumentasi | Belum |

---

## 11. Risiko dan Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Guru lupa mengisi jurnal | Data tidak lengkap | Dashboard “belum diisi” + monitoring Waka |
| Salah eksekusi naik kelas | Data siswa rusak | Pratinjau, commit atomik, cancel batch, audit |
| Kuota Neon habis | Aplikasi down | Query efisien, index, pantau usage |
| Vercel Hobby komersial | Pelanggaran ToS | Dokumentasikan upgrade |
| Perubahan jadwal setelah jurnal | Data tidak konsisten | Snapshot `journals.teacher_id`, larang hapus slot ber-jurnal |
| Timezone server | Salah hari | Helper tanggal `Asia/Jakarta` di `lib/date.ts` |

---

## 12. Pertanyaan Terbuka

1. Apakah Waka boleh eksekusi promosi? **Keputusan v1: hanya Admin.**
2. Window edit jurnal? **Keputusan v1: tanpa batas; P1 7 hari.**
3. Wali kelas eksplisit? **Tidak; gunakan `classes.homeroom_teacher_id`.**
4. Retensi data lulusan? **Belum diputuskan; data tidak dihapus pada v1.**
5. Jurnal untuk KBM di luar jadwal? **Tidak ada di v1.**

---

## 13. Glosarium

- **Jurnal** — catatan satu pertemuan KBM, terikat `schedule_id` + `date`.
- **Slot jadwal** — kombinasi guru × mapel × kelas × semester × hari × jam.
- **Susunan jam** — daftar entri jam per semester berisi jam pelajaran, istirahat, atau waktu sholat beserta jam mulai/selesai.
- **Enrollment** — penempatan siswa pada kelas di tahun ajaran tertentu.
- **Batch promosi** — satu eksekusi naik kelas untuk transisi tahun ajaran.
- **Coverage jurnal** — persentase slot yang sudah diisi jurnal pada periode tertentu.
- **Snapshot guru** — `journals.teacher_id` disalin saat jurnal dibuat agar histori tidak berubah.


