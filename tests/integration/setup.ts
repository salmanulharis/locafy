/**
 * Per-file setup for integration tests. Runs before any test module (and so
 * before any service creates the shared pool).
 */
import { afterAll } from "vitest";
import { closeDb } from "@/db/client";

const testUrl = process.env.TEST_DATABASE_URL;
const devUrl = process.env.LOCAFY_DEV_DATABASE_URL;
if (!testUrl || testUrl === devUrl || process.env.DATABASE_URL !== testUrl) {
  throw new Error("Integration tests must run with DATABASE_URL = TEST_DATABASE_URL (and it must differ from the dev database).");
}

afterAll(async () => {
  await closeDb();
});
