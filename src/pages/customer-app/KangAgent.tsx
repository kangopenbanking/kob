// Kang Agent — ChatGPT-style mobile chat UI
// Wires the /app/kang-agent route to the three edge functions built in Step 3.
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Send, Plus, Menu, Trash2, Sparkles, Loader2, Crown, MessageSquare,
  Wallet, AlertTriangle, ArrowUpRight, Receipt, Copy, ThumbsUp, ThumbsDown, Pencil, Check,
} from "lucide-react";
import { toast } from "sonner";
import { KangNotificationBell } from "./KangNotificationBell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import kangLogo from "@/assets/kang-mascot/logo.png.asset.json";
import attentionMascot from "@/assets/kang-mascot/attention.png.asset.json";
import { KangMarkdown } from "./KangMarkdown";

type Role = "user" | "assistant";
type Message = { id: string; role: Role; content: string; created_at: string };
type SessionRow = {
  id: string;
  title: string;
  updated_at: string;
  last_message?: { content: string; created_at: string; role: string } | null;
};
type Subscription = {
  status: "trial" | "active" | "suspended";
  questions_asked_count: number;
  free_questions_limit: number;
  current_period_end?: string | null;
  last_payment_status?: string | null;
};

const STORAGE_KEY = "kang-agent:session-id";

const SUGGESTIONS = [
  "How can I improve my credit score?",
  "Help me build a monthly budget.",
  "What's a good savings strategy?",
  "Explain my recent spending trends.",
];

