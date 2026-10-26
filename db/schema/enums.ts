import { pgEnum } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["ADMIN", "GURU", "WAKA_KURIKULUM"]);

export const semesterNameEnum = pgEnum("semester_name", ["GANJIL", "GENAP"]);

export const timeSlotKindEnum = pgEnum("time_slot_kind", [
  "LESSON",
  "BREAK",
  "PRAYER",
]);

export const genderEnum = pgEnum("gender", ["L", "P"]);

export const attendanceStatusEnum = pgEnum("attendance_status", [
  "SAKIT",
  "IZIN",
  "ALPA",
  "DISPENSASI",
]);

export const enrollmentStatusEnum = pgEnum("enrollment_status", [
  "ACTIVE",
  "COMPLETED",
  "GRADUATED",
  "TRANSFERRED",
  "DROPPED_OUT",
]);

export const promotionActionEnum = pgEnum("promotion_action", [
  "PROMOTE",
  "RETAIN",
  "GRADUATE",
  "TRANSFERRED",
  "DROPPED_OUT",
]);

export const promotionBatchStatusEnum = pgEnum("promotion_batch_status", [
  "DRAFT",
  "COMMITTED",
  "CANCELLED",
]);

export type Role = (typeof roleEnum.enumValues)[number];
export type SemesterName = (typeof semesterNameEnum.enumValues)[number];
export type TimeSlotKind = (typeof timeSlotKindEnum.enumValues)[number];
export type Gender = (typeof genderEnum.enumValues)[number];
export type AttendanceStatus = (typeof attendanceStatusEnum.enumValues)[number];
export type EnrollmentStatus = (typeof enrollmentStatusEnum.enumValues)[number];
export type PromotionAction = (typeof promotionActionEnum.enumValues)[number];
export type PromotionBatchStatus =
  (typeof promotionBatchStatusEnum.enumValues)[number];

export const ATTENDANCE_STATUSES = attendanceStatusEnum.enumValues;
export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  SAKIT: "Sakit",
  IZIN: "Izin",
  ALPA: "Alpa",
  DISPENSASI: "Dispensasi",
};

export const ENROLLMENT_STATUS_LABELS: Record<EnrollmentStatus, string> = {
  ACTIVE: "Aktif",
  COMPLETED: "Selesai",
  GRADUATED: "Lulus",
  TRANSFERRED: "Pindah",
  DROPPED_OUT: "Keluar",
};

export const PROMOTION_ACTION_LABELS: Record<PromotionAction, string> = {
  PROMOTE: "Naik kelas",
  RETAIN: "Tinggal kelas",
  GRADUATE: "Lulus",
  TRANSFERRED: "Pindah",
  DROPPED_OUT: "Keluar",
};

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  GURU: "Guru",
  WAKA_KURIKULUM: "Waka Kurikulum",
};

export const DAY_NAMES = [
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
  "Minggu",
] as const;

export const TIME_SLOT_KIND_LABELS: Record<TimeSlotKind, string> = {
  LESSON: "Jam pelajaran",
  BREAK: "Istirahat",
  PRAYER: "Sholat / ibadah",
};
