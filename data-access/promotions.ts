import "server-only";

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
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import {
  academicYears,
  classPromotionRules,
  classes,
  departments,
  promotionBatches,
  studentEnrollments,
  students,
} from "@/db/schema";
import type {
  PromotionAction,
  PromotionBatchStatus,
} from "@/db/schema/enums";
import { writeAudit } from "@/lib/audit";
import { getDb, getDbPool } from "@/lib/db";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";
import {
  likePattern,
  normalizePagination,
  paginated,
  type Paginated,
  type SortDirection,
} from "@/lib/pagination";

type ClassRow = {
  id: string;
  academicYearId: string;
  departmentId: string;
  departmentCode: string;
  gradeLevel: number;
  section: string;
};

type RuleRow = {
  fromClassId: string;
  toClassId: string | null;
  action: PromotionAction;
};

type Mapping = {
  fromClassId: string;
  toClassId: string | null;
  action: PromotionAction;
  fromLabel: string;
  toLabel: string | null;
};

function labelFor(row: ClassRow) {
  return `${row.gradeLevel} ${row.departmentCode} ${row.section}`;
}

function buildMappings(
  fromClasses: ClassRow[],
  toClasses: ClassRow[],
  rules: RuleRow[],
): { mappings: Mapping[]; conflicts: string[] } {
  const mappings: Mapping[] = [];
  const conflicts: string[] = [];

  for (const fromClass of fromClasses) {
    const rule = rules.find((item) => item.fromClassId === fromClass.id);
    let action: PromotionAction = fromClass.gradeLevel >= 12 ? "GRADUATE" : "PROMOTE";
    let toClassId: string | null = null;

    if (rule) {
      action = rule.action;
      toClassId = rule.toClassId;
    } else if (action === "PROMOTE") {
      const exact = toClasses.find(
        (item) =>
          item.departmentId === fromClass.departmentId &&
          item.gradeLevel === fromClass.gradeLevel + 1 &&
          item.section === fromClass.section,
      );
      const fallback = toClasses.find(
        (item) =>
          item.departmentId === fromClass.departmentId &&
          item.gradeLevel === fromClass.gradeLevel + 1,
      );
      toClassId = exact?.id ?? fallback?.id ?? null;
    }

    if (action === "PROMOTE" && !toClassId) {
      conflicts.push(
        `Kelas tujuan untuk ${labelFor(fromClass)} belum tersedia pada tahun ajaran tujuan.`,
      );
    }

    const toClass = toClassId
      ? toClasses.find((item) => item.id === toClassId) ?? null
      : null;
    if (toClassId && !toClass) {
      conflicts.push(
        `Kelas tujuan untuk ${labelFor(fromClass)} tidak ditemukan.`,
      );
    }

    mappings.push({
      fromClassId: fromClass.id,
      toClassId: action === "GRADUATE" ? null : toClassId,
      action,
      fromLabel: labelFor(fromClass),
      toLabel: toClass ? labelFor(toClass) : null,
    });
  }

  return { mappings, conflicts };
}

async function fetchYears(fromId: string, toId: string) {
  const rows = await getDb()
    .select()
    .from(academicYears)
    .where(
      and(
        inArray(academicYears.id, [fromId, toId]),
        isNull(academicYears.deletedAt),
      ),
    );
  const from = rows.find((row) => row.id === fromId) ?? null;
  const to = rows.find((row) => row.id === toId) ?? null;
  return { from, to };
}

async function fetchClassesForYears(fromId: string, toId: string) {
  const rows = await getDb()
    .select({
      id: classes.id,
      academicYearId: classes.academicYearId,
      departmentId: classes.departmentId,
      departmentCode: departments.code,
      gradeLevel: classes.gradeLevel,
      section: classes.section,
    })
    .from(classes)
    .innerJoin(departments, eq(classes.departmentId, departments.id))
    .where(
      and(
        inArray(classes.academicYearId, [fromId, toId]),
        eq(classes.isActive, true),
        isNull(classes.deletedAt),
      ),
    );
  return {
    fromClasses: rows.filter((row) => row.academicYearId === fromId),
    toClasses: rows.filter((row) => row.academicYearId === toId),
  };
}

