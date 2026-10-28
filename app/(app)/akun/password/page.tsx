import type { Metadata } from "next";

import { ActionForm } from "@/components/ui/action-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, PasswordInput } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/dal";
import { changePassword } from "./actions";

export const metadata: Metadata = { title: "Ubah Password" };
export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const user = await getCurrentUser();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ubah Password"
        description="Ganti password akun Anda, termasuk password default dari admin."
      />

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Keamanan Akun</CardTitle>
          <CardDescription>
            Masuk sebagai {user.email ?? user.name ?? "pengguna"}. Password baru
            minimal 8 karakter.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ActionForm action={changePassword} submitLabel="Simpan Password">
            <Field
              label="Password Saat Ini"
              htmlFor="currentPassword"
              required
            >
              <PasswordInput
                id="currentPassword"
                name="currentPassword"
                autoComplete="current-password"
                required
              />
            </Field>
            <Field label="Password Baru" htmlFor="newPassword" required>
              <PasswordInput
                id="newPassword"
                name="newPassword"
                autoComplete="new-password"
                required
              />
            </Field>
            <Field
              label="Konfirmasi Password Baru"
              htmlFor="confirmPassword"
              required
            >
              <PasswordInput
                id="confirmPassword"
                name="confirmPassword"
                autoComplete="new-password"
                required
              />
            </Field>
          </ActionForm>
        </CardContent>
      </Card>
    </div>
  );
}
