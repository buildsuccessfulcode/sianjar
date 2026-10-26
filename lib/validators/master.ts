import { z } from "zod";

import {
  dateString,
  emailSchema,
  optionalText,
  optionalUuid,
  passwordSchema,
  uuidSchema,
} from "./common";

const checkbox = z.preprocess(
  (value) => value === "on" || value === "true" || value === true,
  z.boolean(),
);

export const academicYearSchema = z
  .object({
    name: z
      .string()
      .trim()
      .regex(/^\d{4}\/\d{4}$/, "Format tahun ajaran harus 2026/2027"),
    startDate: dateString,
    endDate: dateString,
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "Tanggal selesai harus setelah tanggal mulai",
    path: ["endDate"],
  });

export const semesterSchema = z
  .object({
    academicYearId: uuidSchema,
    name: z.enum(["GANJIL", "GENAP"]),
    startDate: dateString,
    endDate: dateString,
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "Tanggal selesai harus setelah tanggal mulai",
    path: ["endDate"],
  });

export const departmentSchema = z.object({
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(100),
});

export const subjectSchema = z.object({
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(100),
});

export const classSchema = z.object({
  academicYearId: uuidSchema,
  departmentId: uuidSchema,
  gradeLevel: z.coerce.number().int().min(7).max(12),
  section: z.string().trim().max(10),
  homeroomTeacherId: optionalUuid,
});

export const teacherCreateSchema = z.object({
  name: z.string().trim().min(1).max(255),
  email: emailSchema,
  password: passwordSchema,
  nip: optionalText,
  expertiseNote: optionalText,
});

export const teacherUpdateSchema = z.object({
  name: z.string().trim().min(1).max(255),
  email: emailSchema,
  nip: optionalText,
  expertiseNote: optionalText,
  isActive: checkbox.optional().default(true),
});

export const studentCreateSchema = z.object({
  nisn: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(255),
  gender: z.enum(["L", "P"]),
  birthDate: z
    .string()
    .optional()
    .transform((value) => (value ? value : undefined))
    .pipe(dateString.optional()),
});

export const studentUpdateSchema = studentCreateSchema.extend({
  isActive: checkbox.optional().default(true),
});

export const studentImportRowSchema = z.object({
  rowNumber: z.number().int().positive(),
  nisn: z
    .string()
    .trim()
    .min(1, "NISN wajib diisi.")
    .max(20, "NISN maksimal 20 karakter."),
  name: z
    .string()
    .trim()
    .min(1, "Nama wajib diisi.")
    .max(255, "Nama maksimal 255 karakter."),
  gender: z.enum(["L", "P"], {
    message: "Jenis kelamin harus L atau P.",
  }),
  birthDate: z
    .string()
    .optional()
    .transform((value) => (value ? value : undefined))
    .pipe(dateString.optional()),
});

const enrollmentStatusSchema = z
  .enum(["ACTIVE", "COMPLETED", "GRADUATED", "TRANSFERRED", "DROPPED_OUT"])
  .default("ACTIVE");

export const enrollmentSchema = z.object({
  studentId: uuidSchema,
  classId: uuidSchema,
  academicYearId: uuidSchema,
  status: enrollmentStatusSchema,
});

export const enrollmentUpdateSchema = z.object({
  id: uuidSchema,
  classId: uuidSchema,
  status: enrollmentStatusSchema,
});

export const enrollmentBulkSchema = z.object({
  studentIds: z
    .array(uuidSchema)
    .min(1, "Pilih minimal satu siswa.")
    .max(2000, "Maksimal 2000 siswa per batch.")
    .transform((ids) => [...new Set(ids)]),
  classId: uuidSchema,
  academicYearId: uuidSchema,
  status: enrollmentStatusSchema,
});

export const enrollmentMoveSchema = z.object({
  enrollmentIds: z
    .array(uuidSchema)
    .min(1, "Pilih minimal satu enrollment.")
    .max(2000, "Maksimal 2000 enrollment per batch.")
    .transform((ids) => [...new Set(ids)]),
  targetClassId: uuidSchema,
});

export const enrollmentBulkStatusSchema = z.object({
  enrollmentIds: z
    .array(uuidSchema)
    .min(1, "Pilih minimal satu enrollment.")
    .max(2000, "Maksimal 2000 enrollment per batch.")
    .transform((ids) => [...new Set(ids)]),
  status: enrollmentStatusSchema,
});

export const teacherSubjectSchema = z.object({
  teacherId: uuidSchema,
  subjectId: uuidSchema,
});

export const teacherSubjectBulkSchema = z.object({
  teacherId: uuidSchema,
  subjectIds: z
    .array(uuidSchema)
    .min(1, "Pilih minimal satu mapel.")
    .max(50, "Maksimal 50 mapel per batch.")
    .transform((ids) => [...new Set(ids)]),
});
