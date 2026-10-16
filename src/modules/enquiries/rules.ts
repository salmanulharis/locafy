export type EnquiryStatus = "open" | "responded" | "closed";
export type EnquiryEvent = "merchant_reply" | "customer_reply" | "close" | "reopen";

/**
 * Enquiry state machine:
 *   open --merchant_reply--> responded --customer_reply--> open
 *   open|responded --close--> closed --reopen--> open
 * Replies are not accepted on a closed enquiry.
 */
export function nextEnquiryStatus(current: EnquiryStatus, event: EnquiryEvent): EnquiryStatus | null {
  switch (event) {
    case "merchant_reply":
      return current === "closed" ? null : "responded";
    case "customer_reply":
      return current === "closed" ? null : "open";
    case "close":
      return current === "closed" ? null : "closed";
    case "reopen":
      return current === "closed" ? "open" : null;
  }
}

export const ENQUIRY_STATUS_LABELS: Record<EnquiryStatus, string> = {
  open: "Awaiting reply",
  responded: "Replied",
  closed: "Closed",
};
