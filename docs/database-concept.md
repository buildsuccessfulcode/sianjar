# Database Concept — SiJAR

| Field | Value |
|---|---|
| DBMS | PostgreSQL 16 (Neon) |
| ORM | Drizzle ORM |
| Driver | `@neondatabase/serverless` — HTTP untuk query, Pool/WebSocket untuk transaksi |
| Naming | `snake_case` untuk tabel/kolom; `camelCase` untuk property TypeScript |
| Primary key | UUID `gen_random_uuid()` |
| Audit kolom | `created_at`, `updated_at`, `deleted_at` pada entitas master/operasional |
| Soft delete | `deleted_at IS NULL` berarti aktif |

Implementasi aktual: `db/schema/*.ts`, koneksi: `lib/db.ts`, migration: `drizzle/`.

---

## 1. Prinsip Desain

1. **Histori tidak boleh hilang.** Kelas siswa dan jadwal lintas tahun dimodelkan sebagai baris baru, bukan update kolom.
2. **Absensi adalah exception.** Hanya ketidakhadiran disimpan. Kehadiran = total siswa aktif di kelas − jumlah baris absensi.
3. **Jadwal adalah jangkar.** Jurnal terikat ke `schedule_id` + `date`; absensi terikat ke `journal_id`.
4. **Foreign key wajib, cascade terkendali.**
   - `ON DELETE RESTRICT` untuk master data historis.
   - `ON DELETE CASCADE` hanya untuk anak murni: `attendance_records` → `journals`, `user_roles` → `users`.
5. **Index untuk query umum:** `(schedule_id, date)`, `(student_id, academic_year_id)`, `(teacher_id, semester_id, day_of_week)`, `(class_id, academic_year_id)`.
6. **Transaksi atomik** untuk jurnal + absensi dan promosi massal.
7. **Snapshot guru** pada jurnal: `journals.teacher_id` disalin dari jadwal saat jurnal dibuat.
8. **Status aktif tunggal** dijaga partial unique index.
9. **Bentrok jadwal** divalidasi di server (overlap interval), karena unique index pada `period_start` saja tidak cukup.

---

## 2. ERD Ringkas

```text
users ──< user_roles
users ─── teacher_profiles (1:1)

academic_years ──< semesters ──< schedules
semesters ──< time_slots
academic_years ──< classes
departments ──< classes
subjects ──< schedules
users(teacher) ──< schedules
users(teacher) ──< teacher_subjects >── subjects

students ──< student_enrollments >── classes
                                >── academic_years
                                >── promotion_batches

classes ──< class_promotion_rules >── classes (to_class)
promotion_batches ── (from_year, to_year)

schedules ──< journals ──< attendance_records >── students
audit_logs >── users(actor)
```

---

## 3. Enum

| Enum | Nilai |
|---|---|
| `role` | `ADMIN`, `GURU`, `WAKA_KURIKULUM` |
| `semester_name` | `GANJIL`, `GENAP` |
| `time_slot_kind` | `LESSON`, `BREAK`, `PRAYER` |
| `attendance_status` | `SAKIT`, `IZIN`, `ALPA`, `DISPENSASI` |
| `enrollment_status` | `ACTIVE`, `COMPLETED`, `GRADUATED`, `TRANSFERRED`, `DROPPED_OUT` |
| `promotion_action` | `PROMOTE`, `RETAIN`, `GRADUATE`, `TRANSFERRED`, `DROPPED_OUT` |
| `promotion_batch_status` | `DRAFT`, `COMMITTED`, `CANCELLED` |

> `HADIR` bukan nilai enum karena kehadiran tidak disimpan. UI menampilkan `HADIR` untuk siswa tanpa baris absensi.

---

## 4. Definisi Tabel

### 4.1 `users`

| Kolom | Tipe | Constraint |
|---|---|---|
| `id` | uuid | PK, default random |
| `email` | varchar(255) | UNIQUE, NOT NULL |
| `password_hash` | text | NOT NULL |
| `name` | varchar(255) | NOT NULL |
| `is_active` | boolean | NOT NULL DEFAULT true |
| `created_at` | timestamptz | NOT NULL DEFAULT now() |
| `updated_at` | timestamptz | NOT NULL DEFAULT now() |
| `deleted_at` | timestamptz | NULL |

Index: `users_email_unique`, `users_deleted_at_idx`.

### 4.2 `user_roles`

| Kolom | Tipe | Constraint |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | FK `users(id)` ON DELETE CASCADE |
| `role` | enum `role` | NOT NULL |

