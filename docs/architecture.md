# Architecture & Development Guide — SiJAR

Dokumen ini menjelaskan bagaimana kode disusun dan aturan yang harus diikuti saat menambah fitur.

---

## 1. Stack dan Versi

| Layer | Teknologi |
|---|---|
| Framework | Next.js `16.4.3` (App Router, Server Components, Server Actions) |
| UI runtime | React `19.3.0` |
| Styling | Tailwind CSS `4` (via `@tailwindcss/turbopack`) |
| Auth | `next-auth@beta` (Auth.js v5), Credentials, JWT 7 hari |
| Database | Neon PostgreSQL + Drizzle ORM |
| DB driver | `@neondatabase/serverless` — HTTP untuk reads, Pool untuk transaksi |
| Validasi | Zod |
| Ikon | lucide-react |
| Password | bcryptjs |
| Excel | exceljs (template + parsing import siswa) |
| Deploy | Vercel + Neon |

### Keputusan penting

- **Cache Components dimatikan.** Dashboard bergantung pada session dan data real-time. `next.config.ts` tidak mengaktifkan `cacheComponents`/`partialPrefetching`. Halaman dashboard memakai dynamic rendering.
- **Tidak memakai `middleware`/`proxy` untuk otorisasi.** Semua proteksi dilakukan di server component/data access/server action sesuai rekomendasi Next.js. Redirect optimistik ditangani `getCurrentUser()` di DAL.
- **Tidak memakai Auth.js adapter.** Sesi JWT; `users` dan `user_roles` dibaca pada saat authorize/login. Ini menghindari tabel adapter tambahan.
- **Server Actions adalah mutation layer.** Tidak ada route API CRUD kecuali export Excel rekap absensi dan unduh template import. Server Action upload memakai `bodySizeLimit: "6mb"` (file dibatasi 5 MB).
- **Form menggunakan native form + `useActionState`/`useFormStatus`.** Zod adalah sumber validasi tunggal.

---

## 2. Struktur Folder

```text
app/
  layout.tsx                     root layout
  globals.css                    Tailwind + design token
  page.tsx                       redirect ke /dashboard atau /login
  (auth)/
    login/page.tsx
    login/actions.ts
  (app)/
    layout.tsx                   AppShell + guard session
    dashboard/page.tsx
    jurnal/
      page.tsx                   riwayat/monitoring
      isi/[scheduleId]/page.tsx  form jurnal (query: ?date=)
      [id]/page.tsx              detail
      actions.ts
    jadwal/
      page.tsx                   kalender + kelola jadwal
      actions.ts
      jam/page.tsx               susunan jam, istirahat, sholat
      jam/actions.ts
    rekap/absensi/page.tsx
    rekap/absensi/export/route.ts
    admin/
      tahun-ajaran/page.tsx
      tahun-ajaran/actions.ts
      jurusan/page.tsx
      jurusan/actions.ts
      kelas/page.tsx
      kelas/actions.ts
      mapel/page.tsx
      mapel/actions.ts
      guru/page.tsx
      guru/actions.ts
      siswa/page.tsx
      siswa/actions.ts
      siswa/template/route.ts   unduh template import .xlsx
      enrollment/page.tsx
      enrollment/actions.ts
    guru-mapel/page.tsx
    guru-mapel/actions.ts
    promosi/page.tsx
    promosi/actions.ts
    audit/page.tsx
  api/auth/[...nextauth]/route.ts

components/
  ui/                            primitives (button, input, badge, ...)
  domain/                        komponen domain (app-shell, schedule-card, teaching-calendar, attendance-form, bulk-enrollment-form, enrollment-table)

db/
  schema/                        definisi tabel Drizzle per domain
  index.ts                       export schema + tipe
  seed.ts                        seed data pilot

lib/
  auth.ts                        konfigurasi NextAuth
  dal.ts                         getCurrentUser, requirePagePermission, assertPermission
  permissions.ts                 matrix permission + helper
  db.ts                          koneksi HTTP + Pool
  date.ts                        timezone Asia/Jakarta, format tanggal
  utils.ts                       cn(), format helper
  pagination.ts                  parse page/perPage/sort + metadata + URL builder
  excel/students.ts              template + parsing Excel import siswa (server-only)
  excel/attendance-recap.ts      builder workbook laporan analitik rekap absensi (server-only)
  validators/                    schema Zod per domain
  audit.ts                       helper pencatatan audit

data-access/                    query + aturan bisnis + otorisasi
  master.ts
  schedules.ts
  time-slots.ts                  susunan jam, istirahat, sholat
  journals.ts
  promotions.ts
  account.ts                     ubah password akun sendiri
  audit.ts

scripts/
  load-env.ts                    memuat .env.local/.env untuk drizzle-kit & seed
```

