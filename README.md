# SiJAR

Sistem Informasi Jurnal Mengajar, Jadwal, dan Absensi untuk sekolah. Satu input jurnal per pertemuan menghasilkan riwayat mengajar, absensi siswa, monitoring Waka Kurikulum, dan rekap lintas tahun ajaran.

## Stack

- Next.js 16 (App Router, Server Components, Server Actions)
- React 19 + Tailwind CSS 4
- Auth.js v5 (Credentials, JWT 7 hari)
- Drizzle ORM + Neon PostgreSQL
- Zod

## Menjalankan

```bash
npm install
cp .env.example .env.local
# isi DATABASE_URL dan AUTH_SECRET (openssl rand -base64 32)
npm run db:migrate
npm run db:seed
npm run dev
```

Buka `http://localhost:3000`.

Akun seed default (password `Admin123!` kecuali diubah lewat env):

| Email | Role |
|---|---|
| admin@sekolah.sch.id | Admin |
| waka@sekolah.sch.id | Waka Kurikulum + Guru |
| sari@sekolah.sch.id | Guru |
| andi@sekolah.sch.id | Guru |

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
npm run db:generate
npm run db:migrate
npm run db:push
npm run db:seed
```

## Dokumentasi

Dokumentasi adalah source of truth proyek. Mulai dari [`docs/README.md`](./docs/README.md).

- [PRD](./docs/prd.md)
- [Database Concept](./docs/database-concept.md)
- [UI/UX Concept](./docs/ui-ux-concept.md)
- [Architecture & Development Guide](./docs/architecture.md)
- [Implementation Status](./docs/implementation-status.md)

## Catatan deploy

- Vercel Hobby hanya untuk penggunaan non-komersial.
- Set `DATABASE_URL`, `AUTH_SECRET`, dan `AUTH_TRUST_HOST=true` di environment Vercel.
- Jalankan migration sebelum deploy.
