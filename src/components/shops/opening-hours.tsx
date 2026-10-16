import { Clock } from "lucide-react";
import type { OpeningHours } from "@/db/schema";
import { DAYS, DAY_LABELS, type Day } from "@/modules/shops/schemas";
import { cn } from "@/lib/cn";

/** Market timezone used for "open now" until per-shop timezones are added. */
const TZ = process.env.DEFAULT_TIMEZONE ?? "Asia/Kolkata";

function nowInTz(): { day: Day; hhmm: string } {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
  const wd = parts.find((p) => p.type === "weekday")!.value.toLowerCase().slice(0, 3) as Day;
  const h = parts.find((p) => p.type === "hour")!.value.replace("24", "00");
  const m = parts.find((p) => p.type === "minute")!.value;
  return { day: wd, hhmm: `${h}:${m}` };
}

export function openStatus(hours: OpeningHours | null | undefined): { open: boolean; label: string } | null {
  if (!hours || !Object.keys(hours).length) return null;
  const { day, hhmm } = nowInTz();
  const today = hours[day] ?? [];
  const slot = today.find((s) => s.open <= hhmm && hhmm < s.close);
  if (slot) return { open: true, label: `Open now · closes ${slot.close}` };
  const later = today.find((s) => s.open > hhmm);
  if (later) return { open: false, label: `Closed · opens ${later.open}` };
  return { open: false, label: "Closed now" };
}

export function OpeningHoursTable({ hours }: { hours: OpeningHours | null | undefined }) {
  const status = openStatus(hours);
  if (!status) return <p className="text-sm text-muted">Opening hours not provided. Call the shop to check.</p>;
  const { day } = nowInTz();
  return (
    <div className="flex flex-col gap-2">
      <p className={cn("inline-flex items-center gap-1.5 text-sm font-medium", status.open ? "text-success-soft-fg" : "text-danger-soft-fg")}>
        <Clock className="size-4" aria-hidden /> {status.label}
      </p>
      <table className="w-full text-sm">
        <caption className="sr-only">Opening hours</caption>
        <tbody>
          {DAYS.map((d) => (
            <tr key={d} className={cn(d === day && "font-semibold")}>
              <th scope="row" className="py-1 pr-4 text-left font-normal text-muted">
                {DAY_LABELS[d]}
              </th>
              <td className="py-1 text-right tabular">{hours?.[d]?.length ? hours[d]!.map((s) => `${s.open}–${s.close}`).join(", ") : "Closed"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
