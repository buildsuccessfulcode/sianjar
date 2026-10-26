import type { ReactNode } from "react";

import { AppShell } from "@/components/domain/app-shell";
import { getCurrentUser } from "@/lib/dal";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();

  return (
    <AppShell
      user={{ name: user.name, email: user.email, roles: user.roles }}
    >
      {children}
    </AppShell>
  );
}
