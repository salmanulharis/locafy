import { readLocalMedia } from "@/modules/media/storage";

/** Serves files written by the local storage driver. Production should use object storage/CDN. */
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  let file: Buffer | null = null;
  try {
    file = await readLocalMedia(path.join("/"));
  } catch {
    file = null;
  }
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file), {
    headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
  });
}
