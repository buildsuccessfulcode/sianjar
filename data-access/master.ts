import "server-only";

import bcrypt from "bcryptjs";
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  or,
  sql,
} from "drizzle-orm";
import type { z } from "zod";

import {
  academicYears,
  classes,
  departments,
  semesters,
  studentEnrollments,
  students,
  subjects,
  teacherProfiles,
  teacherSubjects,
  userRoles,
  users,
} from "@/db/schema";
import { getDb, getDbPool } from "@/lib/db";
import {
  ConflictError,
  isUniqueViolation,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";
import type { EnrollmentStatus } from "@/db/schema/enums";
import { writeAudit } from "@/lib/audit";
import {
  likePattern,
  normalizePagination,
  paginated,
  type Paginated,
  type SortDirection,
} from "@/lib/pagination";
import type {
  academicYearSchema,
  classSchema,
  departmentSchema,
  enrollmentBulkSchema,
  enrollmentBulkStatusSchema,
  enrollmentMoveSchema,
  enrollmentSchema,
  enrollmentUpdateSchema,
  semesterSchema,
  studentBulkStatusSchema,
  studentCreateSchema,
  studentImportRowSchema,
  studentUpdateSchema,
  subjectSchema,
  teacherCreateSchema,
  teacherSubjectBulkSchema,
  teacherUpdateSchema,
} from "@/lib/validators/master";

export type AcademicYearInput = z.infer<typeof academicYearSchema>;
export type SemesterInput = z.infer<typeof semesterSchema>;
export type DepartmentInput = z.infer<typeof departmentSchema>;
export type SubjectInput = z.infer<typeof subjectSchema>;
export type ClassInput = z.infer<typeof classSchema>;
export type TeacherCreateInput = z.infer<typeof teacherCreateSchema>;
export type TeacherUpdateInput = z.infer<typeof teacherUpdateSchema>;
export type StudentCreateInput = z.infer<typeof studentCreateSchema>;
export type StudentUpdateInput = z.infer<typeof studentUpdateSchema>;
export type StudentBulkStatusInput = z.infer<typeof studentBulkStatusSchema>;
export type StudentImportInput = z.infer<typeof studentImportRowSchema>;
export type StudentImportRowInput = StudentImportInput & { classId?: string };
export type EnrollmentInput = z.infer<typeof enrollmentSchema>;
export type EnrollmentUpdateInput = z.infer<typeof enrollmentUpdateSchema>;
export type EnrollmentBulkInput = z.infer<typeof enrollmentBulkSchema>;
export type EnrollmentBulkStatusInput = z.infer<
  typeof enrollmentBulkStatusSchema
>;
export type EnrollmentMoveInput = z.infer<typeof enrollmentMoveSchema>;
export type TeacherSubjectBulkInput = z.infer<
  typeof teacherSubjectBulkSchema
>;

export type BulkEnrollmentResult = {
  created: number;
  reactivated: number;
  skipped: { studentId: string; name: string; reason: string }[];
};

export type StudentImportResult = {
  created: number;
  enrolled: number;
  skipped: { nisn: string; name: string; reason: string }[];
};

export const DEFAULT_RESET_PASSWORD = "test1234";

export async function listAcademicYears() {
  return getDb()
    .select()
    .from(academicYears)
    .where(isNull(academicYears.deletedAt))
    .orderBy(desc(academicYears.startDate));
}

export async function listSemesters() {
  return getDb()
    .select({
      id: semesters.id,
      name: semesters.name,
      startDate: semesters.startDate,
      endDate: semesters.endDate,
      isActive: semesters.isActive,
      academicYearId: academicYears.id,
      academicYearName: academicYears.name,
      academicYearActive: academicYears.isActive,
    })
    .from(semesters)
    .innerJoin(academicYears, eq(semesters.academicYearId, academicYears.id))
    .where(
      and(isNull(semesters.deletedAt), isNull(academicYears.deletedAt)),
    )
    .orderBy(desc(academicYears.startDate), asc(semesters.name));
}

export async function getActiveAcademicYear() {
  const rows = await getDb()
    .select()
    .from(academicYears)
    .where(
      and(
        eq(academicYears.isActive, true),
        isNull(academicYears.deletedAt),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function getActiveSemester() {
  const rows = await getDb()
    .select({
      id: semesters.id,
      name: semesters.name,
      startDate: semesters.startDate,
      endDate: semesters.endDate,
      academicYearId: academicYears.id,
      academicYearName: academicYears.name,
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
  return rows[0] ?? null;
}

export async function createAcademicYear(input: AcademicYearInput) {
  try {
    const [row] = await getDb()
      .insert(academicYears)
      .values(input)
      .returning();
    return row;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError("Tahun ajaran sudah ada.");
    }
    throw error;
  }
}

export async function updateAcademicYear(
  id: string,
  input: AcademicYearInput,
) {
  try {
    const [row] = await getDb()
      .update(academicYears)
      .set({ ...input, updatedAt: new Date() })
      .where(
        and(eq(academicYears.id, id), isNull(academicYears.deletedAt)),
      )
      .returning();
    if (!row) throw new NotFoundError("Tahun ajaran tidak ditemukan.");
    return row;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError("Tahun ajaran sudah ada.");
    }
    throw error;
  }
}

export async function activateAcademicYear(id: string, actorId: string) {
  const db = getDbPool();
  await db.transaction(async (tx) => {
    const [year] = await tx
      .select()
      .from(academicYears)
      .where(
        and(eq(academicYears.id, id), isNull(academicYears.deletedAt)),
      )
      .limit(1);
    if (!year) throw new NotFoundError("Tahun ajaran tidak ditemukan.");

    await tx
      .update(academicYears)
      .set({ isActive: false, updatedAt: new Date() });
    await tx
      .update(academicYears)
      .set({ isActive: true, updatedAt: new Date() })
      .where(eq(academicYears.id, id));

    await writeAudit(tx, {
      actorId,
      action: "academic_year.activate",
      entityType: "academic_year",
      entityId: id,
      payload: { name: year.name },
    });
  });
}

export async function softDeleteAcademicYear(id: string) {
  const [row] = await getDb()
    .update(academicYears)
    .set({ isActive: false, deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(academicYears.id, id))
    .returning();
  if (!row) throw new NotFoundError("Tahun ajaran tidak ditemukan.");
}

export async function createSemester(input: SemesterInput) {
  try {
    const [row] = await getDb().insert(semesters).values(input).returning();
    return row;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError(
        "Semester dengan nama tersebut sudah ada pada tahun ajaran ini.",
      );
    }
    throw error;
  }
}

export async function updateSemester(id: string, input: SemesterInput) {
  const [existing] = await getDb()
    .select({ academicYearId: semesters.academicYearId })
    .from(semesters)
    .where(and(eq(semesters.id, id), isNull(semesters.deletedAt)))
    .limit(1);
  if (!existing) throw new NotFoundError("Semester tidak ditemukan.");
  if (existing.academicYearId !== input.academicYearId) {
    throw new ConflictError(
      "Tahun ajaran semester tidak dapat diubah. Buat semester baru pada tahun ajaran tujuan.",
    );
  }

  try {
    const [row] = await getDb()
      .update(semesters)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(semesters.id, id), isNull(semesters.deletedAt)))
      .returning();
    if (!row) throw new NotFoundError("Semester tidak ditemukan.");
    return row;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError(
        "Semester dengan nama tersebut sudah ada pada tahun ajaran ini.",
      );
    }
    throw error;
  }
}

export async function activateSemester(id: string, actorId: string) {
  const db = getDbPool();
  await db.transaction(async (tx) => {
    const [semester] = await tx
      .select({
        id: semesters.id,
        name: semesters.name,
        academicYearId: semesters.academicYearId,
        yearActive: academicYears.isActive,
      })
      .from(semesters)
      .innerJoin(academicYears, eq(semesters.academicYearId, academicYears.id))
      .where(and(eq(semesters.id, id), isNull(semesters.deletedAt)))
      .limit(1);

    if (!semester) throw new NotFoundError("Semester tidak ditemukan.");
    if (!semester.yearActive) {
      throw new ConflictError(
        "Aktifkan tahun ajaran terlebih dahulu sebelum mengaktifkan semester.",
      );
    }

    await tx
      .update(semesters)
      .set({ isActive: false, updatedAt: new Date() });
    await tx
      .update(semesters)
      .set({ isActive: true, updatedAt: new Date() })
      .where(eq(semesters.id, id));

    await writeAudit(tx, {
      actorId,
      action: "semester.activate",
      entityType: "semester",
      entityId: id,
      payload: { name: semester.name },
    });
  });
}

export async function listDepartments() {
  return getDb()
    .select()
    .from(departments)
    .where(isNull(departments.deletedAt))
    .orderBy(asc(departments.code));
}

export async function createDepartment(input: DepartmentInput) {
  try {
    const [row] = await getDb().insert(departments).values(input).returning();
    return row;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError("Kode jurusan sudah dipakai.");
    }
    throw error;
  }
}

