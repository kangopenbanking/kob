/**
 * KYB document payload builder.
 *
 * The gateway-merchant-kyb edge function's `validateKybDocuments` requires
 * every document entry to include `{ type, url, mime_type, size_bytes }`.
 * We rebuild this on submit by reading each uploaded object's Storage
 * metadata, since the upload UI only retains the storage path.
 *
 * Exposed as a standalone module so it can be unit tested without
 * mounting the entire MerchantKYB page.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type KybDocEntry = {
  type: string;
  url: string;
  mime_type: string;
  size_bytes: number;
};

export type KybBuildAuditEvent =
  | { event: "doc_metadata_ok"; type: string; mime_type: string; size_bytes: number }
  | { event: "doc_metadata_missing"; type: string; reason: string }
  | { event: "doc_metadata_fallback_mime"; type: string; guessed: string };

export function guessMime(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  return "application/octet-stream";
}

export interface BuildDocsOptions {
  bucket?: string;
  /** Optional sink for structured audit events (one per document). */
  audit?: (e: KybBuildAuditEvent) => void;
}

/**
 * Build the `documents[]` payload from a mapping of document type → storage path.
 * Throws if any entry's size_bytes cannot be resolved — the backend will
 * reject zero-size entries and we want to surface a clear error to the user
 * before the network round-trip.
 */
export async function buildDocumentsPayload(
  supabase: Pick<SupabaseClient, "storage">,
  docs: Record<string, string>,
  options: BuildDocsOptions = {},
): Promise<KybDocEntry[]> {
  const bucket = options.bucket ?? "kyc-documents";
  const audit = options.audit ?? (() => {});

  const entries = Object.entries(docs).filter(([, path]) => !!path);
  const out: KybDocEntry[] = [];

  for (const [type, path] of entries) {
    let size = 0;
    let mime = guessMime(path);
    let mimeFromMeta = false;

    try {
      const folder = path.includes("/") ? path.substring(0, path.lastIndexOf("/")) : "";
      const name = path.split("/").pop()!;
      const { data: list, error } = await supabase.storage
        .from(bucket)
        .list(folder, { search: name, limit: 1 });
      if (error) throw error;
      const meta = list?.[0]?.metadata as { size?: number; mimetype?: string } | undefined;
      if (meta?.size) size = Number(meta.size);
      if (meta?.mimetype) {
        mime = String(meta.mimetype);
        mimeFromMeta = true;
      }
    } catch (err) {
      audit({ event: "doc_metadata_missing", type, reason: (err as Error).message ?? "list_failed" });
    }

    if (!mimeFromMeta) {
      audit({ event: "doc_metadata_fallback_mime", type, guessed: mime });
    }

    if (!size) {
      audit({ event: "doc_metadata_missing", type, reason: "size_unknown" });
      throw new Error(`Could not read file metadata for ${type}. Please re-upload it.`);
    }

    audit({ event: "doc_metadata_ok", type, mime_type: mime, size_bytes: size });
    out.push({ type, url: path, mime_type: mime, size_bytes: size });
  }

  return out;
}
