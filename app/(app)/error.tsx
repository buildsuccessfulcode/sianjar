"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-[0_1px_3px_rgba(16,24,40,0.05)]">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h1 className="text-lg font-semibold text-slate-900">
        Gagal memuat halaman
      </h1>
      <p className="mt-1 max-w-md text-sm text-slate-500">
        Terjadi kesalahan saat mengambil data. Periksa koneksi lalu coba lagi.
      </p>
      {error.digest ? (
        <p className="mt-2 font-mono text-xs text-slate-400">
          {error.digest}
        </p>
      ) : null}
      <Button className="mt-5" onClick={() => reset()}>
        <RotateCcw className="h-4 w-4" />
        Coba lagi
      </Button>
    </div>
  );
}