export async function updateDepartment(id: string, input: DepartmentInput) {
  try {
    const [row] = await getDb()
      .update(departments)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(departments.id, id), isNull(departments.deletedAt)))
      .returning();
    if (!row) throw new NotFoundError("Jurusan tidak ditemukan.");
    return row;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError("Kode jurusan sudah dipakai.");
    }
    throw error;
  }
}

export async function softDeleteDepartment(id: string) {
  const [row] = await getDb()
    .update(departments)
    .set({ isActive: false, deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(departments.id, id))
    .returning();
  if (!row) throw new NotFoundError("Jurusan tidak ditemukan.");
}

export async function listSubjects() {
  return getDb()
    .select()
    .from(subjects)
    .where(isNull(subjects.deletedAt))
    .orderBy(asc(subjects.name));
}

export async function createSubject(input: SubjectInput) {
  try {
    const [row] = await getDb().insert(subjects).values(input).returning();
    return row;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError("Kode mapel sudah dipakai.");
    }
    throw error;
  }
}

export async function updateSubject(id: string, input: SubjectInput) {
  try {
    const [row] = await getDb()
      .update(subjects)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(subjects.id, id), isNull(subjects.deletedAt)))
      .returning();
    if (!row) throw new NotFoundError("Mapel tidak ditemukan.");
    return row;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError("Kode mapel sudah dipakai.");
    }
    throw error;
  }
}

export async function softDeleteSubject(id: string) {
  const [row] = await getDb()
    .update(subjects)
    .set({ isActive: false, deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(subjects.id, id))
    .returning();
  if (!row) throw new NotFoundError("Mapel tidak ditemukan.");
}

export async function listClasses(academicYearId?: string) {
  const db = getDb();
  const rows = await db
    .select({
      id: classes.id,
      academicYearId: classes.academicYearId,
      academicYearName: academicYears.name,
      departmentId: classes.departmentId,
      departmentCode: departments.code,
      departmentName: departments.name,
      gradeLevel: classes.gradeLevel,
      section: classes.section,
      homeroomTeacherId: classes.homeroomTeacherId,
      homeroomTeacherName: users.name,
      isActive: classes.isActive,
      studentCount: count(studentEnrollments.id),
    })
    .from(classes)
    .innerJoin(academicYears, eq(classes.academicYearId, academicYears.id))
    .innerJoin(departments, eq(classes.departmentId, departments.id))
    .leftJoin(users, eq(classes.homeroomTeacherId, users.id))
    .leftJoin(
      studentEnrollments,
      and(
        eq(studentEnrollments.classId, classes.id),
        eq(studentEnrollments.academicYearId, classes.academicYearId),
        eq(studentEnrollments.status, "ACTIVE"),
        isNull(studentEnrollments.deletedAt),
      ),
    )
    .where(
      academicYearId
        ? and(
            isNull(classes.deletedAt),
            isNull(academicYears.deletedAt),
            isNull(departments.deletedAt),
            eq(classes.academicYearId, academicYearId),
          )
        : and(
            isNull(classes.deletedAt),
            isNull(academicYears.deletedAt),
            isNull(departments.deletedAt),
          ),
    )
    .groupBy(
      classes.id,
      academicYears.name,
      academicYears.startDate,
      departments.code,
      departments.name,
      users.name,
    )
    .orderBy(
      desc(academicYears.startDate),
      asc(classes.gradeLevel),
      asc(classes.section),
    );

  return rows.map((row) => ({ ...row, studentCount: Number(row.studentCount) }));
}

export async function createClass(input: ClassInput) {
  try {
    const [row] = await getDb().insert(classes).values(input).returning();
    return row;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError(
        "Kelas dengan jurusan, tingkat, dan rombel tersebut sudah ada.",
      );
    }
    throw error;
  }
}

export async function updateClass(id: string, input: ClassInput) {
  const [existing] = await getDb()
    .select({ academicYearId: classes.academicYearId })
    .from(classes)
    .where(and(eq(classes.id, id), isNull(classes.deletedAt)))
    .limit(1);
  if (!existing) throw new NotFoundError("Kelas tidak ditemukan.");
  if (existing.academicYearId !== input.academicYearId) {
    throw new ConflictError(
      "Tahun ajaran kelas tidak dapat diubah. Buat kelas baru pada tahun ajaran tujuan.",
    );
  }

  try {
    const [row] = await getDb()
      .update(classes)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(classes.id, id), isNull(classes.deletedAt)))
      .returning();
    if (!row) throw new NotFoundError("Kelas tidak ditemukan.");
    return row;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError(
        "Kelas dengan jurusan, tingkat, dan rombel tersebut sudah ada.",
      );
    }
    throw error;
  }
}

export async function softDeleteClass(id: string) {
  const [row] = await getDb()
    .update(classes)
    .set({ isActive: false, deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(classes.id, id))
    .returning();
  if (!row) throw new NotFoundError("Kelas tidak ditemukan.");
}

export async function listTeachers() {
  const rows = await getDb()
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      isActive: users.isActive,
      nip: teacherProfiles.nip,
      expertiseNote: teacherProfiles.expertiseNote,
      createdAt: users.createdAt,
    })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .leftJoin(teacherProfiles, eq(teacherProfiles.userId, users.id))
    .where(
      and(
        eq(userRoles.role, "GURU"),
        isNull(users.deletedAt),
      ),
    )
    .orderBy(asc(users.name));
  return rows;
}

export async function listTeacherOptions() {
  return getDb()
    .select({
      id: users.id,
      name: users.name,
      nip: teacherProfiles.nip,
    })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .leftJoin(teacherProfiles, eq(teacherProfiles.userId, users.id))
    .where(
      and(
        eq(userRoles.role, "GURU"),
        eq(users.isActive, true),
        isNull(users.deletedAt),
      ),
    )
    .orderBy(asc(users.name));
}

export async function getTeacher(id: string) {
  const rows = await getDb()
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      isActive: users.isActive,
      nip: teacherProfiles.nip,
      expertiseNote: teacherProfiles.expertiseNote,
    })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .leftJoin(teacherProfiles, eq(teacherProfiles.userId, users.id))
    .where(
      and(
        eq(userRoles.role, "GURU"),
        eq(users.id, id),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function createTeacher(
  input: TeacherCreateInput,
  subjectIds: string[] = [],
) {
  const db = getDbPool();
  try {
    return await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          name: input.name,
          email: input.email,
          passwordHash: await bcrypt.hash(input.password, 10),
        })
        .returning();

      await tx.insert(userRoles).values({ userId: user.id, role: "GURU" });
      await tx.insert(teacherProfiles).values({
        userId: user.id,
        nip: input.nip ?? null,
        expertiseNote: input.expertiseNote ?? null,
      });

      if (subjectIds.length > 0) {
        await tx
          .insert(teacherSubjects)
          .values(subjectIds.map((subjectId) => ({ teacherId: user.id, subjectId })));
      }

      return user;
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError("Email atau NIP sudah dipakai.");
    }
    throw error;
  }
}

