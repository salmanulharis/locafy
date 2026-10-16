/**
 * Create (or promote) the first super administrator.
 * Usage: pnpm db:create-admin <email> "<Full name>"
 * The password is read from ADMIN_PASSWORD (never pass secrets as CLI args,
 * they end up in shell history).
 */
import { hash } from "@node-rs/argon2";
import { eq } from "drizzle-orm";
import { closeDb, getDb } from "../../src/db/client";
import { auditLogs, users } from "../../src/db/schema";
import { ARGON_OPTS, passwordSchema } from "../../src/modules/auth/service";

async function main() {
  const [email, name] = process.argv.slice(2);
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !name) throw new Error('Usage: pnpm db:create-admin <email> "<Full name>"  (with ADMIN_PASSWORD set)');
  if (!password) throw new Error("Set ADMIN_PASSWORD in the environment.");
  const pw = passwordSchema.safeParse(password);
  if (!pw.success) throw new Error(`Weak password: ${pw.error.issues[0]?.message}`);
  const db = getDb();
  const existing = await db.query.users.findFirst({ where: eq(users.email, email.toLowerCase()) });
  let id: string;
  if (existing) {
    await db.update(users).set({ platformRole: "super_admin", updatedAt: new Date() }).where(eq(users.id, existing.id));
    id = existing.id;
    console.log(`Promoted ${email} to super_admin.`);
  } else {
    const [u] = await db
      .insert(users)
      .values({ email: email.toLowerCase(), name, platformRole: "super_admin", passwordHash: await hash(password, ARGON_OPTS) })
      .returning({ id: users.id });
    id = u!.id;
    console.log(`Created super_admin ${email}.`);
  }
  await db.insert(auditLogs).values({ actorId: null, action: "system.create_admin", targetType: "user", targetId: id });
}

main()
  .then(() => closeDb())
  .catch(async (e) => {
    console.error(e.message);
    await closeDb();
    process.exit(1);
  });