UNIQUE `(user_id, role)`.

### 4.3 `teacher_profiles`

| Kolom | Tipe | Constraint |
|---|---|---|
| `user_id` | uuid | PK, FK `users(id)` ON DELETE CASCADE |
| `nip` | varchar(30) | UNIQUE, NULL |
| `expertise_note` | text | NULL |
| `created_at` | timestamptz | NOT NULL DEFAULT now() |
| `updated_at` | timestamptz | NOT NULL DEFAULT now() |

### 4.4 `academic_years`

| Kolom | Tipe | Constraint |
|---|---|---|
| `id` | uuid | PK |
| `name` | varchar(20) | UNIQUE, NOT NULL — contoh `2026/2027` |
| `start_date` | date | NOT NULL |
| `end_date` | date | NOT NULL |
| `is_active` | boolean | NOT NULL DEFAULT false |
| `created_at`, `updated_at` | timestamptz | NOT NULL DEFAULT now() |
| `deleted_at` | timestamptz | NULL |

Partial unique index: `academic_years_single_active` pada `(is_active) WHERE is_active = true`.

### 4.5 `semesters`

| Kolom | Tipe | Constraint |
|---|---|---|
| `id` | uuid | PK |
| `academic_year_id` | uuid | FK `academic_years(id)` |
| `name` | enum `semester_name` | NOT NULL |
| `start_date` | date | NOT NULL |
| `end_date` | date | NOT NULL |
| `is_active` | boolean | NOT NULL DEFAULT false |
| `created_at`, `updated_at` | timestamptz | NOT NULL DEFAULT now() |
| `deleted_at` | timestamptz | NULL |

UNIQUE `(academic_year_id, name)`.
Partial unique index: `semesters_single_active` pada `(is_active) WHERE is_active = true`.
Aturan aplikasi: semester aktif harus berada pada tahun ajaran aktif.

### 4.6 `departments`

| Kolom | Tipe | Constraint |
|---|---|---|
| `id` | uuid | PK |
| `code` | varchar(20) | UNIQUE, NOT NULL |
| `name` | varchar(100) | NOT NULL |
| `is_active` | boolean | NOT NULL DEFAULT true |
| `created_at`, `updated_at`, `deleted_at` | timestamptz | |

### 4.7 `classes`

| Kolom | Tipe | Constraint |
|---|---|---|
| `id` | uuid | PK |
| `academic_year_id` | uuid | FK `academic_years(id)` |
| `department_id` | uuid | FK `departments(id)` |
| `grade_level` | integer | NOT NULL, CHECK 7–12 |
| `section` | varchar(10) | NOT NULL |
| `homeroom_teacher_id` | uuid | FK `users(id)`, NULL |
| `is_active` | boolean | NOT NULL DEFAULT true |
| `created_at`, `updated_at`, `deleted_at` | timestamptz | |

UNIQUE `(academic_year_id, department_id, grade_level, section)`.
Index: `(academic_year_id)`, `(department_id)`.

### 4.8 `subjects`

| Kolom | Tipe | Constraint |
|---|---|---|
| `id` | uuid | PK |
| `code` | varchar(20) | UNIQUE, NOT NULL |
| `name` | varchar(100) | NOT NULL |
| `is_active` | boolean | NOT NULL DEFAULT true |
| `created_at`, `updated_at`, `deleted_at` | timestamptz | |

### 4.9 `teacher_subjects`

| Kolom | Tipe | Constraint |
|---|---|---|
| `teacher_id` | uuid | FK `users(id)` ON DELETE CASCADE |
| `subject_id` | uuid | FK `subjects(id)` ON DELETE CASCADE |

PK komposit `(teacher_id, subject_id)`.
Dipakai untuk mapping guru–mapel dan validasi pilihan mapel pada jadwal.

### 4.10 `students`

| Kolom | Tipe | Constraint |
|---|---|---|
| `id` | uuid | PK |
| `nisn` | varchar(20) | UNIQUE, NOT NULL |
| `name` | varchar(255) | NOT NULL |
| `gender` | enum `gender` (`L`, `P`) | NOT NULL |
| `birth_date` | date | NULL |
| `is_active` | boolean | NOT NULL DEFAULT true |
| `created_at`, `updated_at`, `deleted_at` | timestamptz | |

**Penting:** tidak ada `class_id` di `students`. Kelas diambil dari enrollment.

### 4.11 `student_enrollments`