**Aturan import:**
- `data-access/*` tidak boleh diimpor komponen client.
- `components/ui/*` dan `components/domain/*` presentasional; data diberikan via props.
- Server action memanggil data-access setelah `assertPermission()`.
- Jangan akses `getDb()` langsung dari komponen/page; gunakan data-access.

---

## 3. Lapisan Aplikasi

```text
Page / Server Component
        │
        ▼
data-access/*  ← otorisasi resource + query Drizzle
        │
        ▼
lib/db.ts (HTTP / Pool)
        │
        ▼
Neon PostgreSQL
```

```text
Client form
   │ submit
   ▼
Server Action ('use server')
   │ 1. auth + permission
   │ 2. zod validate
   │ 3. data-access transaction
   ▼
redirect / revalidate / return state
```

### Tanggung jawab

| Layer | Boleh | Tidak boleh |
|---|---|---|
| `app/**/page.tsx` | fetch via data-access, render, redirect | query DB langsung, mutasi |
| `components` | presentasi, state UI | import `db`, import data-access |
| `app/**/actions.ts` | auth, validasi, panggil data-access, redirect | query SQL kompleks |
| `data-access` | query, aturan bisnis, transaksi | `redirect`, membaca cookie secara implisit untuk UI |
| `lib` | utilitas lintas domain | aturan bisnis spesifik halaman |

---

## 4. Auth dan Session

### Konfigurasi

`lib/auth.ts`:

- Credentials provider.
- `authorize()`:
  1. validasi Zod `loginSchema`;
  2. cari user aktif & belum soft-deleted;
  3. `bcrypt.compare`;
  4. ambil roles dari `user_roles`;
  5. return `{ id, email, name, roles }`.
- `session.strategy = "jwt"`, `maxAge = 7 hari`.
- Callback `jwt` menyalin `id` dan `roles` ke token.
- Callback `session` menyalin ke `session.user`.
- `pages.signIn = "/login"`.

### Tipe

`types/next-auth.d.ts` menambahkan `roles: Role[]` pada `Session["user"]` dan `JWT`.

### Login action

```ts
'use server'
export async function login(_state: LoginState, formData: FormData) {
  const parsed = loginSchema.safeParse({ ... })
  if (!parsed.success) return { fieldErrors: ... }
  try {
    await signIn('credentials', { ...parsed.data, redirectTo: '/dashboard' })
  } catch (error) {
    if (error instanceof AuthError) return { message: 'Email atau password salah.' }
    throw error
  }
}
```

`signIn` yang berhasil akan melempar redirect internal Auth.js — jangan menangkapnya sebagai error biasa.

### Logout

Server action `signOut({ redirectTo: '/login' })`.

### Proteksi

`lib/dal.ts`:

```ts
export const getCurrentUser = cache(async () => {
  const session = await auth()
  if (!session?.user) redirect('/login')
  return session.user
})

export async function assertPermission(permission: Permission) {
  const user = await getCurrentUser()
  if (!hasPermission(user.roles, permission)) throw new ForbiddenError()
  return user
}
```

> `cache()` hanya mendeduplikasi dalam satu render pass. Server action tetap menjalankan pengecekan setiap kali.

`app/(app)/layout.tsx` memanggil `getCurrentUser()` setelah membungkus konten dinamis. Halaman tetap wajib memakai `requirePagePermission` untuk akses data spesifik.

---

## 5. RBAC

`lib/permissions.ts` memuat matrix statis:

```ts
const ROLE_PERMISSIONS: Record<Role, Permission[]>
export function hasPermission(roles: Role[], permission: Permission): boolean
export function requireRole(user, role): void
```

