import type {
  AttendanceStatus,
  EnrollmentStatus,
  PromotionBatchStatus,
} from "@/db/schema/enums";

export type BadgeVariant =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral";

export const ATTENDANCE_UI_LABELS: Record<"HADIR" | AttendanceStatus, string> = {
  HADIR: "Hadir",
  SAKIT: "Sakit",
  IZIN: "Izin",
  ALPA: "Alpa",
  DISPENSASI: "Dispensasi",
};

export const ATTENDANCE_UI_VARIANTS: Record<
  "HADIR" | AttendanceStatus,
  BadgeVariant
> = {
  HADIR: "success",
  SAKIT: "warning",
  IZIN: "info",
  ALPA: "danger",
  DISPENSASI: "neutral",
};

export const ENROLLMENT_VARIANTS: Record<EnrollmentStatus, BadgeVariant> = {
  ACTIVE: "success",
  COMPLETED: "info",
  GRADUATED: "neutral",
  TRANSFERRED: "warning",
  DROPPED_OUT: "danger",
};

export const BATCH_VARIANTS: Record<PromotionBatchStatus, BadgeVariant> = {
  DRAFT: "warning",
  COMMITTED: "success",
  CANCELLED: "neutral",
};

export function attendanceVariant(
  status: "HADIR" | AttendanceStatus,
): BadgeVariant {
  return ATTENDANCE_UI_VARIANTS[status];
}
