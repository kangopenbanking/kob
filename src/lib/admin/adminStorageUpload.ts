/**
 * Client-side helper that routes admin-gated storage uploads through the
 * `admin-storage-upload` edge function. Bypasses the storage.objects
 * `has_role(auth.uid(),'admin')` RLS check that intermittently produced
 * "new row violates row-level security policy" errors on hero banner and
 * other admin-only uploads when the caller's JWT role claim lagged.
 */
import { supabase } from "@/integrations/supabase/client";

export type AdminBucket = "homepage-hero" | "auth-branding" | "nav-icons";

async function fileToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  // Chunked conversion avoids stack overflow on large videos.
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + CHUNK)) as unknown as number[],
    );
  }
  return btoa(bin);
}

export interface AdminUploadResult {
  path: string;
  publicUrl: string;
}

export async function adminStorageUpload(params: {
  bucket: AdminBucket;
  path: string;
  file: Blob;
  contentType?: string;
  upsert?: boolean;
}): Promise<AdminUploadResult> {
  const contentType =
    params.contentType || (params.file as File).type || "application/octet-stream";
  const data_base64 = await fileToBase64(params.file);
  const { data, error } = await supabase.functions.invoke("admin-storage-upload", {
    body: {
      bucket: params.bucket,
      path: params.path,
      content_type: contentType,
      data_base64,
      upsert: params.upsert !== false,
    },
  });
  const payload = data as { ok?: boolean; path?: string; public_url?: string; error?: string } | null;
  if (error || !payload?.ok) {
    const msg = payload?.error || error?.message || "Upload failed";
    throw new Error(msg);
  }
  return { path: payload.path!, publicUrl: payload.public_url! };
}