export async function updateTeacher(
  id: string,
  input: TeacherUpdateInput,
  subjectIds: string[] = [],
) {
  const db = getDbPool();
  try {
    await db.transaction(async (tx) => {
      const [user] = await tx
        .update(users)
        .set({
          name: input.name,
          email: input.email,
          isActive: input.isActive,
          deletedAt: input.isActive ? null : undefined,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))
        .returning();
      if (!user) throw new NotFoundError("Guru tidak ditemukan.");

      const [profile] = await tx
        .update(teacherProfiles)
        .set({
          nip: input.nip ?? null,
          expertiseNote: input.expertiseNote ?? null,
          updatedAt: new Date(),
        })
        .where(eq(teacherProfiles.userId, id))
        .returning();

      if (!profile) {
        await tx.insert(teacherProfiles).values({
          userId: id,
          nip: input.nip ?? null,
          expertiseNote: input.expertiseNote ?? null,
        });
      }

      await tx
        .delete(teacherSubjects)
        .where(eq(teacherSubjects.teacherId, id));
      if (subjectIds.length > 0) {
        await tx.insert(teacherSubjects).values(
          subjectIds.map((subjectId) => ({
            teacherId: id,
            subjectId,
          })),
        );
      }
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError("Email atau NIP sudah dipakai.");
    }
    throw error;
  }
}

export async function setTeacherActive(id: string, isActive: boolean) {
  const [row] = await getDb()
    .update(users)
    .set({
      isActive,
      deletedAt: isActive ? null : undefined,
      updatedAt: new Date(),
    })
    .where(eq(users.id, id))
    .returning();
  if (!row) throw new NotFoundError("Guru tidak ditemukan.");
}

export async function resetTeacherPassword(id: string, actorId: string) {
  const passwordHash = await bcrypt.hash(DEFAULT_RESET_PASSWORD, 10);

  await getDbPool().transaction(async (tx) => {
    const [teacher] = await tx
      .select({ id: users.id })
      .from(users)
      .innerJoin(userRoles, eq(userRoles.userId, users.id))
      .where(
        and(
          eq(users.id, id),
          eq(userRoles.role, "GURU"),
          isNull(users.deletedAt),
        ),
      )
      .limit(1);

    if (!teacher) throw new NotFoundError("Guru tidak ditemukan.");

    await tx
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, id));

    await writeAudit(tx, {
      actorId,
      action: "teacher.reset_password",
      entityType: "user",
      entityId: id,
    });
  });
}

export async function listTeacherSubjects(teacherId?: string) {
  return getDb()
    .select({
      teacherId: teacherSubjects.teacherId,
      subjectId: teacherSubjects.subjectId,
      subjectCode: subjects.code,
      subjectName: subjects.name,
    })
    .from(teacherSubjects)
    .innerJoin(subjects, eq(teacherSubjects.subjectId, subjects.id))
    .innerJoin(users, eq(teacherSubjects.teacherId, users.id))
    .where(
      and(
        isNull(users.deletedAt),
        teacherId ? eq(teacherSubjects.teacherId, teacherId) : undefined,
      ),
    )
    .orderBy(asc(subjects.name));
}

export async function listTeacherSubjectsByTeacherIds(teacherIds: string[]) {
  if (teacherIds.length === 0) return [];
  return getDb()
    .select({
      teacherId: teacherSubjects.teacherId,
      subjectId: teacherSubjects.subjectId,
      subjectCode: subjects.code,
      subjectName: subjects.name,
    })
    .from(teacherSubjects)
    .innerJoin(subjects, eq(teacherSubjects.subjectId, subjects.id))
    .where(
      and(
        inArray(teacherSubjects.teacherId, teacherIds),
        isNull(subjects.deletedAt),
      ),
    )
    .orderBy(asc(subjects.name));
}

export async function addTeacherSubject(teacherId: string, subjectId: string) {
  try {
    await getDb().insert(teacherSubjects).values({ teacherId, subjectId });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError("Mapping guruâ€“mapel sudah ada.");
    }
    throw error;
  }
}

export async function addTeacherSubjectsBulk(input: TeacherSubjectBulkInput) {
  const subjectIds = [...new Set(input.subjectIds)];
  const rows = await getDb()
    .insert(teacherSubjects)
    .values(
      subjectIds.map((subjectId) => ({
        teacherId: input.teacherId,
        subjectId,
      })),
    )
    .onConflictDoNothing()
    .returning({ subjectId: teacherSubjects.subjectId });

  return {
    created: rows.length,
    skipped: subjectIds.length - rows.length,
  };
}

export async function removeTeacherSubject(teacherId: string, subjectId: string) {
  await getDb()
    .delete(teacherSubjects)
    .where(
      and(
        eq(teacherSubjects.teacherId, teacherId),
        eq(teacherSubjects.subjectId, subjectId),
      ),
    );
}

export async function listStudents(academicYearId?: string | null) {
  const db = getDb();
  if (!academicYearId) {
    return getDb()
      .select({
        id: students.id,
        nisn: students.nisn,
        name: students.name,
        gender: students.gender,
        birthDate: students.birthDate,
        isActive: students.isActive,
        classId: sql<string | null>`null`.as("class_id"),
        className: sql<string | null>`null`.as("class_name"),
        enrollmentStatus: sql<string | null>`null`.as("enrollment_status"),
      })
      .from(students)
      .where(isNull(students.deletedAt))
      .orderBy(asc(students.name));
  }

  const rows = await db
    .select({
      id: students.id,
      nisn: students.nisn,
      name: students.name,
      gender: students.gender,
      birthDate: students.birthDate,
      isActive: students.isActive,
      classId: classes.id,
      gradeLevel: classes.gradeLevel,
      section: classes.section,
      departmentCode: departments.code,
      enrollmentStatus: studentEnrollments.status,
    })
    .from(students)
    .leftJoin(
      studentEnrollments,
      and(
        eq(studentEnrollments.studentId, students.id),
        eq(studentEnrollments.academicYearId, academicYearId),
        isNull(studentEnrollments.deletedAt),
      ),
    )
    .leftJoin(classes, eq(studentEnrollments.classId, classes.id))
    .leftJoin(departments, eq(classes.departmentId, departments.id))
    .where(isNull(students.deletedAt))
    .orderBy(asc(students.name));

  return rows.map((row) => ({
    ...row,
    className:
      row.gradeLevel != null
        ? `${row.gradeLevel} ${row.departmentCode ?? ""} ${row.section ?? ""}`.trim()
        : null,
  }));
}

export async function createStudent(input: StudentCreateInput) {
  try {
    const [row] = await getDb()
      .insert(students)
      .values({
        nisn: input.nisn,
        name: input.name,
        gender: input.gender,
        birthDate: input.birthDate ?? null,
      })
      .returning();
    return row;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError("NISN sudah dipakai.");
    }
    throw error;
  }
}

