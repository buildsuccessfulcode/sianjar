import "server-only";

import {
  and,
  asc,
  count,
  eq,
  gte,
  isNull,
  lte,
  ne,
  or,
} from "drizzle-orm";
import type { z } from "zod";

import {
  academicYears,
  classes,
  departments,
  journals,
  schedules,
  semesters,
  subjects,
  teacherSubjects,
  timeSlots,
  users,
} from "@/db/schema";
import { DAY_NAMES } from "@/db/schema/enums";
import { writeAudit } from "@/lib/audit";
import { dayOfWeekFromDate, todayInJakarta } from "@/lib/date";
import { getDb, getDbPool } from "@/lib/db";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";
import type { scheduleSchema } from "@/lib/validators/schedule";

export type ScheduleInput = z.infer<typeof scheduleSchema>;
export type ScheduleFilters = {
  semesterId?: string;
  teacherId?: string;
  classId?: string;
  dayOfWeek?: number;
};

export async function listSchedules(filters: ScheduleFilters) {
  const conditions = [
    isNull(schedules.deletedAt),
    isNull(semesters.deletedAt),
    isNull(academicYears.deletedAt),
    filters.semesterId ? eq(schedules.semesterId, filters.semesterId) : undefined,
    filters.teacherId ? eq(schedules.teacherId, filters.teacherId) : undefined,
    filters.classId ? eq(schedules.classId, filters.classId) : undefined,
    filters.dayOfWeek
      ? eq(schedules.dayOfWeek, filters.dayOfWeek)
      : undefined,
  ];

  return getDb()
    .select({
      id: schedules.id,
      semesterId: schedules.semesterId,
      semesterName: semesters.name,
      academicYearName: academicYears.name,
      teacherId: schedules.teacherId,
      teacherName: users.name,
      subjectId: schedules.subjectId,
      subjectName: subjects.name,
      classId: schedules.classId,
      gradeLevel: classes.gradeLevel,
      section: classes.section,
      departmentCode: departments.code,
      dayOfWeek: schedules.dayOfWeek,
      periodStart: schedules.periodStart,
      periodEnd: schedules.periodEnd,
      room: schedules.room,
      isActive: schedules.isActive,
    })
    .from(schedules)
    .innerJoin(semesters, eq(schedules.semesterId, semesters.id))
    .innerJoin(academicYears, eq(semesters.academicYearId, academicYears.id))
    .innerJoin(users, eq(schedules.teacherId, users.id))
    .innerJoin(subjects, eq(schedules.subjectId, subjects.id))
    .innerJoin(classes, eq(schedules.classId, classes.id))
    .innerJoin(departments, eq(classes.departmentId, departments.id))
    .where(and(...conditions))
    .orderBy(
      asc(schedules.dayOfWeek),
      asc(schedules.periodStart),
      asc(classes.gradeLevel),
      asc(classes.section),
    );
}

