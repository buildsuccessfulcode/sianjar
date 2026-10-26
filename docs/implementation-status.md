# Implementation Status — SiJAR

Terakhir diperbarui: 2026-10-26.

Dokumen ini mencatat apa yang sudah diimplementasikan, apa yang belum, dan batasan yang diketahui. Perbarui setiap menyelesaikan milestone.

---

## 1. Ringkasan

| Area | Status | Catatan |
|---|---|---|
| Fondasi Next.js 16 + Tailwind 4 | ✅ | App Router, Server Components, Server Actions |
| Auth.js v5 Credentials + JWT | ✅ | Session 7 hari, multi-role, login generik |
| RBAC matrix + ownership checks | ✅ | Permission matrix, cek kepemilikan jurnal/jadwal |
| Schema database + migration | ✅ | 18 tabel, enum, index, partial unique index |
| Seed data pilot | ✅ | Admin, Waka+Guru, 2 guru, kelas, siswa, jadwal, jurnal |
| Master data CRUD | ✅ | Tahun ajaran, semester, jurusan, kelas, mapel, guru, siswa |
| Enrollment manual | ✅ | Create satuan/massal, edit kelas/status, pindah kelas massal, reaktivasi, validasi tahun kelas |
| Mapping guru–mapel | ✅ | Tambah/hapus mapping |
| Jadwal CRUD + validasi bentrok | ✅ | Overlap guru/kelas, mapping mapel, ownership |
| Susunan jam & istirahat | ✅ | `time_slots`: LESSON/BREAK/PRAYER, contoh 8 jam + dzuhur |
| Kalender jadwal responsif | ✅ | Grid mingguan desktop/tablet, tab hari + timeline mobile |
| Jurnal + absensi atomik | ✅ | Satu transaksi, exception-based attendance |
| Dashboard guru | ✅ | Jadwal hari ini + status jurnal |
| Monitoring Waka/Admin | ✅ | Coverage, daftar belum diisi, filter |
| Riwayat/detail jurnal | ✅ | Daftar hadir lengkap, statistik |
| Rekap absensi + CSV | ✅ | Filter tanggal/kelas/mapel, batas guru |
| Naik kelas | ✅ | Pratinjau, commit atomik, cancel, audit |
| Audit log | ✅ | Jadwal, promosi, aktivasi tahun/semester |
| Responsive AppShell | ✅ | Sidebar desktop, drawer mobile |
| Toast & modal feedback | ✅ | Toast global, form tambah/edit di modal, konfirmasi aksi di modal |
| Cache Components | ⛔ sengaja dimatikan | Dashboard dynamic |
| Import CSV | ❌ P1 | Belum |
| Override promosi per siswa | ❌ P1 | Mapping per kelas; backend mendukung status per enrollment |
| Edit jurnal window 7 hari | ❌ P1 | Saat ini tanpa batas |
| Pagination tabel | ❌ | Limit 100–200 baris |

---

## 2. File Map

### Auth & shell

- `lib/auth.ts` — konfigurasi Auth.js.
- `lib/dal.ts` — `getCurrentUser`, `requirePermission`, `assertPermission`.
- `lib/permissions.ts` — permission matrix.
- `types/next-auth.d.ts` — augmentasi session/JWT.
- `app/(auth)/login/*` — halaman dan form login.
- `app/api/auth/[...nextauth]/route.ts` — handler Auth.js.
- `components/domain/app-shell.tsx` — navigasi per role.
- `app/(app)/layout.tsx` — guard session + shell.
- `app/(app)/actions.ts` — logout.

### Database

- `db/schema/enums.ts`
- `db/schema/auth.ts`
- `db/schema/academic.ts`
- `db/schema/scheduling.ts` — jadwal, jurnal, absensi, dan `time_slots`
- `db/schema/audit.ts`
- `db/schema/index.ts`
- `db/seed.ts`
- `drizzle/0000_*.sql` — migration awal.
- `lib/db.ts` — lazy HTTP dan Pool.
- `lib/audit.ts` — helper audit.

### Data access

- `data-access/master.ts` — master data + enrollment + mapping.
- `data-access/schedules.ts` — jadwal, monitoring, form context.
- `data-access/time-slots.ts` — susunan jam, istirahat, sholat, validasi overlap.
- `data-access/journals.ts` — simpan jurnal, detail, rekap.
- `data-access/promotions.ts` — pratinjau, commit, cancel, riwayat.
- `data-access/audit.ts` — list audit.

### UI

- `components/ui/*` — primitives lokal: button, card, form, badge, table, alert, stat, action-form, confirm-submit, submit-button, toast, flash-toast, modal, modal-form.
- `components/domain/attendance-form.tsx` — form jurnal + absensi client.
- `components/domain/schedule-card.tsx` — kartu jadwal guru.
- `components/domain/teaching-calendar.tsx` — kalender mingguan responsif + istirahat/sholat.

### Routes

