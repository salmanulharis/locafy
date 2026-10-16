"use client";

import { useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { SubmitButton, type FormAction } from "@/components/forms/action-form";
import { MerchantForm } from "./merchant-form";
import { FieldError } from "@/components/forms/fields";
import { Label } from "@/components/ui/form";
import { cn } from "@/lib/cn";

/** Server Actions accept ~1 MB bodies by default; larger photos are downscaled in the browser first. */
const TARGET_BYTES = 900 * 1024;
const MAX_EDGE = 1600;

async function shrink(file: File): Promise<File> {
  if (file.size <= TARGET_BYTES || !/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const q of [0.85, 0.75, 0.6]) {
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", q));
      if (blob && (blob.size <= TARGET_BYTES || q === 0.6)) {
        return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
      }
    }
  } catch {
    // Fall through: the server validates and reports a clear error.
  }
  return file;
}

type Props = {
  action: FormAction;
  removeAction?: FormAction;
  currentUrl?: string | null;
  label: string;
  hint?: string;
  shape?: "square" | "wide";
  planHref?: string;
  submitLabel?: string;
  disabled?: boolean;
};

export function ImageUpload({ action, removeAction, currentUrl, label, hint, shape = "square", planHref, submitLabel = "Upload", disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const id = `upload-${label.toLowerCase().replace(/\W+/g, "-")}`;
  const shown = preview ?? currentUrl ?? null;

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    const small = await shrink(f);
    if (small !== f && inputRef.current) {
      const dt = new DataTransfer();
      dt.items.add(small);
      inputRef.current.files = dt.files;
    }
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(small);
    });
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <Label htmlFor={id}>{label}</Label>
      <div className={cn("flex gap-4", shape === "wide" ? "flex-col" : "items-center")}>
        <div
          className={cn(
            "relative shrink-0 overflow-hidden rounded-xl border border-border bg-surface-2",
            shape === "square" ? "size-24" : "aspect-[3/1] w-full max-w-xl",
          )}
        >
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element -- local preview / own media
            <img src={shown} alt={`${label} preview`} className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center text-subtle">
              <ImagePlus className="size-6" aria-hidden />
              <span className="sr-only">No image yet</span>
            </div>
          )}
        </div>
        <MerchantForm
          action={action}
          resetOnSuccess
          onSuccess={() => {
            setPreview(null);
          }}
          className="min-w-0 flex-1 gap-2"
          planHref={planHref}
        >
          <input
            ref={inputRef}
            id={id}
            type="file"
            name="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={onPick}
            disabled={disabled}
            className="block w-full text-sm text-muted file:mr-3 file:h-11 file:cursor-pointer file:rounded-lg file:border file:border-border-strong file:bg-surface file:px-4 file:text-sm file:font-medium file:text-fg hover:file:bg-surface-2"
            aria-describedby={`${id}-hint`}
          />
          <FieldError name="file" />
          <p id={`${id}-hint`} className="text-xs text-muted">
            {hint ?? "JPEG, PNG or WebP. Large photos are resized automatically; location data is removed."}
          </p>
          <div className="flex flex-wrap gap-2">
            <SubmitButton size="md" pendingLabel="Uploading…">
              {busy ? "Preparing…" : submitLabel}
            </SubmitButton>
          </div>
        </MerchantForm>
      </div>
      {removeAction && currentUrl && (
        <MerchantForm action={removeAction} className="items-start">
          <SubmitButton variant="ghost" size="sm">
            <Trash2 className="size-4" aria-hidden /> Remove {label.toLowerCase()}
          </SubmitButton>
        </MerchantForm>
      )}
    </div>
  );
}
