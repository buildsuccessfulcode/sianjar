import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BookOpenCheck, GraduationCap } from "lucide-react";

import { auth } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Masuk",
};

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
            <BookOpenCheck className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            SiJAR
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Jurnal mengajar, jadwal, dan absensi dalam satu tempat.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
          <div className="mb-5 flex items-center gap-2 text-sm font-medium text-slate-700">
            <GraduationCap className="h-4 w-4 text-indigo-600" />
            Masuk ke akun sekolah
          </div>
          <LoginForm />
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">
          Gunakan akun yang diberikan operator sekolah.
        </p>
      </div>
    </main>
  );
}
