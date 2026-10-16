/**
 * DEVELOPMENT ONLY: drop everything in the target database, re-run migrations
 * and the base seed. Refuses to run in production or against non-local hosts
 * unless ALLOW_DB_RESET=1.   Usage: pnpm db:reset
 */
import postgres from "postgres";
import { runMigrations } from "./migrate";
import { seedBase } from "../seeds/base";

export async function resetDatabase(url: string) {
  const host = new URL(url).hostname;
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to reset in production");
  if (!["localhost", "127.0.0.1", "::1"].includes(host) && process.env.ALLOW_DB_RESET !== "1") {
    throw new Error(`Refusing to reset non-local database host "${host}" (set ALLOW_DB_RESET=1 to override)`);
  }
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await sql.unsafe("drop schema if exists drizzle cascade; drop schema public cascade; create schema public;");
  } finally {
    await sql.end();
  }
  await runMigrations(url);
  await seedBase(url);
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("scripts/reset.ts")) {
  const url = process.argv[2] === "--test" ? process.env.TEST_DATABASE_URL : process.env.DATABASE_URL;
  if (!url) throw new Error("Database URL is required");
  resetDatabase(url)
    .then(() => console.log("Database reset complete."))
    .catch((e) => {
      console.error(e.message);
      process.exit(1);
    });
}
