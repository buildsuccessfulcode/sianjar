import "server-only";

import bcrypt from "bcryptjs";
import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNull,
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
import { writeAudit } from "@/lib/audit";
import type {
  academicYearSchema,
  classSchema,
  departmentSchema,
  enrollmentBulkSchema,
  enrollmentMoveSchema,
  enrollmentSchema,
  enrollmentUpdateSchema,
  semesterSchema,
  studentCreateSchema,
  studentUpdateSchema,
  subjectSchema,
  teacherCreateSchema,
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
export type EnrollmentInput = z.infer<typeof enrollmentSchema>;
export type EnrollmentUpdateInput = z.infer<typeof enrollmentUpdateSchema>;
export type EnrollmentBulkInput = z.infer<typeof enrollmentBulkSchema>;
export type EnrollmentMoveInput = z.infer<typeof enrollmentMoveSchema>;

export type BulkEnrollmentResult = {
  created: number;
  reactivated: number;
  skipped: { studentId: string; name: string; reason: string }[];
};

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
          updatedAt: new Date(),
        })
        .where(and(eq(users.id, id), isNull(users.deletedAt)))
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

export async function softDeleteTeacher(id: string) {
  const [row] = await getDb()
    .update(users)
    .set({ isActive: false, deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();
  if (!row) throw new NotFoundError("Guru tidak ditemukan.");
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

export async function addTeacherSubject(teacherId: string, subjectId: string) {
  try {
    await getDb().insert(teacherSubjects).values({ teacherId, subjectId });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError("Mapping guru–mapel sudah ada.");
    }
    throw error;
  }
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
        updatedAt: new Date(),
      })
      .where(and(eq(students.id, id), isNull(students.deletedAt)))
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

export async function softDeleteStudent(id: string) {
  const [row] = await getDb()
    .update(students)
    .set({ isActive: false, deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(students.id, id))
    .returning();
  if (!row) throw new NotFoundError("Siswa tidak ditemukan.");
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

