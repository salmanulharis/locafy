import { Archive, Ban, CircleAlert, CircleCheck, CircleDashed, CircleMinus, Clock, EyeOff, FileEdit, Hourglass, Lock, MessageCircle, PauseCircle, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { Badge, type Tone } from "@/components/ui/primitives";
import { ENQUIRY_STATUS_LABELS, type EnquiryStatus } from "@/modules/enquiries/rules";
import { STOCK_LABELS, type StockStatus } from "@/modules/inventory/rules";
import { LISTING_STATUS_LABELS, type ListingStatus } from "@/modules/listings/rules";
import type { OfferPhase } from "@/modules/offers/rules";

const ic = "size-3.5";

export type ShopStatus = "draft" | "pending" | "active" | "rejected" | "suspended";

export const SHOP_STATUS_META: Record<ShopStatus, { label: string; tone: Tone; icon: ReactNode }> = {
  draft: { label: "Draft", tone: "neutral", icon: <FileEdit className={ic} aria-hidden /> },
  pending: { label: "Under review", tone: "info", icon: <Hourglass className={ic} aria-hidden /> },
  active: { label: "Live", tone: "success", icon: <CircleCheck className={ic} aria-hidden /> },
  rejected: { label: "Changes needed", tone: "danger", icon: <XCircle className={ic} aria-hidden /> },
  suspended: { label: "Suspended", tone: "danger", icon: <Ban className={ic} aria-hidden /> },
};

export function ShopStatusBadge({ status }: { status: ShopStatus }) {
  const m = SHOP_STATUS_META[status];
  return (
    <Badge tone={m.tone} icon={m.icon}>
      {m.label}
    </Badge>
  );
}

const LISTING_META: Record<ListingStatus, { tone: Tone; icon: ReactNode }> = {
  draft: { tone: "neutral", icon: <FileEdit className={ic} aria-hidden /> },
  published: { tone: "success", icon: <CircleCheck className={ic} aria-hidden /> },
  unpublished: { tone: "warning", icon: <EyeOff className={ic} aria-hidden /> },
  archived: { tone: "neutral", icon: <Archive className={ic} aria-hidden /> },
  discontinued: { tone: "neutral", icon: <PauseCircle className={ic} aria-hidden /> },
  restricted: { tone: "danger", icon: <Lock className={ic} aria-hidden /> },
};

export function ListingStatusBadge({ status }: { status: ListingStatus }) {
  const m = LISTING_META[status];
  return (
    <Badge tone={m.tone} icon={m.icon}>
      {LISTING_STATUS_LABELS[status]}
    </Badge>
  );
}

const STOCK_META: Record<StockStatus, { tone: Tone; icon: ReactNode }> = {
  in_stock: { tone: "success", icon: <CircleCheck className={ic} aria-hidden /> },
  low_stock: { tone: "warning", icon: <CircleAlert className={ic} aria-hidden /> },
  out_of_stock: { tone: "danger", icon: <CircleMinus className={ic} aria-hidden /> },
  unknown: { tone: "neutral", icon: <CircleDashed className={ic} aria-hidden /> },
};

export function StockBadge({ status, quantity }: { status: StockStatus; quantity?: number | null }) {
  const m = STOCK_META[status];
  return (
    <Badge tone={m.tone} icon={m.icon}>
      {status === "unknown" ? "Not confirmed" : STOCK_LABELS[status]}
      {quantity != null ? ` · ${quantity}` : ""}
    </Badge>
  );
}

export function StaleBadge() {
  return (
    <Badge tone="warning" icon={<Clock className={ic} aria-hidden />}>
      Needs update
    </Badge>
  );
}

const OFFER_META: Record<OfferPhase, { label: string; tone: Tone }> = {
  draft: { label: "Draft", tone: "neutral" },
  scheduled: { label: "Scheduled", tone: "info" },
  active: { label: "Active now", tone: "success" },
  expired: { label: "Ended", tone: "neutral" },
  unpublished: { label: "Unpublished", tone: "warning" },
};

export const OFFER_PHASE_LABELS: Record<OfferPhase, string> = {
  draft: "Drafts",
  scheduled: "Scheduled",
  active: "Active now",
  expired: "Ended",
  unpublished: "Unpublished",
};

export function OfferPhaseBadge({ phase }: { phase: OfferPhase }) {
  return <Badge tone={OFFER_META[phase].tone}>{OFFER_META[phase].label}</Badge>;
}

const ENQ_TONE: Record<EnquiryStatus, Tone> = { open: "warning", responded: "success", closed: "neutral" };

export function EnquiryStatusBadge({ status }: { status: EnquiryStatus }) {
  return (
    <Badge tone={ENQ_TONE[status]} icon={<MessageCircle className={ic} aria-hidden />}>
      {ENQUIRY_STATUS_LABELS[status]}
    </Badge>
  );
}