export async function importStudents(
  rows: StudentImportRowInput[],
  actorId: string,
): Promise<StudentImportResult> {
  if (rows.length === 0) {
    return { created: 0, enrolled: 0, skipped: [] };
  }

  const db = getDbPool();
  return db.transaction(async (tx) => {
    const nisns = rows.map((row) => row.nisn);
    const existingRows = await tx
      .select({
        id: students.id,
        nisn: students.nisn,
        name: students.name,
        isActive: students.isActive,
        deletedAt: students.deletedAt,
      })
      .from(students)
      .where(inArray(students.nisn, nisns));
    const existing = new Map(existingRows.map((row) => [row.nisn, row]));

    const toInsert: (typeof students.$inferInsert)[] = [];
    const skipped: StudentImportResult["skipped"] = [];

    for (const row of rows) {
      if (existing.has(row.nisn)) {
        skipped.push({
          nisn: row.nisn,
          name: row.name,
          reason: "NISN sudah terdaftar.",
        });
        continue;
      }

      existing.set(row.nisn, {
        id: "",
        nisn: row.nisn,
        name: row.name,
        isActive: true,
        deletedAt: null,
      });
      toInsert.push({
        nisn: row.nisn,
        name: row.name,
        gender: row.gender,
        birthDate: row.birthDate ?? null,
      });
    }

    const inserted =
      toInsert.length > 0
        ? await tx
            .insert(students)
            .values(toInsert)
            .returning({ id: students.id, nisn: students.nisn })
        : [];
    for (const row of inserted) {
      const current = existing.get(row.nisn);
      if (current) existing.set(row.nisn, { ...current, id: row.id });
    }

    const studentIdByNisn = new Map<string, string>();
    for (const row of existing.values()) {
      if (row.id && row.isActive && !row.deletedAt) {
        studentIdByNisn.set(row.nisn, row.id);
      }
    }

    const classIds = [
      ...new Set(rows.map((row) => row.classId).filter(Boolean)),
    ] as string[];
    const classRows =
      classIds.length > 0
        ? await tx
            .select({
              id: classes.id,
              academicYearId: classes.academicYearId,
            })
            .from(classes)
            .where(and(inArray(classes.id, classIds), isNull(classes.deletedAt)))
        : [];
    const classYearById = new Map(
      classRows.map((row) => [row.id, row.academicYearId]),
    );
    if (classRows.length !== classIds.length) {
      throw new NotFoundError("Sebagian kelas tidak ditemukan.");
    }

    const enrollmentTargets = rows
      .map((row) => {
        if (!row.classId) return null;
        const studentId = studentIdByNisn.get(row.nisn);
        const academicYearId = classYearById.get(row.classId);
        if (!studentId || !academicYearId) return null;
        return {
          studentId,
          classId: row.classId,
          academicYearId,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    let enrolled = 0;
    if (enrollmentTargets.length > 0) {
      const targetStudentIds = [
        ...new Set(enrollmentTargets.map((row) => row.studentId)),
      ];
      const targetYearIds = [
        ...new Set(enrollmentTargets.map((row) => row.academicYearId)),
      ];
      const existingEnrollments = await tx
        .select({
          id: studentEnrollments.id,
          studentId: studentEnrollments.studentId,
          academicYearId: studentEnrollments.academicYearId,
          deletedAt: studentEnrollments.deletedAt,
        })
        .from(studentEnrollments)
        .where(
          and(
            inArray(studentEnrollments.studentId, targetStudentIds),
            inArray(studentEnrollments.academicYearId, targetYearIds),
          ),
        );
      const enrollmentByKey = new Map(
        existingEnrollments.map((row) => [
          `${row.studentId}:${row.academicYearId}`,
          row,
        ]),
      );

      const toInsertEnrollments: (typeof studentEnrollments.$inferInsert)[] =
        [];
      const reactivateByClass = new Map<string, string[]>();
      for (const target of enrollmentTargets) {
        const key = `${target.studentId}:${target.academicYearId}`;
        const existingEnrollment = enrollmentByKey.get(key);
        if (existingEnrollment) {
          if (existingEnrollment.deletedAt) {
            const ids = reactivateByClass.get(target.classId) ?? [];
            ids.push(existingEnrollment.id);
            reactivateByClass.set(target.classId, ids);
            enrolled += 1;
          }
          continue;
        }
        enrollmentByKey.set(key, {
          id: "",
          studentId: target.studentId,
          academicYearId: target.academicYearId,
          deletedAt: null,
        });
        toInsertEnrollments.push({
          studentId: target.studentId,
          classId: target.classId,
          academicYearId: target.academicYearId,
          status: "ACTIVE",
        });
        enrolled += 1;
      }

      for (const [classId, ids] of reactivateByClass) {
        await tx
          .update(studentEnrollments)
          .set({
            classId,
            status: "ACTIVE",
            promotionBatchId: null,
            deletedAt: null,
            updatedAt: new Date(),
          })
          .where(inArray(studentEnrollments.id, ids));
      }

      if (toInsertEnrollments.length > 0) {
        await tx.insert(studentEnrollments).values(toInsertEnrollments);
      }
    }

    if (toInsert.length > 0 || enrolled > 0) {
      await writeAudit(tx, {
        actorId,
        action: "student.import",
        entityType: "student",
        payload: {
          created: toInsert.length,
          enrolled,
          skipped: skipped.length,
        },
      });
    }

    return { created: inserted.length, enrolled, skipped };
  });
}

export async function updateStudent(id: string, input: StudentUpdateInput) {
  try {
    const [row] = await getDb()
      .update(students)
      .set({
        nisn: input.nisn,
        name: input.name,
        gender: input.gender,
        birthDate: input.birthDate ?? null,
        isActive: input.isActive,
        deletedAt: input.isActive ? null : undefined,
        updatedAt: new Date(),
      })
      .where(eq(students.id, id))
      .returning();
    if (!row) throw new NotFoundError("Siswa tidak ditemukan.");
    return row;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError("NISN sudah dipakai.");
    }
    throw error;
  }
}

export async function setStudentActive(id: string, isActive: boolean) {
  const [row] = await getDb()
    .update(students)
    .set({
      isActive,
      deletedAt: isActive ? null : undefined,
      updatedAt: new Date(),
    })
    .where(eq(students.id, id))
    .returning();
  if (!row) throw new NotFoundError("Siswa tidak ditemukan.");
}

export async function setStudentsActive(
  input: StudentBulkStatusInput,
  actorId: string,
) {
  const studentIds = [...new Set(input.studentIds)];
  if (studentIds.length === 0) return { updated: 0 };

  const db = getDbPool();
  return db.transaction(async (tx) => {
    const rows = await tx
      .update(students)
      .set({
        isActive: input.isActive,
        deletedAt: input.isActive ? null : undefined,
        updatedAt: new Date(),
      })
      .where(inArray(students.id, studentIds))
      .returning({ id: students.id });

    await writeAudit(tx, {
      actorId,
      action: "student.bulk_status",
      entityType: "student",
      payload: { count: rows.length, isActive: input.isActive },
    });

    return { updated: rows.length };
  });
}

export async function listEnrollments(academicYearId?: string) {
  return getDb()
    .select({
      id: studentEnrollments.id,
      studentId: students.id,
      studentName: students.name,
      nisn: students.nisn,
      classId: classes.id,
      gradeLevel: classes.gradeLevel,
      section: classes.section,
      departmentCode: departments.code,
      academicYearId: academicYears.id,
      academicYearName: academicYears.name,
      status: studentEnrollments.status,
    })
    .from(studentEnrollments)
    .innerJoin(students, eq(studentEnrollments.studentId, students.id))
    .innerJoin(classes, eq(studentEnrollments.classId, classes.id))
    .innerJoin(departments, eq(classes.departmentId, departments.id))
    .innerJoin(academicYears, eq(studentEnrollments.academicYearId, academicYears.id))
    .where(
      and(
        isNull(studentEnrollments.deletedAt),
        academicYearId
          ? eq(studentEnrollments.academicYearId, academicYearId)
          : undefined,
      ),
    )
    .orderBy(asc(classes.gradeLevel), asc(classes.section), asc(students.name));
}

export async function createEnrollment(input: EnrollmentInput) {
  const db = getDbPool();
  return db.transaction(async (tx) => {
    const [targetClass] = await tx
      .select({
        id: classes.id,
        academicYearId: classes.academicYearId,
      })
      .from(classes)
      .where(and(eq(classes.id, input.classId), isNull(classes.deletedAt)))
      .limit(1);

    if (!targetClass) throw new NotFoundError("Kelas tidak ditemukan.");
    if (targetClass.academicYearId !== input.academicYearId) {
      throw new ValidationError(
        "Kelas yang dipilih tidak berada pada tahun ajaran tersebut.",
      );
    }

    const [student] = await tx
      .select({
        id: students.id,
        isActive: students.isActive,
        deletedAt: students.deletedAt,
      })
      .from(students)
      .where(eq(students.id, input.studentId))
      .limit(1);
    if (!student || student.deletedAt) {
      throw new NotFoundError("Siswa tidak ditemukan.");
    }
    if (!student.isActive) {
      throw new ValidationError("Siswa tidak aktif dan tidak dapat didaftarkan.");
    }

    const [existing] = await tx
      .select()
      .from(studentEnrollments)
      .where(
        and(
          eq(studentEnrollments.studentId, input.studentId),
          eq(studentEnrollments.academicYearId, input.academicYearId),
        ),
      )
      .limit(1);

    if (existing) {
      if (!existing.deletedAt) {
        throw new ConflictError(
          "Siswa sudah memiliki enrollment pada tahun ajaran ini.",
        );
      }
      const [row] = await tx
        .update(studentEnrollments)
        .set({
          classId: input.classId,
          status: input.status,
          promotionBatchId: null,
          deletedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(studentEnrollments.id, existing.id))
        .returning();
      return row;
    }

    const [row] = await tx
      .insert(studentEnrollments)
      .values({
        studentId: input.studentId,
        classId: input.classId,
        academicYearId: input.academicYearId,
        status: input.status,
      })
      .returning();
    return row;
  });
}

export async function createEnrollmentsBulk(
  input: EnrollmentBulkInput,
): Promise<BulkEnrollmentResult> {
  const studentIds = [...new Set(input.studentIds)];
  const db = getDbPool();

  return db.transaction(async (tx) => {
    const [targetClass] = await tx
      .select({
        id: classes.id,
        academicYearId: classes.academicYearId,
      })
      .from(classes)
      .where(and(eq(classes.id, input.classId), isNull(classes.deletedAt)))
      .limit(1);

    if (!targetClass) throw new NotFoundError("Kelas tidak ditemukan.");
    if (targetClass.academicYearId !== input.academicYearId) {
      throw new ValidationError(
        "Kelas yang dipilih tidak berada pada tahun ajaran tersebut.",
      );
    }

    const studentRows = await tx
      .select({
        id: students.id,
        name: students.name,
        isActive: students.isActive,
        deletedAt: students.deletedAt,
      })
      .from(students)
      .where(inArray(students.id, studentIds));
    const studentMap = new Map(studentRows.map((row) => [row.id, row]));

    const existingRows = await tx
      .select({
        id: studentEnrollments.id,
        studentId: studentEnrollments.studentId,
        deletedAt: studentEnrollments.deletedAt,
      })
      .from(studentEnrollments)
      .where(
        and(
          eq(studentEnrollments.academicYearId, input.academicYearId),
          inArray(studentEnrollments.studentId, studentIds),
        ),
      );
    const existingMap = new Map(
      existingRows.map((row) => [row.studentId, row]),
    );

    const skipped: BulkEnrollmentResult["skipped"] = [];
    const toInsert: (typeof studentEnrollments.$inferInsert)[] = [];
    const reactivateIds: string[] = [];

    for (const studentId of studentIds) {
      const student = studentMap.get(studentId);
      if (!student || student.deletedAt) {
        skipped.push({
          studentId,
          name: student?.name ?? "Siswa tidak ditemukan",
          reason: "Siswa tidak ditemukan.",
        });
        continue;
      }
      if (!student.isActive) {
        skipped.push({
          studentId,
          name: student.name,
          reason: "Siswa tidak aktif.",
        });
        continue;
      }

      const existing = existingMap.get(studentId);
      if (existing && !existing.deletedAt) {
        skipped.push({
          studentId,
          name: student.name,
          reason: "Sudah terdaftar pada tahun ajaran ini.",
        });
        continue;
      }

      if (existing) {
        reactivateIds.push(existing.id);
      } else {
        toInsert.push({
          studentId,
          classId: input.classId,
          academicYearId: input.academicYearId,
          status: input.status,
        });
      }
    }

    if (reactivateIds.length > 0) {
      await tx
        .update(studentEnrollments)
        .set({
          classId: input.classId,
          status: input.status,
          promotionBatchId: null,
          deletedAt: null,
          updatedAt: new Date(),
        })
        .where(inArray(studentEnrollments.id, reactivateIds));
    }

    if (toInsert.length > 0) {
      await tx.insert(studentEnrollments).values(toInsert);
    }

    return {
      created: toInsert.length,
      reactivated: reactivateIds.length,
      skipped,
    };
  });
}

export async function updateEnrollment(input: EnrollmentUpdateInput) {
  const db = getDbPool();
  return db.transaction(async (tx) => {
    const [enrollment] = await tx
      .select({
        id: studentEnrollments.id,
        academicYearId: studentEnrollments.academicYearId,
      })
      .from(studentEnrollments)
      .where(
        and(
          eq(studentEnrollments.id, input.id),
          isNull(studentEnrollments.deletedAt),
        ),
      )
      .limit(1);

    if (!enrollment) throw new NotFoundError("Enrollment tidak ditemukan.");

    const [targetClass] = await tx
      .select({
        id: classes.id,
        academicYearId: classes.academicYearId,
      })
      .from(classes)
      .where(and(eq(classes.id, input.classId), isNull(classes.deletedAt)))
      .limit(1);

    if (!targetClass) throw new NotFoundError("Kelas tidak ditemukan.");
    if (targetClass.academicYearId !== enrollment.academicYearId) {
      throw new ValidationError(
        "Kelas tujuan harus berada pada tahun ajaran enrollment.",
      );
    }

    const [row] = await tx
      .update(studentEnrollments)
      .set({
        classId: input.classId,
        status: input.status,
        updatedAt: new Date(),
      })
      .where(eq(studentEnrollments.id, input.id))
      .returning();
    return row;
  });
}

export async function moveEnrollmentsBulk(input: EnrollmentMoveInput) {
  const enrollmentIds = [...new Set(input.enrollmentIds)];
  const db = getDbPool();

  return db.transaction(async (tx) => {
    const [targetClass] = await tx
      .select({
        id: classes.id,
        academicYearId: classes.academicYearId,
      })
      .from(classes)
      .where(and(eq(classes.id, input.targetClassId), isNull(classes.deletedAt)))
      .limit(1);

    if (!targetClass) throw new NotFoundError("Kelas tujuan tidak ditemukan.");

    const rows = await tx
      .select({
        id: studentEnrollments.id,
        academicYearId: studentEnrollments.academicYearId,
      })
      .from(studentEnrollments)
      .where(
        and(
          inArray(studentEnrollments.id, enrollmentIds),
          isNull(studentEnrollments.deletedAt),
        ),
      );

    if (rows.length !== enrollmentIds.length) {
      throw new NotFoundError("Sebagian enrollment tidak ditemukan.");
    }
    if (rows.some((row) => row.academicYearId !== targetClass.academicYearId)) {
      throw new ValidationError(
        "Semua enrollment harus berada pada tahun ajaran kelas tujuan.",
      );
    }

    const updated = await tx
      .update(studentEnrollments)
      .set({ classId: input.targetClassId, updatedAt: new Date() })
      .where(
        and(
          inArray(studentEnrollments.id, enrollmentIds),
          isNull(studentEnrollments.deletedAt),
        ),
      )
      .returning({ id: studentEnrollments.id });

    return { moved: updated.length };
  });
}

export async function updateEnrollmentsStatusBulk(
  input: EnrollmentBulkStatusInput,
) {
  const enrollmentIds = [...new Set(input.enrollmentIds)];
  const rows = await getDb()
    .update(studentEnrollments)
    .set({ status: input.status, updatedAt: new Date() })
    .where(
      and(
        inArray(studentEnrollments.id, enrollmentIds),
        isNull(studentEnrollments.deletedAt),
      ),
    )
    .returning({ id: studentEnrollments.id });

  return { updated: rows.length };
}

export async function deleteEnrollment(id: string) {
  const [row] = await getDb()
    .update(studentEnrollments)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(studentEnrollments.id, id))
    .returning();
  if (!row) throw new NotFoundError("Enrollment tidak ditemukan.");
}

export async function listStudentsInClass(
  classId: string,
  academicYearId: string,
) {
  return getDb()
    .select({
      id: students.id,
      nisn: students.nisn,
      name: students.name,
      gender: students.gender,
    })
    .from(studentEnrollments)
    .innerJoin(students, eq(studentEnrollments.studentId, students.id))
    .where(
      and(
        eq(studentEnrollments.classId, classId),
        eq(studentEnrollments.academicYearId, academicYearId),
        eq(studentEnrollments.status, "ACTIVE"),
        isNull(studentEnrollments.deletedAt),
        eq(students.isActive, true),
        isNull(students.deletedAt),
      ),
    )
    .orderBy(asc(students.name));
}

export async function listStudentOptions() {
  return getDb()
    .select({
      id: students.id,
      nisn: students.nisn,
      name: students.name,
    })
    .from(students)
    .where(and(isNull(students.deletedAt), eq(students.isActive, true)))
    .orderBy(asc(students.name));
}

export async function listStudentEnrollmentOptions(academicYearId: string) {
  const rows = await getDb()
    .select({
      id: students.id,
      nisn: students.nisn,
      name: students.name,
      classId: classes.id,
      gradeLevel: classes.gradeLevel,
      section: classes.section,
      departmentCode: departments.code,
      enrollmentStatus: studentEnrollments.status,
    })
    .from(students)
    .leftJoin(
      studentEnrollments,
      and(
        eq(studentEnrollments.studentId, students.id),
        eq(studentEnrollments.academicYearId, academicYearId),
        isNull(studentEnrollments.deletedAt),
      ),
    )
    .leftJoin(classes, eq(studentEnrollments.classId, classes.id))
    .leftJoin(departments, eq(classes.departmentId, departments.id))
    .where(and(isNull(students.deletedAt), eq(students.isActive, true)))
    .orderBy(asc(students.name));

  return rows.map((row) => ({
    ...row,
    className:
      row.gradeLevel != null
        ? `${row.gradeLevel} ${row.departmentCode ?? ""} ${row.section ?? ""}`.trim()
        : null,
  }));
}

export async function findStudentsByIds(ids: string[]) {
  if (ids.length === 0) return [];
  return getDb()
    .select()
    .from(students)
    .where(inArray(students.id, ids));
}


/* -------------------------------------------------------------------------- */
/* Paginated / filtered lists                                                  */
/* -------------------------------------------------------------------------- */

export type StatusFilter = "active" | "inactive";

export type AcademicYearListFilters = {
  q?: string;
  status?: StatusFilter;
  sort?: "name" | "startDate" | "isActive";
  dir?: SortDirection;
  page?: number;
  perPage?: number;
};

export async function listAcademicYearsPaged(
  filters: AcademicYearListFilters,
): Promise<Paginated<Awaited<ReturnType<typeof listAcademicYears>>[number]>> {
  const db = getDb();
  const perPage = filters.perPage ?? 20;
  const page = filters.page ?? 1;
  const pattern = filters.q ? likePattern(filters.q) : undefined;

  const conditions = [
    isNull(academicYears.deletedAt),
    pattern ? ilike(academicYears.name, pattern) : undefined,
    filters.status === "active"
      ? eq(academicYears.isActive, true)
      : filters.status === "inactive"
        ? eq(academicYears.isActive, false)
        : undefined,
  ];

  const [totalRow] = await db
    .select({ total: count() })
    .from(academicYears)
    .where(and(...conditions));
  const total = Number(totalRow?.total ?? 0);
  const meta = normalizePagination(total, page, perPage);

  const sort = filters.sort ?? "startDate";
  const dir = filters.dir ?? (sort === "startDate" ? "desc" : "asc");
  const sortColumn =
    sort === "name"
      ? academicYears.name
      : sort === "isActive"
        ? academicYears.isActive
        : academicYears.startDate;

  const rows = await db
    .select()
    .from(academicYears)
    .where(and(...conditions))
    .orderBy(
      dir === "asc" ? asc(sortColumn) : desc(sortColumn),
      asc(academicYears.name),
    )
    .limit(perPage)
    .offset(meta.offset);

  return paginated(rows, total, meta.page, perPage);
}

export type SemesterListFilters = {
  q?: string;
  academicYearId?: string;
  status?: StatusFilter;
  sort?: "name" | "academicYear" | "startDate" | "isActive";
  dir?: SortDirection;
  page?: number;
  perPage?: number;
};

export async function listSemestersPaged(
  filters: SemesterListFilters,
): Promise<Paginated<Awaited<ReturnType<typeof listSemesters>>[number]>> {
  const db = getDb();
  const perPage = filters.perPage ?? 20;
  const page = filters.page ?? 1;
  const pattern = filters.q ? likePattern(filters.q) : undefined;

  const conditions = [
    isNull(semesters.deletedAt),
    isNull(academicYears.deletedAt),
    pattern
      ? or(
          ilike(academicYears.name, pattern),
          sql`${semesters.name}::text ilike ${pattern}`,
        )
      : undefined,
    filters.academicYearId
      ? eq(semesters.academicYearId, filters.academicYearId)
      : undefined,
    filters.status === "active"
      ? eq(semesters.isActive, true)
      : filters.status === "inactive"
        ? eq(semesters.isActive, false)
        : undefined,
  ];

  const [totalRow] = await db
    .select({ total: count() })
    .from(semesters)
    .innerJoin(academicYears, eq(semesters.academicYearId, academicYears.id))
    .where(and(...conditions));
  const total = Number(totalRow?.total ?? 0);
  const meta = normalizePagination(total, page, perPage);

  const sort = filters.sort ?? "academicYear";
  const dir = filters.dir ?? (sort === "academicYear" ? "desc" : "asc");
  const sortColumn =
    sort === "name"
      ? semesters.name
      : sort === "startDate"
        ? semesters.startDate
        : sort === "isActive"
          ? semesters.isActive
          : academicYears.startDate;

  const rows = await db
    .select({
      id: semesters.id,
      name: semesters.name,
      startDate: semesters.startDate,
      endDate: semesters.endDate,
      isActive: semesters.isActive,
      academicYearId: academicYears.id,
      academicYearName: academicYears.name,
      academicYearActive: academicYears.isActive,
    })
    .from(semesters)
    .innerJoin(academicYears, eq(semesters.academicYearId, academicYears.id))
    .where(and(...conditions))
    .orderBy(
      dir === "asc" ? asc(sortColumn) : desc(sortColumn),
      asc(semesters.name),
    )
    .limit(perPage)
    .offset(meta.offset);

  return paginated(rows, total, meta.page, perPage);
}

export type DepartmentListFilters = {
  q?: string;
  status?: StatusFilter;
  sort?: "code" | "name" | "isActive";
  dir?: SortDirection;
  page?: number;
  perPage?: number;
};

export async function listDepartmentsPaged(
  filters: DepartmentListFilters,
): Promise<Paginated<Awaited<ReturnType<typeof listDepartments>>[number]>> {
  const db = getDb();
  const perPage = filters.perPage ?? 20;
  const page = filters.page ?? 1;
  const pattern = filters.q ? likePattern(filters.q) : undefined;

  const conditions = [
    isNull(departments.deletedAt),
    pattern
      ? or(
          ilike(departments.code, pattern),
          ilike(departments.name, pattern),
        )
      : undefined,
    filters.status === "active"
      ? eq(departments.isActive, true)
      : filters.status === "inactive"
        ? eq(departments.isActive, false)
        : undefined,
  ];

  const [totalRow] = await db
    .select({ total: count() })
    .from(departments)
    .where(and(...conditions));
  const total = Number(totalRow?.total ?? 0);
  const meta = normalizePagination(total, page, perPage);

  const sort = filters.sort ?? "code";
  const dir = filters.dir ?? "asc";
  const sortColumn =
    sort === "name"
      ? departments.name
      : sort === "isActive"
        ? departments.isActive
        : departments.code;

  const rows = await db
    .select()
    .from(departments)
    .where(and(...conditions))
    .orderBy(
      dir === "asc" ? asc(sortColumn) : desc(sortColumn),
      asc(departments.code),
    )
    .limit(perPage)
    .offset(meta.offset);

  return paginated(rows, total, meta.page, perPage);
}

export type SubjectListFilters = {
  q?: string;
  status?: StatusFilter;
  sort?: "code" | "name" | "isActive";
  dir?: SortDirection;
  page?: number;
  perPage?: number;
};

export async function listSubjectsPaged(
  filters: SubjectListFilters,
): Promise<Paginated<Awaited<ReturnType<typeof listSubjects>>[number]>> {
  const db = getDb();
  const perPage = filters.perPage ?? 20;
  const page = filters.page ?? 1;
  const pattern = filters.q ? likePattern(filters.q) : undefined;

  const conditions = [
    isNull(subjects.deletedAt),
    pattern
      ? or(ilike(subjects.code, pattern), ilike(subjects.name, pattern))
      : undefined,
    filters.status === "active"
      ? eq(subjects.isActive, true)
      : filters.status === "inactive"
        ? eq(subjects.isActive, false)
        : undefined,
  ];

  const [totalRow] = await db
    .select({ total: count() })
    .from(subjects)
    .where(and(...conditions));
  const total = Number(totalRow?.total ?? 0);
  const meta = normalizePagination(total, page, perPage);

  const sort = filters.sort ?? "name";
  const dir = filters.dir ?? "asc";
  const sortColumn =
    sort === "code"
      ? subjects.code
      : sort === "isActive"
        ? subjects.isActive
        : subjects.name;

  const rows = await db
    .select()
    .from(subjects)
    .where(and(...conditions))
    .orderBy(
      dir === "asc" ? asc(sortColumn) : desc(sortColumn),
      asc(subjects.name),
    )
    .limit(perPage)
    .offset(meta.offset);

  return paginated(rows, total, meta.page, perPage);
}

export type ClassListFilters = {
  academicYearId?: string;
  departmentId?: string;
  gradeLevel?: number;
  q?: string;
  status?: StatusFilter;
  sort?: "class" | "year" | "homeroom" | "studentCount" | "status";
  dir?: SortDirection;
  page?: number;
  perPage?: number;
};

export async function listClassesPaged(
  filters: ClassListFilters,
): Promise<Paginated<Awaited<ReturnType<typeof listClasses>>[number]>> {
  const db = getDb();
  const perPage = filters.perPage ?? 20;
  const page = filters.page ?? 1;
  const pattern = filters.q ? likePattern(filters.q) : undefined;

  const conditions = [
    isNull(classes.deletedAt),
    isNull(academicYears.deletedAt),
    isNull(departments.deletedAt),
    filters.academicYearId
      ? eq(classes.academicYearId, filters.academicYearId)
      : undefined,
    filters.departmentId
      ? eq(classes.departmentId, filters.departmentId)
      : undefined,
    filters.gradeLevel ? eq(classes.gradeLevel, filters.gradeLevel) : undefined,
    filters.status === "active"
      ? eq(classes.isActive, true)
      : filters.status === "inactive"
        ? eq(classes.isActive, false)
        : undefined,
    pattern
      ? or(
          ilike(departments.code, pattern),
          ilike(departments.name, pattern),
          ilike(classes.section, pattern),
          ilike(users.name, pattern),
          sql`${classes.gradeLevel}::text ilike ${pattern}`,
        )
      : undefined,
  ];

  const [totalRow] = await db
    .select({ total: count(classes.id) })
    .from(classes)
    .innerJoin(academicYears, eq(classes.academicYearId, academicYears.id))
    .innerJoin(departments, eq(classes.departmentId, departments.id))
    .leftJoin(users, eq(classes.homeroomTeacherId, users.id))
    .where(and(...conditions));
  const total = Number(totalRow?.total ?? 0);
  const meta = normalizePagination(total, page, perPage);

  const sort = filters.sort ?? "class";
  const dir = filters.dir ?? "asc";
  const studentCountExpr = sql<number>`count(${studentEnrollments.id})`;
  const tieBreakers = [asc(classes.gradeLevel), asc(classes.section)];
  const primary =
    sort === "year"
      ? dir === "asc"
        ? asc(academicYears.startDate)
        : desc(academicYears.startDate)
      : sort === "homeroom"
        ? dir === "asc"
          ? asc(users.name)
          : desc(users.name)
        : sort === "studentCount"
          ? dir === "asc"
            ? asc(studentCountExpr)
            : desc(studentCountExpr)
          : sort === "status"
            ? dir === "asc"
              ? asc(classes.isActive)
              : desc(classes.isActive)
            : dir === "asc"
              ? asc(classes.gradeLevel)
              : desc(classes.gradeLevel);

  const rows = await db
    .select({
      id: classes.id,
      academicYearId: classes.academicYearId,
      academicYearName: academicYears.name,
      departmentId: classes.departmentId,
      departmentCode: departments.code,
      departmentName: departments.name,
      gradeLevel: classes.gradeLevel,
      section: classes.section,
      homeroomTeacherId: classes.homeroomTeacherId,
      homeroomTeacherName: users.name,
      isActive: classes.isActive,
      studentCount: studentCountExpr,
    })
    .from(classes)
    .innerJoin(academicYears, eq(classes.academicYearId, academicYears.id))
    .innerJoin(departments, eq(classes.departmentId, departments.id))
    .leftJoin(users, eq(classes.homeroomTeacherId, users.id))
    .leftJoin(
      studentEnrollments,
      and(
        eq(studentEnrollments.classId, classes.id),
        eq(studentEnrollments.academicYearId, classes.academicYearId),
        eq(studentEnrollments.status, "ACTIVE"),
        isNull(studentEnrollments.deletedAt),
      ),
    )
    .where(and(...conditions))
    .groupBy(
      classes.id,
      academicYears.name,
      academicYears.startDate,
      departments.code,
      departments.name,
      users.name,
    )
    .orderBy(primary, ...tieBreakers)
    .limit(perPage)
    .offset(meta.offset);

  return paginated(
    rows.map((row) => ({ ...row, studentCount: Number(row.studentCount) })),
    total,
    meta.page,
    perPage,
  );
}

export type TeacherListFilters = {
  q?: string;
  status?: StatusFilter;
  subjectId?: string;
  sort?: "name" | "email" | "nip" | "isActive";
  dir?: SortDirection;
  page?: number;
  perPage?: number;
};

export async function listTeachersPaged(
  filters: TeacherListFilters,
): Promise<Paginated<Awaited<ReturnType<typeof listTeachers>>[number]>> {
  const db = getDb();
  const perPage = filters.perPage ?? 20;
  const page = filters.page ?? 1;
  const pattern = filters.q ? likePattern(filters.q) : undefined;

  const conditions = [
    eq(userRoles.role, "GURU"),
    filters.status === "inactive" ? undefined : isNull(users.deletedAt),
    pattern
      ? or(
          ilike(users.name, pattern),
          ilike(users.email, pattern),
          ilike(teacherProfiles.nip, pattern),
        )
      : undefined,
    filters.status === "active"
      ? eq(users.isActive, true)
      : filters.status === "inactive"
        ? eq(users.isActive, false)
        : undefined,
    filters.subjectId
      ? sql`exists (select 1 from ${teacherSubjects} where ${teacherSubjects.teacherId} = ${users.id} and ${teacherSubjects.subjectId} = ${filters.subjectId})`
      : undefined,
  ];

  const [totalRow] = await db
    .select({ total: count(users.id) })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .leftJoin(teacherProfiles, eq(teacherProfiles.userId, users.id))
    .where(and(...conditions));
  const total = Number(totalRow?.total ?? 0);
  const meta = normalizePagination(total, page, perPage);

  const sort = filters.sort ?? "name";
  const dir = filters.dir ?? "asc";
  const sortColumn =
    sort === "email"
      ? users.email
      : sort === "nip"
        ? teacherProfiles.nip
        : sort === "isActive"
          ? users.isActive
          : users.name;

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      isActive: users.isActive,
      nip: teacherProfiles.nip,
      expertiseNote: teacherProfiles.expertiseNote,
      createdAt: users.createdAt,
    })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .leftJoin(teacherProfiles, eq(teacherProfiles.userId, users.id))
    .where(and(...conditions))
    .orderBy(
      dir === "asc" ? asc(sortColumn) : desc(sortColumn),
      asc(users.name),
    )
    .limit(perPage)
    .offset(meta.offset);

  return paginated(rows, total, meta.page, perPage);
}

