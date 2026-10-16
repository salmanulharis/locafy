"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { upsertReviewAction } from "@/app/(public)/actions";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { FieldError, TextAreaField } from "@/components/forms/fields";
import { cn } from "@/lib/cn";

export function ReviewForm({ targetType, targetId, existing }: { targetType: "shop" | "product"; targetId: string; existing: { rating: number; body: string | null } | null }) {
  const [rating, setRating] = useState(existing?.rating ?? 0);
  return (
    <ActionForm action={upsertReviewAction}>
      <input type="hidden" name="targetType" value={targetType} />
      <input type="hidden" name="targetId" value={targetId} />
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">{existing ? "Update your rating" : "Your rating"}</legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <label key={i} className="cursor-pointer rounded-md p-1.5 hover:bg-surface-2 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring">
              <input type="radio" name="rating" value={i} checked={rating === i} onChange={() => setRating(i)} className="sr-only" />
              <Star className={cn("size-7", i <= rating ? "fill-accent text-accent" : "text-border-strong")} aria-hidden />
              <span className="sr-only">
                {i} star{i > 1 ? "s" : ""}
              </span>
            </label>
          ))}
        </div>
        <FieldError name="rating" />
      </fieldset>
      <TextAreaField name="body" label="Comment" optional rows={3} defaultValue={existing?.body ?? ""} placeholder="What was good or could be better?" />
      <div>
        <SubmitButton>{existing ? "Update review" : "Post review"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
