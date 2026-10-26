import "server-only";

import { and, asc, count, eq, gt, isNull, lt, ne } from "drizzle-orm";
import type { z } from "zod";

import { academicYears, semesters, timeSlots } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { getDb, getDbPool } from "@/lib/db";
import { DEFAULT_TIME_SLOTS } from "@/lib/default-time-slots";
import { ConflictError, NotFoundError } from "@/lib/errors";
import type { timeSlotSchema } from "@/lib/validators/schedule";

export type TimeSlotInput = z.infer<typeof timeSlotSchema>;

function normalizeTime(value: string) {
  return value.length === 5 ? `${value}:00` : value;
}

async function assertSemesterExists(semesterId: string) {
  const [row] = await getDb()
    .select({ id: semesters.id })
    .from(semesters)
    .innerJoin(academicYears, eq(semesters.academicYearId, academicYears.id))
    .where(
      and(
        eq(semesters.id, semesterId),
        isNull(semesters.deletedAt),
        isNull(academicYears.deletedAt),
      ),
    )
    .limit(1);
  if (!row) throw new NotFoundError("Semester tidak ditemukan.");
}

export async function listTimeSlots(semesterId: string) {
  return getDb()
    .select({
      id: timeSlots.id,
      semesterId: timeSlots.semesterId,
      label: timeSlots.label,
      kind: timeSlots.kind,
      periodNumber: timeSlots.periodNumber,
      startTime: timeSlots.startTime,
      endTime: timeSlots.endTime,
    })
    .from(timeSlots)
    .where(eq(timeSlots.semesterId, semesterId))
    .orderBy(asc(timeSlots.startTime), asc(timeSlots.periodNumber));
}

export async function getTimeSlotById(id: string) {
  const [row] = await getDb()
    .select()
    .from(timeSlots)
    .where(eq(timeSlots.id, id))
    .limit(1);
  return row ?? null;
}

async function validateTimeSlot(input: TimeSlotInput, excludeId?: string) {
  await assertSemesterExists(input.semesterId);

  const conflict = await getDb()
    .select({
      id: timeSlots.id,
      label: timeSlots.label,
      startTime: timeSlots.startTime,
      endTime: timeSlots.endTime,
    })
    .from(timeSlots)
    .where(
      and(
        eq(timeSlots.semesterId, input.semesterId),
        excludeId ? ne(timeSlots.id, excludeId) : undefined,
        lt(timeSlots.startTime, normalizeTime(input.endTime)),
        gt(timeSlots.endTime, normalizeTime(input.startTime)),
      ),
    )
    .limit(1);

  if (conflict[0]) {
    throw new ConflictError(
      `Jam bertabrakan dengan "${conflict[0].label}" (${conflict[0].startTime.slice(0, 5)}–${conflict[0].endTime.slice(0, 5)}).`,
    );
  }
}

export async function createTimeSlot(input: TimeSlotInput, actorId: string) {
  await validateTimeSlot(input);
  const values = {
    ...input,
    periodNumber: input.kind === "LESSON" ? input.periodNumber : null,
    startTime: normalizeTime(input.startTime),
    endTime: normalizeTime(input.endTime),
  };
  const db = getDbPool();
  return db.transaction(async (tx) => {
    const [row] = await tx.insert(timeSlots).values(values).returning();
    await writeAudit(tx, {
      actorId,
      action: "time_slot.create",
      entityType: "time_slot",
      entityId: row.id,
      payload: values,
    });
    return row;
  });
}

export async function updateTimeSlot(
  id: string,
  input: TimeSlotInput,
  actorId: string,
) {
  const existing = await getTimeSlotById(id);
  if (!existing) throw new NotFoundError("Jam tidak ditemukan.");
  await validateTimeSlot(input, id);
  const values = {
    ...input,
    periodNumber: input.kind === "LESSON" ? input.periodNumber : null,
    startTime: normalizeTime(input.startTime),
    endTime: normalizeTime(input.endTime),
    updatedAt: new Date(),
  };
  const db = getDbPool();
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(timeSlots)
      .set(values)
      .where(eq(timeSlots.id, id))
      .returning();
    await writeAudit(tx, {
      actorId,
      action: "time_slot.update",
      entityType: "time_slot",
      entityId: id,
      payload: values,
    });
    return row;
  });
}

export async function deleteTimeSlot(id: string, actorId: string) {
  const existing = await getTimeSlotById(id);
  if (!existing) throw new NotFoundError("Jam tidak ditemukan.");
  const db = getDbPool();
  await db.transaction(async (tx) => {
    await tx.delete(timeSlots).where(eq(timeSlots.id, id));
    await writeAudit(tx, {
      actorId,
      action: "time_slot.delete",
      entityType: "time_slot",
      entityId: id,
      payload: {
        semesterId: existing.semesterId,
        label: existing.label,
        kind: existing.kind,
      },
    });
  });
}

export async function createDefaultTimeSlots(
  semesterId: string,
  actorId: string,
) {
  await assertSemesterExists(semesterId);
  const [existing] = await getDb()
    .select({ total: count(timeSlots.id) })
    .from(timeSlots)
    .where(eq(timeSlots.semesterId, semesterId));
  if (Number(existing?.total ?? 0) > 0) {
    throw new ConflictError(
      "Jam pelajaran sudah ada. Hapus atau ubah jam yang tersedia.",
    );
  }

  const values = DEFAULT_TIME_SLOTS.map((slot) => ({
    ...slot,
    semesterId,
    periodNumber: slot.kind === "LESSON" ? slot.periodNumber : null,
    startTime: normalizeTime(slot.startTime),
    endTime: normalizeTime(slot.endTime),
  }));

  const db = getDbPool();
  return db.transaction(async (tx) => {
    const rows = await tx.insert(timeSlots).values(values).returning();
    await writeAudit(tx, {
      actorId,
      action: "time_slot.seed_default",
      entityType: "semester",
      entityId: semesterId,
      payload: { total: rows.length },
    });
    return rows;
  });
}
