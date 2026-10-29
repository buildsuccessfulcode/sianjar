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
      classId: classes.id,
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
      classes.id,
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
      classId: classes.id,
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
      classes.id,
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

export type AttendanceAnalyticsCounts = {
  sakit: number;
  izin: number;
  alpa: number;
  dispensasi: number;
  total: number;
};

export type AttendanceRisk =
  | "TINGGI"
  | "SEDANG"
  | "RENDAH"
  | "TIDAK_DIHITUNG";

export type AttendanceAnalyticsSummary = AttendanceAnalyticsCounts & {
  dateFrom: string;
  dateTo: string;
  classCount: number;
  subjectCount: number;
  sessions: number;
  students: number;
  expected: number;
  present: number;
  attendanceRate: number | null;
  absenceRate: number | null;
};

export type AttendanceAnalyticsClassRow = AttendanceAnalyticsCounts & {
  classId: string;
  gradeLevel: number;
  section: string;
  departmentCode: string;
  students: number;
  sessions: number;
  expected: number;
  present: number;
  attendanceRate: number | null;
  absenceRate: number | null;
};

export type AttendanceAnalyticsSubjectRow = AttendanceAnalyticsCounts & {
  subjectId: string;
  subjectName: string;
  classCount: number;
  sessions: number;
  expected: number;
  present: number;
  attendanceRate: number | null;
  absenceRate: number | null;
};

export type AttendanceAnalyticsClassSubjectRow = AttendanceAnalyticsCounts & {
  classId: string;
  gradeLevel: number;
  section: string;
  departmentCode: string;
  subjectId: string;
  subjectName: string;
  students: number;
  sessions: number;
  expected: number;
  present: number;
  attendanceRate: number | null;
  absenceRate: number | null;
};

export type AttendanceAnalyticsStudentRow = AttendanceAnalyticsCounts & {
  studentId: string;
  studentName: string;
  nisn: string;
  classId: string;
  gradeLevel: number;
  section: string;
  departmentCode: string;
  sessions: number;
  expected: number;
  present: number;
  attendanceRate: number | null;
  absenceRate: number | null;
  risk: AttendanceRisk;
};

export type AttendanceAnalyticsStudentSubjectRow =
  AttendanceAnalyticsCounts & {
    studentId: string;
    studentName: string;
    nisn: string;
    classId: string;
    gradeLevel: number;
    section: string;
    departmentCode: string;
    subjectId: string;
    subjectName: string;
    sessions: number;
    expected: number;
    present: number;
    attendanceRate: number | null;
    absenceRate: number | null;
    risk: AttendanceRisk;
  };

export type AttendanceRecapAnalytics = {
  summary: AttendanceAnalyticsSummary;
  byClass: AttendanceAnalyticsClassRow[];
  bySubject: AttendanceAnalyticsSubjectRow[];
  byClassSubject: AttendanceAnalyticsClassSubjectRow[];
  byStudent: AttendanceAnalyticsStudentRow[];
  byStudentSubject: AttendanceAnalyticsStudentSubjectRow[];
};

const EMPTY_ATTENDANCE_COUNTS: AttendanceAnalyticsCounts = {
  sakit: 0,
  izin: 0,
  alpa: 0,
  dispensasi: 0,
  total: 0,
};

function addCounts(
  target: AttendanceAnalyticsCounts,
  source: AttendanceAnalyticsCounts,
) {
  target.sakit += source.sakit;
  target.izin += source.izin;
  target.alpa += source.alpa;
  target.dispensasi += source.dispensasi;
  target.total += source.total;
  return target;
}

function readCounts(row: {
  sakit: unknown;
  izin: unknown;
  alpa: unknown;
  dispensasi: unknown;
  total: unknown;
}): AttendanceAnalyticsCounts {
  return {
    sakit: Number(row.sakit ?? 0),
    izin: Number(row.izin ?? 0),
    alpa: Number(row.alpa ?? 0),
    dispensasi: Number(row.dispensasi ?? 0),
    total: Number(row.total ?? 0),
  };
}

