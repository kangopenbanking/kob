import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, X, Send, Sparkles, Loader2, User, Trash2, Download, Code2, ShieldCheck, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type Msg = { role: "user" | "assistant"; content: string };

const STARTERS = [
  "How do I accept MTN Mobile Money payments?",
  "Generate a webhook signature verification example",
  "What's the OAuth + PKCE flow for AISP consents?",
  "How do I issue a payout via Visa Direct?",
];

const ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/developer-ai-assistant`;

// Detect API endpoint mentions like `POST /v1/payments` or `/v1/accounts/{id}/balances`
const ENDPOINT_REGEX = /(GET|POST|PUT|PATCH|DELETE)?\s*`?(\/v1\/[a-zA-Z0-9_\-{}\/]+)`?/g;

function linkifyEndpoints(text: string): string {
  return text.replace(ENDPOINT_REGEX, (match, method, path) => {
    const m = method ? `${method.trim()} ` : "";
    const url = `/developer/api-explorer#${encodeURIComponent(path)}`;
    return `[\`${m}${path}\`](${url})`;
  });
}

export function DeveloperAIAssistant() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [devToken, setDevToken] = useState<string>(() => localStorage.getItem("kob_devbot_token") || "");
  const [showAuth, setShowAuth] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      };
      if (devToken) headers["x-developer-token"] = devToken;

      const resp = await fetch(ENDPOINT, {
        method: "POST",
        headers,
        body: JSON.stringify({ messages: next }),
        signal: controller.signal,
      });

      if (!resp.ok || !resp.body) {
        const errJson = await resp.json().catch(() => ({ error: "Request failed" }));
        setMessages((m) => [...m, { role: "assistant", content: `**Error (${resp.status}):** ${errJson.error || resp.statusText}` }]);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistant = "";
      let appended = false;
      let done = false;

      while (!done) {
        const { value, done: d } = await reader.read();
        if (d) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") { done = true; break; }
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistant += delta;
              if (!appended) {
                appended = true;
                setMessages((m) => [...m, { role: "assistant", content: assistant }]);
              } else {
                setMessages((m) => m.map((msg, i) => (i === m.length - 1 ? { ...msg, content: assistant } : msg)));
              }
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        setMessages((m) => [...m, { role: "assistant", content: `**Network error:** ${e?.message || "Unknown"}. Please retry — the AI service may be warming up.` }]);
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const stop = () => abortRef.current?.abort();
  const clear = () => setMessages([]);

  const exportTranscript = () => {
    if (messages.length === 0) {
      toast({ title: "Nothing to export", description: "Start a conversation first." });
      return;
    }
    const md = [
      `# Kang AI Agent — Conversation transcript`,
      `Exported ${new Date().toISOString()}`,
      ``,
      ...messages.map((m) => `### ${m.role === "user" ? "You" : "Kang AI Agent"}\n\n${m.content}\n`),
    ].join("\n");
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kang-ai-agent-transcript-${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Transcript exported", description: "Markdown file downloaded." });
  };

  const askSnippet = (lang: "cURL" | "Node.js" | "Python") => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content;
    const ctx = lastUser ? ` for: "${lastUser}"` : "";
    send(`Generate a complete, working **${lang}** SDK snippet${ctx}. Include auth header, idempotency key, and proper error handling. Use the production backend base URL.`);
  };

  const askWebhookHelper = () => {
    send("Generate a complete webhook signature verification example for Kang Open Banking. Show: (1) sample event payload (e.g. payment.completed), (2) sample headers including X-KOB-Signature, X-KOB-Timestamp, (3) HMAC-SHA256 verification code in Node.js, and (4) how to detect replay attacks.");
  };

  const saveDevToken = () => {
    localStorage.setItem("kob_devbot_token", devToken);
    setShowAuth(false);
    toast({ title: devToken ? "Developer token saved" : "Developer token cleared", description: devToken ? "Higher rate limits enabled." : "Reverted to anonymous limits." });
  };

  const renderedMessages = useMemo(() => messages.map((m) => ({ ...m, rendered: m.role === "assistant" ? linkifyEndpoints(m.content) : m.content })), [messages]);

  return (
    <>
      {/* Floating launcher */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open Kang AI Agent"
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-1 ring-border transition-all hover:scale-105 hover:shadow-xl"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {open && (
        <div className="fixed bottom-6 right-6 z-50 flex h-[680px] w-[420px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-primary/10 ring-1 ring-primary/20">
                <img src="/kob-logo.png" alt="Kang" className="h-7 w-7 object-contain" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight">Kang AI Agent</p>
                <p className="text-[10px] text-muted-foreground">Senior API integration engineer</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowAuth((v) => !v)} aria-label="Developer auth" title="Developer login (optional)">
                <ShieldCheck className={cn("h-4 w-4", devToken && "text-emerald-500")} />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={exportTranscript} aria-label="Export transcript" title="Export transcript (Markdown)" disabled={messages.length === 0}>
                <Download className="h-4 w-4" />
              </Button>
              {messages.length > 0 && (
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={clear} aria-label="Clear conversation" title="Clear">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOpen(false)} aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Optional developer login */}
          {showAuth && (
            <div className="border-b border-border bg-muted/30 px-4 py-3 space-y-2">
              <p className="text-[11px] font-medium">Optional developer token (higher rate limits)</p>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={devToken}
                  onChange={(e) => setDevToken(e.target.value)}
                  placeholder="Paste any developer token"
                  className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                />
                <Button size="sm" variant="outline" onClick={saveDevToken}>Save</Button>
              </div>
              <p className="text-[10px] text-muted-foreground">Anonymous: 15 req/min · With token: 60 req/min. Stored locally only.</p>
            </div>
          )}

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto bg-muted/20 px-4 py-4">
            {messages.length === 0 && (
              <div className="space-y-4">
                <div className="rounded-xl border border-border bg-card p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <p className="text-sm font-medium">Welcome, developer</p>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    I'm a senior API engineer here to help you integrate Kang Open Banking. Ask about endpoints,
                    authentication, webhooks, mobile money, or paste an error and I'll debug it.
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Try asking</p>
                  {STARTERS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="block w-full rounded-lg border border-border bg-card px-3 py-2 text-left text-xs transition-colors hover:border-primary/40 hover:bg-accent"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-3">
              {renderedMessages.map((m, i) => (
                <div key={i} className={cn("flex gap-2", m.role === "user" ? "justify-end" : "justify-start")}>
                  {m.role === "assistant" && (
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 ring-1 ring-primary/20">
                      <img src="/kob-logo.png" alt="Kang" className="h-5 w-5 object-contain" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm",
                      m.role === "user"
                        ? "rounded-br-sm bg-primary text-primary-foreground"
                        : "rounded-bl-sm border border-border bg-card text-foreground",
                    )}
                  >
                    {m.role === "assistant" ? (
                      <div className="prose prose-sm max-w-none dark:prose-invert prose-pre:my-2 prose-pre:rounded-lg prose-pre:bg-muted prose-pre:text-foreground prose-pre:text-xs prose-code:text-xs prose-p:my-1.5 prose-headings:my-2 prose-a:text-primary prose-a:no-underline hover:prose-a:underline">
                        <ReactMarkdown
                          components={{
                            a: ({ href, children, ...props }) => (
                              <a href={href} target={href?.startsWith("/") ? "_self" : "_blank"} rel="noreferrer" {...props}>
                                {children}
                                {href && !href.startsWith("/") && <ExternalLink className="ml-0.5 inline h-3 w-3" />}
                              </a>
                            ),
                          }}
                        >
                          {m.rendered}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    )}
                  </div>
                  {m.role === "user" && (
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted ring-1 ring-border">
                      <User className="h-3.5 w-3.5" />
                    </div>
                  )}
                </div>
              ))}
              {loading && messages[messages.length - 1]?.role === "user" && (
                <div className="flex gap-2">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 ring-1 ring-primary/20">
                    <img src="/kob-logo.png" alt="Kang" className="h-5 w-5 object-contain" />
                  </div>
                  <div className="rounded-2xl rounded-bl-sm border border-border bg-card px-3.5 py-2.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action toolbar */}
          {messages.length > 0 && !loading && (
            <div className="flex flex-wrap gap-1.5 border-t border-border bg-card/50 px-3 py-2">
              <Button size="sm" variant="outline" className="h-7 gap-1 text-[10px]" onClick={() => askSnippet("cURL")}>
                <Code2 className="h-3 w-3" /> cURL
              </Button>
              <Button size="sm" variant="outline" className="h-7 gap-1 text-[10px]" onClick={() => askSnippet("Node.js")}>
                <Code2 className="h-3 w-3" /> Node.js
              </Button>
              <Button size="sm" variant="outline" className="h-7 gap-1 text-[10px]" onClick={() => askSnippet("Python")}>
                <Code2 className="h-3 w-3" /> Python
              </Button>
              <Button size="sm" variant="outline" className="h-7 gap-1 text-[10px]" onClick={askWebhookHelper}>
                <ShieldCheck className="h-3 w-3" /> Webhook signature
              </Button>
            </div>
          )}

          {/* Input */}
          <div className="border-t border-border bg-card p-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="flex items-end gap-2"
            >
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                placeholder="Ask about endpoints, auth, webhooks…"
                rows={1}
                className="min-h-[40px] max-h-32 resize-none text-sm"
                disabled={loading}
              />
              {loading ? (
                <Button type="button" size="icon" variant="outline" onClick={stop} aria-label="Stop">
                  <X className="h-4 w-4" />
                </Button>
              ) : (
                <Button type="submit" size="icon" disabled={!input.trim()} aria-label="Send">
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </form>
            <div className="mt-2 flex items-center justify-between px-1">
              <Badge variant="outline" className="gap-1 text-[9px] font-normal">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Kang AI Agent
              </Badge>
              <p className="text-[9px] text-muted-foreground">Always verify code in the API Explorer</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