Aturan tambahan yang **tidak** bisa diwakili matrix:
- Guru hanya boleh membuat jurnal untuk `schedule.teacher_id === user.id`.
- Guru hanya boleh mengedit jurnal miliknya (Admin boleh semua).
- Guru hanya melihat rekap kelas/mapel yang diajar.
- Hanya Admin commit/cancel promosi.
- Waka melihat audit read-only.

Implementasikan aturan ini di data-access, bukan hanya menyembunyikan tombol.

---

## 6. Pola Server Action

Setiap action mengikuti urutan:

```ts
'use server'

export async function doSomething(prevState: State, formData: FormData) {
  // 1. auth + permission
  const user = await assertPermission('manage:jadwal')

  // 2. parse & validasi
  const parsed = schema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { status: 'error', fieldErrors: parsed.error.flatten().fieldErrors }

  // 3. mutasi (data-access, transaksi bila multi-tabel)
  try {
    const result = await dataAccessFunction(parsed.data, user)
    // 4. audit bila aksi kritis
    await writeAudit(...)
  } catch (error) {
    return { status: 'error', message: toUserMessage(error) }
  }

  // 5. revalidate / redirect
  revalidatePath('/jadwal')
  redirect('/jadwal')
}
```

Ketentuan:
- Jangan pernah mempercayai `id`/`teacher_id` dari client untuk kepemilikan; ambil dari session atau baca ulang resource.
- Kembalikan pesan yang aman (tidak membocorkan detail DB).
- Gunakan `redirect()` setelah `revalidatePath()`.
- Server Actions dieksekusi berurutan per client; jangan mengandalkan `Promise.all` di client.
- Untuk transaksi, gunakan `getDbPool()` dan `db.transaction()`.

### Import file

- Parsing file dilakukan di `lib/excel/*` dengan direktif `server-only`, bukan di komponen atau action.
- Batasi tipe file, ukuran, dan jumlah baris sebelum parsing.
- Validasi seluruh baris terlebih dahulu; jika ada baris error, batalkan import sebelum memanggil data-access.
- Import siswa dapat sekaligus membuat enrollment bila kolom Kelas diisi; nama kelas divalidasi terhadap kelas pada tahun ajaran terpilih.
- Insert siswa, insert/reactivate enrollment, dan audit dijalankan dalam satu transaksi `getDbPool()`.
- Unduh template memakai route handler terpisah dan tetap memeriksa permission.

### Format state

```ts
export type ActionState = {
  status?: 'idle' | 'success' | 'error'
  message?: string
  fieldErrors?: Record<string, string[] | undefined>
}
```

---

## 7. Database

`lib/db.ts` menyediakan:

- `getDb()` — Drizzle + `neon-http`, lazy init.
- `getDbPool()` — Drizzle + `neon-serverless` Pool, lazy init; dipakai untuk transaksi.
- `neonConfig.webSocketConstructor = ws` untuk runtime Node.

Lazy init penting agar `next build` tidak membutuhkan `DATABASE_URL` saat modul diimpor. Jangan membuat koneksi di top-level module.

Semua schema diekspor dari `db/index.ts` supaya `drizzle(client, { schema })` dan query relasional tersedia.

### Transaksi

```ts
const db = getDbPool()
await db.transaction(async (tx) => {
  const [journal] = await tx.insert(journals).values(...).returning()
  if (attendance.length) await tx.insert(attendanceRecords).values(...)
})
```

### Tanggal dan waktu

- Kolom `date`: string `YYYY-MM-DD`.
- “Hari ini” dihitung dengan `Asia/Jakarta` di `lib/date.ts`.
- `day_of_week`: 1 = Senin … 7 = Minggu.
- Format tampilan: `Senin, 26 Okt 2026` (`Intl.DateTimeFormat('id-ID')`).

---

## 8. Validasi

- Semua schema Zod di `lib/validators/`.
- Schema yang sama dipakai untuk tipe `z.infer` dan validasi server action.
- Input `FormData` selalu berupa string; gunakan `z.coerce.number()` untuk angka dan `z.enum()` untuk status.
- Validasi bisnis (bentrok jadwal, duplikat jurnal, tahun aktif) ada di data-access, bukan Zod.

---

## 9. Error Handling

