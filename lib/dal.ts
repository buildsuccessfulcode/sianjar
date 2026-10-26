import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { ForbiddenError } from "@/lib/errors";
import {
  hasAnyRole,
  hasPermission,
  type Permission,
} from "@/lib/permissions";
import type { Role } from "@/db/schema/enums";

export type CurrentUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  roles: Role[];
};

export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    roles: session.user.roles ?? [],
  };
});

export async function requirePagePermission(
  permission: Permission,
): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!hasPermission(user.roles, permission)) {
    redirect("/dashboard");
  }
  return user;
}

export async function requirePageRole(role: Role): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!hasAnyRole(user.roles, [role])) {
    redirect("/dashboard");
  }
  return user;
}

export async function assertPermission(
  permission: Permission,
): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!hasPermission(user.roles, permission)) {
    throw new ForbiddenError();
  }
  return user;
}

export async function assertAnyRole(roles: Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!hasAnyRole(user.roles, roles)) {
    throw new ForbiddenError();
  }
  return user;
}

export async function assertPermissionWithUser(
  permission: Permission,
  user: CurrentUser,
): Promise<void> {
  if (!hasPermission(user.roles, permission)) {
    throw new ForbiddenError();
  }
}
