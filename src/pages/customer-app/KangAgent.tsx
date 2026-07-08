// Kang Agent — ChatGPT-style mobile chat UI
// Wires the /app/kang-agent route to the three edge functions built in Step 3.
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Send, Plus, Menu, X, Trash2, Sparkles, Loader2, Crown, MessageSquare,
  Wallet, AlertTriangle, ArrowUpRight,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PullToRefresh } from "@/components/pwa/PullToRefresh";
import welcomeMascot from "@/assets/kang-mascot/welcome.png.asset.json";
import attentionMascot from "@/assets/kang-mascot/attention.png.asset.json";
import supportMascot from "@/assets/kang-mascot/support.png.asset.json";
import thinkingMascot from "@/assets/kang-mascot/thinking.png.asset.json";
import workingMascot from "@/assets/kang-mascot/working.png.asset.json";

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

function pickMascot(content: string) {
  const c = content.toLowerCase();
  if (/support|help|contact|agent/.test(c)) return supportMascot.url;
  if (/think|calculat|analy|budget|plan/.test(c)) return thinkingMascot.url;
  if (/ai|technical|api|code|data/.test(c)) return workingMascot.url;
  if (/tip|advice|recommend|should|consider/.test(c)) return attentionMascot.url;
  return welcomeMascot.url;
}

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const trialUsed = sub?.questions_asked_count ?? 0;
  const trialLimit = sub?.free_questions_limit ?? 5;
  const isTrial = sub?.status === "trial";
  const isSuspended = sub?.status === "suspended";
  const isActive = sub?.status === "active";
  const limitReached = isTrial && trialUsed >= trialLimit;
  const canPay = walletBalance >= monthlyFee;
  const blocked = limitReached || isSuspended;

  const fmt = (n: number) => `${Math.round(n).toLocaleString()} ${currency}`;

  // --- Data fetchers ---
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
    setSub((subRow as any) ?? {
      status: "trial", questions_asked_count: 0, free_questions_limit: 5,
    });
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
      // silent — sidebar is not critical
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
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  useEffect(() => { inputRef.current?.focus(); }, [sessionId, sending]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || sending) return;
    if (limitReached) { setShowPaywall(true); return; }

    setSending(true);
    const optimistic: Message = {
      id: `tmp-${Date.now()}`,
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimistic]);
    setInput("");

    try {
      const { data, error } = await supabase.functions.invoke("kang-chat-handler", {
        body: { message: text, session_id: sessionId },
      });
      if (error) throw error;
      const body: any = data;
      if (!body.success) {
        if (body.error === "limit_reached") {
          setShowPaywall(true);
          setSub((s) => s ? { ...s, questions_asked_count: s.free_questions_limit } : s);
        } else {
          toast.error(body.message ?? "Could not send message.");
        }
        setMessages((m) => m.filter((x) => x.id !== optimistic.id));
        return;
      }
      if (body.session_id && body.session_id !== sessionId) setSessionId(body.session_id);
      // Reload messages authoritative + subscription
      if (body.session_id) await loadSessionMessages(body.session_id);
      await loadProfileAndSub();
      loadSessions();
    } catch (e: any) {
      toast.error(e?.message ?? "Network error. Please try again.");
      setMessages((m) => m.filter((x) => x.id !== optimistic.id));
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

  const empty = messages.length === 0;

  return (
    <div className="fixed inset-0 flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border/60 bg-card/80 backdrop-blur px-4 py-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} aria-label="Open conversations">
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <img src={welcomeMascot.url} alt="Kang mascot" className="h-8 w-8 rounded-full object-contain" />
            <div>
              <h1 className="text-sm font-semibold leading-tight">kang Agent</h1>
              <p className="text-[10px] text-muted-foreground leading-tight">AI Financial Advisor</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {creditScore != null && (
            <Badge variant="outline" className="gap-1 text-xs" aria-label={`Credit score ${creditScore}`}>
              <Sparkles className="h-3 w-3" /> {creditScore}
            </Badge>
          )}
          {sub?.status === "active" ? (
            <Badge className="gap-1 bg-primary text-primary-foreground text-xs"><Crown className="h-3 w-3" /> Active</Badge>
          ) : (
            <Badge variant="secondary" className="text-xs">{trialUsed}/{trialLimit}</Badge>
          )}
          <Button variant="ghost" size="icon" onClick={newChat} aria-label="New chat">
            <Plus className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Trial progress bar */}
      {isTrial && (
        <div className="px-4 pt-2">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
            <span>Free questions</span>
            <span>{trialUsed} of {trialLimit} used</span>
          </div>
          <Progress value={(trialUsed / trialLimit) * 100} className="h-1.5" />
        </div>
      )}

      {/* Chat area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <PullToRefresh onRefresh={async () => { await loadProfileAndSub(); if (sessionId) await loadSessionMessages(sessionId); }}>
          <div className="mx-auto max-w-2xl px-4 py-4 space-y-4">
            {empty && !loadingMessages && (
              <div className="flex flex-col items-center text-center py-10">
                <img src={welcomeMascot.url} alt="" className="h-40 w-40 object-contain" />
                <h2 className="mt-4 text-lg font-semibold">Hi, I'm kang Agent</h2>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Ask me anything about your finances — budgeting, saving, credit score, or business planning.
                </p>
                <div className="mt-6 grid grid-cols-1 gap-2 w-full max-w-sm">
                  {["How can I improve my credit score?", "Help me build a monthly budget.", "What's a good savings strategy?"].map((s) => (
                    <button
                      key={s}
                      onClick={() => setInput(s)}
                      className="rounded-2xl border border-border/60 bg-card px-4 py-3 text-left text-sm hover:bg-muted transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {loadingMessages && (
              <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            )}

            <AnimatePresence initial={false}>
              {messages.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {m.role === "assistant" && (
                    <img src={pickMascot(m.content)} alt="" className="h-10 w-10 rounded-full object-contain shrink-0 mt-1" />
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                      m.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted text-foreground rounded-bl-sm"
                    }`}
                  >
                    {m.content}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {sending && (
              <div className="flex items-center gap-2">
                <img src={thinkingMascot.url} alt="" className="h-10 w-10 rounded-full object-contain" />
                <div className="rounded-2xl rounded-bl-sm bg-muted px-4 py-3">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "120ms" }} />
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "240ms" }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </PullToRefresh>
      </div>

      {/* Input */}
      <div className="border-t border-border/60 bg-card/90 backdrop-blur px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-2xl flex items-end gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, 4000))}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder={limitReached ? "Upgrade to keep chatting" : "Ask about finance, business, or money…"}
            className="flex-1 rounded-full h-11 px-4"
            aria-label="Message kang Agent"
            disabled={sending}
          />
          <Button
            onClick={sendMessage}
            disabled={sending || !input.trim()}
            size="icon"
            className="h-11 w-11 rounded-full shrink-0"
            aria-label="Send message"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Sidebar (conversations) */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="p-0 w-[86%] sm:w-96">
          <SheetHeader className="px-4 py-4 border-b border-border/60">
            <SheetTitle className="flex items-center justify-between">
              <span>Conversations</span>
              <Button size="sm" variant="outline" onClick={newChat}><Plus className="h-4 w-4 mr-1" /> New</Button>
            </SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-[calc(100dvh-72px)]">
            <div className="p-2 space-y-1">
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
                    <p className="text-sm font-medium truncate">{s.title || "New Chat"}</p>
                    {s.last_message && (
                      <p className="text-xs text-muted-foreground truncate">{s.last_message.content}</p>
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

      {/* Paywall dialog */}
      <Dialog open={showPaywall} onOpenChange={setShowPaywall}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex justify-center mb-2">
              <img src={attentionMascot.url} alt="" className="h-28 w-28 object-contain" />
            </div>
            <DialogTitle className="text-center">You've used your free questions</DialogTitle>
            <DialogDescription className="text-center">
              Upgrade to kang Agent Premium for unlimited AI financial advice.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-2 text-sm py-2">
            <li className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Unlimited AI conversations</li>
            <li className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Monthly credit-score boost on time payment</li>
            <li className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Priority support</li>
          </ul>
          <div className="rounded-xl bg-muted p-4 text-center">
            <p className="text-2xl font-bold">2,500 XAF<span className="text-sm font-normal text-muted-foreground">/month</span></p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowPaywall(false)}>Later</Button>
            <Button className="flex-1" onClick={() => { setShowPaywall(false); toast.info("Payment flow coming soon."); }}>Subscribe Now</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
