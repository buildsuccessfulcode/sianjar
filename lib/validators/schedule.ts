import { z } from "zod";

import { dateString, optionalText, uuidSchema } from "./common";

const timeString = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Format jam harus HH:MM");

const optionalPeriodNumber = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.coerce.number().int().min(1).max(20).optional(),
);

export const timeSlotKindSchema = z.enum(["LESSON", "BREAK", "PRAYER"]);

export const timeSlotSchema = z
  .object({
    semesterId: uuidSchema,
    label: z.string().trim().min(1, "Nama jam wajib diisi").max(64),
    kind: timeSlotKindSchema,
    periodNumber: optionalPeriodNumber,
    startTime: timeString,
    endTime: timeString,
  })
  .superRefine((data, ctx) => {
    if (data.startTime >= data.endTime) {
      ctx.addIssue({
        code: "custom",
        message: "Jam selesai harus setelah jam mulai",
        path: ["endTime"],
      });
    }
    if (data.kind === "LESSON" && !data.periodNumber) {
      ctx.addIssue({
        code: "custom",
        message: "Nomor jam pelajaran wajib diisi",
        path: ["periodNumber"],
      });
    }
    if (data.kind !== "LESSON" && data.periodNumber) {
      ctx.addIssue({
        code: "custom",
        message: "Istirahat/sholat tidak memakai nomor jam pelajaran",
        path: ["periodNumber"],
      });
    }
  });

const importCheckbox = z.preprocess(
  (value) => value === "on" || value === "true" || value === true,
  z.boolean(),
);

export const scheduleCopySchema = z
  .object({
    sourceSemesterId: uuidSchema,
    targetSemesterId: uuidSchema,
    copyTimeSlots: importCheckbox.optional().default(false),
    copySchedules: importCheckbox.optional().default(false),
  })
  .refine((data) => data.sourceSemesterId !== data.targetSemesterId, {
    message: "Semester sumber dan tujuan tidak boleh sama",
    path: ["sourceSemesterId"],
  })
  .refine((data) => data.copyTimeSlots || data.copySchedules, {
    message: "Pilih minimal satu data yang akan disalin",
    path: ["copySchedules"],
  });

export const scheduleSchema = z
  .object({
    semesterId: uuidSchema,
    teacherId: uuidSchema,
    subjectId: uuidSchema,
    classId: uuidSchema,
    dayOfWeek: z.coerce.number().int().min(1).max(7),
    periodStart: z.coerce.number().int().min(1).max(20),
    periodEnd: z.coerce.number().int().min(1).max(20),
    room: optionalText,
  })
  .refine((data) => data.periodEnd >= data.periodStart, {
    message: "Jam selesai harus setelah jam mulai",
    path: ["periodEnd"],
  });

export const journalDetailSchema = z.object({
  date: dateString,
  material: z.string().trim().min(1, "Materi wajib diisi"),
  activity: z.string().trim().min(1, "Aktivitas wajib diisi"),
  notes: optionalText,
});

export const ATTENDANCE_FORM_STATUSES = [
  "HADIR",
  "SAKIT",
  "IZIN",
  "ALPA",
  "DISPENSASI",
] as const;

export const attendanceEntrySchema = z.object({
  studentId: uuidSchema,
  status: z.enum(ATTENDANCE_FORM_STATUSES),
  note: optionalText,
});

export type AttendanceEntryInput = z.infer<typeof attendanceEntrySchema>;

export const promotionSchema = z
  .object({
    fromAcademicYearId: uuidSchema,
    toAcademicYearId: uuidSchema,
  })
  .refine((data) => data.fromAcademicYearId !== data.toAcademicYearId, {
    message: "Tahun ajaran asal dan tujuan tidak boleh sama",
    path: ["toAcademicYearId"],
  });
