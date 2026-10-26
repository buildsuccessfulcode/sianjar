import "server-only";

import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  lte,
  or,
} from "drizzle-orm";

import { auditLogs, users } from "@/db/schema";
import { getDb } from "@/lib/db";
import {
  likePattern,
  normalizePagination,
  paginated,
  type Paginated,
  type SortDirection,
} from "@/lib/pagination";

export type AuditLogFilters = {
  q?: string;
  action?: string;
  entityType?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: "createdAt" | "actor" | "action" | "entityType";
  dir?: SortDirection;
  page?: number;
  perPage?: number;
};

function auditConditions(filters: AuditLogFilters) {
  const pattern = filters.q ? likePattern(filters.q) : undefined;
  return [
    filters.action ? eq(auditLogs.action, filters.action) : undefined,
    filters.entityType
      ? eq(auditLogs.entityType, filters.entityType)
      : undefined,
    filters.dateFrom
      ? gte(auditLogs.createdAt, new Date(`${filters.dateFrom}T00:00:00+07:00`))
      : undefined,
    filters.dateTo
      ? lte(auditLogs.createdAt, new Date(`${filters.dateTo}T23:59:59.999+07:00`))
      : undefined,
    pattern
      ? or(
          ilike(users.name, pattern),
          ilike(auditLogs.action, pattern),
          ilike(auditLogs.entityType, pattern),
          ilike(auditLogs.entityId, pattern),
        )
      : undefined,
  ];
}

export async function listAuditLogs(filters?: AuditLogFilters) {
  const conditions = auditConditions(filters ?? {});
  return getDb()
    .select({
      id: auditLogs.id,
      actorName: users.name,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      payload: auditLogs.payload,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .innerJoin(users, eq(auditLogs.actorId, users.id))
    .where(and(...conditions))
    .orderBy(desc(auditLogs.createdAt))
    .limit(100);
}

export async function listAuditLogsPaged(
  filters: AuditLogFilters,
): Promise<
  Paginated<Awaited<ReturnType<typeof listAuditLogs>>[number]>
> {
  const db = getDb();
  const perPage = filters.perPage ?? 20;
  const page = filters.page ?? 1;
  const conditions = auditConditions(filters);

  const [totalRow] = await db
    .select({ total: count(auditLogs.id) })
    .from(auditLogs)
    .innerJoin(users, eq(auditLogs.actorId, users.id))
    .where(and(...conditions));
  const total = Number(totalRow?.total ?? 0);
  const meta = normalizePagination(total, page, perPage);

  const sort = filters.sort ?? "createdAt";
  const dir = filters.dir ?? "desc";
  const sortColumn =
    sort === "actor"
      ? users.name
      : sort === "action"
        ? auditLogs.action
        : sort === "entityType"
          ? auditLogs.entityType
          : auditLogs.createdAt;

  const rows = await db
    .select({
      id: auditLogs.id,
      actorName: users.name,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      payload: auditLogs.payload,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .innerJoin(users, eq(auditLogs.actorId, users.id))
    .where(and(...conditions))
    .orderBy(dir === "asc" ? asc(sortColumn) : desc(sortColumn))
    .limit(perPage)
    .offset(meta.offset);

  return paginated(rows, total, meta.page, perPage);
}

export async function listAuditFilterOptions() {
  const db = getDb();
  const [actions, entityTypes] = await Promise.all([
    db
      .selectDistinct({ value: auditLogs.action })
      .from(auditLogs)
      .orderBy(asc(auditLogs.action)),
    db
      .selectDistinct({ value: auditLogs.entityType })
      .from(auditLogs)
      .orderBy(asc(auditLogs.entityType)),
  ]);
  return {
    actions: actions.map((row) => row.value),
    entityTypes: entityTypes.map((row) => row.value),
  };
}
