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
  or,
  sql,
} from "drizzle-orm";

import {
  academicYears,
  attendanceRecords,
  classes,
  departments,
  journals,
  schedules,
  semesters,
  studentEnrollments,
  students,
  subjects,
  users,
} from "@/db/schema";
import type { AttendanceStatus } from "@/db/schema/enums";
import { writeAudit } from "@/lib/audit";
import { getDb, getDbPool } from "@/lib/db";
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";
import { isAdmin } from "@/lib/permissions";
import type { CurrentUser } from "@/lib/dal";
import type { AttendanceEntryInput } from "@/lib/validators/schedule";
import {
  likePattern,
  normalizePagination,
  paginated,
  type Paginated,
  type SortDirection,
} from "@/lib/pagination";

export type JournalFilters = {
  semesterId?: string;
  teacherId?: string;
  classId?: string;
  subjectId?: string;
  dateFrom?: string;
  dateTo?: string;
  q?: string;
  limit?: number;
};

export type JournalListFilters = JournalFilters & {
  sort?: "date" | "subject" | "class" | "teacher" | "absent";
  dir?: SortDirection;
  page?: number;
  perPage?: number;
};

function journalConditions(filters: JournalFilters) {
  const pattern = filters.q ? likePattern(filters.q) : undefined;
  return [
    filters.semesterId ? eq(schedules.semesterId, filters.semesterId) : undefined,
    filters.teacherId ? eq(journals.teacherId, filters.teacherId) : undefined,
    filters.classId ? eq(schedules.classId, filters.classId) : undefined,
    filters.subjectId ? eq(schedules.subjectId, filters.subjectId) : undefined,
    filters.dateFrom ? gte(journals.date, filters.dateFrom) : undefined,
    filters.dateTo ? lte(journals.date, filters.dateTo) : undefined,
    pattern
      ? or(
          ilike(journals.material, pattern),
          ilike(journals.activity, pattern),
          ilike(journals.notes, pattern),
          ilike(users.name, pattern),
          ilike(subjects.name, pattern),
          ilike(departments.code, pattern),
          ilike(classes.section, pattern),
          sql`${classes.gradeLevel}::text ilike ${pattern}`,
        )
      : undefined,
  ];
}

export type SaveJournalInput = {
  scheduleId: string;
  date: string;
  material: string;
  activity: string;
  notes?: string;
  attendance: AttendanceEntryInput[];
};

