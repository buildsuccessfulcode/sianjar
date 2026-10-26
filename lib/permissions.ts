import type { Role } from "@/db/schema/enums";

export const PERMISSIONS = [
  "manage:master_data",
  "manage:jadwal",
  "manage:mapping_guru_mapel",
  "read:jadwal_own",
  "create:jurnal_own",
  "read:jurnal_all",
  "create:absensi_own_jurnal",
  "read:rekap_absensi",
  "manage:promotion_rules",
  "execute:promotion",
  "cancel:promotion_batch",
  "read:audit_log",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: [...PERMISSIONS],
  WAKA_KURIKULUM: [
    "manage:jadwal",
    "manage:mapping_guru_mapel",
    "read:jadwal_own",
    "create:jurnal_own",
    "read:jurnal_all",
    "create:absensi_own_jurnal",
    "read:rekap_absensi",
    "manage:promotion_rules",
    "read:audit_log",
  ],
  GURU: [
    "read:jadwal_own",
    "create:jurnal_own",
    "create:absensi_own_jurnal",
    "read:rekap_absensi",
  ],
};

export function hasRole(roles: Role[], role: Role): boolean {
  return roles.includes(role);
}

export function hasAnyRole(roles: Role[], allowed: Role[]): boolean {
  return allowed.some((role) => roles.includes(role));
}

export function hasPermission(roles: Role[], permission: Permission): boolean {
  return roles.some((role) => ROLE_PERMISSIONS[role]?.includes(permission));
}

export function isAdmin(roles: Role[]): boolean {
  return hasRole(roles, "ADMIN");
}

export function isWaka(roles: Role[]): boolean {
  return hasRole(roles, "WAKA_KURIKULUM");
}

export function isGuru(roles: Role[]): boolean {
  return hasRole(roles, "GURU");
}