| Route | Akses |
|---|---|
| `/login` | publik |
| `/dashboard` | semua user login |
| `/jadwal` | semua (guru: jadwal sendiri; Admin/Waka: kelola semua) |
| `/jadwal/jam` | Admin, Waka |
| `/jurnal` | semua (guru: milik sendiri) |
| `/jurnal/isi/[scheduleId]` | guru pemilik atau Admin |
| `/jurnal/[id]` | guru pemilik, Admin, Waka |
| `/rekap/absensi` | semua (guru: kelas diajar) |
| `/rekap/absensi/export` | route handler CSV |
| `/guru-mapel` | Admin, Waka |
| `/promosi` | Admin (commit), Waka (preview) |
| `/audit` | Admin, Waka |
| `/admin/*` | Admin |

---

## 3. Environment dan Menjalankan

```bash
cp .env.example .env.local
# isi DATABASE_URL dan AUTH_SECRET
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Generate ulang migration setelah mengubah schema:

```bash
npm run db:generate
npm run db:migrate
```

Akun seed (password default `Admin123!`, dapat diubah lewat env):

| Email | Role |
|---|---|
| `admin@sekolah.sch.id` | ADMIN |
| `waka@sekolah.sch.id` | WAKA_KURIKULUM + GURU |
| `sari@sekolah.sch.id` | GURU |
| `andi@sekolah.sch.id` | GURU |

Seed membuat tahun ajaran aktif 2026/2027, semester GANJIL aktif, kelas, siswa, jadwal pada hari seed dijalankan, dan satu jurnal contoh.

---

## 4. Verifikasi

Sudah dijalankan:

```bash
npm run typecheck   # lulus
npm run lint        # lulus (0 error)
npm run build       # lulus
npm run db:generate # migration 0001 time_slots berhasil dibuat
```

Build terakhir juga memverifikasi route `/jadwal` dan `/jadwal/jam`.

Belum dijalankan terhadap database Neon nyata (tidak ada kredensial pada environment pengembangan ini). Sebelum pilot, wajib:

1. Jalankan `npm run db:migrate` ke Neon.
2. Jalankan `npm run db:seed`.
3. Uji login tiap role.
4. Uji alur jurnal end-to-end.
5. Uji commit/cancel promosi pada data uji.
6. Uji export CSV.

---

## 5. Batasan dan Gap

1. **Promosi**: mapping dihitung per kelas; belum ada UI override per siswa. Backend menyimpan status per enrollment dan enum sudah mendukung `TRANSFERRED`/`DROPPED_OUT`.
2. **Rekap absensi**: hanya menampilkan siswa dengan minimal satu catatan tidak hadir. Siswa yang selalu hadir tidak muncul (dijelaskan di UI).
3. **Pagination**: tabel memakai limit (audit 100, jurnal 200). Untuk data besar perlu pagination server-side.
4. **Validasi bentrok**: dilakukan di application layer, bukan exclusion constraint PostgreSQL. Untuk konkurensi tinggi, pertimbangkan constraint `btree_gist` atau advisory lock.
5. **Session**: JWT tidak dicek ulang ke DB setiap request. Menonaktifkan user mencegah login baru, tetapi session lama tetap valid sampai 7 hari.
6. **Import CSV** belum ada.
7. **Testing otomatis** belum ada. Verifikasi saat ini typecheck, lint, build, dan uji manual.
8. **Notifikasi** hanya banner dashboard; belum ada notifikasi in-app persisten.
9. **UI primitives** lokal, bukan paket shadcn/ui/Radix. Dialog memakai `window.confirm`.
10. **Timezone**: tanggal hari ini memakai `Asia/Jakarta`; server dan DB harus konsisten menggunakan date string.
11. **Filter status master data**: data soft-deleted disembunyikan; belum ada tampilan/filter khusus data nonaktif.
12. **Susunan jam**: satu susunan dipakai untuk semua hari dalam semester. Variasi per hari (mis. Jumat lebih pendek) belum didukung; kandidat P1.
13. **Kalender**: menampilkan jadwal mingguan, belum menampilkan status jurnal per tanggal. Status jurnal tetap dilihat di dashboard/jurnal.
14. **Nomor jam**: `schedules.period_start`/`period_end` harus mengacu nomor jam yang ada di susunan jam agar blok tampil pada posisi waktu yang tepat. Jika tidak ada, kalender memakai perkiraan slot terdekat.

---

## 6. Next Steps yang Disarankan

1. Uji dengan Neon nyata dan perbaiki error runtime/migration.
2. Tambah pagination dan pencarian server-side pada tabel besar.
3. Tambah override promosi per siswa (P1).
4. Tambah window edit jurnal 7 hari (P1).
5. Tambah import CSV guru/siswa (P1).
6. Tambah unit test untuk `lib/date.ts`, `lib/permissions.ts`, dan `data-access/promotions.ts`.
7. Tambah pagination dan pencarian pada tabel master data.
8. Pertimbangkan audit log untuk perubahan master data penting.
9. Tambah susunan jam berbeda per hari dan kalender berbasis tanggal (mis. melihat minggu tertentu + status jurnal).

