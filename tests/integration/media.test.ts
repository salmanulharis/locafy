import { existsSync } from "node:fs";
import { readFile, rm, rmdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { mediaAssets, productImages, shops } from "@/db/schema";
import { MAX_UPLOAD_BYTES, uploadShopImage } from "@/modules/media/service";
import { addMember } from "@/modules/shops/service";
import { countRows, createActiveShop, createAdmin, createListingFor, createUser, ctxOf, expectCode, truncateAll } from "./helpers";

const MEDIA_ROOT = path.join(process.cwd(), "storage", "media");
const createdShopDirs = new Set<string>();

beforeEach(truncateAll);
afterAll(async () => {
  for (const id of createdShopDirs) {
    await rm(path.join(MEDIA_ROOT, "shops", id), { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
  // Remove the directories this suite created if nothing else lives there.
  for (const dir of [path.join(MEDIA_ROOT, "shops"), MEDIA_ROOT, path.dirname(MEDIA_ROOT)]) await rmdir(dir).catch(() => {});
});

async function png(width = 64, height = 48) {
  return sharp({ create: { width, height, channels: 3, background: { r: 200, g: 30, b: 30 } } }).png().toBuffer();
}

async function setup() {
  const admin = await createAdmin();
  const owner = await createUser();
  const s = await createActiveShop(owner, admin);
  createdShopDirs.add(s.shop.id);
  return { owner, ...s };
}

describe("uploadShopImage", () => {
  it("accepts a real PNG, re-encodes to WebP and stores it locally", async () => {
    const { owner, shop } = await setup();
    const file = new File([await png()], "logo.png", { type: "image/png" });
    const asset = await uploadShopImage(ctxOf(owner), shop.id, file, "logo");
    expect(asset.mimeType).toBe("image/webp");
    expect(asset.storageKey).toMatch(new RegExp(`^shops/${shop.id}/logo-.+\\.webp$`));
    expect(asset.url).toBe(`/media/${asset.storageKey}`);
    expect(asset.bytes).toBeGreaterThan(0);
    expect([asset.width, asset.height]).toEqual([64, 48]); // smaller than 512: never enlarged

    const onDisk = path.join(MEDIA_ROOT, asset.storageKey);
    expect(existsSync(onDisk)).toBe(true);
    // Read into memory first: sharp(path) keeps a file handle open on Windows.
    const meta = await sharp(await readFile(onDisk)).metadata();
    expect(meta.format).toBe("webp");

    const s = await getDb().query.shops.findFirst({ where: eq(shops.id, shop.id) });
    expect(s?.logoUrl).toBe(asset.url);
  });

  it("large logos are cropped to 512x512", async () => {
    const { owner, shop } = await setup();
    const asset = await uploadShopImage(ctxOf(owner), shop.id, new File([await png(1200, 800)], "logo.png"), "logo");
    expect([asset.width, asset.height]).toEqual([512, 512]);
  });

  it("attaches listing photos", async () => {
    const { owner, shop, branchId } = await setup();
    const l = await createListingFor(owner, shop.id, branchId, { name: "Galaxy A55", brand: "Samsung", model: "Galaxy A55" });
    const asset = await uploadShopImage(ctxOf(owner), shop.id, new File([await png(2000, 1000)], "p.png"), "listing", l.id);
    expect([asset.width, asset.height]).toEqual([1600, 800]);
    const imgs = await getDb().select().from(productImages).where(eq(productImages.listingId, l.id));
    expect(imgs.map((i) => i.mediaAssetId)).toEqual([asset.id]);
  });

  it("rejects a text file disguised as .png (UNSUPPORTED_MEDIA)", async () => {
    const { owner, shop } = await setup();
    const fake = new File(["this is definitely not an image, just text"], "photo.png", { type: "image/png" });
    await expectCode(uploadShopImage(ctxOf(owner), shop.id, fake, "cover"), "UNSUPPORTED_MEDIA");
    // A PNG header followed by garbage is caught by the decoder.
    const truncated = new File([Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("garbage-garbage")])], "x.png");
    await expectCode(uploadShopImage(ctxOf(owner), shop.id, truncated, "cover"), "UNSUPPORTED_MEDIA");
    expect(await countRows("media_assets")).toBe(0);
  });

  it("rejects files over 5 MB (PAYLOAD_TOO_LARGE) and empty files", async () => {
    const { owner, shop } = await setup();
    const big = new File([new Uint8Array(MAX_UPLOAD_BYTES + 1)], "big.png", { type: "image/png" });
    await expectCode(uploadShopImage(ctxOf(owner), shop.id, big, "cover"), "PAYLOAD_TOO_LARGE");
    await expectCode(uploadShopImage(ctxOf(owner), shop.id, new File([], "empty.png"), "cover"), "VALIDATION_ERROR");
    await expectCode(uploadShopImage(ctxOf(owner), shop.id, null, "cover"), "VALIDATION_ERROR");
  });

  it("enforces the storage limit before writing", async () => {
    const { owner, shop } = await setup();
    await getDb().insert(mediaAssets).values({ shopId: shop.id, uploadedBy: owner.id, storageKey: "shops/seed/full.webp", url: "/media/shops/seed/full.webp", mimeType: "image/webp", bytes: 50 * 1024 * 1024 });
    await expectCode(uploadShopImage(ctxOf(owner), shop.id, new File([await png()], "a.png"), "cover"), "LIMIT_EXCEEDED");
    expect(existsSync(path.join(MEDIA_ROOT, "shops", shop.id))).toBe(false);
  });

  it("staff cannot upload; other shops' listings cannot be targeted", async () => {
    const { owner, shop } = await setup();
    const staff = await createUser({ email: "media-staff@example.test" });
    await addMember(ctxOf(owner), shop.id, { email: "media-staff@example.test", role: "staff" });
    await expectCode(uploadShopImage(ctxOf(staff), shop.id, new File([await png()], "a.png"), "logo"), "FORBIDDEN");

    const admin2 = await createAdmin();
    const owner2 = await createUser();
    const other = await createActiveShop(owner2, admin2);
    createdShopDirs.add(other.shop.id);
    const foreign = await createListingFor(owner2, other.shop.id, other.branchId, { name: "Pixel 8", brand: "Google", model: "Pixel 8" });
    await expectCode(uploadShopImage(ctxOf(owner), shop.id, new File([await png()], "a.png"), "listing", foreign.id), "NOT_FOUND");
  });
});