export type StudentListFilters = {
  academicYearId?: string | null;
  q?: string;
  gender?: "L" | "P";
  status?: StatusFilter;
  classId?: string;
  enrollmentStatus?: EnrollmentStatus;
  sort?: "name" | "nisn" | "class" | "gender" | "isActive";
  dir?: SortDirection;
  page?: number;
  perPage?: number;
};

export async function listStudentsPaged(
  filters: StudentListFilters,
): Promise<Paginated<Awaited<ReturnType<typeof listStudents>>[number]>> {
  const db = getDb();
  const perPage = filters.perPage ?? 20;
  const page = filters.page ?? 1;
  const pattern = filters.q ? likePattern(filters.q) : undefined;

  const enrollmentJoin = filters.academicYearId
    ? and(
        eq(studentEnrollments.studentId, students.id),
        eq(studentEnrollments.academicYearId, filters.academicYearId),
        isNull(studentEnrollments.deletedAt),
      )
    : sql`false`;

  const conditions = [
    filters.status === "inactive" ? undefined : isNull(students.deletedAt),
    filters.gender ? eq(students.gender, filters.gender) : undefined,
    filters.status === "active"
      ? eq(students.isActive, true)
      : filters.status === "inactive"
        ? eq(students.isActive, false)
        : undefined,
    pattern
      ? or(ilike(students.name, pattern), ilike(students.nisn, pattern))
      : undefined,
    filters.classId === "none"
      ? isNull(classes.id)
      : filters.classId
        ? eq(classes.id, filters.classId)
        : undefined,
    filters.enrollmentStatus
      ? eq(studentEnrollments.status, filters.enrollmentStatus)
      : undefined,
  ];

  const [totalRow] = await db
    .select({ total: count(students.id) })
    .from(students)
    .leftJoin(studentEnrollments, enrollmentJoin)
    .leftJoin(classes, eq(studentEnrollments.classId, classes.id))
    .leftJoin(departments, eq(classes.departmentId, departments.id))
    .where(and(...conditions));
  const total = Number(totalRow?.total ?? 0);
  const meta = normalizePagination(total, page, perPage);

  const sort = filters.sort ?? "name";
  const dir = filters.dir ?? "asc";
  const sortColumn =
    sort === "nisn"
      ? students.nisn
      : sort === "gender"
        ? students.gender
        : sort === "isActive"
          ? students.isActive
          : sort === "class"
            ? classes.gradeLevel
            : students.name;

  const rows = await db
    .select({
      id: students.id,
      nisn: students.nisn,
      name: students.name,
      gender: students.gender,
      birthDate: students.birthDate,
      isActive: students.isActive,
      classId: classes.id,
      gradeLevel: classes.gradeLevel,
      section: classes.section,
      departmentCode: departments.code,
      enrollmentStatus: studentEnrollments.status,
    })
    .from(students)
    .leftJoin(studentEnrollments, enrollmentJoin)
    .leftJoin(classes, eq(studentEnrollments.classId, classes.id))
    .leftJoin(departments, eq(classes.departmentId, departments.id))
    .where(and(...conditions))
    .orderBy(
      dir === "asc" ? asc(sortColumn) : desc(sortColumn),
      asc(classes.section),
      asc(students.name),
    )
    .limit(perPage)
    .offset(meta.offset);

  return paginated(
    rows.map((row) => ({
      ...row,
      className:
        row.gradeLevel != null
          ? `${row.gradeLevel} ${row.departmentCode ?? ""} ${row.section ?? ""}`.trim()
          : null,
    })),
    total,
    meta.page,
    perPage,
  );
}

