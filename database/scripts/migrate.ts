/**
 * Apply pending migrations from database/migrations (drizzle journal).
 * Usage: pnpm db:migrate   (uses DATABASE_URL)
 */
import path from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

export async function runMigrations(url: string) {
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(sql), { migrationsFolder: path.join(process.cwd(), "database", "migrations") });
  } finally {
    await sql.end();
  }
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("scripts/migrate.ts")) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  runMigrations(url)
    .then(() => console.log("Migrations applied."))
    .catch((e) => {
      console.error("Migration failed:", e.message);
      process.exit(1);
    });
}
