import { relativeTime } from "@/components/products/availability";
import { cn } from "@/lib/cn";

type Message = { id: string; body: string; senderRole: "customer" | "merchant"; senderName: string | null; createdAt: Date };

/** Chat-style transcript shared by the customer and merchant enquiry views. */
export function EnquiryThread({ messages, viewerRole }: { messages: Message[]; viewerRole: "customer" | "merchant" }) {
  return (
    <ol className="flex flex-col gap-3" aria-label="Messages">
      {messages.map((m) => {
        const mine = m.senderRole === viewerRole;
        return (
          <li key={m.id} className={cn("flex flex-col gap-1", mine ? "items-end" : "items-start")}>
            <div className={cn("max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-line", mine ? "rounded-br-md bg-primary text-primary-fg" : "rounded-bl-md bg-surface-2 text-fg")}>
              {m.body}
            </div>
            <p className="px-1 text-xs text-muted">
              {mine ? "You" : m.senderName} · <time dateTime={m.createdAt.toISOString()}>{relativeTime(m.createdAt)}</time>
            </p>
          </li>
        );
      })}
    </ol>
  );
}
