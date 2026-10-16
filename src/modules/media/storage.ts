import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";

/**
 * Storage driver boundary. `local` is for development and single-node
 * deployments; `supabase` targets Supabase Storage (public bucket) and is
 * implemented against its REST API but requires credentials to be verified.
 */
export interface StorageDriver {
  put(key: string, body: Buffer, contentType: string): Promise<{ url: string }>;
  remove(key: string): Promise<void>;
}

const LOCAL_ROOT = path.join(process.cwd(), "storage", "media");

/** Prevent path traversal: keys are generated server-side but are re-checked here. */
export function safeKey(key: string): string {
  if (!/^[a-z0-9][a-z0-9/_-]*\.(webp|jpg|png)$/i.test(key) || key.includes("..")) throw new Error("Invalid storage key");
  return key;
}

const localDriver: StorageDriver = {
  async put(key, body) {
    const file = path.join(LOCAL_ROOT, safeKey(key));
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
    return { url: `/media/${key}` };
  },
  async remove(key) {
    await unlink(path.join(LOCAL_ROOT, safeKey(key))).catch(() => {});
  },
};

export async function readLocalMedia(key: string): Promise<Buffer | null> {
  try {
    return await readFile(path.join(LOCAL_ROOT, safeKey(key)));
  } catch {
    return null;
  }
}

function supabaseDriver(): StorageDriver {
  const e = env();
  if (!e.SUPABASE_URL || !e.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("STORAGE_DRIVER=supabase requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  }
  const base = `${e.SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object`;
  const headers = { Authorization: `Bearer ${e.SUPABASE_SERVICE_ROLE_KEY}`, apikey: e.SUPABASE_SERVICE_ROLE_KEY };
  return {
    async put(key, body, contentType) {
      const res = await fetch(`${base}/${e.SUPABASE_STORAGE_BUCKET}/${safeKey(key)}`, {
        method: "POST",
        headers: { ...headers, "Content-Type": contentType, "x-upsert": "false", "Cache-Control": "max-age=31536000" },
        body: new Uint8Array(body),
      });
      if (!res.ok) throw new Error(`Storage upload failed (${res.status})`);
      return { url: `${base}/public/${e.SUPABASE_STORAGE_BUCKET}/${key}` };
    },
    async remove(key) {
      await fetch(`${base}/${e.SUPABASE_STORAGE_BUCKET}/${safeKey(key)}`, { method: "DELETE", headers });
    },
  };
}

export function storage(): StorageDriver {
  return env().STORAGE_DRIVER === "supabase" ? supabaseDriver() : localDriver;
}