export type EnrollmentListFilters = {
  academicYearId?: string;
  q?: string;
  classId?: string;
  status?: EnrollmentStatus;
  sort?: "student" | "class" | "status";
  dir?: SortDirection;
  page?: number;
  perPage?: number;
};

export async function listEnrollmentsPaged(
  filters: EnrollmentListFilters,
): Promise<Paginated<Awaited<ReturnType<typeof listEnrollments>>[number]>> {
  const db = getDb();
  const perPage = filters.perPage ?? 20;
  const page = filters.page ?? 1;
  const pattern = filters.q ? likePattern(filters.q) : undefined;

  const conditions = [
    isNull(studentEnrollments.deletedAt),
    filters.academicYearId
      ? eq(studentEnrollments.academicYearId, filters.academicYearId)
      : undefined,
    filters.classId ? eq(studentEnrollments.classId, filters.classId) : undefined,
    filters.status ? eq(studentEnrollments.status, filters.status) : undefined,
    pattern
      ? or(ilike(students.name, pattern), ilike(students.nisn, pattern))
      : undefined,
  ];

  const [totalRow] = await db
    .select({ total: count(studentEnrollments.id) })
    .from(studentEnrollments)
    .innerJoin(students, eq(studentEnrollments.studentId, students.id))
    .innerJoin(classes, eq(studentEnrollments.classId, classes.id))
    .innerJoin(departments, eq(classes.departmentId, departments.id))
    .innerJoin(
      academicYears,
      eq(studentEnrollments.academicYearId, academicYears.id),
    )
    .where(and(...conditions));
  const total = Number(totalRow?.total ?? 0);
  const meta = normalizePagination(total, page, perPage);

  const sort = filters.sort ?? "student";
  const dir = filters.dir ?? "asc";
  const sortColumn =
    sort === "class"
      ? classes.gradeLevel
      : sort === "status"
        ? studentEnrollments.status
        : students.name;

  const rows = await db
    .select({
      id: studentEnrollments.id,
      studentId: students.id,
      studentName: students.name,
      nisn: students.nisn,
      classId: classes.id,
      gradeLevel: classes.gradeLevel,
      section: classes.section,
      departmentCode: departments.code,
      academicYearId: academicYears.id,
      academicYearName: academicYears.name,
      status: studentEnrollments.status,
    })
    .from(studentEnrollments)
    .innerJoin(students, eq(studentEnrollments.studentId, students.id))
    .innerJoin(classes, eq(studentEnrollments.classId, classes.id))
    .innerJoin(departments, eq(classes.departmentId, departments.id))
    .innerJoin(
      academicYears,
      eq(studentEnrollments.academicYearId, academicYears.id),
    )
    .where(and(...conditions))
    .orderBy(
      dir === "asc" ? asc(sortColumn) : desc(sortColumn),
      asc(classes.section),
      asc(students.name),
    )
    .limit(perPage)
    .offset(meta.offset);

  return paginated(rows, total, meta.page, perPage);
}