export async function getPromotionPreview(fromId: string, toId: string) {
  if (fromId === toId) {
    throw new ValidationError("Tahun ajaran asal dan tujuan tidak boleh sama.");
  }
  const { from, to } = await fetchYears(fromId, toId);
  if (!from || !to) throw new NotFoundError("Tahun ajaran tidak ditemukan.");

  const { fromClasses, toClasses } = await fetchClassesForYears(fromId, toId);
  const rules = await getDb()
    .select({
      fromClassId: classPromotionRules.fromClassId,
      toClassId: classPromotionRules.toClassId,
      action: classPromotionRules.action,
    })
    .from(classPromotionRules)
    .where(eq(classPromotionRules.academicYearToId, toId));

  const { mappings, conflicts } = buildMappings(fromClasses, toClasses, rules);

  const enrollments = await getDb()
    .select({
      studentId: students.id,
      studentName: students.name,
      nisn: students.nisn,
      classId: studentEnrollments.classId,
    })
    .from(studentEnrollments)
    .innerJoin(students, eq(studentEnrollments.studentId, students.id))
    .where(
      and(
        eq(studentEnrollments.academicYearId, fromId),
        eq(studentEnrollments.status, "ACTIVE"),
        isNull(studentEnrollments.deletedAt),
        eq(students.isActive, true),
        isNull(students.deletedAt),
      ),
    )
    .orderBy(asc(students.name));

  const existingToYear = await getDb()
    .select({ studentId: studentEnrollments.studentId })
    .from(studentEnrollments)
    .where(
      and(
        eq(studentEnrollments.academicYearId, toId),
        isNull(studentEnrollments.deletedAt),
        enrollments.length
          ? inArray(
              studentEnrollments.studentId,
              enrollments.map((row) => row.studentId),
            )
          : undefined,
      ),
    );
  const existingIds = new Set(existingToYear.map((row) => row.studentId));

  const rows = mappings.map((mapping) => {
    const studentsInClass = enrollments.filter(
      (row) => row.classId === mapping.fromClassId,
    );
    const alreadyEnrolled = studentsInClass.filter((row) =>
      existingIds.has(row.studentId),
    );
    return {
      ...mapping,
      studentCount: studentsInClass.length,
      alreadyEnrolledCount: alreadyEnrolled.length,
    };
  });

  const summary = {
    promote: rows
      .filter((row) => row.action === "PROMOTE")
      .reduce((total, row) => total + row.studentCount, 0),
    retain: rows
      .filter((row) => row.action === "RETAIN")
      .reduce((total, row) => total + row.studentCount, 0),
    graduate: rows
      .filter((row) => row.action === "GRADUATE")
      .reduce((total, row) => total + row.studentCount, 0),
    transferred: rows
      .filter((row) => row.action === "TRANSFERRED")
      .reduce((total, row) => total + row.studentCount, 0),
    droppedOut: rows
      .filter((row) => row.action === "DROPPED_OUT")
      .reduce((total, row) => total + row.studentCount, 0),
  };

  const conflictCount =
    conflicts.length +
    rows.reduce((total, row) => total + row.alreadyEnrolledCount, 0);

  return {
    from,
    to,
    rows,
    mappings,
    conflicts,
    summary,
    conflictCount,
    totalStudents: enrollments.length,
  };
}