| Kolom | Tipe | Constraint |
|---|---|---|
| `id` | uuid | PK |
| `student_id` | uuid | FK `students(id)` |
| `class_id` | uuid | FK `classes(id)` |
| `academic_year_id` | uuid | FK `academic_years(id)` |
| `status` | enum `enrollment_status` | NOT NULL DEFAULT `ACTIVE` |
| `promotion_batch_id` | uuid | FK `promotion_batches(id)`, NULL |
| `created_at`, `updated_at` | timestamptz | NOT NULL DEFAULT now() |
| `deleted_at` | timestamptz | NULL |

UNIQUE `(student_id, academic_year_id)` — satu siswa hanya satu kelas per tahun.
Index: `(class_id)`, `(academic_year_id)`, `(student_id)`.
Aturan: `class.academic_year_id` harus sama dengan `academic_year_id` (divalidasi server).

### 4.12 `class_promotion_rules`

| Kolom | Tipe | Constraint |
|---|---|---|
| `id` | uuid | PK |
| `from_class_id` | uuid | FK `classes(id)` |
| `to_class_id` | uuid | FK `classes(id)`, NULL untuk lulus |
| `academic_year_from_id` | uuid | FK `academic_years(id)` |
| `academic_year_to_id` | uuid | FK `academic_years(id)` |
| `action` | enum `promotion_action` | NOT NULL |
| `created_at`, `updated_at` | timestamptz | |

UNIQUE `(from_class_id, academic_year_to_id)`.

### 4.13 `promotion_batches`

| Kolom | Tipe | Constraint |
|---|---|---|
| `id` | uuid | PK |
| `from_academic_year_id` | uuid | FK `academic_years(id)` |
| `to_academic_year_id` | uuid | FK `academic_years(id)` |
| `status` | enum `promotion_batch_status` | NOT NULL DEFAULT `DRAFT` |
| `created_by` | uuid | FK `users(id)` |
| `committed_at` | timestamptz | NULL |
| `cancelled_at` | timestamptz | NULL |
| `summary` | jsonb | ringkasan `{promote, retain, graduate, transferred, droppedOut}` |
| `created_at`, `updated_at` | timestamptz | |

Index: `(from_academic_year_id, to_academic_year_id)`.

### 4.14 `schedules`

| Kolom | Tipe | Constraint |
|---|---|---|
| `id` | uuid | PK |
| `semester_id` | uuid | FK `semesters(id)` |
| `teacher_id` | uuid | FK `users(id)` |
| `subject_id` | uuid | FK `subjects(id)` |
| `class_id` | uuid | FK `classes(id)` |
| `day_of_week` | smallint | NOT NULL, CHECK 1–7 (1=Senin) |
| `period_start` | smallint | NOT NULL |
| `period_end` | smallint | NOT NULL |
| `room` | varchar(50) | NULL |
| `is_active` | boolean | NOT NULL DEFAULT true |
| `created_at`, `updated_at` | timestamptz | NOT NULL DEFAULT now() |
| `deleted_at` | timestamptz | NULL |

Constraint:
- CHECK `period_end >= period_start`.
- UNIQUE `(semester_id, teacher_id, day_of_week, period_start)`.
- UNIQUE `(semester_id, class_id, day_of_week, period_start)`.
- Index `(teacher_id, semester_id, day_of_week)`, `(class_id, semester_id, day_of_week)`.

Validasi overlap (server):
```text
existing.period_start <= new.period_end AND existing.period_end >= new.period_start
```
dilakukan untuk guru dan kelas pada semester + hari yang sama, mengecualikan `id` yang sedang diedit dan baris soft-deleted.

Jika semester sudah memiliki `time_slots` bertipe `LESSON`, `period_start` dan `period_end` wajib merujuk nomor jam yang tersedia. Validasi ini menjaga kalender tetap dapat memetakan jadwal ke jam sebenarnya.

### 4.15 `journals`

| Kolom | Tipe | Constraint |
|---|---|---|
| `id` | uuid | PK |
| `schedule_id` | uuid | FK `schedules(id)` |
| `date` | date | NOT NULL |
| `teacher_id` | uuid | FK `users(id)` — snapshot |
| `material` | text | NOT NULL |
| `activity` | text | NOT NULL |
| `notes` | text | NULL |
| `created_by` | uuid | FK `users(id)` |
| `created_at`, `updated_at` | timestamptz | NOT NULL DEFAULT now() |

UNIQUE `(schedule_id, date)` — satu jurnal per pertemuan.
Index: `date`, `(schedule_id, date)`, `teacher_id`.

### 4.16 `attendance_records`

