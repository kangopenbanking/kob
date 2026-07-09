// Kang Agent — PDF ingestion (admin-only, cloud-native)
// Accepts multipart/form-data with a .pdf file, extracts text using unpdf
// (pure JS PDF parser, Deno-compatible, no worker setup), chunks the text,
// embeds via OpenRouter, and stores rows in public.kang_financial_knowledge.

import { extractText, getDocumentProxy } from "npm:unpdf@0.12.1";
import {
  corsHeaders,
  json,
  requireAdmin,
  getEmbeddingKey,
  chunkText,
  embedAndInsertChunks,
} from "../_shared/kang-ingest.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "method_not_allowed" }, 405);

  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return auth.response;
    const embeddingKey = getEmbeddingKey();
    if (!embeddingKey) return json({ success: false, error: "embedding_key_missing" }, 500);

    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return json({ success: false, error: "expected_multipart_form_data" }, 400);
    }

    const form = await req.formData();
    const file = form.get("file");
    const topic = (form.get("topic") as string | null)?.trim() || "general";
    if (!(file instanceof File)) return json({ success: false, error: "file_missing" }, 400);
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      return json({ success: false, error: "not_a_pdf" }, 400);
    }
    // Reject files > 25MB to stay within edge-function memory/time budget
    if (file.size > 25 * 1024 * 1024) {
      return json({ success: false, error: "file_too_large", limit_mb: 25 }, 413);
    }

    const buf = new Uint8Array(await file.arrayBuffer());

    let extracted = "";
    let pageCount = 0;
    try {
      const pdf = await getDocumentProxy(buf);
      pageCount = pdf.numPages ?? 0;
      const res = await extractText(pdf, { mergePages: true });
      extracted = Array.isArray(res.text) ? res.text.join("\n") : String(res.text ?? "");
    } catch (err) {
      return json(
        {
          success: false,
          error: "pdf_parse_failed",
          message: (err as Error).message,
        },
        422,
      );
    }

    if (!extracted.trim()) {
      return json(
        {
          success: false,
          error: "no_text_in_pdf",
          message:
            "No extractable text found. The PDF may be a scanned image and requires OCR.",
          page_count: pageCount,
        },
        422,
      );
    }

    const chunks = chunkText(extracted, 1000, 100);
    if (chunks.length === 0) {
      return json({ success: false, error: "no_content_after_chunking" }, 422);
    }
    // Cap runaway ingests
    const MAX_CHUNKS = 300;
    const capped = chunks.slice(0, MAX_CHUNKS);

    const { inserted, errors } = await embedAndInsertChunks(
      auth.admin,
      embeddingKey,
      capped,
      { source: file.name, topic, kind: "pdf", pages: pageCount },
    );

    return json({
      success: inserted > 0,
      source: file.name,
      topic,
      page_count: pageCount,
      total_chunks: chunks.length,
      processed_chunks: capped.length,
      inserted_count: inserted,
      errors,
      truncated: chunks.length > MAX_CHUNKS,
    });
  } catch (err) {
    console.error("kang-ingest-pdf error", err);
    return json(
      { success: false, error: "internal_error", message: (err as Error).message },
      500,
    );
  }
});
