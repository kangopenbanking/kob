// Kang Agent — URL ingestion (admin-only, cloud-native)
// Fetches an HTTPS URL, strips HTML via cheerio, chunks the text,
// embeds via OpenRouter, and stores rows in public.kang_financial_knowledge.

import * as cheerio from "npm:cheerio@1.0.0";
import {
  corsHeaders,
  json,
  requireAdmin,
  getEmbeddingKey,
  chunkText,
  embedAndInsertChunks,
} from "../_shared/kang-ingest.ts";

function isSafeUrl(raw: string): URL | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    // Block obvious internal targets
    const host = u.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host === "0.0.0.0" ||
      host.startsWith("127.") ||
      host.startsWith("10.") ||
      host.startsWith("192.168.") ||
      /^169\.254\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    ) {
      return null;
    }
    return u;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "method_not_allowed" }, 405);

  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return auth.response;
    const embeddingKey = getEmbeddingKey();
    if (!embeddingKey) return json({ success: false, error: "embedding_key_missing" }, 500);

    const body = await req.json().catch(() => ({}));
    const rawUrl = typeof body?.url === "string" ? body.url.trim() : "";
    const topic = (typeof body?.topic === "string" ? body.topic : "").trim() || "general";
    const target = isSafeUrl(rawUrl);
    if (!target) return json({ success: false, error: "invalid_url" }, 400);

    // Fetch with timeout & size guard
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    let html = "";
    try {
      const res = await fetch(target.toString(), {
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; KangIngestBot/1.0; +https://kangopenbanking.com)",
          Accept: "text/html,application/xhtml+xml",
        },
      });
      if (!res.ok) {
        return json(
          { success: false, error: "fetch_failed", status: res.status },
          422,
        );
      }
      const ctype = res.headers.get("content-type") ?? "";
      if (!ctype.includes("text/html") && !ctype.includes("xml") && !ctype.includes("text/plain")) {
        return json(
          { success: false, error: "unsupported_content_type", content_type: ctype },
          415,
        );
      }
      const buf = await res.arrayBuffer();
      if (buf.byteLength > 10 * 1024 * 1024) {
        return json({ success: false, error: "page_too_large", limit_mb: 10 }, 413);
      }
      html = new TextDecoder().decode(buf);
    } catch (err) {
      return json(
        { success: false, error: "fetch_error", message: (err as Error).message },
        502,
      );
    } finally {
      clearTimeout(timeout);
    }

    // Strip HTML → text via cheerio
    const $ = cheerio.load(html);
    $("script, style, noscript, iframe, svg, nav, footer, header, form").remove();
    const title = $("title").first().text().trim() || target.hostname;
    const bodyText = $("body").text() || $.root().text();
    const cleaned = bodyText.replace(/\s+/g, " ").trim();

    if (!cleaned) {
      return json(
        { success: false, error: "no_text_on_page", message: "No readable text extracted." },
        422,
      );
    }

    const chunks = chunkText(cleaned, 1000, 100);
    const MAX_CHUNKS = 300;
    const capped = chunks.slice(0, MAX_CHUNKS);

    const { inserted, errors } = await embedAndInsertChunks(
      auth.admin,
      embeddingKey,
      capped,
      { source: target.toString(), topic, kind: "url", title },
    );

    return json({
      success: inserted > 0,
      source: target.toString(),
      title,
      topic,
      total_chunks: chunks.length,
      processed_chunks: capped.length,
      inserted_count: inserted,
      errors,
      truncated: chunks.length > MAX_CHUNKS,
    });
  } catch (err) {
    console.error("kang-ingest-url error", err);
    return json(
      { success: false, error: "internal_error", message: (err as Error).message },
      500,
    );
  }
});
