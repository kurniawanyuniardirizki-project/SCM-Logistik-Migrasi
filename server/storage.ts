
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = "scm-files";

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Supabase Storage environment variables are missing");
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

function normalizeKey(key: string): string {
  return key.replace(/^\/+/, "");
}

function appendHashSuffix(key: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const dot = key.lastIndexOf(".");
  return dot === -1
    ? `${key}_${hash}`
    : `${key.slice(0, dot)}_${hash}${key.slice(dot)}`;
}

async function createSignedUrl(key: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(key, 3600);

  if (error) throw error;
  return data.signedUrl;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(key, data, {
      contentType,
      upsert: false,
    });

  if (error) throw error;

  return { key, url: await createSignedUrl(key) };
}

export async function storageGet(
  relKey: string,
): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: await createSignedUrl(key) };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  return createSignedUrl(normalizeKey(relKey));
}