function ratio(part: number, whole: number) {
  if (whole <= 0) return null;
  return Math.min(1, Math.max(0, part / whole));
}

function attendanceRate(present: number, expected: number) {
  if (expected <= 0) return null;
  return Math.min(1, Math.max(0, present / expected));
}

function absenceRate(total: number, expected: number) {
  return ratio(total, expected);
}

function toRisk(rate: number | null): AttendanceRisk {
  if (rate === null) return "TIDAK_DIHITUNG";
  if (rate < 0.75) return "TINGGI";
  if (rate < 0.9) return "SEDANG";
  return "RENDAH";
}

function aggregateAttendanceConditions(filters: AttendanceRecapFilters) {
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
  ];
}

/**
 * Rekap analitik untuk export.
 *
 * Catatan metodologi: `attendance_records` hanya menyimpan ketidakhadiran
 * (SAKIT/IZIN/ALPA/DISPENSASI). Kehadiran dihitung implisit sebagai
 * "siswa-sesi potensial dikurangi ketidakhadiran", dengan potensi dihitung
 * dari jumlah jurnal (sesi) pada periode dikali jumlah siswa aktif di kelas.
 * Angka ini pendekatan yang stabil untuk laporan sekolah, bukan presensi
 * per-menit.
 */
export async function getAttendanceRecapAnalytics(
  filters: AttendanceRecapFilters,
): Promise<AttendanceRecapAnalytics> {
  const db = getDb();
  const conditions = aggregateAttendanceConditions(filters);

  const [sessionRows, absenceRows, studentSubjectAbsenceRows] =
    await Promise.all([
      db
        .select({
          classId: classes.id,
          gradeLevel: classes.gradeLevel,
          section: classes.section,
          departmentCode: departments.code,
          subjectId: subjects.id,
          subjectName: subjects.name,
          sessions: sql<number>`count(*)`,
        })
        .from(journals)
        .innerJoin(schedules, eq(journals.scheduleId, schedules.id))
        .innerJoin(subjects, eq(schedules.subjectId, subjects.id))
        .innerJoin(classes, eq(schedules.classId, classes.id))
        .innerJoin(departments, eq(classes.departmentId, departments.id))
        .where(and(...conditions))
        .groupBy(
          classes.id,
          classes.gradeLevel,
          classes.section,
          departments.code,
          subjects.id,
          subjects.name,
        ),
      db
        .select({
          classId: classes.id,
          subjectId: subjects.id,
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
        .where(and(...conditions))
        .groupBy(classes.id, subjects.id),
      db
        .select({
          studentId: students.id,
          studentName: students.name,
          nisn: students.nisn,
          classId: classes.id,
          gradeLevel: classes.gradeLevel,
          section: classes.section,
          departmentCode: departments.code,
          subjectId: subjects.id,
          subjectName: subjects.name,
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
          classes.id,
          classes.gradeLevel,
          classes.section,
          departments.code,
          subjects.id,
          subjects.name,
        ),
    ]);

  type ClassInfo = {
    classId: string;
    gradeLevel: number;
    section: string;
    departmentCode: string;
    sessions: number;
  };
  type ClassSubjectInfo = {
    classId: string;
    gradeLevel: number;
    section: string;
    departmentCode: string;
    subjectId: string;
    subjectName: string;
    sessions: number;
  };
  const classSessions = new Map<string, ClassInfo>();
  const subjectSessions = new Map<
    string,
    {
      subjectId: string;
      subjectName: string;
      sessions: number;
      classIds: Set<string>;
    }
  >();
  const classSubjectSessions = new Map<string, ClassSubjectInfo>();

  let totalSessions = 0;
  for (const row of sessionRows) {
    const sessions = Number(row.sessions ?? 0);
    totalSessions += sessions;
    const classEntry = classSessions.get(row.classId) ?? {
      classId: row.classId,
      gradeLevel: Number(row.gradeLevel),
      section: row.section,
      departmentCode: row.departmentCode,
      sessions: 0,
    };
    classEntry.sessions += sessions;
    classSessions.set(row.classId, classEntry);

    const subjectEntry = subjectSessions.get(row.subjectId) ?? {
      subjectId: row.subjectId,
      subjectName: row.subjectName,
      sessions: 0,
      classIds: new Set<string>(),
    };
    subjectEntry.sessions += sessions;
    subjectEntry.classIds.add(row.classId);
    subjectSessions.set(row.subjectId, subjectEntry);

    classSubjectSessions.set(`${row.classId}:${row.subjectId}`, {
      classId: row.classId,
      gradeLevel: Number(row.gradeLevel),
      section: row.section,
      departmentCode: row.departmentCode,
      subjectId: row.subjectId,
      subjectName: row.subjectName,
      sessions,
    });
  }

  const classAbsences = new Map<string, AttendanceAnalyticsCounts>();
  const subjectAbsences = new Map<string, AttendanceAnalyticsCounts>();
  const classSubjectAbsences = new Map<string, AttendanceAnalyticsCounts>();

  function mergeAbsence(
    map: Map<string, AttendanceAnalyticsCounts>,
    key: string,
    counts: AttendanceAnalyticsCounts,
  ) {
    const entry = map.get(key) ?? { ...EMPTY_ATTENDANCE_COUNTS };
    addCounts(entry, counts);
    map.set(key, entry);
  }

  for (const row of absenceRows) {
    const counts = readCounts(row);
    mergeAbsence(classAbsences, row.classId, counts);
    mergeAbsence(subjectAbsences, row.subjectId, counts);
    mergeAbsence(classSubjectAbsences, `${row.classId}:${row.subjectId}`, counts);
  }

  const sessionClassIds = Array.from(classSessions.keys());
  const enrolledRows =
    sessionClassIds.length > 0
      ? await db
          .select({
            studentId: students.id,
            studentName: students.name,
            nisn: students.nisn,
            classId: classes.id,
            gradeLevel: classes.gradeLevel,
            section: classes.section,
            departmentCode: departments.code,
          })
          .from(studentEnrollments)
          .innerJoin(students, eq(studentEnrollments.studentId, students.id))
          .innerJoin(classes, eq(studentEnrollments.classId, classes.id))
          .innerJoin(departments, eq(classes.departmentId, departments.id))
          .where(
            and(
              inArray(studentEnrollments.classId, sessionClassIds),
              eq(studentEnrollments.academicYearId, classes.academicYearId),
              eq(studentEnrollments.status, "ACTIVE"),
              isNull(studentEnrollments.deletedAt),
              eq(students.isActive, true),
              isNull(students.deletedAt),
            ),
          )
      : [];

  const studentsByClass = new Map<string, number>();
  const studentIds = new Set<string>();
  for (const row of enrolledRows) {
    studentsByClass.set(row.classId, (studentsByClass.get(row.classId) ?? 0) + 1);
    studentIds.add(row.studentId);
  }

  const byClass: AttendanceAnalyticsClassRow[] = Array.from(
    classSessions.values(),
  )
    .map((row) => {
      const counts = classAbsences.get(row.classId) ?? {
        ...EMPTY_ATTENDANCE_COUNTS,
      };
      const students = studentsByClass.get(row.classId) ?? 0;
      const expected = row.sessions * students;
      const present = Math.max(expected - counts.total, 0);
      const rate = attendanceRate(present, expected);
      return {
        classId: row.classId,
        gradeLevel: row.gradeLevel,
        section: row.section,
        departmentCode: row.departmentCode,
        students,
        sessions: row.sessions,
        expected,
        present,
        ...counts,
        attendanceRate: rate,
        absenceRate: absenceRate(counts.total, expected),
      };
    })
    .sort((a, b) => {
      const rateA = a.attendanceRate ?? 1;
      const rateB = b.attendanceRate ?? 1;
      if (rateA !== rateB) return rateA - rateB;
      return `${a.gradeLevel}${a.departmentCode}${a.section}`.localeCompare(
        `${b.gradeLevel}${b.departmentCode}${b.section}`,
      );
    });

  const subjectExpected = new Map<string, number>();
  for (const row of classSubjectSessions.values()) {
    const students = studentsByClass.get(row.classId) ?? 0;
    subjectExpected.set(
      row.subjectId,
      (subjectExpected.get(row.subjectId) ?? 0) + row.sessions * students,
    );
  }

  const bySubject: AttendanceAnalyticsSubjectRow[] = Array.from(
    subjectSessions.values(),
  )
    .map((row) => {
      const counts = subjectAbsences.get(row.subjectId) ?? {
        ...EMPTY_ATTENDANCE_COUNTS,
      };
      const expected = subjectExpected.get(row.subjectId) ?? 0;
      const present = Math.max(expected - counts.total, 0);
      return {
        subjectId: row.subjectId,
        subjectName: row.subjectName,
        classCount: row.classIds.size,
        sessions: row.sessions,
        expected,
        present,
        ...counts,
        attendanceRate: attendanceRate(present, expected),
        absenceRate: absenceRate(counts.total, expected),
      };
    })
    .sort((a, b) => {
      const rateA = a.attendanceRate ?? 1;
      const rateB = b.attendanceRate ?? 1;
      if (rateA !== rateB) return rateA - rateB;
      return a.subjectName.localeCompare(b.subjectName);
    });

  const byClassSubject: AttendanceAnalyticsClassSubjectRow[] = Array.from(
    classSubjectSessions.values(),
  )
    .map((row) => {
      const counts = classSubjectAbsences.get(
        `${row.classId}:${row.subjectId}`,
      ) ?? { ...EMPTY_ATTENDANCE_COUNTS };
      const students = studentsByClass.get(row.classId) ?? 0;
      const expected = row.sessions * students;
      const present = Math.max(expected - counts.total, 0);
      return {
        classId: row.classId,
        gradeLevel: row.gradeLevel,
        section: row.section,
        departmentCode: row.departmentCode,
        subjectId: row.subjectId,
        subjectName: row.subjectName,
        students,
        sessions: row.sessions,
        expected,
        present,
        ...counts,
        attendanceRate: attendanceRate(present, expected),
        absenceRate: absenceRate(counts.total, expected),
      };
    })
    .sort((a, b) => {
      const classCompare = `${a.gradeLevel}${a.departmentCode}${a.section}`.localeCompare(
        `${b.gradeLevel}${b.departmentCode}${b.section}`,
      );
      if (classCompare !== 0) return classCompare;
      return a.subjectName.localeCompare(b.subjectName);
    });

  const recapRows = await getAttendanceRecap(filters);
  const absenceByStudent = new Map<
    string,
    AttendanceAnalyticsCounts & { fallbackClassId: string }
  >();
  for (const row of recapRows) {
    const entry = absenceByStudent.get(row.studentId) ?? {
      ...EMPTY_ATTENDANCE_COUNTS,
      fallbackClassId: row.classId,
    };
    addCounts(entry, {
      sakit: Number(row.sakit),
      izin: Number(row.izin),
      alpa: Number(row.alpa),
      dispensasi: Number(row.dispensasi),
      total: Number(row.total),
    });
    absenceByStudent.set(row.studentId, entry);
  }

  const search = filters.q?.trim().toLowerCase() ?? "";
  const matchesSearch = (name: string, nisn: string) =>
    !search ||
    name.toLowerCase().includes(search) ||
    nisn.toLowerCase().includes(search);

  const studentMap = new Map<string, AttendanceAnalyticsStudentRow>();
  for (const row of enrolledRows) {
    if (!matchesSearch(row.studentName, row.nisn)) continue;
    const counts = absenceByStudent.get(row.studentId) ?? {
      ...EMPTY_ATTENDANCE_COUNTS,
    };
    const sessions = classSessions.get(row.classId)?.sessions ?? 0;
    const present = Math.max(sessions - counts.total, 0);
    const rate = attendanceRate(present, sessions);
    studentMap.set(row.studentId, {
      studentId: row.studentId,
      studentName: row.studentName,
      nisn: row.nisn,
      classId: row.classId,
      gradeLevel: Number(row.gradeLevel),
      section: row.section,
      departmentCode: row.departmentCode,
      sessions,
      expected: sessions,
      present,
      sakit: counts.sakit,
      izin: counts.izin,
      alpa: counts.alpa,
      dispensasi: counts.dispensasi,
      total: counts.total,
      attendanceRate: rate,
      absenceRate: absenceRate(counts.total, sessions),
      risk: toRisk(rate),
    });
  }

  for (const [studentId, counts] of absenceByStudent) {
    if (studentMap.has(studentId)) continue;
    const classInfo = classSessions.get(counts.fallbackClassId);
    const recapRow = recapRows.find((row) => row.studentId === studentId);
    if (!recapRow) continue;
    if (!matchesSearch(recapRow.studentName, recapRow.nisn)) continue;
    const sessions = classInfo?.sessions ?? 0;
    const present = Math.max(sessions - counts.total, 0);
    const rate = attendanceRate(present, sessions);
    studentMap.set(studentId, {
      studentId,
      studentName: recapRow.studentName,
      nisn: recapRow.nisn,
      classId: counts.fallbackClassId,
      gradeLevel: Number(recapRow.gradeLevel),
      section: recapRow.section,
      departmentCode: recapRow.departmentCode,
      sessions,
      expected: sessions,
      present,
      sakit: counts.sakit,
      izin: counts.izin,
      alpa: counts.alpa,
      dispensasi: counts.dispensasi,
      total: counts.total,
      attendanceRate: rate,
      absenceRate: absenceRate(counts.total, sessions),
      risk: toRisk(rate),
    });
  }

  const byStudent = Array.from(studentMap.values()).sort((a, b) => {
    const classCompare = `${a.gradeLevel}${a.departmentCode}${a.section}`.localeCompare(
      `${b.gradeLevel}${b.departmentCode}${b.section}`,
    );
    if (classCompare !== 0) return classCompare;
    const rateA = a.attendanceRate ?? 1;
    const rateB = b.attendanceRate ?? 1;
    if (rateA !== rateB) return rateA - rateB;
    return a.studentName.localeCompare(b.studentName);
  });

  const subjectsByClass = new Map<string, ClassSubjectInfo[]>();
  for (const row of classSubjectSessions.values()) {
    const entry = subjectsByClass.get(row.classId) ?? [];
    entry.push(row);
    subjectsByClass.set(row.classId, entry);
  }

  const studentSubjectAbsence = new Map<string, AttendanceAnalyticsCounts>();
  const studentSubjectSessions = new Map<string, number>();
  const studentSubjectInfo = new Map<
    string,
    {
      studentId: string;
      studentName: string;
      nisn: string;
      classId: string;
      gradeLevel: number;
      section: string;
      departmentCode: string;
      subjectId: string;
      subjectName: string;
    }
  >();

  for (const row of studentSubjectAbsenceRows) {
    const key = `${row.studentId}:${row.subjectId}`;
    mergeAbsence(studentSubjectAbsence, key, readCounts(row));
    const sessions =
      classSubjectSessions.get(`${row.classId}:${row.subjectId}`)?.sessions ?? 0;
    studentSubjectSessions.set(
      key,
      (studentSubjectSessions.get(key) ?? 0) + sessions,
    );
    if (!studentSubjectInfo.has(key)) {
      studentSubjectInfo.set(key, {
        studentId: row.studentId,
        studentName: row.studentName,
        nisn: row.nisn,
        classId: row.classId,
        gradeLevel: Number(row.gradeLevel),
        section: row.section,
        departmentCode: row.departmentCode,
        subjectId: row.subjectId,
        subjectName: row.subjectName,
      });
    }
  }

  const studentSubjectMap = new Map<
    string,
    AttendanceAnalyticsStudentSubjectRow
  >();

  for (const student of enrolledRows) {
    if (!matchesSearch(student.studentName, student.nisn)) continue;
    for (const subject of subjectsByClass.get(student.classId) ?? []) {
      const key = `${student.studentId}:${subject.subjectId}`;
      const counts = studentSubjectAbsence.get(key) ?? {
        ...EMPTY_ATTENDANCE_COUNTS,
      };
      const sessions = subject.sessions;
      const present = Math.max(sessions - counts.total, 0);
      const rate = attendanceRate(present, sessions);
      studentSubjectMap.set(key, {
        studentId: student.studentId,
        studentName: student.studentName,
        nisn: student.nisn,
        classId: student.classId,
        gradeLevel: Number(student.gradeLevel),
        section: student.section,
        departmentCode: student.departmentCode,
        subjectId: subject.subjectId,
        subjectName: subject.subjectName,
        sessions,
        expected: sessions,
        present,
        ...counts,
        attendanceRate: rate,
        absenceRate: absenceRate(counts.total, sessions),
        risk: toRisk(rate),
      });
    }
  }

  for (const [key, info] of studentSubjectInfo) {
    if (studentSubjectMap.has(key)) continue;
    if (!matchesSearch(info.studentName, info.nisn)) continue;
    const counts = studentSubjectAbsence.get(key) ?? {
      ...EMPTY_ATTENDANCE_COUNTS,
    };
    const sessions = studentSubjectSessions.get(key) ?? 0;
    const present = Math.max(sessions - counts.total, 0);
    const rate = attendanceRate(present, sessions);
    studentSubjectMap.set(key, {
      studentId: info.studentId,
      studentName: info.studentName,
      nisn: info.nisn,
      classId: info.classId,
      gradeLevel: info.gradeLevel,
      section: info.section,
      departmentCode: info.departmentCode,
      subjectId: info.subjectId,
      subjectName: info.subjectName,
      sessions,
      expected: sessions,
      present,
      ...counts,
      attendanceRate: rate,
      absenceRate: absenceRate(counts.total, sessions),
      risk: toRisk(rate),
    });
  }

  const byStudentSubject = Array.from(studentSubjectMap.values()).sort(
    (a, b) => {
      const classCompare =
        `${a.gradeLevel}${a.departmentCode}${a.section}`.localeCompare(
          `${b.gradeLevel}${b.departmentCode}${b.section}`,
        );
      if (classCompare !== 0) return classCompare;
      const studentCompare = a.studentName.localeCompare(b.studentName);
      if (studentCompare !== 0) return studentCompare;
      const rateA = a.attendanceRate ?? 1;
      const rateB = b.attendanceRate ?? 1;
      if (rateA !== rateB) return rateA - rateB;
      return a.subjectName.localeCompare(b.subjectName);
    },
  );

  const summaryCounts = byClass.reduce(
    (acc, row) => addCounts(acc, row),
    { ...EMPTY_ATTENDANCE_COUNTS },
  );
  const expected = byClass.reduce((sum, row) => sum + row.expected, 0);
  const present = Math.max(expected - summaryCounts.total, 0);

  return {
    summary: {
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      classCount: classSessions.size,
      subjectCount: subjectSessions.size,
      sessions: totalSessions,
      students: studentIds.size,
      expected,
      present,
      ...summaryCounts,
      attendanceRate: attendanceRate(present, expected),
      absenceRate: absenceRate(summaryCounts.total, expected),
    },
    byClass,
    bySubject,
    byClassSubject,
    byStudent,
    byStudentSubject,
  };
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