export async function commitPromotion(
  fromId: string,
  toId: string,
  actorId: string,
) {
  if (fromId === toId) {
    throw new ValidationError("Tahun ajaran asal dan tujuan tidak boleh sama.");
  }

  const db = getDbPool();
  return db.transaction(async (tx) => {
    const years = await tx
      .select()
      .from(academicYears)
      .where(
        and(
          inArray(academicYears.id, [fromId, toId]),
          isNull(academicYears.deletedAt),
        ),
      );
    const from = years.find((row) => row.id === fromId);
    const to = years.find((row) => row.id === toId);
    if (!from || !to) throw new NotFoundError("Tahun ajaran tidak ditemukan.");
    if (to.isActive) {
      throw new ConflictError(
        "Tahun ajaran tujuan sudah aktif. Promosi tidak dapat dijalankan.",
      );
    }

    const [existingBatch] = await tx
      .select()
      .from(promotionBatches)
      .where(
        and(
          eq(promotionBatches.fromAcademicYearId, fromId),
          eq(promotionBatches.toAcademicYearId, toId),
          eq(promotionBatches.status, "COMMITTED"),
        ),
      )
      .limit(1);
    if (existingBatch) {
      throw new ConflictError(
        "Batch promosi untuk transisi tahun ini sudah pernah di-commit.",
      );
    }

    const classRows = await tx
      .select({
        id: classes.id,
        academicYearId: classes.academicYearId,
        departmentId: classes.departmentId,
        departmentCode: departments.code,
        gradeLevel: classes.gradeLevel,
        section: classes.section,
      })
      .from(classes)
      .innerJoin(departments, eq(classes.departmentId, departments.id))
      .where(
        and(
          inArray(classes.academicYearId, [fromId, toId]),
          eq(classes.isActive, true),
          isNull(classes.deletedAt),
        ),
      );
    const fromClasses = classRows.filter((row) => row.academicYearId === fromId);
    const toClasses = classRows.filter((row) => row.academicYearId === toId);

    const rules = await tx
      .select({
        fromClassId: classPromotionRules.fromClassId,
        toClassId: classPromotionRules.toClassId,
        action: classPromotionRules.action,
      })
      .from(classPromotionRules)
      .where(eq(classPromotionRules.academicYearToId, toId));

    const { mappings, conflicts } = buildMappings(
      fromClasses,
      toClasses,
      rules,
    );
    if (conflicts.length > 0) {
      throw new ConflictError(conflicts.join(" "));
    }

    const enrollments = await tx
      .select({
        id: studentEnrollments.id,
        studentId: studentEnrollments.studentId,
        classId: studentEnrollments.classId,
      })
      .from(studentEnrollments)
      .innerJoin(students, eq(studentEnrollments.studentId, students.id))
      .where(
        and(
          eq(studentEnrollments.academicYearId, fromId),
          eq(studentEnrollments.status, "ACTIVE"),
          isNull(studentEnrollments.deletedAt),
          eq(students.isActive, true),
          isNull(students.deletedAt),
        ),
      );

    if (enrollments.length > 0) {
      const existingTarget = await tx
        .select({ studentId: studentEnrollments.studentId })
        .from(studentEnrollments)
        .where(
          and(
            eq(studentEnrollments.academicYearId, toId),
            isNull(studentEnrollments.deletedAt),
            inArray(
              studentEnrollments.studentId,
              enrollments.map((row) => row.studentId),
            ),
          ),
        );
      if (existingTarget.length > 0) {
        throw new ConflictError(
          `${existingTarget.length} siswa sudah memiliki enrollment pada tahun ajaran tujuan.`,
        );
      }
    }

    const mappingByClass = new Map(
      mappings.map((mapping) => [mapping.fromClassId, mapping]),
    );

    const newEnrollments: {
      studentId: string;
      classId: string;
      academicYearId: string;
      status: "ACTIVE";
    }[] = [];
    const completedIds: string[] = [];
    const graduatedIds: string[] = [];
    const transferredIds: string[] = [];
    const droppedOutIds: string[] = [];
    const summary = {
      promote: 0,
      retain: 0,
      graduate: 0,
      transferred: 0,
      droppedOut: 0,
    };

    for (const enrollment of enrollments) {
      const mapping = mappingByClass.get(enrollment.classId);
      if (!mapping) {
        throw new ConflictError(
          "Ada kelas asal yang belum memiliki mapping promosi.",
        );
      }

      if (mapping.action === "PROMOTE" || mapping.action === "RETAIN") {
        if (!mapping.toClassId) {
          throw new ConflictError(
            `Kelas tujuan untuk ${mapping.fromLabel} tidak tersedia.`,
          );
        }
        newEnrollments.push({
          studentId: enrollment.studentId,
          classId: mapping.toClassId,
          academicYearId: toId,
          status: "ACTIVE",
        });
        completedIds.push(enrollment.id);
        if (mapping.action === "PROMOTE") summary.promote += 1;
        else summary.retain += 1;
      } else if (mapping.action === "GRADUATE") {
        graduatedIds.push(enrollment.id);
        summary.graduate += 1;
      } else if (mapping.action === "TRANSFERRED") {
        transferredIds.push(enrollment.id);
        summary.transferred += 1;
      } else {
        droppedOutIds.push(enrollment.id);
        summary.droppedOut += 1;
      }
    }

    const [batch] = await tx
      .insert(promotionBatches)
      .values({
        fromAcademicYearId: fromId,
        toAcademicYearId: toId,
        status: "COMMITTED",
        createdBy: actorId,
        committedAt: new Date(),
        summary,
      })
      .returning();

    for (const mapping of mappings) {
      await tx
        .insert(classPromotionRules)
        .values({
          fromClassId: mapping.fromClassId,
          toClassId: mapping.toClassId,
          academicYearFromId: fromId,
          academicYearToId: toId,
          action: mapping.action,
        })
        .onConflictDoUpdate({
          target: [
            classPromotionRules.fromClassId,
            classPromotionRules.academicYearToId,
          ],
          set: {
            toClassId: mapping.toClassId,
            action: mapping.action,
            updatedAt: new Date(),
          },
        });
    }

    if (newEnrollments.length > 0) {
      await tx.insert(studentEnrollments).values(
        newEnrollments.map((row) => ({
          ...row,
          promotionBatchId: batch.id,
        })),
      );
    }

    if (completedIds.length > 0) {
      await tx
        .update(studentEnrollments)
        .set({
          status: "COMPLETED",
          promotionBatchId: batch.id,
          updatedAt: new Date(),
        })
        .where(inArray(studentEnrollments.id, completedIds));
    }
    if (graduatedIds.length > 0) {
      await tx
        .update(studentEnrollments)
        .set({
          status: "GRADUATED",
          promotionBatchId: batch.id,
          updatedAt: new Date(),
        })
        .where(inArray(studentEnrollments.id, graduatedIds));
    }
    if (transferredIds.length > 0) {
      await tx
        .update(studentEnrollments)
        .set({
          status: "TRANSFERRED",
          promotionBatchId: batch.id,
          updatedAt: new Date(),
        })
        .where(inArray(studentEnrollments.id, transferredIds));
    }
    if (droppedOutIds.length > 0) {
      await tx
        .update(studentEnrollments)
        .set({
          status: "DROPPED_OUT",
          promotionBatchId: batch.id,
          updatedAt: new Date(),
        })
        .where(inArray(studentEnrollments.id, droppedOutIds));
    }

    await writeAudit(tx, {
      actorId,
      action: "promotion.commit",
      entityType: "promotion_batch",
      entityId: batch.id,
      payload: {
        from: from.name,
        to: to.name,
        summary,
      },
    });

    return { batch, summary };
  });
}

