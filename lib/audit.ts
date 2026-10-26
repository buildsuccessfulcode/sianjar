import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { auditLogs } from "@/db/schema";
import type * as schema from "@/db/schema";

type AuditDb = PgDatabase<PgQueryResultHKT, typeof schema>;

export type AuditEntry = {
  actorId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  payload?: Record<string, unknown> | null;
};

export async function writeAudit(db: AuditDb, entry: AuditEntry) {
  await db.insert(auditLogs).values({
    actorId: entry.actorId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    payload: entry.payload ?? null,
  });
}