export async function saveJournal(input: SaveJournalInput, actor: CurrentUser) {
  const db = getDbPool();

  return db.transaction(async (tx) => {
    const [schedule] = await tx
      .select({
        id: schedules.id,
        teacherId: schedules.teacherId,
        classId: schedules.classId,
        subjectId: schedules.subjectId,
        academicYearId: academicYears.id,
        semesterStart: semesters.startDate,
        semesterEnd: semesters.endDate,
      })
      .from(schedules)
      .innerJoin(semesters, eq(schedules.semesterId, semesters.id))
      .innerJoin(academicYears, eq(semesters.academicYearId, academicYears.id))
      .where(
        and(eq(schedules.id, input.scheduleId), isNull(schedules.deletedAt)),
      )
      .limit(1);

    if (!schedule) throw new NotFoundError("Jadwal tidak ditemukan.");

    const admin = isAdmin(actor.roles);
    const owner = schedule.teacherId === actor.id;
    if (!admin && !owner) {
      throw new ForbiddenError(
        "Anda hanya dapat mengisi jurnal untuk jadwal milik sendiri.",
      );
    }

    if (input.date < schedule.semesterStart || input.date > schedule.semesterEnd) {
      throw new ValidationError(
        "Tanggal jurnal berada di luar rentang semester.",
      );
    }

    const nonPresent = new Map<string, AttendanceEntryInput>();
    for (const entry of input.attendance) {
      if (entry.status === "HADIR") continue;
      if (nonPresent.has(entry.studentId)) {
        throw new ValidationError("Siswa yang sama muncul lebih dari sekali.");
      }
      nonPresent.set(entry.studentId, entry);
    }

    const studentIds = Array.from(nonPresent.keys());
    if (studentIds.length > 0) {
      const valid = await tx
        .select({ id: students.id })
        .from(studentEnrollments)
        .innerJoin(students, eq(studentEnrollments.studentId, students.id))
        .where(
          and(
            eq(studentEnrollments.classId, schedule.classId),
            eq(studentEnrollments.academicYearId, schedule.academicYearId),
            eq(studentEnrollments.status, "ACTIVE"),
            isNull(studentEnrollments.deletedAt),
            eq(students.isActive, true),
            isNull(students.deletedAt),
            inArray(students.id, studentIds),
          ),
        );

      if (valid.length !== studentIds.length) {
        throw new ValidationError(
          "Ada siswa yang tidak terdaftar aktif pada kelas ini.",
        );
      }
    }

    const [existing] = await tx
      .select()
      .from(journals)
      .where(
        and(
          eq(journals.scheduleId, input.scheduleId),
          eq(journals.date, input.date),
        ),
      )
      .limit(1);

    if (existing && existing.teacherId !== actor.id && !admin) {
      throw new ForbiddenError("Anda tidak dapat mengedit jurnal ini.");
    }

    let journal: { id: string };
    let action: "journal.create" | "journal.update";

    if (existing) {
      const [updated] = await tx
        .update(journals)
        .set({
          material: input.material,
          activity: input.activity,
          notes: input.notes ?? null,
          updatedAt: new Date(),
        })
        .where(eq(journals.id, existing.id))
        .returning();
      journal = updated;
      action = "journal.update";

      await tx
        .delete(attendanceRecords)
        .where(eq(attendanceRecords.journalId, existing.id));
    } else {
      const [created] = await tx
        .insert(journals)
        .values({
          scheduleId: input.scheduleId,
          date: input.date,
          teacherId: schedule.teacherId,
          material: input.material,
          activity: input.activity,
          notes: input.notes ?? null,
          createdBy: actor.id,
        })
        .returning();
      journal = created;
      action = "journal.create";
    }

    if (nonPresent.size > 0) {
      await tx.insert(attendanceRecords).values(
        Array.from(nonPresent.values()).map((entry) => ({
          journalId: journal.id,
          studentId: entry.studentId,
          status: entry.status as AttendanceStatus,
          note: entry.note ?? null,
        })),
      );
    }

    await writeAudit(tx, {
      actorId: actor.id,
      action,
      entityType: "journal",
      entityId: journal.id,
      payload: {
        scheduleId: input.scheduleId,
        date: input.date,
        absent: nonPresent.size,
      },
    });

    return journal;
  });
}

export async function getJournalById(id: string) {
  const rows = await getDb()
    .select({
      id: journals.id,
      date: journals.date,
      material: journals.material,
      activity: journals.activity,
      notes: journals.notes,
      teacherId: journals.teacherId,
      teacherName: users.name,
      scheduleId: schedules.id,
      semesterId: schedules.semesterId,
      semesterName: semesters.name,
      academicYearId: academicYears.id,
      academicYearName: academicYears.name,
      subjectId: subjects.id,
      subjectName: subjects.name,
      classId: classes.id,
      gradeLevel: classes.gradeLevel,
      section: classes.section,
      departmentCode: departments.code,
      periodStart: schedules.periodStart,
      periodEnd: schedules.periodEnd,
      createdAt: journals.createdAt,
      updatedAt: journals.updatedAt,
    })
    .from(journals)
    .innerJoin(schedules, eq(journals.scheduleId, schedules.id))
    .innerJoin(semesters, eq(schedules.semesterId, semesters.id))
    .innerJoin(academicYears, eq(semesters.academicYearId, academicYears.id))
    .innerJoin(subjects, eq(schedules.subjectId, subjects.id))
    .innerJoin(classes, eq(schedules.classId, classes.id))
    .innerJoin(departments, eq(classes.departmentId, departments.id))
    .innerJoin(users, eq(journals.teacherId, users.id))
    .where(eq(journals.id, id))
    .limit(1);

  const journal = rows[0];
  if (!journal) return null;

  const attendance = await getDb()
    .select({
      id: attendanceRecords.id,
      studentId: students.id,
      studentName: students.name,
      nisn: students.nisn,
      status: attendanceRecords.status,
      note: attendanceRecords.note,
    })
    .from(attendanceRecords)
    .innerJoin(students, eq(attendanceRecords.studentId, students.id))
    .where(eq(attendanceRecords.journalId, id))
    .orderBy(asc(students.name));

  return { journal, attendance };
}

