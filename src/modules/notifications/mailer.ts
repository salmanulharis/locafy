import { env } from "@/lib/env";

export type Mail = { to: string; subject: string; text: string };

/**
 * Mail transport boundary. Only the `log` driver exists in the MVP: it writes
 * the message to the server log so flows such as password reset can be
 * exercised locally. A real provider (SMTP, SES, Resend…) plugs in here.
 * See docs/integrations.md.
 */
export async function sendMail(mail: Mail): Promise<void> {
  const driver = env().MAIL_DRIVER;
  if (driver === "log") {
    if (process.env.NODE_ENV !== "test") {
      console.info(JSON.stringify({ level: "info", event: "mail.log", to: mail.to, subject: mail.subject, text: mail.text }));
    }
    return;
  }
  throw new Error(`Mail driver "${driver}" is not implemented`);
}
