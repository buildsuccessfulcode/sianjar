# Dokumentasi SiJAR

Dokumen ini adalah sumber kebenaran (source of truth) proyek **SiJAR — Sistem Informasi Jurnal Mengajar, Jadwal, dan Absensi**. Semua keputusan implementasi harus dapat ditelusuri ke salah satu dokumen di bawah. Jika perilaku aplikasi berubah, perbarui dokumen terlebih dahulu, lalu sesuaikan kode.

## Urutan baca

| Dokumen | Isi | Kapan dipakai |
|---|---|---|
| [prd.md](./prd.md) | Tujuan produk, peran, user story, functional & non-functional requirements, roadmap | Menentukan **apa** yang dibangun dan **mengapa** |
| [database-concept.md](./database-concept.md) | Model data, constraint, index, transaksi, pola query | Menentukan **bagaimana data disimpan** |
| [ui-ux-concept.md](./ui-ux-concept.md) | Design token, information architecture, alur layar, komponen, state, aksesibilitas | Menentukan **bagaimana pengguna berinteraksi** |
| [architecture.md](./architecture.md) | Struktur folder, layer, pola auth/RBAC, server action, error handling, env, deploy | Menentukan **bagaimana kode disusun** |
| [implementation-status.md](./implementation-status.md) | Status milestone, checklist, gap yang diketahui, next step | Menentukan **apa yang sudah dan belum dikerjakan** |

## Aturan sinkronisasi

1. Perubahan fitur dimulai dari `prd.md`.
2. Perubahan model data wajib disertai update `database-concept.md` dan migration Drizzle.
3. Perubahan alur/komponen UI wajib disertai update `ui-ux-concept.md`.
4. Perubahan struktur/pola kode wajib disertai update `architecture.md`.
5. Status implementasi diperbarui di `implementation-status.md` setiap menyelesaikan milestone.
6. Jangan menambahkan fitur baru ke kode tanpa mencatatnya di PRD (minimal sebagai P2/roadmap).

## Ringkasan stack

- **Framework:** Next.js 16 (App Router, Server Components, Server Actions)
- **UI:** React 19, Tailwind CSS 4, komponen lokal bergaya shadcn/ui, lucide-react
- **Auth:** Auth.js v5 (`next-auth@beta`), Credentials provider, JWT session 7 hari
- **Database:** PostgreSQL (Neon), Drizzle ORM
- **Validasi:** Zod (satu schema untuk server action dan tipe form)
- **Target deploy:** Vercel Hobby + Neon Free (pilot non-komersial)