export async function listJournals(filters: JournalFilters) {
  const conditions = journalConditions(filters);

  const query = getDb()
    .select({
      id: journals.id,
      date: journals.date,
      material: journals.material,
      activity: journals.activity,
      teacherId: journals.teacherId,
      teacherName: users.name,
      subjectName: subjects.name,
      classId: schedules.classId,
      gradeLevel: classes.gradeLevel,
      section: classes.section,
      departmentCode: departments.code,
      periodStart: schedules.periodStart,
      periodEnd: schedules.periodEnd,
      absentCount: sql<number>`(select count(*) from attendance_records ar where ar.journal_id = ${journals.id})`,
    })
    .from(journals)
    .innerJoin(schedules, eq(journals.scheduleId, schedules.id))
    .innerJoin(subjects, eq(schedules.subjectId, subjects.id))
    .innerJoin(classes, eq(schedules.classId, classes.id))
    .innerJoin(departments, eq(classes.departmentId, departments.id))
    .innerJoin(users, eq(journals.teacherId, users.id))
    .where(and(...conditions))
    .orderBy(desc(journals.date), asc(schedules.periodStart));

  const rows = filters.limit ? await query.limit(filters.limit) : await query;

  return rows.map((row) => ({
    ...row,
    absentCount: Number(row.absentCount),
  }));
}

export async function countJournals(filters: JournalFilters) {
  const conditions = journalConditions(filters);

  const [row] = await getDb()
    .select({ total: count(journals.id) })
    .from(journals)
    .innerJoin(schedules, eq(journals.scheduleId, schedules.id))
    .innerJoin(subjects, eq(schedules.subjectId, subjects.id))
    .innerJoin(classes, eq(schedules.classId, classes.id))
    .innerJoin(departments, eq(classes.departmentId, departments.id))
    .innerJoin(users, eq(journals.teacherId, users.id))
    .where(and(...conditions));
  return Number(row?.total ?? 0);
}

export async function listJournalsPaged(
  filters: JournalListFilters,
): Promise<Paginated<Awaited<ReturnType<typeof listJournals>>[number]>> {
  const db = getDb();
  const perPage = filters.perPage ?? 20;
  const page = filters.page ?? 1;
  const conditions = journalConditions(filters);

  const [totalRow] = await db
    .select({ total: count(journals.id) })
    .from(journals)
    .innerJoin(schedules, eq(journals.scheduleId, schedules.id))
    .innerJoin(subjects, eq(schedules.subjectId, subjects.id))
    .innerJoin(classes, eq(schedules.classId, classes.id))
    .innerJoin(departments, eq(classes.departmentId, departments.id))
    .innerJoin(users, eq(journals.teacherId, users.id))
    .where(and(...conditions));
  const total = Number(totalRow?.total ?? 0);
  const meta = normalizePagination(total, page, perPage);

  const sort = filters.sort ?? "date";
  const dir = filters.dir ?? (sort === "date" ? "desc" : "asc");
  const absentExpr = sql<number>`(select count(*) from attendance_records ar where ar.journal_id = ${journals.id})`;
  const sortColumn =
    sort === "subject"
      ? subjects.name
      : sort === "class"
        ? classes.gradeLevel
        : sort === "teacher"
          ? users.name
          : sort === "absent"
            ? absentExpr
            : journals.date;

  const rows = await db
    .select({
      id: journals.id,
      date: journals.date,
      material: journals.material,
      activity: journals.activity,
      teacherId: journals.teacherId,
      teacherName: users.name,
      subjectName: subjects.name,
      classId: schedules.classId,
      gradeLevel: classes.gradeLevel,
      section: classes.section,
      departmentCode: departments.code,
      periodStart: schedules.periodStart,
      periodEnd: schedules.periodEnd,
      absentCount: absentExpr,
    })
    .from(journals)
    .innerJoin(schedules, eq(journals.scheduleId, schedules.id))
    .innerJoin(subjects, eq(schedules.subjectId, subjects.id))
    .innerJoin(classes, eq(schedules.classId, classes.id))
    .innerJoin(departments, eq(classes.departmentId, departments.id))
    .innerJoin(users, eq(journals.teacherId, users.id))
    .where(and(...conditions))
    .orderBy(
      dir === "asc" ? asc(sortColumn) : desc(sortColumn),
      desc(journals.date),
      asc(schedules.periodStart),
    )
    .limit(perPage)
    .offset(meta.offset);

  return paginated(
    rows.map((row) => ({ ...row, absentCount: Number(row.absentCount) })),
    total,
    meta.page,
    perPage,
  );
}

