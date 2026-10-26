import "server-only";

import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";
import type { z } from "zod";

import {
  academicYears,
  classPromotionRules,
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
import type {
  scheduleCopySchema,
  scheduleSchema,
} from "@/lib/validators/schedule";
import {
  likePattern,
  normalizePagination,
  paginated,
  type Paginated,
  type SortDirection,
} from "@/lib/pagination";

export type ScheduleInput = z.infer<typeof scheduleSchema>;
export type ScheduleCopyInput = z.infer<typeof scheduleCopySchema>;
export type ScheduleCopyResult = {
  timeSlotsCopied: number;
  schedulesCopied: number;
  schedulesSkipped: number;
  notes: string[];
};
export type ScheduleFilters = {
  semesterId?: string;
  teacherId?: string;
  classId?: string;
  subjectId?: string;
  dayOfWeek?: number;
  q?: string;
};

export type ScheduleListFilters = ScheduleFilters & {
  sort?: "day" | "period" | "subject" | "class" | "teacher" | "room";
  dir?: SortDirection;
  page?: number;
  perPage?: number;
};

export async function listSchedules(filters: ScheduleFilters) {
  const pattern = filters.q ? likePattern(filters.q) : undefined;
  const conditions = [
    isNull(schedules.deletedAt),
    isNull(semesters.deletedAt),
    isNull(academicYears.deletedAt),
    filters.semesterId ? eq(schedules.semesterId, filters.semesterId) : undefined,
    filters.teacherId ? eq(schedules.teacherId, filters.teacherId) : undefined,
    filters.classId ? eq(schedules.classId, filters.classId) : undefined,
    filters.subjectId ? eq(schedules.subjectId, filters.subjectId) : undefined,
    filters.dayOfWeek
      ? eq(schedules.dayOfWeek, filters.dayOfWeek)
      : undefined,
    pattern
      ? or(
          ilike(users.name, pattern),
          ilike(subjects.name, pattern),
          ilike(departments.code, pattern),
          ilike(classes.section, pattern),
          ilike(schedules.room, pattern),
          sql`${classes.gradeLevel}::text ilike ${pattern}`,
        )
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

export async function copyScheduleData(
  input: ScheduleCopyInput,
  actorId: string,
): Promise<ScheduleCopyResult> {
  const db = getDbPool();
  return db.transaction(async (tx) => {
    const semesterRows = await tx
      .select({
        id: semesters.id,
        name: semesters.name,
        startDate: semesters.startDate,
        academicYearId: academicYears.id,
        academicYearName: academicYears.name,
      })
      .from(semesters)
      .innerJoin(academicYears, eq(semesters.academicYearId, academicYears.id))
      .where(
        and(
          inArray(semesters.id, [
            input.sourceSemesterId,
            input.targetSemesterId,
          ]),
          isNull(semesters.deletedAt),
          isNull(academicYears.deletedAt),
        ),
      );

    const source = semesterRows.find(
      (row) => row.id === input.sourceSemesterId,
    );
    const target = semesterRows.find(
      (row) => row.id === input.targetSemesterId,
    );
    if (!source || !target) throw new NotFoundError("Semester tidak ditemukan.");
    if (source.startDate >= target.startDate) {
      throw new ValidationError(
        "Semester sumber harus lebih awal dari semester tujuan.",
      );
    }

    const notes: string[] = [];
    const sourceSlots = await tx
      .select({
        label: timeSlots.label,
        kind: timeSlots.kind,
        periodNumber: timeSlots.periodNumber,
        startTime: timeSlots.startTime,
        endTime: timeSlots.endTime,
      })
      .from(timeSlots)
      .where(eq(timeSlots.semesterId, source.id))
      .orderBy(asc(timeSlots.startTime), asc(timeSlots.periodNumber));
    let targetSlots = await tx
      .select({
        label: timeSlots.label,
        kind: timeSlots.kind,
        periodNumber: timeSlots.periodNumber,
        startTime: timeSlots.startTime,
        endTime: timeSlots.endTime,
      })
      .from(timeSlots)
      .where(eq(timeSlots.semesterId, target.id));

    let timeSlotsCopied = 0;
    if (input.copyTimeSlots) {
      if (sourceSlots.length === 0) {
        notes.push("Semester sumber belum memiliki susunan jam.");
      } else if (targetSlots.length > 0) {
        notes.push(
          "Susunan jam semester tujuan sudah ada sehingga tidak disalin.",
        );
      } else {
        await tx.insert(timeSlots).values(
          sourceSlots.map((slot) => ({
            semesterId: target.id,
            label: slot.label,
            kind: slot.kind,
            periodNumber: slot.periodNumber,
            startTime: slot.startTime,
            endTime: slot.endTime,
          })),
        );
        timeSlotsCopied = sourceSlots.length;
        targetSlots = sourceSlots;
      }
    }

    let schedulesCopied = 0;
    let schedulesSkipped = 0;

    if (input.copySchedules) {
      const sourceRows = await tx
        .select({
          teacherId: schedules.teacherId,
          subjectId: schedules.subjectId,
          classId: schedules.classId,
          departmentId: classes.departmentId,
          departmentCode: departments.code,
          gradeLevel: classes.gradeLevel,
          section: classes.section,
          dayOfWeek: schedules.dayOfWeek,
          periodStart: schedules.periodStart,
          periodEnd: schedules.periodEnd,
          room: schedules.room,
        })
        .from(schedules)
        .innerJoin(users, eq(schedules.teacherId, users.id))
        .innerJoin(subjects, eq(schedules.subjectId, subjects.id))
        .innerJoin(classes, eq(schedules.classId, classes.id))
        .innerJoin(departments, eq(classes.departmentId, departments.id))
        .where(
          and(
            eq(schedules.semesterId, source.id),
            eq(schedules.isActive, true),
            isNull(schedules.deletedAt),
            eq(users.isActive, true),
            isNull(users.deletedAt),
            eq(subjects.isActive, true),
            isNull(subjects.deletedAt),
          ),
        )
        .orderBy(
          asc(schedules.dayOfWeek),
          asc(schedules.periodStart),
          asc(classes.gradeLevel),
          asc(classes.section),
        );

      if (sourceRows.length === 0) {
        notes.push("Semester sumber belum memiliki jadwal.");
      } else {
        const sourceClassIds = [...new Set(sourceRows.map((row) => row.classId))];
        const sourceClasses = new Map(
          sourceRows.map((row) => [
            row.classId,
            {
              departmentId: row.departmentId,
              departmentCode: row.departmentCode,
              gradeLevel: row.gradeLevel,
              section: row.section,
            },
          ]),
        );
        const targetClasses = await tx
          .select({
            id: classes.id,
            departmentId: classes.departmentId,
            gradeLevel: classes.gradeLevel,
            section: classes.section,
          })
          .from(classes)
          .innerJoin(departments, eq(classes.departmentId, departments.id))
          .where(
            and(
              eq(classes.academicYearId, target.academicYearId),
              eq(classes.isActive, true),
              isNull(classes.deletedAt),
              isNull(departments.deletedAt),
            ),
          );

        const sameYear = source.academicYearId === target.academicYearId;
        const rules = sameYear
          ? []
          : await tx
              .select({
                fromClassId: classPromotionRules.fromClassId,
                toClassId: classPromotionRules.toClassId,
                action: classPromotionRules.action,
              })
              .from(classPromotionRules)
              .where(
                and(
                  eq(
                    classPromotionRules.academicYearToId,
                    target.academicYearId,
                  ),
                  inArray(classPromotionRules.fromClassId, sourceClassIds),
                ),
              );
        const rulesByClass = new Map(rules.map((rule) => [rule.fromClassId, rule]));
        const targetClassById = new Map(
          targetClasses.map((row) => [row.id, row]),
        );
        const classMapping = new Map<
          string,
          (typeof targetClasses)[number] | null
        >();
        const unmappedLabels = new Set<string>();

        for (const sourceClassId of sourceClassIds) {
          const sourceClass = sourceClasses.get(sourceClassId);
          if (!sourceClass) continue;

          let targetClass: (typeof targetClasses)[number] | null = null;
          if (sameYear) {
            targetClass =
              targetClasses.find(
                (row) =>
                  row.departmentId === sourceClass.departmentId &&
                  row.gradeLevel === sourceClass.gradeLevel &&
                  row.section.trim().toLowerCase() ===
                    sourceClass.section.trim().toLowerCase(),
              ) ?? null;
          } else {
            const rule = rulesByClass.get(sourceClassId);
            if (rule) {
              if (rule.action === "PROMOTE" || rule.action === "RETAIN") {
                targetClass = rule.toClassId
                  ? (targetClassById.get(rule.toClassId) ?? null)
                  : null;
              }
            } else {
              const promoted = targetClasses.filter(
                (row) =>
                  row.departmentId === sourceClass.departmentId &&
                  row.gradeLevel === sourceClass.gradeLevel + 1,
              );
              targetClass =
                promoted.find(
                  (row) =>
                    row.section.trim().toLowerCase() ===
                    sourceClass.section.trim().toLowerCase(),
                ) ??
                (promoted.length === 1 ? promoted[0] : null);
            }
          }

          classMapping.set(sourceClassId, targetClass);
          if (!targetClass) {
            unmappedLabels.add(
              `${sourceClass.gradeLevel} ${sourceClass.departmentCode} ${sourceClass.section}`.trim(),
            );
          }
        }

        if (unmappedLabels.size > 0) {
          const labels = [...unmappedLabels];
          notes.push(
            `Kelas tanpa padanan: ${labels.slice(0, 3).join(", ")}${
              labels.length > 3 ? `, +${labels.length - 3} lainnya` : ""
            }.`,
          );
        }

        const lessonPeriods = new Set(
          targetSlots
            .filter((slot) => slot.kind === "LESSON")
            .map((slot) => slot.periodNumber)
            .filter((value): value is number => value !== null),
        );
        const validatePeriods = lessonPeriods.size > 0;

        const teacherIds = [...new Set(sourceRows.map((row) => row.teacherId))];
        const subjectIds = [...new Set(sourceRows.map((row) => row.subjectId))];
        const teacherMappings = await tx
          .select({
            teacherId: teacherSubjects.teacherId,
            subjectId: teacherSubjects.subjectId,
          })
          .from(teacherSubjects)
          .where(
            and(
              inArray(teacherSubjects.teacherId, teacherIds),
              inArray(teacherSubjects.subjectId, subjectIds),
            ),
          );
        const teacherSubjectKeys = new Set(
          teacherMappings.map((row) => `${row.teacherId}:${row.subjectId}`),
        );

        type BusyInterval = {
          dayOfWeek: number;
          periodStart: number;
          periodEnd: number;
        };
        const teacherBusy = new Map<string, BusyInterval[]>();
        const classBusy = new Map<string, BusyInterval[]>();
        const addBusy = (
          map: Map<string, BusyInterval[]>,
          key: string,
          interval: BusyInterval,
        ) => {
          const list = map.get(key);
          if (list) list.push(interval);
          else map.set(key, [interval]);
        };
        const hasBusy = (
          map: Map<string, BusyInterval[]>,
          key: string,
          periodStart: number,
          periodEnd: number,
        ) =>
          (map.get(key) ?? []).some(
            (interval) =>
              interval.periodStart <= periodEnd &&
              interval.periodEnd >= periodStart,
          );

        const existingTarget = await tx
          .select({
            teacherId: schedules.teacherId,
            classId: schedules.classId,
            dayOfWeek: schedules.dayOfWeek,
            periodStart: schedules.periodStart,
            periodEnd: schedules.periodEnd,
            isActive: schedules.isActive,
            deletedAt: schedules.deletedAt,
          })
          .from(schedules)
          .where(eq(schedules.semesterId, target.id));
        const occupiedTeacherStarts = new Set<string>();
        const occupiedClassStarts = new Set<string>();
        for (const row of existingTarget) {
          occupiedTeacherStarts.add(
            `${row.teacherId}:${row.dayOfWeek}:${row.periodStart}`,
          );
          occupiedClassStarts.add(
            `${row.classId}:${row.dayOfWeek}:${row.periodStart}`,
          );
          if (!row.isActive || row.deletedAt) continue;

          const interval = {
            dayOfWeek: row.dayOfWeek,
            periodStart: row.periodStart,
            periodEnd: row.periodEnd,
          };
          addBusy(
            teacherBusy,
            `${row.teacherId}:${row.dayOfWeek}`,
            interval,
          );
          addBusy(classBusy, `${row.classId}:${row.dayOfWeek}`, interval);
        }

        const skippedReasons = new Set<string>();
        const toInsert: (typeof schedules.$inferInsert)[] = [];

        for (const row of sourceRows) {
          const targetClass = classMapping.get(row.classId);
          if (!targetClass) {
            schedulesSkipped += 1;
            continue;
          }
          if (
            validatePeriods &&
            (!lessonPeriods.has(row.periodStart) ||
              !lessonPeriods.has(row.periodEnd))
          ) {
            schedulesSkipped += 1;
            skippedReasons.add(
              "Ada jadwal dengan nomor jam yang tidak tersedia di susunan jam tujuan.",
            );
            continue;
          }
          if (
            !teacherSubjectKeys.has(`${row.teacherId}:${row.subjectId}`)
          ) {
            schedulesSkipped += 1;
            skippedReasons.add("Ada guru-mapel yang belum dipetakan.");
            continue;
          }

          const teacherKey = `${row.teacherId}:${row.dayOfWeek}`;
          const teacherStartKey = `${row.teacherId}:${row.dayOfWeek}:${row.periodStart}`;
          if (occupiedTeacherStarts.has(teacherStartKey)) {
            schedulesSkipped += 1;
            skippedReasons.add(
              "Ada slot mulai guru yang sudah dipakai pada semester tujuan.",
            );
            continue;
          }
          if (
            hasBusy(
              teacherBusy,
              teacherKey,
              row.periodStart,
              row.periodEnd,
            )
          ) {
            schedulesSkipped += 1;
            skippedReasons.add("Ada jadwal guru yang bentrok.");
            continue;
          }
          const classKey = `${targetClass.id}:${row.dayOfWeek}`;
          const classStartKey = `${targetClass.id}:${row.dayOfWeek}:${row.periodStart}`;
          if (occupiedClassStarts.has(classStartKey)) {
            schedulesSkipped += 1;
            skippedReasons.add(
              "Ada slot mulai kelas yang sudah dipakai pada semester tujuan.",
            );
            continue;
          }
          if (
            hasBusy(classBusy, classKey, row.periodStart, row.periodEnd)
          ) {
            schedulesSkipped += 1;
            skippedReasons.add("Ada jadwal kelas yang bentrok.");
            continue;
          }

          const value = {
            semesterId: target.id,
            teacherId: row.teacherId,
            subjectId: row.subjectId,
            classId: targetClass.id,
            dayOfWeek: row.dayOfWeek,
            periodStart: row.periodStart,
            periodEnd: row.periodEnd,
            room: row.room,
          };
          toInsert.push(value);
          const interval = {
            dayOfWeek: row.dayOfWeek,
            periodStart: row.periodStart,
            periodEnd: row.periodEnd,
          };
          addBusy(teacherBusy, teacherKey, interval);
          addBusy(classBusy, classKey, interval);
          occupiedTeacherStarts.add(teacherStartKey);
          occupiedClassStarts.add(classStartKey);
        }

        if (toInsert.length > 0) {
          await tx.insert(schedules).values(toInsert);
          schedulesCopied = toInsert.length;
        }
        for (const reason of skippedReasons) notes.push(reason);
      }
    }

    if (timeSlotsCopied > 0 || schedulesCopied > 0) {
      await writeAudit(tx, {
        actorId,
        action: "schedule.copy",
        entityType: "semester",
        entityId: target.id,
        payload: {
          sourceSemester: source.name,
          sourceAcademicYear: source.academicYearName,
          targetSemester: target.name,
          targetAcademicYear: target.academicYearName,
          timeSlotsCopied,
          schedulesCopied,
          schedulesSkipped,
        },
      });
    }

    return {
      timeSlotsCopied,
      schedulesCopied,
      schedulesSkipped,
      notes,
    };
  });
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


export async function listSchedulesPaged(
  filters: ScheduleListFilters,
): Promise<Paginated<Awaited<ReturnType<typeof listSchedules>>[number]>> {
  const db = getDb();
  const perPage = filters.perPage ?? 20;
  const page = filters.page ?? 1;
  const pattern = filters.q ? likePattern(filters.q) : undefined;

  const conditions = [
    isNull(schedules.deletedAt),
    isNull(semesters.deletedAt),
    isNull(academicYears.deletedAt),
    filters.semesterId ? eq(schedules.semesterId, filters.semesterId) : undefined,
    filters.teacherId ? eq(schedules.teacherId, filters.teacherId) : undefined,
    filters.classId ? eq(schedules.classId, filters.classId) : undefined,
    filters.subjectId ? eq(schedules.subjectId, filters.subjectId) : undefined,
    filters.dayOfWeek
      ? eq(schedules.dayOfWeek, filters.dayOfWeek)
      : undefined,
    pattern
      ? or(
          ilike(users.name, pattern),
          ilike(subjects.name, pattern),
          ilike(departments.code, pattern),
          ilike(classes.section, pattern),
          ilike(schedules.room, pattern),
          sql`${classes.gradeLevel}::text ilike ${pattern}`,
        )
      : undefined,
  ];

  const [totalRow] = await db
    .select({ total: count(schedules.id) })
    .from(schedules)
    .innerJoin(semesters, eq(schedules.semesterId, semesters.id))
    .innerJoin(academicYears, eq(semesters.academicYearId, academicYears.id))
    .innerJoin(users, eq(schedules.teacherId, users.id))
    .innerJoin(subjects, eq(schedules.subjectId, subjects.id))
    .innerJoin(classes, eq(schedules.classId, classes.id))
    .innerJoin(departments, eq(classes.departmentId, departments.id))
    .where(and(...conditions));
  const total = Number(totalRow?.total ?? 0);
  const meta = normalizePagination(total, page, perPage);

  const sort = filters.sort ?? "day";
  const dir = filters.dir ?? "asc";
  const sortColumn =
    sort === "period"
      ? schedules.periodStart
      : sort === "subject"
        ? subjects.name
        : sort === "class"
          ? classes.gradeLevel
          : sort === "teacher"
            ? users.name
            : sort === "room"
              ? schedules.room
              : schedules.dayOfWeek;

  const rows = await db
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
      dir === "asc" ? asc(sortColumn) : desc(sortColumn),
      asc(schedules.dayOfWeek),
      asc(schedules.periodStart),
      asc(classes.gradeLevel),
      asc(classes.section),
    )
    .limit(perPage)
    .offset(meta.offset);

  return paginated(rows, total, meta.page, perPage);
}
