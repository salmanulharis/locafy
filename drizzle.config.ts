import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./database/migrations",
  dbCredentials: { url: process.env.DATABASE_URL! },
  // PostGIS creates its own tables/views; never let drizzle-kit touch them.
  extensionsFilters: ["postgis"],
  strict: true,
  verbose: true,
});
