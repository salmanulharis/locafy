import { z } from "zod";

/**
 * Server-side environment, validated once on first access.
 * Never import this module from client components.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  APP_URL: z.string().url().default("http://localhost:3000"),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  DEFAULT_CURRENCY: z.string().length(3).default("INR"),
  DEFAULT_LOCALE: z.string().default("en-IN"),
  DEFAULT_COUNTRY_CODE: z.string().length(2).default("in"),
  STORAGE_DRIVER: z.enum(["local", "supabase"]).default("local"),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().default("locafy-media"),
  GEOCODER_URL: z.string().optional(),
  GEOCODER_CONTACT_EMAIL: z.string().optional(),
  MAIL_DRIVER: z.enum(["log"]).default("log"),
  BILLING_PROVIDER: z.enum(["none"]).default("none"),
  /** Disables rate limiting; only honoured outside production (used by e2e tests). */
  DISABLE_RATE_LIMITS: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      const fields = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
      throw new Error(`Invalid environment configuration: ${fields}`);
    }
    cached = parsed.data;
  }
  return cached;
}
