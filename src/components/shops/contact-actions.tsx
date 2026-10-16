"use client";

import { MessageCircle, Navigation, Phone, Share2 } from "lucide-react";
import { trackEventAction } from "@/app/(public)/actions";
import { buttonClass } from "@/components/ui/button";
import { useToast } from "@/components/feedback/toaster";
import { directionsUrl } from "@/modules/geo/format";
import { cn } from "@/lib/cn";

function savedOrigin(): { lat: number; lng: number } | null {
  try {
    const raw = document.cookie.split("; ").find((c) => c.startsWith("locafy_loc="));
    if (!raw) return null;
    const v = JSON.parse(decodeURIComponent(raw.slice("locafy_loc=".length)));
    return typeof v.lat === "number" && typeof v.lng === "number" ? { lat: v.lat, lng: v.lng } : null;
  } catch {
    return null;
  }
}

function tel(phone: string) {
  return phone.replace(/[^\d+]/g, "");
}

function whatsappUrl(phone: string, text?: string) {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

/**
 * Call / WhatsApp / directions actions. Directions open an external routing
 * provider; Locafy never computes routes or travel times itself.
 */
export function ContactActions({
  shopId,
  listingId,
  phone,
  whatsapp,
  lat,
  lng,
  shopName,
  productName,
  compact,
  className,
}: {
  shopId: string;
  listingId?: string;
  phone: string | null;
  whatsapp: string | null;
  lat: number | null;
  lng: number | null;
  shopName: string;
  productName?: string;
  compact?: boolean;
  className?: string;
}) {
  const size = compact ? "sm" : "md";
  const track = (type: "contact_click" | "direction_request") => void trackEventAction({ type, shopId, listingId });
  const msg = productName ? `Hi ${shopName}, is "${productName}" available? (found on Locafy)` : undefined;

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {phone && (
        <a href={`tel:${tel(phone)}`} onClick={() => track("contact_click")} className={buttonClass("primary", size)}>
          <Phone className="size-4" aria-hidden /> Call
        </a>
      )}
      {whatsapp && (
        <a href={whatsappUrl(whatsapp, msg)} target="_blank" rel="noopener noreferrer" onClick={() => track("contact_click")} className={buttonClass("outline", size)}>
          <MessageCircle className="size-4" aria-hidden /> WhatsApp
        </a>
      )}
      {lat != null && lng != null && (
        <a
          href={directionsUrl({ lat, lng })}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            // Add the customer's selected location as the route origin, if any.
            e.currentTarget.href = directionsUrl({ lat, lng }, savedOrigin());
            track("direction_request");
          }}
          className={buttonClass("outline", size)}
        >
          <Navigation className="size-4" aria-hidden /> Directions
        </a>
      )}
    </div>
  );
}

export function ShareButton({ title, className }: { title: string; className?: string }) {
  const toast = useToast();
  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast({ tone: "success", message: "Link copied" });
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast({ tone: "error", message: "Couldn't share this page." });
    }
  }
  return (
    <button type="button" onClick={share} className={cn(buttonClass("outline", "md"), className)}>
      <Share2 className="size-4" aria-hidden /> Share
    </button>
  );
}
