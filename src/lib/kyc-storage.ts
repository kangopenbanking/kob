import { supabase } from "@/integrations/supabase/client";

const BUCKET = "kyc-documents";
const SIGNED_URL_EXPIRY = 3600; // 1 hour

/**
 * Upload a KYC document and return the storage path (NOT a public URL).
 */
export async function uploadKycDocument(
  file: File,
  userId: string,
  folder: "kyc" | "kyb",
  documentType: string
): Promise<string> {
  const ext = file.name.split(".").pop() || "bin";
  const path = `${userId}/${folder}/${documentType}_${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
  if (error) throw error;

  return path; // Return just the path, not a URL
}

/**
 * Given a stored path (or legacy full URL), return a signed URL for viewing.
 * Handles both new paths and legacy public URLs gracefully.
 */
export async function getKycDocumentUrl(storedValue: string | null): Promise<string | null> {
  if (!storedValue) return null;

  // If it's a full URL (legacy or external), extract the path and try a signed URL first
  let path = storedValue;
  const isFullUrl = storedValue.startsWith("http://") || storedValue.startsWith("https://");
  const publicPrefix = `/storage/v1/object/public/${BUCKET}/`;
  const idx = storedValue.indexOf(publicPrefix);
  if (idx !== -1) {
    path = storedValue.substring(idx + publicPrefix.length);
  }

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRY);

  if (data?.signedUrl) {
    return data.signedUrl;
  }

  // If signed URL failed but we have a legacy full URL, fall back to it directly
  // (it may still be accessible as a public URL from the original project)
  if (isFullUrl) {
    console.warn("Signed URL failed, falling back to original URL for", path, error);
    return storedValue;
  }

  console.warn("Failed to create signed URL for", path, error);
  return null;
}

/**
 * Resolve multiple document URLs at once for a KYC record.
 */
export async function resolveKycDocumentUrls(record: {
  document_front_url?: string | null;
  document_back_url?: string | null;
  selfie_url?: string | null;
}): Promise<{
  document_front_url: string | null;
  document_back_url: string | null;
  selfie_url: string | null;
}> {
  const [front, back, selfie] = await Promise.all([
    getKycDocumentUrl(record.document_front_url ?? null),
    getKycDocumentUrl(record.document_back_url ?? null),
    getKycDocumentUrl(record.selfie_url ?? null),
  ]);

  return { document_front_url: front, document_back_url: back, selfie_url: selfie };
}