export type AttendanceRecapFilters = {
  dateFrom: string;
  dateTo: string;
  classId?: string;
  subjectId?: string;
  classIds?: string[];
  q?: string;
};

function attendanceRecapConditions(filters: AttendanceRecapFilters) {
  const pattern = filters.q ? likePattern(filters.q) : undefined;
  return [
    gte(journals.date, filters.dateFrom),
    lte(journals.date, filters.dateTo),
    filters.classId ? eq(schedules.classId, filters.classId) : undefined,
    filters.subjectId ? eq(schedules.subjectId, filters.subjectId) : undefined,
    filters.classIds
      ? filters.classIds.length > 0
        ? inArray(schedules.classId, filters.classIds)
        : sql`false`
      : undefined,
    pattern
      ? or(
          ilike(students.name, pattern),
          ilike(students.nisn, pattern),
          ilike(departments.code, pattern),
          ilike(classes.section, pattern),
          sql`${classes.gradeLevel}::text ilike ${pattern}`,
        )
      : undefined,
  ];
}

export async function getAttendanceRecap(filters: AttendanceRecapFilters) {
  const conditions = attendanceRecapConditions(filters);

  const rows = await getDb()
    .select({
      studentId: students.id,
      studentName: students.name,
      nisn: students.nisn,
      gradeLevel: classes.gradeLevel,
      section: classes.section,
      departmentCode: departments.code,
      sakit: sql<number>`count(*) filter (where ${attendanceRecords.status} = 'SAKIT')`,
      izin: sql<number>`count(*) filter (where ${attendanceRecords.status} = 'IZIN')`,
      alpa: sql<number>`count(*) filter (where ${attendanceRecords.status} = 'ALPA')`,
      dispensasi: sql<number>`count(*) filter (where ${attendanceRecords.status} = 'DISPENSASI')`,
      total: sql<number>`count(*)`,
    })
    .from(attendanceRecords)
    .innerJoin(journals, eq(attendanceRecords.journalId, journals.id))
    .innerJoin(schedules, eq(journals.scheduleId, schedules.id))
    .innerJoin(subjects, eq(schedules.subjectId, subjects.id))
    .innerJoin(classes, eq(schedules.classId, classes.id))
    .innerJoin(departments, eq(classes.departmentId, departments.id))
    .innerJoin(students, eq(attendanceRecords.studentId, students.id))
    .where(and(...conditions))
    .groupBy(
      students.id,
      students.name,
      students.nisn,
      classes.gradeLevel,
      classes.section,
      departments.code,
    )
    .orderBy(asc(students.name));

  return rows.map((row) => ({
    ...row,
    sakit: Number(row.sakit),
    izin: Number(row.izin),
    alpa: Number(row.alpa),
    dispensasi: Number(row.dispensasi),
    total: Number(row.total),
  }));
}

