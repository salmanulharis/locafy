"use client";

import { useState } from "react";
import { Copy, Plus, X } from "lucide-react";
import { FieldError } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { DAY_LABELS, DAYS, type Day } from "@/modules/shops/schemas";

type Slot = { open: string; close: string };
type DayState = { closed: boolean; slots: Slot[] };
export type HoursValue = Partial<Record<Day, Slot[]>> | null;

function initialState(initial: HoursValue): Record<Day, DayState> {
  const out = {} as Record<Day, DayState>;
  for (const d of DAYS) {
    const v = initial?.[d];
    if (v === undefined) out[d] = { closed: false, slots: [{ open: "", close: "" }] };
    else if (v.length === 0) out[d] = { closed: true, slots: [{ open: "", close: "" }] };
    else out[d] = { closed: false, slots: v.slice(0, 2).map((s) => ({ ...s })) };
  }
  return out;
}

/**
 * Weekly opening hours with up to two sessions per day (e.g. a lunch break).
 * Submits hours.<day>.closed / open / close / open2 / close2 fields.
 */
export function HoursEditor({ initial }: { initial: HoursValue }) {
  const [days, setDays] = useState(() => initialState(initial));

  const update = (d: Day, fn: (s: DayState) => DayState) => setDays((prev) => ({ ...prev, [d]: fn(prev[d]) }));
  const copyFirst = () =>
    setDays((prev) => {
      const src = prev.mon;
      const next = { ...prev };
      for (const d of DAYS) if (d !== "mon" && d !== "sun") next[d] = { closed: src.closed, slots: src.slots.map((s) => ({ ...s })) };
      return next;
    });

  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">Opening hours</legend>
      <p className="-mt-1 mb-1 text-sm text-muted">Leave a day blank if you don&apos;t want to show hours for it. Times are 24-hour.</p>
      <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
        {DAYS.map((d) => {
          const s = days[d];
          return (
            <li key={d} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start sm:gap-4">
              <div className="flex items-center justify-between gap-3 sm:w-40 sm:shrink-0 sm:pt-2.5">
                <span className="text-sm font-medium">{DAY_LABELS[d]}</span>
                <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-muted sm:min-h-0">
                  <input
                    type="checkbox"
                    name={`hours.${d}.closed`}
                    checked={s.closed}
                    onChange={(e) => update(d, (x) => ({ ...x, closed: e.target.checked }))}
                    className="size-5 accent-[var(--primary)]"
                  />
                  Closed
                </label>
              </div>
              {!s.closed && (
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  {s.slots.map((slot, i) => {
                    const suffix = i === 0 ? "" : "2";
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <Input
                          type="time"
                          aria-label={`${DAY_LABELS[d]} ${i ? "second session " : ""}opens`}
                          name={`hours.${d}.open${suffix}`}
                          value={slot.open}
                          onChange={(e) => update(d, (x) => ({ ...x, slots: x.slots.map((y, j) => (j === i ? { ...y, open: e.target.value } : y)) }))}
                          className="min-w-0 flex-1"
                        />
                        <span className="text-sm text-muted">to</span>
                        <Input
                          type="time"
                          aria-label={`${DAY_LABELS[d]} ${i ? "second session " : ""}closes`}
                          name={`hours.${d}.close${suffix}`}
                          value={slot.close}
                          onChange={(e) => update(d, (x) => ({ ...x, slots: x.slots.map((y, j) => (j === i ? { ...y, close: e.target.value } : y)) }))}
                          className="min-w-0 flex-1"
                        />
                        {i === 1 ? (
                          <Button variant="ghost" size="icon" aria-label="Remove second session" onClick={() => update(d, (x) => ({ ...x, slots: x.slots.slice(0, 1) }))}>
                            <X className="size-4" />
                          </Button>
                        ) : s.slots.length < 2 ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Add a second session on ${DAY_LABELS[d]} (e.g. after a lunch break)`}
                            title="Add a second session"
                            onClick={() => update(d, (x) => ({ ...x, slots: [...x.slots, { open: "", close: "" }] }))}
                          >
                            <Plus className="size-4" />
                          </Button>
                        ) : (
                          <span className="w-11 shrink-0" />
                        )}
                      </div>
                    );
                  })}
                  <FieldError name={`hours.${d}`} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <div>
        <Button variant="outline" size="sm" onClick={copyFirst} icon={<Copy className="size-4" aria-hidden />}>
          Copy Monday to Tuesday–Saturday
        </Button>
      </div>
    </fieldset>
  );
}