| Kolom | Tipe | Constraint |
|---|---|---|
| `id` | uuid | PK |
| `journal_id` | uuid | FK `journals(id)` ON DELETE CASCADE |
| `student_id` | uuid | FK `students(id)` |
| `status` | enum `attendance_status` | NOT NULL, hanya 4 nilai tidak hadir |
| `note` | varchar(255) | NULL |

UNIQUE `(journal_id, student_id)`.
Index: `(journal_id)`, `(student_id)`.

### 4.17 `audit_logs`

| Kolom | Tipe | Constraint |
|---|---|---|
| `id` | uuid | PK |
| `actor_id` | uuid | FK `users(id)` |
| `action` | varchar(50) | NOT NULL — `schedule.create`, `promotion.commit`, dll |
| `entity_type` | varchar(50) | NOT NULL |
| `entity_id` | uuid | NULL |
| `payload` | jsonb | NULL |
| `created_at` | timestamptz | NOT NULL DEFAULT now() |

Index: `(created_at)`, `(entity_type, entity_id)`.

### 4.18 `time_slots` — susunan jam semester

| Kolom | Tipe | Constraint |
|---|---|---|
| `id` | uuid | PK |
| `semester_id` | uuid | FK `semesters(id)` |
| `label` | varchar(64) | NOT NULL — mis. `Jam 1`, `Istirahat`, `Sholat Dzuhur` |
| `kind` | enum `time_slot_kind` | NOT NULL DEFAULT `LESSON` |
| `period_number` | smallint | NULL; wajib 1–20 untuk `LESSON`, NULL untuk `BREAK`/`PRAYER` |
| `start_time` | time | NOT NULL |
| `end_time` | time | NOT NULL |
| `created_at`, `updated_at` | timestamptz | NOT NULL DEFAULT now() |

Constraint:
- CHECK `end_time > start_time`.
- CHECK `(kind = 'LESSON' AND period_number BETWEEN 1 AND 20) OR (kind <> 'LESSON' AND period_number IS NULL)`.
- UNIQUE parsial `(semester_id, period_number) WHERE period_number IS NOT NULL`.
- Index `(semester_id, start_time)`.

Aturan aplikasi:
- Satu semester memiliki satu susunan jam yang dipakai untuk semua hari (variasi per hari P1).
- Rentang waktu antar entri tidak boleh overlap; divalidasi server.
- `schedules.period_start`/`period_end` merujuk `period_number` untuk menghitung jam tampilan pada kalender.
- Istirahat dan sholat tidak membuat baris `schedules`; hanya ditampilkan dari `time_slots`.

---

## 5. Index Wajib

Didefinisikan di schema Drizzle dan/atau migration:

```sql
CREATE INDEX idx_schedules_teacher_sem_day ON schedules(teacher_id, semester_id, day_of_week);
CREATE INDEX idx_schedules_class_sem_day   ON schedules(class_id, semester_id, day_of_week);
CREATE INDEX idx_journals_date             ON journals(date);
CREATE INDEX idx_journals_schedule_date    ON journals(schedule_id, date);
CREATE INDEX idx_journals_teacher          ON journals(teacher_id);
CREATE INDEX idx_attendance_journal        ON attendance_records(journal_id);
CREATE INDEX idx_attendance_student        ON attendance_records(student_id);

CREATE INDEX enrollments_class_idx          ON student_enrollments(class_id);
CREATE UNIQUE INDEX enrollments_student_year_unique ON student_enrollments(student_id, academic_year_id);

CREATE UNIQUE INDEX academic_years_single_active ON academic_years(is_active) WHERE is_active = true;
CREATE UNIQUE INDEX semesters_single_active ON semesters(is_active) WHERE is_active = true;
```

---

## 6. Transaksi Kritis

### 6.1 Simpan jurnal + absensi

```text
BEGIN
  validasi user adalah guru pemilik jadwal (atau Admin)
  pastikan belum ada jurnal untuk (schedule_id, date), kecuali edit jurnal yang sama
  INSERT journal (teacher_id = schedule.teacher_id)
  INSERT attendance_records hanya untuk siswa berstatus != HADIR
  INSERT audit_logs (opsional, aksi edit)
COMMIT
```

Semua siswa yang dimasukkan harus terdaftar `ACTIVE` pada kelas jadwal dan tahun ajaran semester berjalan.

### 6.2 Commit promosi