export async function cancelPromotionBatch(batchId: string, actorId: string) {
  const db = getDbPool();
  await db.transaction(async (tx) => {
    const [batch] = await tx
      .select()
      .from(promotionBatches)
      .where(eq(promotionBatches.id, batchId))
      .limit(1);
    if (!batch) throw new NotFoundError("Batch promosi tidak ditemukan.");
    if (batch.status !== "COMMITTED") {
      throw new ConflictError("Hanya batch berstatus COMMITTED yang dapat dibatalkan.");
    }

    const [targetYear] = await tx
      .select()
      .from(academicYears)
      .where(eq(academicYears.id, batch.toAcademicYearId))
      .limit(1);
    if (!targetYear) throw new NotFoundError("Tahun ajaran tujuan tidak ditemukan.");
    if (targetYear.isActive) {
      throw new ConflictError(
        "Tahun ajaran tujuan sudah aktif. Batch tidak dapat dibatalkan.",
      );
    }

    await tx
      .delete(studentEnrollments)
      .where(
        and(
          eq(studentEnrollments.promotionBatchId, batchId),
          eq(studentEnrollments.academicYearId, batch.toAcademicYearId),
        ),
      );

    await tx
      .update(studentEnrollments)
      .set({
        status: "ACTIVE",
        promotionBatchId: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(studentEnrollments.promotionBatchId, batchId),
          eq(studentEnrollments.academicYearId, batch.fromAcademicYearId),
        ),
      );

    await tx
      .update(promotionBatches)
      .set({
        status: "CANCELLED",
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(promotionBatches.id, batchId));

    await writeAudit(tx, {
      actorId,
      action: "promotion.cancel",
      entityType: "promotion_batch",
      entityId: batchId,
    });
  });
}

const fromYears = alias(academicYears, "from_years");
const toYears = alias(academicYears, "to_years");

export async function listPromotionBatches() {
  return getDb()
    .select({
      id: promotionBatches.id,
      status: promotionBatches.status,
      summary: promotionBatches.summary,
      committedAt: promotionBatches.committedAt,
      cancelledAt: promotionBatches.cancelledAt,
      fromYearName: fromYears.name,
      toYearName: toYears.name,
    })
    .from(promotionBatches)
    .innerJoin(
      fromYears,
      eq(promotionBatches.fromAcademicYearId, fromYears.id),
    )
    .innerJoin(toYears, eq(promotionBatches.toAcademicYearId, toYears.id))
    .orderBy(desc(promotionBatches.createdAt));
}

export async function getPromotionBatch(id: string) {
  const rows = await getDb()
    .select({
      id: promotionBatches.id,
      status: promotionBatches.status,
      summary: promotionBatches.summary,
      committedAt: promotionBatches.committedAt,
      cancelledAt: promotionBatches.cancelledAt,
      fromYearId: fromYears.id,
      fromYearName: fromYears.name,
      toYearId: toYears.id,
      toYearName: toYears.name,
      toYearActive: toYears.isActive,
    })
    .from(promotionBatches)
    .innerJoin(
      fromYears,
      eq(promotionBatches.fromAcademicYearId, fromYears.id),
    )
    .innerJoin(toYears, eq(promotionBatches.toAcademicYearId, toYears.id))
    .where(eq(promotionBatches.id, id))
    .limit(1);
  return rows[0] ?? null;
}


export type PromotionBatchListFilters = {
  q?: string;
  status?: PromotionBatchStatus;
  sort?: "createdAt" | "status" | "transition";
  dir?: SortDirection;
  page?: number;
  perPage?: number;
};

export async function listPromotionBatchesPaged(
  filters: PromotionBatchListFilters,
): Promise<Paginated<Awaited<ReturnType<typeof listPromotionBatches>>[number]>> {
  const db = getDb();
  const perPage = filters.perPage ?? 20;
  const page = filters.page ?? 1;
  const pattern = filters.q ? likePattern(filters.q) : undefined;

  const conditions = [
    filters.status ? eq(promotionBatches.status, filters.status) : undefined,
    pattern
      ? or(ilike(fromYears.name, pattern), ilike(toYears.name, pattern))
      : undefined,
  ];

  const [totalRow] = await db
    .select({ total: count(promotionBatches.id) })
    .from(promotionBatches)
    .innerJoin(
      fromYears,
      eq(promotionBatches.fromAcademicYearId, fromYears.id),
    )
    .innerJoin(toYears, eq(promotionBatches.toAcademicYearId, toYears.id))
    .where(and(...conditions));
  const total = Number(totalRow?.total ?? 0);
  const meta = normalizePagination(total, page, perPage);

  const sort = filters.sort ?? "createdAt";
  const dir = filters.dir ?? "desc";
  const sortColumn =
    sort === "status"
      ? promotionBatches.status
      : sort === "transition"
        ? fromYears.name
        : promotionBatches.createdAt;

  const rows = await db
    .select({
      id: promotionBatches.id,
      status: promotionBatches.status,
      summary: promotionBatches.summary,
      committedAt: promotionBatches.committedAt,
      cancelledAt: promotionBatches.cancelledAt,
      fromYearName: fromYears.name,
      toYearName: toYears.name,
    })
    .from(promotionBatches)
    .innerJoin(
      fromYears,
      eq(promotionBatches.fromAcademicYearId, fromYears.id),
    )
    .innerJoin(toYears, eq(promotionBatches.toAcademicYearId, toYears.id))
    .where(and(...conditions))
    .orderBy(dir === "asc" ? asc(sortColumn) : desc(sortColumn))
    .limit(perPage)
    .offset(meta.offset);

  return paginated(rows, total, meta.page, perPage);
}
