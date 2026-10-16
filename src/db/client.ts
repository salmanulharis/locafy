import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;
/** A database handle or an open transaction; services accept either. */
export type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0] | Database;

type Holder = { sql?: postgres.Sql; db?: Database; url?: string };
const globalHolder = globalThis as unknown as { __locafyDb?: Holder };
const holder: Holder = (globalHolder.__locafyDb ??= {});

function connect(url: string) {
  const sql = postgres(url, {
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    idle_timeout: 30,
    connect_timeout: 10,
    prepare: true,
    onnotice: () => {},
  });
  return { sql, db: drizzle(sql, { schema, casing: "snake_case" }) };
}

/** Lazily-initialised shared connection pool (survives dev hot reloads). */
export function getDb(): Database {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured");
  if (!holder.db || holder.url !== url) {
    const { sql, db } = connect(url);
    holder.sql = sql;
    holder.db = db;
    holder.url = url;
  }
  return holder.db;
}

export function getSql(): postgres.Sql {
  getDb();
  return holder.sql!;
}

export async function closeDb() {
  await holder.sql?.end({ timeout: 5 });
  holder.sql = undefined;
  holder.db = undefined;
  holder.url = undefined;
}

export { schema };
