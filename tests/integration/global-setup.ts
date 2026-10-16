/**
 * Runs once before the integration project: drops and rebuilds the TEST
 * database (migrations + base reference data). Never touches DATABASE_URL.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { resetDatabase } from "../../database/scripts/reset";

export function assertSafeTestUrl(testUrl: string | undefined, devUrl: string | undefined): string {
  if (!testUrl) throw new Error("TEST_DATABASE_URL is not set; refusing to run integration tests.");
  if (devUrl && testUrl === devUrl) {
    throw new Error("TEST_DATABASE_URL equals DATABASE_URL; refusing to run integration tests against the development database.");
  }
  const dbName = new URL(testUrl).pathname.replace(/^\//, "");
  if (!/test/i.test(dbName)) throw new Error(`Test database name "${dbName}" must contain "test".`);
  return testUrl;
}

export default async function setup() {
  const envFile = path.join(process.cwd(), ".env");
  // Values from the shell take precedence; .env fills in the rest.
  const shellEnv = { ...process.env };
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  Object.assign(process.env, shellEnv);
  const url = assertSafeTestUrl(process.env.TEST_DATABASE_URL, process.env.DATABASE_URL);
  await resetDatabase(url);
}
