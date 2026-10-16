import { randomBytes } from "node:crypto";
import sharp, { type OutputInfo } from "sharp";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { mediaAssets, shops } from "@/db/schema";
import { AppError, errors } from "@/lib/errors";
import { requireShopPermission } from "@/modules/access/permissions";
import type { Ctx } from "@/modules/auth/context";
import { attachListingImage, loadListing } from "@/modules/listings/service";
import { enforceRateLimit } from "@/modules/platform/rate-limit";
import { assertWithinLimit } from "@/modules/subscriptions/entitlements";
import { storage } from "./storage";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_DIMENSION = 1600;

/** Detect image type from magic bytes; the client-supplied MIME type is not trusted. */
export function sniffImageType(buf: Uint8Array): "jpeg" | "png" | "webp" | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) {
    return "webp";
  }
  return null;
}

export type UploadPurpose = "logo" | "cover" | "listing";

/**
 * Validate, normalise and store an uploaded image for a shop. Images are
 * re-encoded to WebP (metadata such as GPS EXIF is stripped) and resized.
 * Works the same for web form uploads and future mobile multipart uploads.
 */
export async function uploadShopImage(ctx: Ctx, shopId: string, file: File | Blob | null, purpose: UploadPurpose, listingId?: string) {
  if (!file || typeof (file as Blob).arrayBuffer !== "function") throw errors.validation("Choose an image to upload.");
  if (file.size === 0) throw errors.validation("The selected file is empty.");
  if (file.size > MAX_UPLOAD_BYTES) throw new AppError("PAYLOAD_TOO_LARGE", "Images must be 5 MB or smaller.");

  const { user } = await requireShopPermission(ctx, shopId, "media.upload");
  if (listingId) {
    const { listing } = await loadListing(ctx, listingId, "listing.manage");
    if (listing.shopId !== shopId) throw errors.notFound("Listing");
  }
  await enforceRateLimit("upload", user.id);

  const input = Buffer.from(await file.arrayBuffer());
  if (!sniffImageType(input)) throw new AppError("UNSUPPORTED_MEDIA", "Upload a JPEG, PNG or WebP image.");

  let output: Buffer;
  let info: OutputInfo;
  try {
    const result = await sharp(input, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize({
        width: purpose === "logo" ? 512 : MAX_DIMENSION,
        height: purpose === "logo" ? 512 : MAX_DIMENSION,
        fit: purpose === "logo" ? "cover" : "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    output = result.data;
    info = result.info;
  } catch {
    throw new AppError("UNSUPPORTED_MEDIA", "This image could not be processed. Try a different file.");
  }

  const db = getDb();
  return db.transaction(async (tx) => {
    await assertWithinLimit(tx, shopId, "maxStorageMb", { incrementBytes: output.length });
    const key = `shops/${shopId}/${purpose}-${Date.now().toString(36)}-${randomBytes(6).toString("hex")}.webp`;
    const { url } = await storage().put(key, output, "image/webp");
    const [asset] = await tx
      .insert(mediaAssets)
      .values({ shopId, uploadedBy: user.id, storageKey: key, url, mimeType: "image/webp", bytes: output.length, width: info.width, height: info.height })
      .returning();
    if (purpose === "logo" || purpose === "cover") {
      await tx
        .update(shops)
        .set(purpose === "logo" ? { logoUrl: url, updatedAt: new Date() } : { coverUrl: url, updatedAt: new Date() })
        .where(eq(shops.id, shopId));
    } else if (listingId) {
      await attachListingImage(tx, listingId, { url, mediaAssetId: asset!.id });
    }
    return asset!;
  });
}
