import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import {
  enrollmentStatusEnum,
  genderEnum,
  promotionActionEnum,
  promotionBatchStatusEnum,
  semesterNameEnum,
} from "./enums";

export const academicYears = pgTable(
  "academic_years",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 20 }).notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    isActive: boolean("is_active").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("academic_years_name_unique").on(t.name),
    uniqueIndex("academic_years_single_active")
      .on(t.isActive)
      .where(sql`${t.isActive} = true`),
    check("academic_years_date_check", sql`${t.endDate} >= ${t.startDate}`),
  ],
);

export const semesters = pgTable(
  "semesters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    academicYearId: uuid("academic_year_id")
      .notNull()
      .references(() => academicYears.id),
    name: semesterNameEnum("name").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    isActive: boolean("is_active").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("semesters_year_name_unique").on(t.academicYearId, t.name),
    uniqueIndex("semesters_single_active")
      .on(t.isActive)
      .where(sql`${t.isActive} = true`),
    check("semesters_date_check", sql`${t.endDate} >= ${t.startDate}`),
  ],
);

export const departments = pgTable(
  "departments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 20 }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("departments_code_unique").on(t.code)],
);

export const subjects = pgTable(
  "subjects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 20 }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("subjects_code_unique").on(t.code)],
);

export const classes = pgTable(
  "classes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    academicYearId: uuid("academic_year_id")
      .notNull()
      .references(() => academicYears.id),
    departmentId: uuid("department_id")
      .notNull()
      .references(() => departments.id),
    gradeLevel: integer("grade_level").notNull(),
    section: varchar("section", { length: 10 }).notNull(),
    homeroomTeacherId: uuid("homeroom_teacher_id").references(() => users.id, {
      onDelete: "set null",
    }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("classes_unique_slot").on(
      t.academicYearId,
      t.departmentId,
      t.gradeLevel,
      t.section,
    ),
    index("classes_year_idx").on(t.academicYearId),
    index("classes_department_idx").on(t.departmentId),
    check(
      "classes_grade_level_check",
      sql`${t.gradeLevel} BETWEEN 7 AND 12`,
    ),
  ],
);

export const teacherSubjects = pgTable(
  "teacher_subjects",
  {
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.teacherId, t.subjectId] }),
    index("teacher_subjects_subject_idx").on(t.subjectId),
  ],
);

export const students = pgTable(
  "students",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nisn: varchar("nisn", { length: 20 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    gender: genderEnum("gender").notNull(),
    birthDate: date("birth_date"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("students_nisn_unique").on(t.nisn)],
);

export const promotionBatches = pgTable(
  "promotion_batches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fromAcademicYearId: uuid("from_academic_year_id")
      .notNull()
      .references(() => academicYears.id),
    toAcademicYearId: uuid("to_academic_year_id")
      .notNull()
      .references(() => academicYears.id),
    status: promotionBatchStatusEnum("status").notNull().default("DRAFT"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    committedAt: timestamp("committed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    summary: jsonb("summary"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("promotion_batches_year_idx").on(
      t.fromAcademicYearId,
      t.toAcademicYearId,
    ),
  ],
);

export const studentEnrollments = pgTable(
  "student_enrollments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id),
    academicYearId: uuid("academic_year_id")
      .notNull()
      .references(() => academicYears.id),
    status: enrollmentStatusEnum("status").notNull().default("ACTIVE"),
    promotionBatchId: uuid("promotion_batch_id").references(
      () => promotionBatches.id,
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("enrollments_student_year_unique").on(
      t.studentId,
      t.academicYearId,
    ),
    index("enrollments_class_idx").on(t.classId),
    index("enrollments_year_idx").on(t.academicYearId),
    index("enrollments_student_idx").on(t.studentId),
    index("enrollments_batch_idx").on(t.promotionBatchId),
  ],
);

export const classPromotionRules = pgTable(
  "class_promotion_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fromClassId: uuid("from_class_id")
      .notNull()
      .references(() => classes.id),
    toClassId: uuid("to_class_id").references(() => classes.id),
    academicYearFromId: uuid("academic_year_from_id")
      .notNull()
      .references(() => academicYears.id),
    academicYearToId: uuid("academic_year_to_id")
      .notNull()
      .references(() => academicYears.id),
    action: promotionActionEnum("action").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("class_promotion_rules_unique").on(
      t.fromClassId,
      t.academicYearToId,
    ),
  ],
);
