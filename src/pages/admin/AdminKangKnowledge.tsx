// Admin — Kang Agent Knowledge Base ingestion
// Three tabs: Upload PDF · Scrape Website · Paste Text
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  FileUp,
  Globe,
  ClipboardPaste,
  Loader2,
  AlertTriangle,
  ArrowLeft,
} from "lucide-react";

const SUPABASE_URL = "https://wdzkzeahdtxlynetndqw.supabase.co";

type IngestResult = {
  success: boolean;
  error?: string;
  message?: string;
  source?: string;
  topic?: string;
  inserted_count?: number;
  total_chunks?: number;
  processed_chunks?: number;
  page_count?: number;
  truncated?: boolean;
  errors?: string[];
};

async function callIngest(
  fn: "kang-ingest-pdf" | "kang-ingest-url" | "kang-ingest-document",
  init: RequestInit,
): Promise<IngestResult> {
  const { data: session } = await supabase.auth.getSession();
  const token = session?.session?.access_token;
  if (!token) throw new Error("Not authenticated");
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
    ...init,
    headers,
  });
  const body = (await res.json().catch(() => ({}))) as IngestResult;
  if (!res.ok || body.success === false) {
    const err = new Error(body.message || body.error || `HTTP ${res.status}`);
    (err as Error & { payload?: IngestResult }).payload = body;
    throw err;
  }
  return body;
}

export default function AdminKangKnowledge() {
  const navigate = useNavigate();
  const [checkingRole, setCheckingRole] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes?.user?.id;
      if (!uid) {
        navigate("/login");
        return;
      }
      const { data: isAdmin } = await supabase.rpc("has_role", {
        _user_id: uid,
        _role: "admin",
      });
      if (!isAdmin) {
        toast.error("Admin access required");
        navigate("/");
        return;
      }
      setCheckingRole(false);
    })();
  }, [navigate]);

  if (checkingRole) return null;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/admin/kang-agent")}
            className="mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Kang Agent
          </Button>
          <h1 className="text-2xl font-semibold">Kang Knowledge Base</h1>
          <p className="text-sm text-muted-foreground">
            Ingest documents, web pages, and raw text into the retrieval index.
          </p>
        </div>
      </div>

      <Card className="p-6">
        <Tabs defaultValue="pdf" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="pdf">
              <FileUp className="h-4 w-4 mr-2" /> Upload PDF
            </TabsTrigger>
            <TabsTrigger value="url">
              <Globe className="h-4 w-4 mr-2" /> Scrape Website
            </TabsTrigger>
            <TabsTrigger value="text">
              <ClipboardPaste className="h-4 w-4 mr-2" /> Paste Text
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pdf">
            <PdfIngestPanel />
          </TabsContent>
          <TabsContent value="url">
            <UrlIngestPanel />
          </TabsContent>
          <TabsContent value="text">
            <TextIngestPanel />
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}

/* ---------------- PDF ---------------- */

function PdfIngestPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [topic, setTopic] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const pickFile = useCallback((f: File | null) => {
    setWarning(null);
    if (!f) return setFile(null);
    if (!f.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Only .pdf files are supported");
      return;
    }
    if (f.size > 25 * 1024 * 1024) {
      toast.error("PDF is larger than 25 MB. Please split it first.");
      return;
    }
    setFile(f);
  }, []);

  const onSubmit = async () => {
    if (!file) return toast.error("Choose a PDF first");
    setLoading(true);
    setWarning(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (topic.trim()) fd.append("topic", topic.trim());
      const res = await callIngest("kang-ingest-pdf", { method: "POST", body: fd });
      toast.success(
        `Ingested ${res.inserted_count ?? 0} chunks from ${res.source ?? file.name}`,
      );
      if (res.truncated) {
        setWarning(
          `Only the first ${res.processed_chunks} of ${res.total_chunks} chunks were processed. Split the document into smaller files for full coverage.`,
        );
      }
      setFile(null);
      setTopic("");
      if (inputRef.current) inputRef.current.value = "";
    } catch (err) {
      const payload = (err as Error & { payload?: IngestResult }).payload;
      if (payload?.error === "no_text_in_pdf") {
        setWarning(
          "No text found in this PDF. It might be a scanned image — run it through OCR before uploading.",
        );
      } else {
        toast.error((err as Error).message || "Ingestion failed");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>PDF file</Label>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            pickFile(e.dataTransfer.files?.[0] ?? null);
          }}
          onClick={() => inputRef.current?.click()}
          className={`mt-2 border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            dragOver ? "border-primary bg-primary/5" : "border-muted"
          }`}
        >
          <FileUp className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          {file ? (
            <p className="text-sm">
              <span className="font-medium">{file.name}</span> ·{" "}
              {(file.size / 1024).toFixed(0)} KB
            </p>
          ) : (
            <>
              <p className="text-sm font-medium">
                Drag & drop a PDF, or click to browse
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Max 25 MB · text-based PDFs only
              </p>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="pdf-topic">Topic (optional)</Label>
        <Input
          id="pdf-topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g. taxation, monetary_policy"
        />
      </div>

      {warning && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Notice</AlertTitle>
          <AlertDescription>{warning}</AlertDescription>
        </Alert>
      )}

      <Button onClick={onSubmit} disabled={!file || loading}>
        {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
        Upload & Process
      </Button>
    </div>
  );
}

/* ---------------- URL ---------------- */

function UrlIngestPanel() {
  const [url, setUrl] = useState("");
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    const trimmed = url.trim();
    if (!/^https?:\/\//i.test(trimmed)) {
      return toast.error("Enter a valid http(s) URL");
    }
    setLoading(true);
    try {
      const res = await callIngest("kang-ingest-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed, topic: topic.trim() || undefined }),
      });
      toast.success(
        `Ingested ${res.inserted_count ?? 0} chunks from ${res.source ?? trimmed}`,
      );
      setUrl("");
      setTopic("");
    } catch (err) {
      toast.error((err as Error).message || "Scrape failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="url-input">URL</Label>
        <Input
          id="url-input"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/article"
        />
      </div>
      <div>
        <Label htmlFor="url-topic">Topic (optional)</Label>
        <Input
          id="url-topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g. regulations"
        />
      </div>
      <Button onClick={onSubmit} disabled={!url || loading}>
        {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
        Scrape & Process
      </Button>
    </div>
  );
}

/* ---------------- TEXT ---------------- */

function TextIngestPanel() {
  const [content, setContent] = useState("");
  const [source, setSource] = useState("");
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!content.trim()) return toast.error("Paste some text first");
    setLoading(true);
    try {
      const res = await callIngest("kang-ingest-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          metadata: {
            source: source.trim() || "manual",
            topic: topic.trim() || "general",
            kind: "text",
          },
        }),
      });
      toast.success(`Ingested ${res.inserted_count ?? 0} chunks`);
      setContent("");
      setSource("");
      setTopic("");
    } catch (err) {
      toast.error((err as Error).message || "Ingestion failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="text-content">Content</Label>
        <Textarea
          id="text-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Paste knowledge base content here..."
          rows={10}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="text-source">Source</Label>
          <Input
            id="text-source"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="e.g. internal-memo-2025"
          />
        </div>
        <div>
          <Label htmlFor="text-topic">Topic</Label>
          <Input
            id="text-topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. loans"
          />
        </div>
      </div>
      <Button onClick={onSubmit} disabled={!content || loading}>
        {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
        Ingest
      </Button>
    </div>
  );
}
