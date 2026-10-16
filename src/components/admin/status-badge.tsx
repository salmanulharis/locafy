import { Badge, type Tone } from "@/components/ui/primitives";

const TONES: Record<string, Tone> = {
  active: "success",
  published: "success",
  actioned: "success",
  verified: "success",
  trialing: "info",
  pending: "warning",
  draft: "neutral",
  open: "warning",
  past_due: "warning",
  unpublished: "neutral",
  archived: "neutral",
  discontinued: "neutral",
  dismissed: "neutral",
  canceled: "neutral",
  inactive: "neutral",
  merged: "info",
  hidden: "warning",
  rejected: "danger",
  suspended: "danger",
  restricted: "danger",
  removed: "danger",
  deleted: "danger",
  deletion_requested: "warning",
  super_admin: "accent",
  admin: "primary",
  user: "neutral",
};

const LABELS: Record<string, string> = {
  past_due: "Past due",
  super_admin: "Super admin",
  deletion_requested: "Deletion requested",
};

export function statusLabel(status: string): string {
  return LABELS[status] ?? status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ");
}

/** Status conveyed as text (colour is only a secondary cue). */
export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return <Badge tone={TONES[status] ?? "neutral"}>{label ?? statusLabel(status)}</Badge>;
}