export type AttendanceRecapListFilters = AttendanceRecapFilters & {
  sort?: "name" | "class" | "sakit" | "izin" | "alpa" | "dispensasi" | "total";
  dir?: SortDirection;
  page?: number;
  perPage?: number;
};

export async function getAttendanceRecapPaged(
  filters: AttendanceRecapListFilters,
): Promise<Paginated<Awaited<ReturnType<typeof getAttendanceRecap>>[number]>> {
  const db = getDb();
  const perPage = filters.perPage ?? 20;
  const page = filters.page ?? 1;
  const conditions = attendanceRecapConditions(filters);

  const [totalRow] = await db
    .select({ total: sql<number>`count(distinct ${students.id})` })
    .from(attendanceRecords)
    .innerJoin(journals, eq(attendanceRecords.journalId, journals.id))
    .innerJoin(schedules, eq(journals.scheduleId, schedules.id))
    .innerJoin(subjects, eq(schedules.subjectId, subjects.id))
    .innerJoin(classes, eq(schedules.classId, classes.id))
    .innerJoin(departments, eq(classes.departmentId, departments.id))
    .innerJoin(students, eq(attendanceRecords.studentId, students.id))
    .where(and(...conditions));
  const total = Number(totalRow?.total ?? 0);
  const meta = normalizePagination(total, page, perPage);

  const sakitExpr = sql<number>`count(*) filter (where ${attendanceRecords.status} = 'SAKIT')`;
  const izinExpr = sql<number>`count(*) filter (where ${attendanceRecords.status} = 'IZIN')`;
  const alpaExpr = sql<number>`count(*) filter (where ${attendanceRecords.status} = 'ALPA')`;
  const dispensasiExpr = sql<number>`count(*) filter (where ${attendanceRecords.status} = 'DISPENSASI')`;
  const totalExpr = sql<number>`count(*)`;

  const sort = filters.sort ?? "total";
  const dir = filters.dir ?? (sort === "name" || sort === "class" ? "asc" : "desc");
  const sortColumn =
    sort === "name"
      ? students.name
      : sort === "class"
        ? classes.gradeLevel
        : sort === "sakit"
          ? sakitExpr
          : sort === "izin"
            ? izinExpr
            : sort === "alpa"
              ? alpaExpr
              : sort === "dispensasi"
                ? dispensasiExpr
                : totalExpr;

  const rows = await db
    .select({
      studentId: students.id,
      studentName: students.name,
      nisn: students.nisn,
      gradeLevel: classes.gradeLevel,
      section: classes.section,
      departmentCode: departments.code,
      sakit: sakitExpr,
      izin: izinExpr,
      alpa: alpaExpr,
      dispensasi: dispensasiExpr,
      total: totalExpr,
    })
    .from(attendanceRecords)
    .innerJoin(journals, eq(attendanceRecords.journalId, journals.id))
    .innerJoin(schedules, eq(journals.scheduleId, schedules.id))
    .innerJoin(subjects, eq(schedules.subjectId, subjects.id))
    .innerJoin(classes, eq(schedules.classId, classes.id))
    .innerJoin(departments, eq(classes.departmentId, departments.id))
    .innerJoin(students, eq(attendanceRecords.studentId, students.id))
    .where(and(...conditions))
    .groupBy(
      students.id,
      students.name,
      students.nisn,
      classes.gradeLevel,
      classes.section,
      departments.code,
    )
    .orderBy(
      dir === "asc" ? asc(sortColumn) : desc(sortColumn),
      asc(classes.gradeLevel),
      asc(classes.section),
      asc(students.name),
    )
    .limit(perPage)
    .offset(meta.offset);

  return paginated(
    rows.map((row) => ({
      ...row,
      sakit: Number(row.sakit),
      izin: Number(row.izin),
      alpa: Number(row.alpa),
      dispensasi: Number(row.dispensasi),
      total: Number(row.total),
    })),
    total,
    meta.page,
    perPage,
  );
}

