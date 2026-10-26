import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  pgTable,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { classes, semesters, students, subjects } from "./academic";
import { attendanceStatusEnum, timeSlotKindEnum } from "./enums";

export const timeSlots = pgTable(
  "time_slots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    semesterId: uuid("semester_id")
      .notNull()
      .references(() => semesters.id),
    label: varchar("label", { length: 64 }).notNull(),
    kind: timeSlotKindEnum("kind").notNull().default("LESSON"),
    periodNumber: smallint("period_number"),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("idx_time_slots_semester").on(t.semesterId, t.startTime),
    uniqueIndex("uq_time_slot_semester_period")
      .on(t.semesterId, t.periodNumber)
      .where(sql`${t.periodNumber} IS NOT NULL`),
    check("chk_time_slot_range", sql`${t.endTime} > ${t.startTime}`),
    check(
      "chk_time_slot_period",
      sql`(${t.kind} = 'LESSON' AND ${t.periodNumber} IS NOT NULL AND ${t.periodNumber} BETWEEN 1 AND 20) OR (${t.kind} <> 'LESSON' AND ${t.periodNumber} IS NULL)`,
    ),
  ],
);

export const schedules = pgTable(
  "schedules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    semesterId: uuid("semester_id")
      .notNull()
      .references(() => semesters.id),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => users.id),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id),
    dayOfWeek: smallint("day_of_week").notNull(),
    periodStart: smallint("period_start").notNull(),
    periodEnd: smallint("period_end").notNull(),
    room: varchar("room", { length: 50 }),
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
    uniqueIndex("uq_schedule_teacher_slot").on(
      t.semesterId,
      t.teacherId,
      t.dayOfWeek,
      t.periodStart,
    ),
    uniqueIndex("uq_schedule_class_slot").on(
      t.semesterId,
      t.classId,
      t.dayOfWeek,
      t.periodStart,
    ),
    index("idx_schedules_teacher_sem_day").on(
      t.teacherId,
      t.semesterId,
      t.dayOfWeek,
    ),
    index("idx_schedules_class_sem_day").on(
      t.classId,
      t.semesterId,
      t.dayOfWeek,
    ),
    check("chk_period", sql`${t.periodEnd} >= ${t.periodStart}`),
    check(
      "chk_day_of_week",
      sql`${t.dayOfWeek} BETWEEN 1 AND 7`,
    ),
  ],
);

export const journals = pgTable(
  "journals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scheduleId: uuid("schedule_id")
      .notNull()
      .references(() => schedules.id),
    date: date("date").notNull(),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => users.id),
    material: text("material").notNull(),
    activity: text("activity").notNull(),
    notes: text("notes"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_journal_schedule_date").on(t.scheduleId, t.date),
    index("idx_journals_date").on(t.date),
    index("idx_journals_schedule_date").on(t.scheduleId, t.date),
    index("idx_journals_teacher").on(t.teacherId),
  ],
);

export const attendanceRecords = pgTable(
  "attendance_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    journalId: uuid("journal_id")
      .notNull()
      .references(() => journals.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id),
    status: attendanceStatusEnum("status").notNull(),
    note: varchar("note", { length: 255 }),
  },
  (t) => [
    uniqueIndex("uq_attendance_journal_student").on(t.journalId, t.studentId),
    index("idx_attendance_journal").on(t.journalId),
    index("idx_attendance_student").on(t.studentId),
  ],
);