```text
BEGIN
  lock/validate batch + tahun ajaran tujuan belum aktif
  INSERT promotion_batches status COMMITTED
  untuk setiap enrollment ACTIVE di tahun asal:
    - PROMOTE/RETAIN -> INSERT enrollment baru (student, to_class, to_year, ACTIVE, batch)
    - GRADUATE/TRANSFERRED/DROPPED_OUT -> UPDATE enrollment asal + status akhir
    - UPDATE enrollment asal menjadi COMPLETED (atau GRADUATED)
  INSERT audit_logs
COMMIT
```

Rollback otomatis jika salah satu insert gagal.

### 6.3 Cancel promosi

- Hanya batch `COMMITTED`.
- Tahun tujuan belum aktif.
- Hapus enrollment baru yang memiliki `promotion_batch_id` batch tersebut.
- Kembalikan enrollment asal ke `ACTIVE` dan kosongkan `promotion_batch_id`.
- Batch menjadi `CANCELLED` + `cancelled_at`.
- Catat audit.

---

## 7. Pola Query Penting

### Siswa aktif di kelas (form jurnal)

```sql
SELECT s.id, s.nisn, s.name
FROM student_enrollments e
JOIN students s ON s.id = e.student_id
WHERE e.class_id = $1
  AND e.academic_year_id = $2
  AND e.status = 'ACTIVE'
  AND e.deleted_at IS NULL
  AND s.deleted_at IS NULL
ORDER BY s.name;
```

### Jadwal guru hari ini + status jurnal

```sql
SELECT sch.id, sub.name AS subject, c.grade_level, c.section,
       sch.period_start, sch.period_end, j.id AS journal_id
FROM schedules sch
JOIN subjects sub ON sub.id = sch.subject_id
JOIN classes c ON c.id = sch.class_id
LEFT JOIN journals j ON j.schedule_id = sch.id AND j.date = $today
WHERE sch.teacher_id = $teacherId
  AND sch.semester_id = $activeSemesterId
  AND sch.day_of_week = $dow
  AND sch.deleted_at IS NULL
ORDER BY sch.period_start;
```

### Coverage jurnal

```sql
SELECT COUNT(*) AS total,
       COUNT(j.id) AS filled
FROM schedules sch
LEFT JOIN journals j ON j.schedule_id = sch.id AND j.date = $date
WHERE sch.semester_id = $semesterId
  AND sch.day_of_week = $dow
  AND sch.deleted_at IS NULL;
```

### Rekap absensi per siswa

```sql
SELECT s.name, s.nisn,
       COUNT(*) FILTER (WHERE a.status = 'SAKIT') AS sakit,
       COUNT(*) FILTER (WHERE a.status = 'IZIN') AS izin,
       COUNT(*) FILTER (WHERE a.status = 'ALPA') AS alpa,
       COUNT(*) FILTER (WHERE a.status = 'DISPENSASI') AS dispensasi,
       COUNT(*) AS total
FROM attendance_records a
JOIN journals j ON j.id = a.journal_id
JOIN students s ON s.id = a.student_id
WHERE j.date BETWEEN $from AND $to
  AND ($classId IS NULL OR s.id IN (
    SELECT student_id FROM student_enrollments
    WHERE class_id = $classId AND academic_year_id = $yearId
  ))
GROUP BY s.id, s.name, s.nisn
ORDER BY s.name;
```

---

## 8. Aturan Integritas (Checklist Review)

- [x] Tidak ada `class_id` di `students`.
- [x] Absensi hanya menyimpan siswa tidak hadir.
- [x] Satu jurnal per `(schedule_id, date)`.
- [x] Satu enrollment per `(student_id, academic_year_id)`.
- [x] Hanya satu `academic_years.is_active = true`.
- [x] Hanya satu `semesters.is_active = true`.
- [x] `journals.teacher_id` snapshot dari `schedules.teacher_id`.
- [x] `attendance_records` cascade jika jurnal dihapus.
- [x] Tidak ada hard delete master data yang punya riwayat.
- [x] Overlap jadwal divalidasi server (guru & kelas).
- [x] Enrollment `class.academic_year_id` = `enrollment.academic_year_id` (validasi server).
- [x] Susunan jam tidak overlap dan nomor jam pelajaran unik per semester.
- [x] Istirahat/sholat tersimpan di `time_slots`, bukan sebagai jadwal mengajar.

---

## 9. Migrasi dan Seed

```bash
npm run db:generate   # generate SQL migration dari schema
npm run db:migrate    # apply migration
npm run db:push       # alternatif untuk development
npm run db:seed       # seed admin, waka, guru, kelas, siswa, jadwal
```

Konfigurasi ada di `drizzle.config.ts`. Semua migration disimpan di `drizzle/` dan wajib di-commit.

