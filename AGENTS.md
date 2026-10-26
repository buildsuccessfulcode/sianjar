<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## SiJAR project instructions

Baca [`docs/README.md`](docs/README.md) sebelum mengubah fitur. Urutan source of truth:

1. `docs/prd.md` — apa dan mengapa.
2. `docs/database-concept.md` — model data dan invariant.
3. `docs/ui-ux-concept.md` — alur dan komponen UI.
4. `docs/architecture.md` — struktur kode, auth/RBAC, pola Server Action, env.
5. `docs/implementation-status.md` — status dan gap.

Aturan penting:

- Auth: Auth.js v5 Credentials + JWT. Jangan memakai `middleware`/`proxy` sebagai satu-satunya proteksi. Setiap Server Action wajib memanggil `assertPermission()` dan memeriksa kepemilikan resource.
- Database: akses hanya melalui `data-access/*`. Jangan query langsung dari page/component.
- Mutasi multi-tabel (jurnal+absensi, promosi) wajib memakai transaksi `getDbPool()`.
- Form memakai native `<form>` + Server Action + Zod. Tidak memakai react-hook-form.
- Jangan menambahkan dependency UI baru tanpa memperbarui `docs/architecture.md`.
- Jangan commit `.env` atau secret.
- Setelah perubahan, jalankan `npm run typecheck`, `npm run lint`, dan `npm run build`.
- Jika mengubah schema, jalankan `npm run db:generate` dan update `docs/database-concept.md`.
- Jika perilaku fitur berubah, update PRD/UI/UX dan `docs/implementation-status.md`.