export default function KangAgent() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));
  const [sub, setSub] = useState<Subscription | null>(null);
  const [creditScore, setCreditScore] = useState<number | null>(null);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [monthlyFee, setMonthlyFee] = useState<number>(2000);
  const [currency, setCurrency] = useState<string>("XAF");
  const [paying, setPaying] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, "up" | "down">>({});
  const [workingStatus, setWorkingStatus] = useState<string>("Thinking");
  const [showPreview, setShowPreview] = useState(false);



  useEffect(() => {
    if (!sending) return;
    const phases = [
      "Thinking",
      "Searching knowledge base",
      "Analysing your finances",
      "Composing a response",
      "Almost ready",
    ];
    let i = 0;
    setWorkingStatus(phases[0]);
    const t = setInterval(() => {
      i = (i + 1) % phases.length;
      setWorkingStatus(phases[i]);
    }, 1800);
    return () => clearInterval(t);
  }, [sending]);

  async function copyMessage(id: string, content: string) {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
    } catch {
      toast.error("Copy failed");
    }
  }

  function reactToMessage(id: string, kind: "up" | "down") {
    setFeedback((f) => {
      const next = { ...f };
      if (next[id] === kind) delete next[id];
      else next[id] = kind;
      return next;
    });
  }

  function editMessage(content: string) {
    setInput(content);
    inputRef.current?.focus();
  }
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const trialUsed = sub?.questions_asked_count ?? 0;
  const trialLimit = sub?.free_questions_limit ?? 5;
  const isTrial = sub?.status === "trial";
  const isSuspended = sub?.status === "suspended";
  const isActive = sub?.status === "active";
  const limitReached = isTrial && trialUsed >= trialLimit;
  const canPay = walletBalance >= monthlyFee;
  const blocked = limitReached || isSuspended;

  const fmt = (n: number) => `${Math.round(n).toLocaleString()} ${currency}`;

  async function loadProfileAndSub() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const db = supabase as any;
    const [{ data: profile }, { data: subRow }, { data: cfg }, { data: accounts }] = await Promise.all([
      db.from("profiles").select("credit_score").eq("id", user.id).maybeSingle(),
      db.from("kang_subscriptions")
        .select("status, questions_asked_count, free_questions_limit, current_period_end, last_payment_status")
        .eq("user_id", user.id).maybeSingle(),
      db.from("kang_config").select("value").eq("key", "monthly_fee").maybeSingle(),
      db.from("accounts").select("id").eq("user_id", user.id).eq("is_active", true).limit(1),
    ]);
    if (profile) setCreditScore((profile as any).credit_score ?? 500);
    setSub((subRow as any) ?? { status: "trial", questions_asked_count: 0, free_questions_limit: 5 });
    if (cfg?.value) {
      setMonthlyFee(Number((cfg.value as any).amount ?? 2000));
      setCurrency(String((cfg.value as any).currency ?? "XAF"));
    }
    const accountId = accounts?.[0]?.id;
    if (accountId) {
      const { data: bal } = await db
        .from("account_balances")
        .select("amount")
        .eq("account_id", accountId)
        .eq("balance_type", "ClosingAvailable")
        .order("balance_datetime", { ascending: false })
        .limit(1)
        .maybeSingle();
      setWalletBalance(Number((bal as any)?.amount ?? 0));
    } else {
      setWalletBalance(0);
    }
    // Unread notifications count (kang-sync-state also returns this; use direct read for speed)
    const { count } = await db
      .from("kang_notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id).eq("is_read", false);
    setUnreadNotifs(count ?? 0);
  }

  async function payFromWallet() {
    if (paying) return;
    setPaying(true);
    try {
      const { data, error } = await supabase.functions.invoke("kang-wallet-payment", { body: {} });
      if (error) throw error;
      const body: any = data;
      if (body?.success) {
        toast.success(body.message ?? "Subscription activated.");
        setShowPaywall(false);
        await loadProfileAndSub();
      } else if (body?.error === "insufficient_funds") {
        toast.error(`Insufficient funds. You need ${fmt(body.required)} but have ${fmt(body.current_balance)}.`);
        await loadProfileAndSub();
      } else {
        toast.error(body?.message ?? "Payment could not be processed.");
        await loadProfileAndSub();
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Network error. Please try again.");
    } finally {
      setPaying(false);
    }
  }

  function goTopUp() {
    setShowPaywall(false);
    navigate("/app/wallet");
  }

  async function loadSessions() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/kang-chat-history?page=1&limit=20`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${session.access_token}` } });
      const body = await res.json();
      if (body?.success && Array.isArray(body.sessions)) setSessions(body.sessions);
    } catch {
      // silent
    }
  }

  async function loadSessionMessages(id: string) {
    setLoadingMessages(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/kang-session-messages?session_id=${id}&page=1&limit=100`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${session?.access_token}` } });
      const body = await res.json();
      if (body.success) setMessages(body.messages ?? []);
      else toast.error(body.message ?? "Could not load conversation.");
    } finally {
      setLoadingMessages(false);
    }
  }

  useEffect(() => {
    loadProfileAndSub();
    loadSessions();
  }, []);

  useEffect(() => {
    if (sessionId) {
      localStorage.setItem(STORAGE_KEY, sessionId);
      loadSessionMessages(sessionId);
    }
  }, [sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  useEffect(() => { inputRef.current?.focus(); }, [sessionId, sending]);

  // Auto-resize textarea
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  }, [input]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || sending) return;
    if (blocked) { setShowPaywall(true); return; }

    setSending(true);
    const userMsg: Message = {
      id: `tmp-user-${Date.now()}`, role: "user", content: text, created_at: new Date().toISOString(),
    };
    const assistantId = `tmp-asst-${Date.now()}`;
    setMessages((m) => [...m, userMsg]);
    setInput("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated.");

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/kang-chat-handler`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          Accept: "text/event-stream",
        },
        body: JSON.stringify({ message: text, session_id: sessionId }),
      });

      // Non-stream JSON error (quota, auth, upstream failure)
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("text/event-stream")) {
        const body = await res.json().catch(() => ({}));
        if (body?.error === "limit_reached") {
          setShowPaywall(true);
          setSub((s) => s ? { ...s, questions_asked_count: s.free_questions_limit } : s);
        } else {
          toast.error(body?.message ?? "Could not send message.");
        }
        setMessages((m) => m.filter((x) => x.id !== userMsg.id));
        return;
      }
      if (!res.body) throw new Error("No response stream.");

      // Insert placeholder assistant bubble that will fill in as tokens arrive.
      setMessages((m) => [
        ...m,
        { id: assistantId, role: "assistant", content: "", created_at: new Date().toISOString() },
      ]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let receivedMeta = false;

      const flushEvent = (raw: string) => {
        const lines = raw.split("\n");
        let event = "message";
        let dataLine = "";
        for (const l of lines) {
          if (l.startsWith("event:")) event = l.slice(6).trim();
          else if (l.startsWith("data:")) dataLine += l.slice(5).trim();
        }
        if (!dataLine) return;
        try {
          const payload = JSON.parse(dataLine);
          if (event === "meta") {
            receivedMeta = true;
            if (payload.session_id && payload.session_id !== sessionId) {
              setSessionId(payload.session_id);
            }
            setSub((s) => s ? {
              ...s,
              questions_asked_count: payload.questions_asked_count ?? s.questions_asked_count,
              free_questions_limit: payload.free_questions_limit ?? s.free_questions_limit,
              status: payload.status ?? s.status,
            } : s);
          } else if (event === "error") {
            toast.error(payload.message ?? "Streaming error.");
          } else if (payload.delta) {
            setMessages((m) =>
              m.map((x) => x.id === assistantId ? { ...x, content: x.content + payload.delta } : x),
            );
            requestAnimationFrame(() =>
              bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }),
            );
          }
        } catch {
          // ignore
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const raw = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          flushEvent(raw);
        }
      }
      if (buffer.trim()) flushEvent(buffer);
      if (!receivedMeta) {
        // Backend closed without meta — refresh state defensively.
        await loadProfileAndSub();
      }
      loadSessions();
    } catch (e: any) {
      toast.error(e?.message ?? "Network error. Please try again.");
      setMessages((m) => m.filter((x) => x.id !== userMsg.id && x.id !== assistantId));
    } finally {
      setSending(false);
    }
  }

  function newChat() {
    setSessionId(null);
    localStorage.removeItem(STORAGE_KEY);
    setMessages([]);
    setSidebarOpen(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function deleteSession(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    const { error } = await (supabase as any).from("kang_chat_sessions").delete().eq("id", id);
    if (error) { toast.error("Could not delete conversation."); return; }
    setSessions((s) => s.filter((x) => x.id !== id));
    if (sessionId === id) newChat();
    toast.success("Conversation removed.");
  }

  const empty = messages.length === 0 && !loadingMessages;

  return (
    <div
      className="relative flex flex-col bg-gradient-to-b from-background via-background to-muted/30"
      style={{ height: "calc(100dvh - 5rem)" }}
    >
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border/50 bg-background/70 backdrop-blur-xl px-3 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setSidebarOpen(true)} aria-label="Open conversations">
            <Menu className="h-4.5 w-4.5" />
          </Button>
          <div className="flex items-center gap-2 min-w-0">
            <img src={kangLogo.url} alt="Kang Agent" className="h-8 w-8 object-contain shrink-0 drop-shadow-sm" />
            <div className="min-w-0">
              <h1 className="text-[13px] font-semibold leading-tight truncate">Kang Agent</h1>
              
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {isActive ? (
            <Badge className="gap-1 bg-primary text-primary-foreground text-[10px] h-6 px-1.5">
              <Crown className="h-2.5 w-2.5" /> Active
            </Badge>
          ) : isSuspended ? (
            <Badge variant="destructive" className="gap-1 text-[10px] h-6 px-1.5"><AlertTriangle className="h-2.5 w-2.5" /> Suspended</Badge>
          ) : limitReached ? (
            <button
              onClick={() => setShowPaywall(true)}
              className="inline-flex items-center gap-1 rounded-md text-[10px] h-6 px-2 font-medium text-white bg-[#7c3aed] hover:bg-[#6d28d9] transition-colors"
              aria-label="Upgrade"
            >
              <Crown className="h-2.5 w-2.5" /> Upgrade
            </button>
          ) : (
            <Badge variant="secondary" className="text-[10px] h-6 px-1.5">Trial {trialUsed}/{trialLimit}</Badge>
          )}
          <KangNotificationBell unreadCount={unreadNotifs} onChanged={loadProfileAndSub} />
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={newChat} aria-label="New chat">
            <Plus className="h-4.5 w-4.5" />
          </Button>
        </div>
      </header>

      {isTrial && (
        <div className="px-4 pt-2 pb-1">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
            <span>Free questions</span>
            <span>{trialUsed} of {trialLimit} used</span>
          </div>
          <Progress value={(trialUsed / trialLimit) * 100} className="h-1" />
        </div>
      )}

      {/* Chat scroll area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto flex min-h-full max-w-2xl flex-col px-3 py-3">
          {empty ? (
            <div className="flex flex-1 flex-col items-center justify-center text-center py-8">
              <div className="relative flex h-40 w-40 items-center justify-center">
                {/* Pulse wave rings — travel across the page */}
                <span className="kang-pulse-ring" style={{ animationDelay: "0s" }} />
                <span className="kang-pulse-ring" style={{ animationDelay: "2.5s" }} />
                <span className="kang-pulse-ring" style={{ animationDelay: "5s" }} />
                <span className="kang-pulse-ring" style={{ animationDelay: "7.5s" }} />
                {/* Orbiting particles */}
                <span className="kang-orbit">
                  <span className="kang-particle" style={{ background: "hsl(265 70% 60%)" }} />
                </span>
                <span className="kang-orbit" style={{ animationDelay: "-4s", animationDuration: "14s" }}>
                  <span className="kang-particle" style={{ background: "hsl(210 90% 55%)" }} />
                </span>
                <span className="kang-orbit" style={{ animationDelay: "-8s", animationDuration: "18s" }}>
                  <span className="kang-particle" style={{ background: "hsl(95 65% 55%)" }} />
                </span>
                {/* Ambient glow */}
                <div className="absolute inset-6 rounded-full bg-primary/25 blur-2xl animate-pulse" />
                <motion.img
                  src={kangLogo.url}
                  alt=""
                  className="relative h-24 w-24 object-contain drop-shadow-[0_8px_24px_hsl(var(--primary)/0.35)]"
                  animate={{ y: [0, -6, 0], rotate: [0, 3, -3, 0] }}
                  transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                />
              </div>
              <h2 className="mt-5 text-lg font-semibold tracking-tight">Hi, I'm Kang Agent</h2>
              <p className="mt-1.5 max-w-xs text-[12px] leading-relaxed text-muted-foreground">
                Your AI financial advisor. Ask me about budgeting, saving, credit, or business planning.
              </p>
              <div className="mt-6 grid w-full max-w-sm grid-cols-1 gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => { setInput(s); setTimeout(() => inputRef.current?.focus(), 0); }}
                    className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur px-3.5 py-2.5 text-left text-[12px] text-foreground/80 hover:bg-card hover:border-primary/40 transition-all"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1" />
              {loadingMessages && (
                <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
              )}
              <div className="space-y-3">
                <AnimatePresence initial={false}>
                  {messages.map((m) => {
                    const isUser = m.role === "user";
                    const isStreaming = m.id.startsWith("tmp-asst-");
                    return (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex gap-2 ${isUser ? "justify-end" : "justify-start"}`}
                    >
                      {!isUser && (
                        <img src={kangLogo.url} alt="" className="h-7 w-7 object-contain shrink-0 mt-0.5" />
                      )}
                      <div className={`flex flex-col max-w-[82%] ${isUser ? "items-end" : "items-start"}`}>
                        <div
                          className={`rounded-2xl px-3.5 py-2 text-[13px] leading-[1.55] break-words ${
                            isUser
                              ? "bg-primary text-primary-foreground rounded-br-md shadow-sm"
                              : "bg-card border border-border/60 text-foreground rounded-bl-md"
                          }`}
                        >
                          <KangMarkdown content={m.content} variant={isUser ? "onPrimary" : "default"} />
                        </div>
                        {!isStreaming && m.content && (
                          <div className={`mt-1 flex items-center gap-0.5 ${isUser ? "justify-end" : "justify-start"}`}>
                            <button
                              type="button"
                              onClick={() => copyMessage(m.id, m.content)}
                              aria-label="Copy"
                              className="h-6 w-6 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            >
                              {copiedId === m.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                            </button>
                            {isUser ? (
                              <button
                                type="button"
                                onClick={() => editMessage(m.content)}
                                aria-label="Edit"
                                className="h-6 w-6 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => reactToMessage(m.id, "up")}
                                  aria-label="Good response"
                                  aria-pressed={feedback[m.id] === "up"}
                                  className={`h-6 w-6 inline-flex items-center justify-center rounded-md hover:bg-muted transition-colors ${
                                    feedback[m.id] === "up" ? "text-primary" : "text-muted-foreground hover:text-foreground"
                                  }`}
                                >
                                  <ThumbsUp className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => reactToMessage(m.id, "down")}
                                  aria-label="Poor response"
                                  aria-pressed={feedback[m.id] === "down"}
                                  className={`h-6 w-6 inline-flex items-center justify-center rounded-md hover:bg-muted transition-colors ${
                                    feedback[m.id] === "down" ? "text-destructive" : "text-muted-foreground hover:text-foreground"
                                  }`}
                                >
                                  <ThumbsDown className="h-3 w-3" />
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                    );
                  })}
                </AnimatePresence>

                {sending && !messages.some((m) => m.role === "assistant" && m.id.startsWith("tmp-asst-")) && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-end gap-2"
                  >
                    <img src={kangLogo.url} alt="" className="h-7 w-7 object-contain shrink-0" />
                    <div className="relative rounded-2xl rounded-bl-md bg-card border border-border/60 px-3.5 py-2 shadow-sm">
                      {/* Speech tail */}
                      <span
                        aria-hidden
                        className="absolute -left-1.5 bottom-1.5 h-3 w-3 rotate-45 bg-card border-l border-b border-border/60"
                      />
                      <div className="flex items-center gap-2 relative">
                        <div className="flex gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary/70 animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="h-1.5 w-1.5 rounded-full bg-primary/70 animate-bounce" style={{ animationDelay: "120ms" }} />
                          <span className="h-1.5 w-1.5 rounded-full bg-primary/70 animate-bounce" style={{ animationDelay: "240ms" }} />
                        </div>
                        <AnimatePresence mode="wait">
                          <motion.span
                            key={workingStatus}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.25 }}
                            className="text-[12px] text-muted-foreground"
                          >
                            {workingStatus}…
                          </motion.span>
                        </AnimatePresence>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
              <div ref={bottomRef} />
            </>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="border-t border-border/50 bg-background/80 backdrop-blur-xl px-3 py-2.5">
        {blocked ? (
          <div className="mx-auto max-w-2xl">
            <button
              type="button"
              onClick={() => setShowPaywall(true)}
              className="w-full flex items-center justify-between rounded-2xl border border-primary/30 bg-primary/5 px-3.5 py-2.5 text-left hover:bg-primary/10 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <img src={attentionMascot.url} alt="" className="h-9 w-9 object-contain" />
                <div>
                  <p className="text-[12px] font-semibold">
                    {isSuspended ? "Subscription suspended" : "Free questions used"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {canPay ? `Deduct ${fmt(monthlyFee)} from your wallet to continue` : "Top up your wallet to reactivate"}
                  </p>
                </div>
              </div>
              <ArrowUpRight className="h-4 w-4 text-primary" />
            </button>
          </div>
        ) : (
          <div className="mx-auto max-w-2xl space-y-2">
            {/* Preview toggle */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowPreview((v) => !v)}
                aria-pressed={showPreview}
                aria-label={showPreview ? "Hide preview" : "Show preview"}
                className={`h-7 px-2.5 inline-flex items-center gap-1 rounded-full text-[11px] font-medium border transition-colors ${
                  showPreview
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {showPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                Preview
              </button>
            </div>

            {/* Live preview */}
            {showPreview && input.trim() && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-primary/25 bg-primary/[0.04] px-3.5 py-2.5"
              >
                <p className="mb-1 text-[10px] uppercase tracking-wide text-primary/80 font-semibold">Preview</p>
                <div className="text-[13px] leading-[1.55] text-foreground">
                  <KangMarkdown content={input} />
                </div>
              </motion.div>
            )}

            <div className="relative flex items-end gap-2 rounded-3xl border border-border/60 bg-card/80 backdrop-blur px-3 py-2 shadow-sm focus-within:border-primary/50 transition-colors">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value.slice(0, 4000))}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="Ask Kang Agent…"
                rows={1}
                className="flex-1 resize-none bg-transparent text-[13px] leading-[1.5] outline-none placeholder:text-muted-foreground/70 py-1.5 max-h-[140px]"
                aria-label="Message Kang Agent"
                disabled={sending}
              />
              <Button
                onClick={sendMessage}
                disabled={sending || !input.trim()}
                size="icon"
                className="h-8 w-8 rounded-full shrink-0"
                aria-label="Send message"
              >
                {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </Button>
            </div>
            <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
              Kang Agent may make mistakes. Verify important financial decisions.
            </p>
          </div>
        )}
      </div>

      {/* Sidebar */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="p-0 w-[86%] sm:w-96">
          <SheetHeader className="px-4 py-4 pr-12 border-b border-border/60">
            <SheetTitle className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <img src={kangLogo.url} alt="" className="h-6 w-6 object-contain" />
                Conversations
              </span>
              <Button size="sm" variant="outline" onClick={newChat} className="mr-6"><Plus className="h-4 w-4 mr-1" /> New</Button>
            </SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-[calc(100dvh-72px)]">
            <div className="p-2 space-y-1">
              <button
                onClick={() => { setSidebarOpen(false); navigate("/app/kang-agent/billing"); }}
                className="w-full flex items-center gap-2 rounded-xl px-3 py-2.5 text-left hover:bg-muted transition-colors"
              >
                <Receipt className="h-4 w-4 text-muted-foreground" />
                <span className="text-[13px] font-medium">Billing History</span>
              </button>
              <div className="my-1 h-px bg-border/60" />
              {sessions.length === 0 && (
                <div className="text-center text-sm text-muted-foreground py-10 px-4">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  No conversations yet.
                </div>
              )}
              {sessions.map((s) => (
                <div
                  key={s.id}
                  onClick={() => { setSessionId(s.id); setSidebarOpen(false); }}
                  className={`group flex items-start gap-2 rounded-xl px-3 py-2.5 cursor-pointer hover:bg-muted transition-colors ${
                    sessionId === s.id ? "bg-muted" : ""
                  }`}
                >
                  <MessageSquare className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium truncate">{s.title || "New Chat"}</p>
                    {s.last_message && (
                      <p className="text-[11px] text-muted-foreground truncate">{s.last_message.content}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(s.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={(e) => deleteSession(s.id, e)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10"
                    aria-label="Delete conversation"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Paywall */}
      <Dialog open={showPaywall} onOpenChange={setShowPaywall}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex justify-center mb-2">
              <img src={kangLogo.url} alt="" className="h-20 w-20 object-contain" />
            </div>
            <DialogTitle className="text-center">Subscription Renewal Required</DialogTitle>
            <DialogDescription className="text-center">
              Kang Agent Premium is billed monthly from your Kang wallet.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="flex items-center justify-between rounded-xl border border-border/60 p-3">
              <span className="text-sm text-muted-foreground">Monthly fee</span>
              <span className="text-sm font-semibold">{fmt(monthlyFee)}</span>
            </div>
            <div className={`flex items-center justify-between rounded-xl border p-3 ${canPay ? "border-border/60" : "border-destructive/40 bg-destructive/5"}`}>
              <span className="text-sm text-muted-foreground flex items-center gap-2">
                <Wallet className="h-4 w-4" /> Wallet balance
              </span>
              <span className={`text-sm font-semibold ${canPay ? "" : "text-destructive"}`}>{fmt(walletBalance)}</span>
            </div>

            {!canPay && (
              <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-xs text-destructive">
                  Insufficient wallet balance. You need {fmt(monthlyFee - walletBalance)} more to activate Premium.
                </p>
              </div>
            )}

            <ul className="space-y-2 text-sm pt-1">
              <li className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Unlimited AI conversations</li>
              <li className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> +1 credit-score point on time payment</li>
              <li className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Automatic monthly renewal from wallet</li>
            </ul>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowPaywall(false)} disabled={paying}>Later</Button>
            {canPay ? (
              <Button className="flex-1" onClick={payFromWallet} disabled={paying}>
                {paying ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…</>) : "Deduct from Wallet & Activate"}
              </Button>
            ) : (
              <Button className="flex-1" onClick={goTopUp} disabled={paying}>
                <Wallet className="mr-2 h-4 w-4" /> Top Up Wallet
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
