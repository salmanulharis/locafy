import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";

/** Fresh e2e database: schema + reference data + clearly-labelled demo data. */
export default async function globalSetup() {
  const url = process.env.E2E_DATABASE_URL!;
  const host = new URL(url).hostname;
  if (!["localhost", "127.0.0.1"].includes(host)) throw new Error("E2E database must be local");
  if (process.env.DATABASE_URL && new URL(process.env.DATABASE_URL).pathname === new URL(url).pathname) {
    throw new Error("E2E_DATABASE_URL must not point at the development database");
  }
  const env = { ...process.env, DATABASE_URL: url, DISABLE_RATE_LIMITS: "1", NODE_ENV: "development" } as NodeJS.ProcessEnv;
  const run = (script: string) => execFileSync(process.execPath, ["--import", "tsx", script], { env, stdio: "inherit" });
  run("database/scripts/reset.ts");
  run("database/seeds/demo.ts");
  mkdirSync("e2e/.auth", { recursive: true });
}
