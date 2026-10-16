const dayFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

function label(day: string) {
  return dayFmt.format(new Date(`${day}T00:00:00Z`));
}

/**
 * Single-series daily bar chart in plain HTML/CSS. Bars are anchored to the
 * baseline with rounded data-ends; each bar has a hover/focus tooltip and the
 * same numbers are available as a table below.
 */
export function DailyBarChart({ title, data, unit }: { title: string; data: { day: string; value: number }[]; unit: string }) {
  const max = Math.max(0, ...data.map((d) => d.value));
  const total = data.reduce((s, d) => s + d.value, 0);
  const ticks = data.length > 1 ? [data[0]!, data[Math.floor((data.length - 1) / 2)]!, data[data.length - 1]!] : data;
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-sm text-muted tabular">
          {total} total
        </span>
      </figcaption>
      <div className="flex gap-2">
        <div className="flex h-40 flex-col justify-between py-0 text-right text-xs text-muted tabular" aria-hidden>
          <span>{max}</span>
          <span>0</span>
        </div>
        <div className="relative flex-1">
          <div className="absolute inset-x-0 top-0 border-t border-dashed border-border" aria-hidden />
          <div
            className="flex h-40 items-end gap-[2px] border-b border-border-strong"
            role="img"
            aria-label={`${title}: ${total} ${unit} over ${data.length} days, highest ${max} in a day. Exact values in the table below.`}
          >
            {data.map((d) => {
              const h = max > 0 ? (d.value / max) * 100 : 0;
              return (
                <div key={d.day} className="group relative flex h-full min-w-0 flex-1 items-end justify-center">
                  <div
                    className="w-full max-w-6 rounded-t-[4px] bg-primary transition-opacity group-hover:opacity-80"
                    style={{ height: d.value > 0 ? `max(${h}%, 2px)` : 0 }}
                  />
                  <span className="pointer-events-none absolute bottom-full z-10 mb-1 hidden rounded-md border border-border bg-surface px-2 py-1 text-xs whitespace-nowrap shadow-md group-hover:block">
                    <span className="font-semibold tabular">{d.value}</span> {unit} · {label(d.day)}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-1 flex justify-between text-xs text-muted" aria-hidden>
            {ticks.map((t, i) => (
              <span key={`${t.day}-${i}`}>{label(t.day)}</span>
            ))}
          </div>
        </div>
      </div>
    </figure>
  );
}

export function DailyTable({ rows }: { rows: { day: string; views: number; actions: number }[] }) {
  return (
    <details className="text-sm">
      <summary className="inline-flex min-h-11 cursor-pointer items-center font-medium text-primary">Show daily numbers as a table</summary>
      <div className="mt-2 max-h-80 overflow-y-auto rounded-lg border border-border" role="region" aria-label="Daily numbers" tabIndex={0}>
        <table className="w-full">
          <thead className="sticky top-0 bg-surface-2 text-left text-xs text-muted">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">Day</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Page views</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Customer actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {[...rows].reverse().map((r) => (
              <tr key={r.day}>
                <td className="px-3 py-1.5">{label(r.day)}</td>
                <td className="px-3 py-1.5 text-right tabular">{r.views}</td>
                <td className="px-3 py-1.5 text-right tabular">{r.actions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
