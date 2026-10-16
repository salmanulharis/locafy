import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";
import { defineConfig } from "vitest/config";

/**
 * Two projects:
 *  - unit:        pure rules and helpers, no database.
 *  - integration: services against TEST_DATABASE_URL (reset once per run by
 *                 tests/integration/global-setup.ts). Files run serially in a
 *                 single worker because they share one database.
 */
const envPath = path.join(process.cwd(), ".env");
const fileEnv: Record<string, string> = existsSync(envPath)
  ? (parseEnv(readFileSync(envPath, "utf8")) as Record<string, string>)
  : {};
const devUrl = process.env.DATABASE_URL ?? fileEnv.DATABASE_URL;
const testUrl = process.env.TEST_DATABASE_URL ?? fileEnv.TEST_DATABASE_URL;

const alias = {
  "@": path.resolve(__dirname, "src"),
};

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.ts"],
          env: { ...fileEnv, NODE_ENV: "test" },
        },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          fileParallelism: false,
          maxWorkers: 1,
          testTimeout: 60_000,
          hookTimeout: 120_000,
          globalSetup: ["tests/integration/global-setup.ts"],
          setupFiles: ["tests/integration/setup.ts"],
          env: {
            ...fileEnv,
            NODE_ENV: "test",
            // Services create their pool lazily from DATABASE_URL; point it at the test DB.
            DATABASE_URL: testUrl ?? "",
            LOCAFY_DEV_DATABASE_URL: devUrl ?? "",
            TEST_DATABASE_URL: testUrl ?? "",
            DISABLE_RATE_LIMITS: "1",
            STORAGE_DRIVER: "local",
            MAIL_DRIVER: "log",
            DATABASE_POOL_MAX: "20",
          },
        },
      },
    ],
  },
});