export async function getAttendanceRecapTotals(filters: AttendanceRecapFilters) {
  const conditions = attendanceRecapConditions(filters);
  const [row] = await getDb()
    .select({
      sakit: sql<number>`count(*) filter (where ${attendanceRecords.status} = 'SAKIT')`,
      izin: sql<number>`count(*) filter (where ${attendanceRecords.status} = 'IZIN')`,
      alpa: sql<number>`count(*) filter (where ${attendanceRecords.status} = 'ALPA')`,
      dispensasi: sql<number>`count(*) filter (where ${attendanceRecords.status} = 'DISPENSASI')`,
      total: sql<number>`count(*)`,
      students: sql<number>`count(distinct ${attendanceRecords.studentId})`,
    })
    .from(attendanceRecords)
    .innerJoin(journals, eq(attendanceRecords.journalId, journals.id))
    .innerJoin(schedules, eq(journals.scheduleId, schedules.id))
    .innerJoin(subjects, eq(schedules.subjectId, subjects.id))
    .innerJoin(classes, eq(schedules.classId, classes.id))
    .innerJoin(departments, eq(classes.departmentId, departments.id))
    .innerJoin(students, eq(attendanceRecords.studentId, students.id))
    .where(and(...conditions));

  return {
    sakit: Number(row?.sakit ?? 0),
    izin: Number(row?.izin ?? 0),
    alpa: Number(row?.alpa ?? 0),
    dispensasi: Number(row?.dispensasi ?? 0),
    total: Number(row?.total ?? 0),
    students: Number(row?.students ?? 0),
  };
}

export async function getAttendanceRecapByClass(
  filters: AttendanceRecapFilters,
) {
  const conditions = attendanceRecapConditions(filters);
  const rows = await getDb()
    .select({
      classId: classes.id,
      gradeLevel: classes.gradeLevel,
      section: classes.section,
      departmentCode: departments.code,
      sakit: sql<number>`count(*) filter (where ${attendanceRecords.status} = 'SAKIT')`,
      izin: sql<number>`count(*) filter (where ${attendanceRecords.status} = 'IZIN')`,
      alpa: sql<number>`count(*) filter (where ${attendanceRecords.status} = 'ALPA')`,
      dispensasi: sql<number>`count(*) filter (where ${attendanceRecords.status} = 'DISPENSASI')`,
      total: sql<number>`count(*)`,
      students: sql<number>`count(distinct ${attendanceRecords.studentId})`,
    })
    .from(attendanceRecords)
    .innerJoin(journals, eq(attendanceRecords.journalId, journals.id))
    .innerJoin(schedules, eq(journals.scheduleId, schedules.id))
    .innerJoin(subjects, eq(schedules.subjectId, subjects.id))
    .innerJoin(classes, eq(schedules.classId, classes.id))
    .innerJoin(departments, eq(classes.departmentId, departments.id))
    .innerJoin(students, eq(attendanceRecords.studentId, students.id))
    .where(and(...conditions))
    .groupBy(classes.id, classes.gradeLevel, classes.section, departments.code)
    .orderBy(desc(sql`count(*)`));

  return rows.map((row) => ({
    ...row,
    sakit: Number(row.sakit),
    izin: Number(row.izin),
    alpa: Number(row.alpa),
    dispensasi: Number(row.dispensasi),
    total: Number(row.total),
    students: Number(row.students),
  }));
}

export async function getJournalRecapByTeacher(filters: {
  dateFrom: string;
  dateTo: string;
}) {
  const rows = await getDb()
    .select({
      teacherId: journals.teacherId,
      teacherName: users.name,
      totalJournals: count(journals.id),
    })
    .from(journals)
    .innerJoin(users, eq(journals.teacherId, users.id))
    .where(
      and(
        gte(journals.date, filters.dateFrom),
        lte(journals.date, filters.dateTo),
      ),
    )
    .groupBy(journals.teacherId, users.name)
    .orderBy(asc(users.name));

  return rows.map((row) => ({
    ...row,
    totalJournals: Number(row.totalJournals),
  }));
}
