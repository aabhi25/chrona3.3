import { Pool as PgPool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new PgPool({
  connectionString: process.env.DATABASE_URL
});

// Timestamp columns have no time zone and Drizzle reads them as UTC, so the database's own NOW()
// (column defaults) must write UTC too - otherwise a server set to IST stores times 5.5 hours ahead
pool.on('connect', (client) => {
  client.query("SET TIME ZONE 'UTC'").catch((error) => console.error("Failed to set database time zone:", error));
});

export const db = drizzle({ client: pool, schema });