export async function getScheduleById(id: string) {
  const rows = await getDb()
    .select({
      id: schedules.id,
      semesterId: schedules.semesterId,
      semesterName: semesters.name,
      academicYearId: academicYears.id,
      academicYearName: academicYears.name,
      semesterStart: semesters.startDate,
      semesterEnd: semesters.endDate,
      teacherId: schedules.teacherId,
      teacherName: users.name,
      subjectId: schedules.subjectId,
      subjectName: subjects.name,
      classId: schedules.classId,
      gradeLevel: classes.gradeLevel,
      section: classes.section,
      departmentCode: departments.code,
      dayOfWeek: schedules.dayOfWeek,
      periodStart: schedules.periodStart,
      periodEnd: schedules.periodEnd,
      room: schedules.room,
      isActive: schedules.isActive,
    })
    .from(schedules)
    .innerJoin(semesters, eq(schedules.semesterId, semesters.id))
    .innerJoin(academicYears, eq(semesters.academicYearId, academicYears.id))
    .innerJoin(users, eq(schedules.teacherId, users.id))
    .innerJoin(subjects, eq(schedules.subjectId, subjects.id))
    .innerJoin(classes, eq(schedules.classId, classes.id))
    .innerJoin(departments, eq(classes.departmentId, departments.id))
    .where(and(eq(schedules.id, id), isNull(schedules.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

async function getSemesterContext(semesterId: string) {
  const [row] = await getDb()
    .select({
      id: semesters.id,
      name: semesters.name,
      academicYearId: semesters.academicYearId,
      academicYearName: academicYears.name,
      startDate: semesters.startDate,
      endDate: semesters.endDate,
    })
    .from(semesters)
    .innerJoin(academicYears, eq(semesters.academicYearId, academicYears.id))
    .where(
      and(eq(semesters.id, semesterId), isNull(semesters.deletedAt)),
    )
    .limit(1);
  return row ?? null;
}

async function validateScheduleReferences(input: ScheduleInput) {
  const semester = await getSemesterContext(input.semesterId);
  if (!semester) throw new NotFoundError("Semester tidak ditemukan.");

  const [classRow] = await getDb()
    .select({
      id: classes.id,
      academicYearId: classes.academicYearId,
      gradeLevel: classes.gradeLevel,
      section: classes.section,
      departmentCode: departments.code,
    })
    .from(classes)
    .innerJoin(departments, eq(classes.departmentId, departments.id))
    .where(and(eq(classes.id, input.classId), eq(classes.isActive, true), isNull(classes.deletedAt)))
    .limit(1);
  if (!classRow) throw new NotFoundError("Kelas tidak ditemukan.");
  if (classRow.academicYearId !== semester.academicYearId) {
    throw new ValidationError(
      "Kelas harus berada pada tahun ajaran yang sama dengan semester.",
    );
  }

  const [subject] = await getDb()
    .select({ id: subjects.id, name: subjects.name })
    .from(subjects)
    .where(and(eq(subjects.id, input.subjectId), eq(subjects.isActive, true), isNull(subjects.deletedAt)))
    .limit(1);
  if (!subject) throw new NotFoundError("Mapel tidak ditemukan.");

  const [teacher] = await getDb()
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(
      and(
        eq(users.id, input.teacherId),
        eq(users.isActive, true),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);
  if (!teacher) throw new NotFoundError("Guru tidak ditemukan.");

  const [mapping] = await getDb()
    .select()
    .from(teacherSubjects)
    .where(
      and(
        eq(teacherSubjects.teacherId, input.teacherId),
        eq(teacherSubjects.subjectId, input.subjectId),
      ),
    )
    .limit(1);
  if (!mapping) {
    throw new ValidationError(
      "Guru belum dipetakan ke mapel ini. Atur di menu Mapping Guru–Mapel.",
    );
  }

  const lessonPeriods = await getDb()
    .select({ periodNumber: timeSlots.periodNumber })
    .from(timeSlots)
    .where(
      and(
        eq(timeSlots.semesterId, input.semesterId),
        eq(timeSlots.kind, "LESSON"),
      ),
    );
  if (lessonPeriods.length > 0) {
    const available = new Set(
      lessonPeriods
        .map((row) => row.periodNumber)
        .filter((value): value is number => value !== null),
    );
    const missing = [input.periodStart, input.periodEnd].filter(
      (period) => !available.has(period),
    );
    if (missing.length > 0) {
      throw new ValidationError(
        `Nomor jam ${missing.join(", ")} belum ada di susunan jam. Atur di menu Jadwal → Atur Jam & Istirahat.`,
      );
    }
  }

  const conflicts = await getDb()
    .select({
      id: schedules.id,
      teacherId: schedules.teacherId,
      classId: schedules.classId,
      periodStart: schedules.periodStart,
      periodEnd: schedules.periodEnd,
      teacherName: users.name,
      subjectName: subjects.name,
      gradeLevel: classes.gradeLevel,
      section: classes.section,
      departmentCode: departments.code,
    })
    .from(schedules)
    .innerJoin(users, eq(schedules.teacherId, users.id))
    .innerJoin(subjects, eq(schedules.subjectId, subjects.id))
    .innerJoin(classes, eq(schedules.classId, classes.id))
    .innerJoin(departments, eq(classes.departmentId, departments.id))
    .where(
      and(
        eq(schedules.semesterId, input.semesterId),
        eq(schedules.dayOfWeek, input.dayOfWeek),
        lte(schedules.periodStart, input.periodEnd),
        gte(schedules.periodEnd, input.periodStart),
        eq(schedules.isActive, true),
        isNull(schedules.deletedAt),
      ),
    );

  const teacherConflict = conflicts.find(
    (row) => row.teacherId === input.teacherId,
  );
  if (teacherConflict) {
    throw new ConflictError(
      `Guru ${teacher.name} sudah mengajar ${teacherConflict.subjectName} di jam yang overlap pada hari ${DAY_NAMES[input.dayOfWeek - 1]}.`,
    );
  }

  const classConflict = conflicts.find((row) => row.classId === input.classId);
  if (classConflict) {
    throw new ConflictError(
      `Kelas ${classRow.gradeLevel} ${classRow.departmentCode} ${classRow.section} sudah memiliki jadwal ${classConflict.subjectName} di jam yang overlap.`,
    );
  }

  return { semester, classRow, subject, teacher };
}

export async function createSchedule(input: ScheduleInput, actorId: string) {
  await validateScheduleReferences(input);
  const db = getDbPool();
  return db.transaction(async (tx) => {
    const [row] = await tx.insert(schedules).values(input).returning();
    await writeAudit(tx, {
      actorId,
      action: "schedule.create",
      entityType: "schedule",
      entityId: row.id,
      payload: {
        semesterId: row.semesterId,
        teacherId: row.teacherId,
        subjectId: row.subjectId,
        classId: row.classId,
        dayOfWeek: row.dayOfWeek,
        periodStart: row.periodStart,
        periodEnd: row.periodEnd,
      },
    });
    return row;
  });
}

export async function updateSchedule(
  id: string,
  input: ScheduleInput,
  actorId: string,
) {
  const existing = await getScheduleById(id);
  if (!existing) throw new NotFoundError("Jadwal tidak ditemukan.");
  await validateScheduleReferences(input);
  const db = getDbPool();
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(schedules)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(schedules.id, id))
      .returning();
    await writeAudit(tx, {
      actorId,
      action: "schedule.update",
      entityType: "schedule",
      entityId: id,
      payload: {
        before: {
          teacherId: existing.teacherId,
          subjectId: existing.subjectId,
          classId: existing.classId,
          dayOfWeek: existing.dayOfWeek,
          periodStart: existing.periodStart,
          periodEnd: existing.periodEnd,
        },
        after: input,
      },
    });
    return row;
  });
}

export async function deleteSchedule(id: string, actorId: string) {
  const [journalCount] = await getDb()
    .select({ total: count(journals.id) })
    .from(journals)
    .where(eq(journals.scheduleId, id));
  if (Number(journalCount?.total ?? 0) > 0) {
    throw new ConflictError(
      "Jadwal tidak dapat dihapus karena sudah memiliki jurnal.",
    );
  }

  const db = getDbPool();
  await db.transaction(async (tx) => {
    const [row] = await tx
      .update(schedules)
      .set({ isActive: false, deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(schedules.id, id))
      .returning();
    if (!row) throw new NotFoundError("Jadwal tidak ditemukan.");
    await writeAudit(tx, {
      actorId,
      action: "schedule.delete",
      entityType: "schedule",
      entityId: id,
    });
  });
}

export async function getTodaySchedulesForTeacher(
  teacherId: string,
  date = todayInJakarta(),
) {
  const [activeSemester] = await getDb()
    .select({
      id: semesters.id,
      name: semesters.name,
      academicYearName: academicYears.name,
      startDate: semesters.startDate,
      endDate: semesters.endDate,
    })
    .from(semesters)
    .innerJoin(academicYears, eq(semesters.academicYearId, academicYears.id))
    .where(
      and(
        eq(semesters.isActive, true),
        isNull(semesters.deletedAt),
        eq(academicYears.isActive, true),
        isNull(academicYears.deletedAt),
      ),
    )
    .limit(1);

  if (!activeSemester) {
    return { semester: null, schedules: [] };
  }

  const dayOfWeek = dayOfWeekFromDate(date);
  const rows = await getDb()
    .select({
      id: schedules.id,
      subjectName: subjects.name,
      classId: classes.id,
      gradeLevel: classes.gradeLevel,
      section: classes.section,
      departmentCode: departments.code,
      periodStart: schedules.periodStart,
      periodEnd: schedules.periodEnd,
      room: schedules.room,
      journalId: journals.id,
      isActive: schedules.isActive,
    })
    .from(schedules)
    .innerJoin(subjects, eq(schedules.subjectId, subjects.id))
    .innerJoin(classes, eq(schedules.classId, classes.id))
    .innerJoin(departments, eq(classes.departmentId, departments.id))
    .leftJoin(
      journals,
      and(eq(journals.scheduleId, schedules.id), eq(journals.date, date)),
    )
    .where(
      and(
        eq(schedules.teacherId, teacherId),
        eq(schedules.semesterId, activeSemester.id),
        eq(schedules.dayOfWeek, dayOfWeek),
        eq(schedules.isActive, true),
        isNull(schedules.deletedAt),
      ),
    )
    .orderBy(asc(schedules.periodStart));

  return { semester: activeSemester, schedules: rows };
}

export async function getJournalFormContext(scheduleId: string, date: string) {
  const schedule = await getScheduleById(scheduleId);
  if (!schedule) throw new NotFoundError("Jadwal tidak ditemukan.");

  const [journal] = await getDb()
    .select()
    .from(journals)
    .where(and(eq(journals.scheduleId, scheduleId), eq(journals.date, date)))
    .limit(1);

  return { schedule, journal: journal ?? null };
}

export async function scheduleHasJournal(scheduleId: string, excludeJournalId?: string) {
  const rows = await getDb()
    .select({ id: journals.id })
    .from(journals)
    .where(
      and(
        eq(journals.scheduleId, scheduleId),
        excludeJournalId ? ne(journals.id, excludeJournalId) : undefined,
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export async function listDaySchedulesForMonitoring(
  semesterId: string,
  date: string,
  filters?: { classId?: string; subjectId?: string; teacherId?: string },
) {
  const dayOfWeek = dayOfWeekFromDate(date);
  return getDb()
    .select({
      id: schedules.id,
      teacherId: schedules.teacherId,
      teacherName: users.name,
      subjectId: schedules.subjectId,
      subjectName: subjects.name,
      classId: schedules.classId,
      gradeLevel: classes.gradeLevel,
      section: classes.section,
      departmentCode: departments.code,
      periodStart: schedules.periodStart,
      periodEnd: schedules.periodEnd,
      journalId: journals.id,
      journalDate: journals.date,
    })
    .from(schedules)
    .innerJoin(users, eq(schedules.teacherId, users.id))
    .innerJoin(subjects, eq(schedules.subjectId, subjects.id))
    .innerJoin(classes, eq(schedules.classId, classes.id))
    .innerJoin(departments, eq(classes.departmentId, departments.id))
    .leftJoin(
      journals,
      and(
        eq(journals.scheduleId, schedules.id),
        eq(journals.date, date),
      ),
    )
    .where(
      and(
        eq(schedules.semesterId, semesterId),
        eq(schedules.dayOfWeek, dayOfWeek),
        eq(schedules.isActive, true),
        isNull(schedules.deletedAt),
        filters?.classId ? eq(schedules.classId, filters.classId) : undefined,
        filters?.subjectId
          ? eq(schedules.subjectId, filters.subjectId)
          : undefined,
        filters?.teacherId
          ? eq(schedules.teacherId, filters.teacherId)
          : undefined,
      ),
    )
    .orderBy(asc(schedules.periodStart), asc(users.name));
}

export async function teacherTeachesClassSubject(
  teacherId: string,
  classId: string,
  subjectId: string,
) {
  const rows = await getDb()
    .select({ id: schedules.id })
    .from(schedules)
    .where(
      and(
        eq(schedules.teacherId, teacherId),
        eq(schedules.classId, classId),
        eq(schedules.subjectId, subjectId),
        isNull(schedules.deletedAt),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export async function teacherTeachesClass(teacherId: string, classId: string) {
  const rows = await getDb()
    .select({ id: schedules.id })
    .from(schedules)
    .where(
      and(
        eq(schedules.teacherId, teacherId),
        eq(schedules.classId, classId),
        isNull(schedules.deletedAt),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export async function listTeacherScheduleClassIds(teacherId: string) {
  const rows = await getDb()
    .selectDistinct({ classId: schedules.classId })
    .from(schedules)
    .where(
      and(
        eq(schedules.teacherId, teacherId),
        isNull(schedules.deletedAt),
      ),
    );
  return rows.map((row) => row.classId);
}

export async function listTeacherScheduleSubjectIds(teacherId: string) {
  const rows = await getDb()
    .selectDistinct({ subjectId: schedules.subjectId })
    .from(schedules)
    .where(
      and(
        eq(schedules.teacherId, teacherId),
        isNull(schedules.deletedAt),
      ),
    );
  return rows.map((row) => row.subjectId);
}

export async function countSchedulesForSemester(semesterId: string) {
  const [row] = await getDb()
    .select({ total: count(schedules.id) })
    .from(schedules)
    .where(
      and(
        eq(schedules.semesterId, semesterId),
        isNull(schedules.deletedAt),
      ),
    );
  return Number(row?.total ?? 0);
}

export async function getScheduleConflictAlternative(
  semesterId: string,
  teacherId: string,
  classId: string,
  dayOfWeek: number,
) {
  const conditions = [
    eq(schedules.semesterId, semesterId),
    eq(schedules.dayOfWeek, dayOfWeek),
    isNull(schedules.deletedAt),
    or(
      eq(schedules.teacherId, teacherId),
      eq(schedules.classId, classId),
    ),
  ];
  return getDb()
    .select({
      periodStart: schedules.periodStart,
      periodEnd: schedules.periodEnd,
    })
    .from(schedules)
    .where(and(...conditions))
    .orderBy(asc(schedules.periodStart));
}

