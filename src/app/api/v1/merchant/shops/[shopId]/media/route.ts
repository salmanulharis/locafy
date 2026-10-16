import { z } from "zod";
import { AppError, errors } from "@/lib/errors";
import { api, ok } from "@/lib/http";
import { parseInput } from "@/lib/validation";
import { MAX_UPLOAD_BYTES, uploadShopImage } from "@/modules/media/service";
import { created, pathId } from "../../../../_lib/helpers";

const fieldsSchema = z.object({
  purpose: z.enum(["logo", "cover", "listing"], { message: "purpose must be logo, cover or listing." }),
  listingId: z.string().uuid("Invalid listing id.").optional(),
});

/** Multipart framing overhead allowed on top of the image size limit. */
const MULTIPART_SLACK_BYTES = 64 * 1024;

/**
 * POST /api/v1/merchant/shops/{shopId}/media — multipart/form-data with
 * "file" (JPEG/PNG/WebP, max 5 MB), "purpose" (logo|cover|listing) and, for listing photos, "listingId".
 * Images are re-encoded to WebP with metadata (including GPS EXIF) stripped.
 */
export const POST = api<{ shopId: string }>(async ({ req, ctx, params }) => {
  const shopId = pathId(params.shopId, "Shop");
  const type = req.headers.get("content-type") ?? "";
  if (!type.toLowerCase().startsWith("multipart/form-data")) {
    throw new AppError("UNSUPPORTED_MEDIA", "Send the image as multipart/form-data with a 'file' field.");
  }
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > MAX_UPLOAD_BYTES + MULTIPART_SLACK_BYTES) throw new AppError("PAYLOAD_TOO_LARGE", "Images must be 5 MB or smaller.");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw errors.validation("Could not read the multipart form.");
  }
  const rawListingId = form.get("listingId");
  const fields = parseInput(fieldsSchema, {
    purpose: form.get("purpose") ?? undefined,
    listingId: typeof rawListingId === "string" && rawListingId ? rawListingId : undefined,
  });
  if (fields.purpose === "listing" && !fields.listingId) {
    throw errors.validation("listingId is required for listing photos.", { listingId: ["Required for listing photos."] });
  }
  const file = form.get("file");
  const asset = await uploadShopImage(ctx, shopId, file instanceof Blob ? file : null, fields.purpose, fields.listingId);
  return ok(
    { id: asset.id, url: asset.url, mimeType: asset.mimeType, bytes: asset.bytes, width: asset.width, height: asset.height, purpose: fields.purpose },
    undefined,
    created,
  );
});
