import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { auditLogs, users } from "@/db/schema";
import { getDb } from "@/lib/db";

export async function listAuditLogs(filters?: {
  action?: string;
  entityType?: string;
}) {
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
    .where(
      and(
        filters?.action ? eq(auditLogs.action, filters.action) : undefined,
        filters?.entityType
          ? eq(auditLogs.entityType, filters.entityType)
          : undefined,
      ),
    )
    .orderBy(desc(auditLogs.createdAt))
    .limit(100);
}
