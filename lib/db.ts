import { neon, neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import { drizzle as drizzlePool } from "drizzle-orm/neon-serverless";
import ws from "ws";

import * as schema from "@/db/schema";

function connectionString() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL belum diset. Salin .env.example menjadi .env.local.",
    );
  }
  return url;
}

function createHttpDb() {
  return drizzleHttp(neon(connectionString()), { schema });
}

function createPoolDb() {
  neonConfig.webSocketConstructor = ws;
  const pool = new Pool({ connectionString: connectionString() });
  return drizzlePool(pool, { schema });
}

export type AppDb = ReturnType<typeof createHttpDb>;
export type AppPoolDb = ReturnType<typeof createPoolDb>;

const globalForDb = globalThis as unknown as {
  sijarHttpDb?: AppDb;
  sijarPoolDb?: AppPoolDb;
};

export function getDb(): AppDb {
  if (!globalForDb.sijarHttpDb) {
    globalForDb.sijarHttpDb = createHttpDb();
  }
  return globalForDb.sijarHttpDb;
}

export function getDbPool(): AppPoolDb {
  if (!globalForDb.sijarPoolDb) {
    globalForDb.sijarPoolDb = createPoolDb();
  }
  return globalForDb.sijarPoolDb;
}