- `ForbiddenError`/`NotFoundError`/`ConflictError` di `lib/errors.ts`.
- Page dapat menangkap error dan menampilkan alert, atau memakai `notFound()`.
- Server action menangkap error domain dan mengembalikan `ActionState`; error tak terduga boleh dilempar agar terlihat di log.
- Jangan menampilkan stack trace atau pesan SQL ke pengguna.
- Pesan UI berbahasa Indonesia.

---

## 10. Audit

`lib/audit.ts` menyediakan `writeAudit(tx, { actorId, action, entityType, entityId, payload })`.

Aksi minimal yang dicatat:
- `schedule.create`, `schedule.update`, `schedule.delete`
- `time_slot.create`, `time_slot.update`, `time_slot.delete`, `time_slot.seed_default`
- `promotion.commit`, `promotion.cancel`
- `academic_year.activate`

Audit ditulis dalam transaksi yang sama dengan mutasi agar konsisten.

---

## 11. UI System

- `components/ui/*` adalah primitives lokal. Tidak memakai Radix pada v1.
- Gunakan `cn()` dari `lib/utils.ts` untuk merge class.
- Warna status dipusatkan di `components/ui/badge.tsx` dan helper `lib/status.ts`.
- Semua form memakai `Field`/`Input`/`Select` yang sudah menyediakan label, error, dan `aria-describedby`.
- Tombol submit memakai `SubmitButton` (`useFormStatus`).
- Daftar data memakai pola yang sama: query string (`q`, filter, `sort`, `dir`, `page`, `perPage`) → data-access `list*Paged` → `FilterBar` + `SortableHead`/`SortLinks` + `Pagination`. Parser dan builder ada di `lib/pagination.ts`.
- Data-access list wajib memakai `limit`/`offset` dan mengembalikan `{ rows, total, page, perPage, totalPages, from, to }`; jangan mengambil seluruh tabel lalu memotong di halaman.
- Jangan menambahkan dependency UI baru tanpa memperbarui dokumen ini.

---

## 12. Environment Variables

`.env.example`:

```env
DATABASE_URL=postgresql://user:password@host/db?sslmode=require
AUTH_SECRET=generate-with-openssl-rand-base64-32
AUTH_TRUST_HOST=true
SEED_ADMIN_EMAIL=admin@sekolah.sch.id
SEED_ADMIN_PASSWORD=Admin123!
```

- `DATABASE_URL` — Neon pooled connection string.
- `AUTH_SECRET` — wajib; `openssl rand -base64 32`.
- `AUTH_TRUST_HOST` — untuk dev/self-host.
- Seed opsional: email/password admin awal.

Next.js memuat `.env.local` otomatis. Script `db:seed` dan `drizzle.config.ts` memuat `.env.local`/`.env` melalui `scripts/load-env.ts` agar tetap bekerja di luar runtime Next.

Jangan commit `.env`.

---

## 13. Scripts

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "typecheck": "tsc --noEmit",
  "db:generate": "drizzle-kit generate",
  "db:migrate": "drizzle-kit migrate",
  "db:push": "drizzle-kit push",
  "db:seed": "tsx db/seed.ts"
}
```

---

## 14. Testing dan Verifikasi

Wajib sebelum menyelesaikan task:

```bash
npm run typecheck
npm run lint
npm run build
```

Build memakai `DATABASE_URL` dummy bila perlu, karena halaman dashboard dynamic dan tidak melakukan query saat build. Jangan menambahkan unit test framework tanpa kebutuhan; prioritaskan verifikasi tipe, lint, dan alur manual.

---

## 15. Deployment

- Vercel: set env `DATABASE_URL`, `AUTH_SECRET`, `AUTH_TRUST_HOST=true`.
- Jalankan migration sebelum deploy: `npm run db:migrate`.
- Neon: gunakan pooled connection; pantau CU-hours.
- Vercel Hobby hanya untuk non-komersial.
- Region: Singapore (`sin1`) untuk latensi Indonesia.

---

## 16. Checklist Menambah Fitur

1. Update `docs/prd.md` (dan dokumen terkait).
2. Tambah/ubah schema Drizzle + migration.
3. Tambah validator Zod.
4. Tambah data-access dengan otorisasi.
5. Tambah server action dengan urutan standar.
6. Tambah UI (Server Component + client hanya untuk interaksi).
7. Tambah audit bila aksi kritis.
8. Update `implementation-status.md`.
9. Jalankan typecheck, lint, build.