export type TeacherSubjectListFilters = {
  q?: string;
  teacherId?: string;
  subjectId?: string;
  sort?: "teacher" | "subject";
  dir?: SortDirection;
  page?: number;
  perPage?: number;
};

export async function listTeacherSubjectsPaged(
  filters: TeacherSubjectListFilters,
): Promise<
  Paginated<
    Awaited<ReturnType<typeof listTeacherSubjects>>[number] & {
      teacherName: string;
      subjectName: string;
    }
  >
> {
  const db = getDb();
  const perPage = filters.perPage ?? 20;
  const page = filters.page ?? 1;
  const pattern = filters.q ? likePattern(filters.q) : undefined;

  const conditions = [
    isNull(users.deletedAt),
    filters.teacherId
      ? eq(teacherSubjects.teacherId, filters.teacherId)
      : undefined,
    filters.subjectId
      ? eq(teacherSubjects.subjectId, filters.subjectId)
      : undefined,
    pattern
      ? or(
          ilike(users.name, pattern),
          ilike(subjects.code, pattern),
          ilike(subjects.name, pattern),
        )
      : undefined,
  ];

  const [totalRow] = await db
    .select({ total: count() })
    .from(teacherSubjects)
    .innerJoin(users, eq(teacherSubjects.teacherId, users.id))
    .innerJoin(subjects, eq(teacherSubjects.subjectId, subjects.id))
    .where(and(...conditions));
  const total = Number(totalRow?.total ?? 0);
  const meta = normalizePagination(total, page, perPage);

  const sort = filters.sort ?? "teacher";
  const dir = filters.dir ?? "asc";
  const sortColumn = sort === "subject" ? subjects.name : users.name;

  const rows = await db
    .select({
      teacherId: teacherSubjects.teacherId,
      teacherName: users.name,
      subjectId: teacherSubjects.subjectId,
      subjectCode: subjects.code,
      subjectName: subjects.name,
    })
    .from(teacherSubjects)
    .innerJoin(users, eq(teacherSubjects.teacherId, users.id))
    .innerJoin(subjects, eq(teacherSubjects.subjectId, subjects.id))
    .where(and(...conditions))
    .orderBy(
      dir === "asc" ? asc(sortColumn) : desc(sortColumn),
      asc(subjects.name),
    )
    .limit(perPage)
    .offset(meta.offset);

  return paginated(rows, total, meta.page, perPage);
}
