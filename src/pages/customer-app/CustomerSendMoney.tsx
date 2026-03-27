import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Globe, ArrowRight, Banknote, Clock, CheckCircle2, ChevronLeft,
  Building2, Smartphone, Loader2, AlertTriangle, Search, History,
  TrendingUp, ShieldCheck, ArrowUpRight, Wallet, CreditCard,
  Sparkles, PartyPopper, MapPin, User, FileText, ChevronRight,
  RefreshCw, Copy, ExternalLink,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

/* ── Helpers ───────────────────────────────────────── */
const FLAGS: Record<string, string> = {
  CM: "🇨🇲", NG: "🇳🇬", GH: "🇬🇭", KE: "🇰🇪", ZA: "🇿🇦", US: "🇺🇸", GB: "🇬🇧",
  FR: "🇫🇷", DE: "🇩🇪", SN: "🇸🇳", CI: "🇨🇮", GA: "🇬🇦", TD: "🇹🇩", CF: "🇨🇫",
  CG: "🇨🇬", CD: "🇨🇩", BJ: "🇧🇯", TG: "🇹🇬", ML: "🇲🇱", BF: "🇧🇫", NE: "🇳🇪",
  GN: "🇬🇳", RW: "🇷🇼", UG: "🇺🇬", TZ: "🇹🇿", ET: "🇪🇹", EG: "🇪🇬", MA: "🇲🇦",
  TN: "🇹🇳", IN: "🇮🇳", CN: "🇨🇳", JP: "🇯🇵", CA: "🇨🇦", AU: "🇦🇺", BR: "🇧🇷",
};
const flag = (c: string) => FLAGS[c] || "🌍";

const NAMES: Record<string, string> = {
  CM: "Cameroon", NG: "Nigeria", GH: "Ghana", KE: "Kenya", ZA: "South Africa",
  US: "United States", GB: "United Kingdom", FR: "France", DE: "Germany",
  SN: "Senegal", CI: "Ivory Coast", GA: "Gabon", TD: "Chad", CF: "Central African Rep.",
  CG: "Congo", CD: "DR Congo", BJ: "Benin", TG: "Togo", ML: "Mali", BF: "Burkina Faso",
  NE: "Niger", GN: "Guinea", RW: "Rwanda", UG: "Uganda", TZ: "Tanzania",
  ET: "Ethiopia", EG: "Egypt", MA: "Morocco", TN: "Tunisia", IN: "India",
  CN: "China", JP: "Japan", CA: "Canada", AU: "Australia", BR: "Brazil",
};
const name = (c: string, fb?: string) => NAMES[c] || fb || c;

const DELIVERY: Record<string, { label: string; icon: typeof Building2; desc: string }> = {
  bank_transfer: { label: "Bank Transfer", icon: Building2, desc: "Direct to bank account" },
  mobile_money: { label: "Mobile Money", icon: Smartphone, desc: "To mobile wallet" },
  mobile_wallet: { label: "Mobile Wallet", icon: Wallet, desc: "To mobile wallet" },
  paypal: { label: "PayPal", icon: CreditCard, desc: "To PayPal account" },
  card: { label: "Card", icon: CreditCard, desc: "To debit/credit card" },
};
const dm = (k: string) => DELIVERY[k] || { label: k.replace(/_/g, " "), icon: Banknote, desc: "Transfer" };

const STATUS: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  created: { label: "Submitted", color: "bg-muted text-muted-foreground", icon: Clock },
  pending: { label: "Processing", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400", icon: Loader2 },
  received: { label: "In Transit", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400", icon: TrendingUp },
  credited: { label: "Delivered", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", icon: CheckCircle2 },
  settled: { label: "Settled", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", icon: CheckCircle2 },
  failed: { label: "Failed", color: "bg-destructive/10 text-destructive", icon: AlertTriangle },
};

type Step = "destination" | "amount" | "recipient" | "review" | "sending" | "success";
type Tab = "send" | "history";

/* ── Confetti burst component ─────────────────────── */
function ConfettiBurst() {
  const pieces = useMemo(() => Array.from({ length: 40 }, (_, i) => ({
    id: i,
    x: Math.random() * 100 - 50,
    y: -(Math.random() * 120 + 60),
    rot: Math.random() * 720 - 360,
    scale: Math.random() * 0.6 + 0.5,
    color: ["hsl(var(--primary))", "hsl(var(--secondary))", "hsl(38 92% 50%)", "hsl(258 80% 58%)", "hsl(0 84% 60%)"][Math.floor(Math.random() * 5)],
    delay: Math.random() * 0.3,
    shape: Math.random() > 0.5 ? "circle" : "rect",
  })), []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-50">
      {pieces.map((p) => (
        <motion.div
          key={p.id}
          initial={{ x: "50%", y: "40%", opacity: 1, scale: 0, rotate: 0 }}
          animate={{
            x: `calc(50% + ${p.x}vw)`,
            y: `calc(40% + ${p.y}vh)`,
            opacity: [1, 1, 0],
            scale: p.scale,
            rotate: p.rot,
          }}
          transition={{ duration: 1.8, delay: p.delay, ease: "easeOut" }}
          className="absolute"
          style={{ left: 0, top: 0 }}
        >
          <div
            className={p.shape === "circle" ? "rounded-full" : "rounded-sm"}
            style={{
              width: p.shape === "circle" ? 8 : 6,
              height: p.shape === "circle" ? 8 : 10,
              backgroundColor: p.color,
            }}
          />
        </motion.div>
      ))}
    </div>
  );
}

/* ── Step indicator ───────────────────────────────── */
const STEP_ORDER: Step[] = ["destination", "amount", "recipient", "review"];
const STEP_LABELS = ["Where", "Amount", "Who", "Review"];
const STEP_ICONS = [MapPin, Banknote, User, FileText];

function StepIndicator({ current }: { current: Step }) {
  const idx = STEP_ORDER.indexOf(current);
  if (idx < 0) return null;

  return (
    <div className="flex items-center gap-1 px-1">
      {STEP_ORDER.map((s, i) => {
        const Icon = STEP_ICONS[i];
        const active = i <= idx;
        const isCurrent = i === idx;
        return (
          <div key={s} className="flex-1 flex flex-col items-center gap-1.5">
            <div className="flex items-center w-full gap-0.5">
              <motion.div
                className={`flex h-7 w-7 items-center justify-center rounded-full shrink-0 transition-all duration-500 ${
                  isCurrent ? "bg-white text-primary shadow-md" : active ? "bg-white/30 text-white" : "bg-white/10 text-white/40"
                }`}
                animate={isCurrent ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 0.5 }}
              >
                <Icon className="h-3 w-3" />
              </motion.div>
              {i < STEP_ORDER.length - 1 && (
                <div className={`flex-1 h-0.5 rounded-full transition-all duration-500 ${active ? "bg-white/40" : "bg-white/10"}`} />
              )}
            </div>
            <span className={`text-[9px] font-semibold transition-colors duration-300 ${
              isCurrent ? "text-white" : active ? "text-white/60" : "text-white/30"
            }`}>{STEP_LABELS[i]}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Page transition variants ────────────────────── */
const pageVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? 60 : -60,
    opacity: 0,
    scale: 0.97,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
    transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] },
  },
  exit: (dir: number) => ({
    x: dir > 0 ? -60 : 60,
    opacity: 0,
    scale: 0.97,
    transition: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] },
  }),
};

const stagger = {
  hidden: { opacity: 0, y: 12 },
  show: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: [0.25, 0.1, 0.25, 1] },
  }),
};

export default function CustomerSendMoney() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("send");
  const [step, setStep] = useState<Step>("destination");
  const [dir, setDir] = useState(1);
  const [search, setSearch] = useState("");

  // Form state
  const [selectedCountry, setSelectedCountry] = useState("");
  const [corridor, setCorridor] = useState<any>(null);
  const [amount, setAmount] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [receiverEmail, setReceiverEmail] = useState("");
  const [receiverBankName, setReceiverBankName] = useState("");
  const [receiverBankCode, setReceiverBankCode] = useState("");
  const [receiverAccount, setReceiverAccount] = useState("");
  const [receiverWallet, setReceiverWallet] = useState("");
  const [purpose, setPurpose] = useState("personal");
  const [narration, setNarration] = useState("");
  const [quote, setQuote] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [trackDialog, setTrackDialog] = useState<any>(null);

  const goTo = useCallback((s: Step, direction = 1) => {
    setDir(direction);
    setStep(s);
  }, []);

  /* ── Data ─────────────────────────────────────────── */
  const { data: corridors, isLoading: loading } = useQuery({
    queryKey: ["outbound-corridors"],
    queryFn: async () => {
      const res = await supabase.functions.invoke("remittance-outbound", { body: { action: "get_corridors" } });
      if (res.error) throw res.error;
      return res.data?.corridors || [];
    },
  });

  const { data: transfers, refetch: refetchTransfers } = useQuery({
    queryKey: ["my-outbound-transfers"],
    queryFn: async () => {
      const res = await supabase.functions.invoke("remittance-outbound", { body: { action: "list_outbound", limit: 30 } });
      return res.data?.transfers || [];
    },
  });

  /* ── Derived ──────────────────────────────────────── */
  const countries = useMemo(() => {
    if (!corridors) return [];
    const map = new Map<string, { code: string; n: string; f: string; currencies: string[]; count: number }>();
    (corridors as any[]).forEach((c: any) => {
      if (!map.has(c.to_country)) {
        map.set(c.to_country, { code: c.to_country, n: name(c.to_country, c.to_country_name), f: flag(c.to_country), currencies: [], count: 0 });
      }
      const e = map.get(c.to_country)!;
      e.count++;
      if (!e.currencies.includes(c.to_currency)) e.currencies.push(c.to_currency);
    });
    return Array.from(map.values()).sort((a, b) => a.n.localeCompare(b.n));
  }, [corridors]);

  const filtered = useMemo(() => {
    if (!search) return countries;
    const q = search.toLowerCase();
    return countries.filter(c => c.n.toLowerCase().includes(q) || c.code.toLowerCase().includes(q));
  }, [countries, search]);

  const countryCorridors = useMemo(() => {
    if (!selectedCountry || !corridors) return [];
    return (corridors as any[]).filter((c: any) => c.to_country === selectedCountry);
  }, [corridors, selectedCountry]);

  const methods = useMemo(() => {
    if (!corridor) return [];
    const m: string[] = corridor.delivery_methods || [];
    return m.length ? m : ["bank_transfer", "mobile_wallet"];
  }, [corridor]);

  /* ── Mutations ────────────────────────────────────── */
  const quoteMut = useMutation({
    mutationFn: async () => {
      const res = await supabase.functions.invoke("remittance-outbound", {
        body: { action: "get_quote", corridor_id: corridor?.id, amount: parseFloat(amount) },
      });
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: (data) => setQuote(data),
    onError: (e: any) => toast.error(e.message || "Failed to get quote"),
  });

  const sendMut = useMutation({
    mutationFn: async () => {
      const res = await supabase.functions.invoke("remittance-outbound", {
        body: {
          action: "send", corridor_id: corridor?.id, amount: parseFloat(amount),
          quote_id: quote?.quote_id, receiver_name: receiverName,
          receiver_phone: receiverPhone || undefined, receiver_email: receiverEmail || undefined,
          receiver_country: corridor?.to_country,
          receiver_bank_name: receiverBankName || undefined, receiver_bank_code: receiverBankCode || undefined,
          receiver_account_number: receiverAccount || undefined,
          receiver_mobile_wallet: receiverWallet || undefined,
          delivery_method: deliveryMethod, purpose_code: purpose, narration: narration || undefined,
        },
      });
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: (data) => { setResult(data); goTo("success"); refetchTransfers(); },
    onError: (e: any) => toast.error(e.message || "Transfer failed"),
  });

  const trackMut = useMutation({
    mutationFn: async (id: string) => {
      const res = await supabase.functions.invoke("remittance-outbound", { body: { action: "track", remittance_id: id } });
      return res.data;
    },
    onSuccess: (data) => setTrackDialog(data),
  });

  /* ── Actions ──────────────────────────────────────── */
  const selectCountry = (code: string) => {
    setSelectedCountry(code);
    setSearch("");
    const matching = (corridors as any[] || []).filter((c: any) => c.to_country === code);
    if (matching.length === 1) {
      setCorridor(matching[0]);
      const m: string[] = matching[0].delivery_methods || [];
      setDeliveryMethod(m[0] || "bank_transfer");
    }
    goTo("amount");
  };

  const pickCorridor = (c: any) => {
    setCorridor(c);
    const m: string[] = c.delivery_methods || [];
    setDeliveryMethod(m[0] || "bank_transfer");
  };

  const getQuoteAndContinue = async () => {
    await quoteMut.mutateAsync();
    goTo("review");
  };

  const confirmAndSend = () => {
    goTo("sending");
    sendMut.mutate();
  };

  const reset = () => {
    setStep("destination"); setSelectedCountry(""); setCorridor(null); setAmount("");
    setDeliveryMethod(""); setReceiverName(""); setReceiverPhone(""); setReceiverEmail("");
    setReceiverBankName(""); setReceiverBankCode(""); setReceiverAccount("");
    setReceiverWallet(""); setQuote(null); setResult(null); setNarration(""); setSearch("");
    setDir(1);
  };

  const goBack = () => {
    if (step === "destination") navigate(-1);
    else if (step === "amount") goTo("destination", -1);
    else if (step === "recipient") goTo("amount", -1);
    else if (step === "review") goTo("recipient", -1);
    else goTo("destination", -1);
  };

  const canProceedAmount = !!amount && parseFloat(amount) > 0 && !!corridor && !!deliveryMethod;
  const canProceedRecipient = !!receiverName && (
    deliveryMethod === "bank_transfer" ? !!receiverAccount :
    (deliveryMethod === "mobile_wallet" || deliveryMethod === "mobile_money") ? !!receiverWallet :
    deliveryMethod === "paypal" ? !!receiverEmail : true
  );

  const copyRef = (ref: string) => {
    navigator.clipboard.writeText(ref);
    toast.success("Reference copied!");
  };

  return (
    <div className="max-w-lg mx-auto pb-24">
      {/* ── Header ──────────────────────────────────── */}
      <div className="sticky top-0 z-40">
        <div className="rounded-b-3xl overflow-hidden" style={{ background: "var(--gradient-hero)" }}>
          <div className="px-4 pt-3 pb-4">
            <div className="flex items-center gap-3 mb-3">
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={goBack}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-white"
              >
                <ChevronLeft className="h-5 w-5" />
              </motion.button>
              <div className="flex-1">
                <h1 className="text-base font-bold text-white">Send Money</h1>
                <p className="text-[10px] text-white/60">International transfers</p>
              </div>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setTab(tab === "send" ? "history" : "send")}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-white"
              >
                {tab === "send" ? <History className="h-4 w-4" /> : <Send className="h-4 w-4" />}
              </motion.button>
            </div>

            {tab === "send" && step !== "success" && step !== "sending" && (
              <StepIndicator current={step} />
            )}
          </div>
        </div>
      </div>

      <div className="px-4 mt-4">
        {/* ── SEND TAB ───────────────────────────────── */}
        {tab === "send" && (
          <AnimatePresence mode="wait" custom={dir}>

            {/* ═══ STEP 1: Destination ═══════════════════ */}
            {step === "destination" && (
              <motion.div
                key="destination"
                custom={dir}
                variants={pageVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className="space-y-4"
              >
                <div>
                  <h2 className="text-lg font-bold text-foreground">Where to?</h2>
                  <p className="text-xs text-muted-foreground">Choose the destination country</p>
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search countries..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10 rounded-2xl h-12 bg-muted/40 border-0 text-sm font-medium"
                  />
                </div>

                {loading ? (
                  <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                ) : filtered.length > 0 ? (
                  <div className="space-y-2">
                    {filtered.map((c, i) => (
                      <motion.button
                        key={c.code}
                        custom={i}
                        variants={stagger}
                        initial="hidden"
                        animate="show"
                        whileTap={{ scale: 0.97 }}
                        onClick={() => selectCountry(c.code)}
                        className="w-full flex items-center gap-3.5 rounded-2xl bg-card border border-border/40 p-3.5 transition-all hover:border-primary/30 hover:shadow-md active:bg-muted/30"
                      >
                        <span className="text-3xl">{c.f}</span>
                        <div className="flex-1 text-left min-w-0">
                          <p className="text-sm font-semibold text-foreground">{c.n}</p>
                          <p className="text-[11px] text-muted-foreground">{c.currencies.join(", ")}</p>
                        </div>
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/8 shrink-0">
                          <ChevronRight className="h-4 w-4 text-primary" />
                        </div>
                      </motion.button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <Globe className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm font-medium text-muted-foreground">No destinations found</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* ═══ STEP 2: Amount & Method ═══════════════ */}
            {step === "amount" && (
              <motion.div
                key="amount"
                custom={dir}
                variants={pageVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className="space-y-4"
              >
                {/* Selected destination chip */}
                <div className="flex items-center gap-2.5 rounded-2xl bg-primary/5 border border-primary/10 px-3.5 py-2.5">
                  <span className="text-2xl">{flag(selectedCountry)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{name(selectedCountry)}</p>
                    <p className="text-[10px] text-muted-foreground">{countryCorridors.length} route{countryCorridors.length !== 1 ? "s" : ""}</p>
                  </div>
                  <button onClick={() => goTo("destination", -1)} className="text-[11px] text-primary font-bold">Change</button>
                </div>

                {/* Route picker (if multiple corridors) */}
                {countryCorridors.length > 1 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Select Route</p>
                    {countryCorridors.map((c: any) => (
                      <motion.button
                        key={c.id}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => pickCorridor(c)}
                        className={`w-full flex items-center gap-3 rounded-2xl border-2 p-3 transition-all text-left ${
                          corridor?.id === c.id ? "border-primary bg-primary/5" : "border-border/40 bg-card hover:border-primary/20"
                        }`}
                      >
                        <div className="flex items-center gap-1">
                          <span className="text-lg">{flag(c.from_country)}</span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <span className="text-lg">{flag(c.to_country)}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-foreground">{c.from_currency} → {c.to_currency}</p>
                          <p className="text-[10px] text-muted-foreground">{c.remittance_partners?.display_name || "Partner"}</p>
                        </div>
                        {corridor?.id === c.id && (
                          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                            <CheckCircle2 className="h-3 w-3 text-primary-foreground" />
                          </motion.div>
                        )}
                      </motion.button>
                    ))}
                  </div>
                )}

                {/* Amount card */}
                {corridor && (
                  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                    <Card className="border-0 shadow-lg overflow-hidden">
                      <CardContent className="p-0">
                        {/* You Send */}
                        <div className="p-4 pb-3">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-2">You Send</label>
                          <div className="flex items-center gap-2 rounded-2xl border-2 border-border/50 focus-within:border-primary transition-colors bg-background overflow-hidden">
                            <Input
                              type="number"
                              inputMode="numeric"
                              placeholder="0"
                              value={amount}
                              onChange={(e) => setAmount(e.target.value)}
                              className="border-0 text-2xl font-bold h-14 focus-visible:ring-0 bg-transparent pl-4 flex-1 min-w-0"
                            />
                            <div className="flex items-center gap-1.5 px-3 h-14 bg-muted/30 border-l border-border/30 shrink-0">
                              <span className="text-base">{flag(corridor.from_country)}</span>
                              <span className="text-xs font-bold text-foreground">{corridor.from_currency}</span>
                            </div>
                          </div>
                          {/* Presets */}
                          <div className="flex gap-2 mt-2">
                            {[10000, 50000, 100000, 500000].map(p => (
                              <motion.button
                                key={p}
                                whileTap={{ scale: 0.93 }}
                                onClick={() => setAmount(String(p))}
                                className={`flex-1 rounded-xl py-2 text-[11px] font-semibold border transition-all ${
                                  Number(amount) === p ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground"
                                }`}
                              >
                                {p >= 1000 ? `${(p / 1000).toFixed(0)}K` : p}
                              </motion.button>
                            ))}
                          </div>
                        </div>

                        {/* Rate strip */}
                        <div className="flex items-center justify-center gap-2 py-2.5 bg-muted/20 border-y border-border/20">
                          <ArrowUpRight className="h-3 w-3 text-primary" />
                          <span className="text-[11px] font-medium text-muted-foreground">1 {corridor.from_currency} = {corridor.to_currency}</span>
                        </div>

                        {/* They Receive */}
                        <div className="p-4 pt-3">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-2">They Receive</label>
                          <div className="flex items-center gap-2 rounded-2xl border-2 border-border/30 bg-muted/10 overflow-hidden">
                            <div className="flex-1 pl-4 py-3.5">
                              <span className="text-2xl font-bold text-muted-foreground/60">
                                {Number(amount) > 0 ? "≈ quoted" : "0"}
                              </span>
                              <p className="text-[10px] text-muted-foreground mt-0.5">Final amount after quote</p>
                            </div>
                            <div className="flex items-center gap-1.5 px-3 h-14 bg-muted/30 border-l border-border/30 shrink-0">
                              <span className="text-base">{flag(corridor.to_country)}</span>
                              <span className="text-xs font-bold text-foreground">{corridor.to_currency}</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {/* Delivery Method */}
                {corridor && methods.length > 1 && (
                  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Delivery Method</p>
                    {methods.map(m => {
                      const meta = dm(m);
                      const Icon = meta.icon;
                      const sel = deliveryMethod === m;
                      return (
                        <motion.button
                          key={m}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => setDeliveryMethod(m)}
                          className={`w-full flex items-center gap-3 rounded-2xl border-2 p-3 transition-all text-left ${
                            sel ? "border-primary bg-primary/5" : "border-border/40 bg-card hover:border-primary/20"
                          }`}
                        >
                          <div className={`flex h-10 w-10 items-center justify-center rounded-xl shrink-0 ${sel ? "bg-primary/15" : "bg-muted/50"}`}>
                            <Icon className={`h-5 w-5 ${sel ? "text-primary" : "text-muted-foreground"}`} />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-foreground">{meta.label}</p>
                            <p className="text-[10px] text-muted-foreground">{meta.desc}</p>
                          </div>
                          {sel && (
                            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                              <CheckCircle2 className="h-3 w-3 text-primary-foreground" />
                            </motion.div>
                          )}
                        </motion.button>
                      );
                    })}
                  </motion.div>
                )}

                {/* Continue CTA */}
                <motion.div whileTap={{ scale: 0.98 }}>
                  <Button
                    className="w-full h-13 rounded-2xl text-sm font-bold"
                    disabled={!canProceedAmount}
                    onClick={() => goTo("recipient")}
                  >
                    Continue <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </motion.div>
              </motion.div>
            )}

            {/* ═══ STEP 3: Recipient ═════════════════════ */}
            {step === "recipient" && corridor && (
              <motion.div
                key="recipient"
                custom={dir}
                variants={pageVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className="space-y-4"
              >
                <div>
                  <h2 className="text-lg font-bold text-foreground">Recipient Details</h2>
                  <p className="text-xs text-muted-foreground">
                    {dm(deliveryMethod).label} to {name(corridor.to_country)}
                  </p>
                </div>

                {/* Route summary chip */}
                <div className="flex items-center gap-2 rounded-2xl bg-muted/30 border border-border/30 px-3 py-2">
                  <span>{flag(corridor.from_country)}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <span>{flag(corridor.to_country)}</span>
                  <span className="text-xs font-semibold text-foreground ml-1">{parseFloat(amount).toLocaleString()} {corridor.from_currency}</span>
                </div>

                <Card className="border-0 shadow-md">
                  <CardContent className="p-4 space-y-3.5">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-semibold text-muted-foreground">Full Name *</Label>
                      <Input
                        placeholder="As it appears on ID"
                        value={receiverName}
                        onChange={e => setReceiverName(e.target.value)}
                        className="rounded-xl h-11 border-border/40"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-semibold text-muted-foreground">Phone</Label>
                        <Input placeholder="+237..." value={receiverPhone} onChange={e => setReceiverPhone(e.target.value)} className="rounded-xl h-11 border-border/40" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-semibold text-muted-foreground">Email</Label>
                        <Input placeholder="email@..." value={receiverEmail} onChange={e => setReceiverEmail(e.target.value)} className="rounded-xl h-11 border-border/40" />
                      </div>
                    </div>

                    {/* Conditional fields */}
                    <AnimatePresence mode="wait">
                      {deliveryMethod === "bank_transfer" && (
                        <motion.div key="bank" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-3 overflow-hidden">
                          <div className="space-y-1.5">
                            <Label className="text-[11px] font-semibold text-muted-foreground">Bank Name</Label>
                            <Input placeholder="Receiver's bank" value={receiverBankName} onChange={e => setReceiverBankName(e.target.value)} className="rounded-xl h-11 border-border/40" />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <Label className="text-[11px] font-semibold text-muted-foreground">SWIFT/BIC</Label>
                              <Input placeholder="Code" value={receiverBankCode} onChange={e => setReceiverBankCode(e.target.value)} className="rounded-xl h-11 border-border/40" />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-[11px] font-semibold text-muted-foreground">Account / IBAN *</Label>
                              <Input placeholder="Account no." value={receiverAccount} onChange={e => setReceiverAccount(e.target.value)} className="rounded-xl h-11 border-border/40" />
                            </div>
                          </div>
                        </motion.div>
                      )}
                      {(deliveryMethod === "mobile_wallet" || deliveryMethod === "mobile_money") && (
                        <motion.div key="wallet" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-1.5 overflow-hidden">
                          <Label className="text-[11px] font-semibold text-muted-foreground">Wallet Number *</Label>
                          <Input placeholder="+237..." value={receiverWallet} onChange={e => setReceiverWallet(e.target.value)} className="rounded-xl h-11 border-border/40" />
                        </motion.div>
                      )}
                      {deliveryMethod === "paypal" && (
                        <motion.div key="paypal" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-1.5 overflow-hidden">
                          <Label className="text-[11px] font-semibold text-muted-foreground">PayPal Email *</Label>
                          <Input placeholder="paypal@email.com" value={receiverEmail} onChange={e => setReceiverEmail(e.target.value)} className="rounded-xl h-11 border-border/40" />
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Purpose */}
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-semibold text-muted-foreground">Purpose</Label>
                      <Select value={purpose} onValueChange={setPurpose}>
                        <SelectTrigger className="rounded-xl h-11 border-border/40"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="personal">Personal / Family</SelectItem>
                          <SelectItem value="education">Education</SelectItem>
                          <SelectItem value="medical">Medical</SelectItem>
                          <SelectItem value="business">Business</SelectItem>
                          <SelectItem value="investment">Investment</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-semibold text-muted-foreground">Note (optional)</Label>
                      <Textarea
                        placeholder="Any additional details..."
                        value={narration}
                        onChange={e => setNarration(e.target.value)}
                        rows={2}
                        className="rounded-xl border-border/40 resize-none"
                      />
                    </div>
                  </CardContent>
                </Card>

                <motion.div whileTap={{ scale: 0.98 }}>
                  <Button
                    className="w-full h-13 rounded-2xl text-sm font-bold"
                    disabled={!canProceedRecipient || quoteMut.isPending}
                    onClick={getQuoteAndContinue}
                  >
                    {quoteMut.isPending ? (
                      <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Getting Quote...</>
                    ) : (
                      <>Get Quote & Review <ArrowRight className="h-4 w-4 ml-2" /></>
                    )}
                  </Button>
                </motion.div>
              </motion.div>
            )}

            {/* ═══ STEP 4: Review & Confirm ══════════════ */}
            {step === "review" && quote && corridor && (
              <motion.div
                key="review"
                custom={dir}
                variants={pageVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className="space-y-4"
              >
                <div>
                  <h2 className="text-lg font-bold text-foreground">Review Transfer</h2>
                  <p className="text-xs text-muted-foreground">Verify everything before sending</p>
                </div>

                {/* Big amount card */}
                <Card className="border-0 shadow-lg overflow-hidden">
                  <div className="text-center py-6 px-4" style={{ background: "linear-gradient(135deg, hsl(var(--primary) / 0.06), hsl(var(--primary) / 0.02))" }}>
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <span className="text-2xl">{flag(corridor.from_country)}</span>
                      <motion.div
                        animate={{ x: [0, 4, 0] }}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                      >
                        <ArrowRight className="h-4 w-4 text-primary" />
                      </motion.div>
                      <span className="text-2xl">{flag(corridor.to_country)}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mb-1">Receiver Gets</p>
                    <motion.p
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="text-3xl font-extrabold text-primary"
                    >
                      {(quote.amount_out || 0).toLocaleString()}
                      <span className="text-base text-muted-foreground ml-1.5">{quote.currency_out}</span>
                    </motion.p>
                  </div>

                  <CardContent className="p-4 space-y-3">
                    {/* Breakdown */}
                    <div className="rounded-2xl bg-muted/20 border border-border/30 p-3.5 space-y-2.5">
                      {[
                        { l: "You Send", v: `${(quote.amount_in || 0).toLocaleString()} ${quote.currency_in}` },
                        { l: "Fee", v: `-${(quote.fee_total || 0).toLocaleString()} ${quote.currency_in}`, color: "text-destructive" },
                        { l: "FX Rate", v: `1 ${quote.currency_in} = ${quote.fx_rate} ${quote.currency_out}` },
                        ...(quote.delivery_estimate_seconds ? [{ l: "Delivery", v: `~${Math.round(quote.delivery_estimate_seconds / 3600)}h` }] : []),
                      ].map(row => (
                        <div key={row.l} className="flex justify-between items-center">
                          <span className="text-[11px] text-muted-foreground">{row.l}</span>
                          <span className={`text-[11px] font-semibold ${row.color || "text-foreground"}`}>{row.v}</span>
                        </div>
                      ))}
                    </div>

                    {/* Receiver summary */}
                    <div className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border/30">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/10 shrink-0">
                        <User className="h-5 w-5 text-secondary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">{receiverName}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {name(corridor.to_country)} · {dm(deliveryMethod).label}
                        </p>
                      </div>
                    </div>

                    {/* Disclaimer */}
                    <div className="flex items-start gap-2 rounded-xl bg-primary/5 border border-primary/10 p-3">
                      <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        By confirming, you agree this transfer is for lawful purposes and recipient details are correct.
                      </p>
                    </div>

                    {/* Quote expiry */}
                    {quote.expires_at && (
                      <p className="text-[10px] text-muted-foreground text-center">
                        Quote expires {new Date(quote.expires_at).toLocaleTimeString()}
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Actions */}
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1 rounded-2xl h-12" onClick={() => goTo("recipient", -1)}>
                    Edit
                  </Button>
                  <motion.div className="flex-1" whileTap={{ scale: 0.97 }}>
                    <Button
                      className="w-full rounded-2xl h-12 font-bold"
                      onClick={confirmAndSend}
                    >
                      <Send className="h-4 w-4 mr-2" /> Confirm & Send
                    </Button>
                  </motion.div>
                </div>
              </motion.div>
            )}

            {/* ═══ SENDING (processing animation) ════════ */}
            {step === "sending" && (
              <motion.div
                key="sending"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-20 gap-6"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                  className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10"
                >
                  <Send className="h-8 w-8 text-primary" />
                </motion.div>
                <div className="text-center">
                  <h2 className="text-lg font-bold text-foreground">Processing Transfer</h2>
                  <p className="text-xs text-muted-foreground mt-1">Securing your transfer...</p>
                </div>
                <motion.div
                  className="w-48 h-1.5 rounded-full bg-muted overflow-hidden"
                >
                  <motion.div
                    className="h-full bg-primary rounded-full"
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 3, ease: "easeInOut" }}
                  />
                </motion.div>
              </motion.div>
            )}

            {/* ═══ SUCCESS 🎉 ════════════════════════════ */}
            {step === "success" && result && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 22 }}
                className="relative space-y-4"
              >
                <ConfettiBurst />

                <Card className="border-0 shadow-xl overflow-hidden">
                  {/* Success header */}
                  <div className="relative py-8 text-center overflow-hidden" style={{ background: "linear-gradient(135deg, hsl(142 76% 36% / 0.12), hsl(142 76% 36% / 0.04))" }}>
                    <motion.div
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", stiffness: 400, damping: 15, delay: 0.3 }}
                      className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-lg"
                    >
                      <CheckCircle2 className="h-10 w-10 text-secondary" />
                    </motion.div>

                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
                      <h2 className="text-xl font-extrabold text-foreground flex items-center justify-center gap-2">
                        Transfer Sent! <PartyPopper className="h-5 w-5 text-amber-500" />
                      </h2>
                      <p className="text-xs text-muted-foreground mt-1">Your money is on its way</p>
                    </motion.div>
                  </div>

                  <CardContent className="p-4 space-y-4">
                    {/* Transfer details */}
                    <div className="rounded-2xl bg-muted/20 border border-border/30 p-3.5 space-y-2.5">
                      {[
                        { l: "Reference", v: result.partner_reference },
                        { l: "Status", v: result.compliance_status === "cleared" ? "✅ Processing" : "🔍 Under Review" },
                        { l: "Amount", v: `${(result.amount_out || 0).toLocaleString()} ${result.currency_out}` },
                        { l: "Receiver", v: receiverName },
                      ].map(row => (
                        <div key={row.l} className="flex justify-between items-center">
                          <span className="text-[11px] text-muted-foreground">{row.l}</span>
                          <span className="text-[11px] font-semibold text-foreground">{row.v}</span>
                        </div>
                      ))}
                    </div>

                    {/* Copy reference */}
                    {result.partner_reference && (
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => copyRef(result.partner_reference)}
                        className="w-full flex items-center justify-center gap-2 rounded-xl border border-border/40 py-2.5 text-xs font-medium text-muted-foreground hover:bg-muted/30 transition-colors"
                      >
                        <Copy className="h-3.5 w-3.5" /> Copy Reference
                      </motion.button>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3">
                      <motion.div className="flex-1" whileTap={{ scale: 0.97 }}>
                        <Button variant="outline" onClick={reset} className="w-full rounded-2xl h-12 font-semibold">
                          <RefreshCw className="h-4 w-4 mr-2" /> Send Another
                        </Button>
                      </motion.div>
                      <motion.div className="flex-1" whileTap={{ scale: 0.97 }}>
                        <Button
                          onClick={() => { setTab("history"); reset(); }}
                          className="w-full rounded-2xl h-12 font-semibold"
                        >
                          <ExternalLink className="h-4 w-4 mr-2" /> View Transfers
                        </Button>
                      </motion.div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

          </AnimatePresence>
        )}

        {/* ── HISTORY TAB ──────────────────────────────── */}
        {tab === "history" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-foreground">Transfer History</h2>
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => refetchTransfers()} className="text-primary">
                <RefreshCw className="h-4 w-4" />
              </motion.button>
            </div>

            {!transfers || transfers.length === 0 ? (
              <div className="text-center py-16">
                <Send className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground">No transfers yet</p>
                <p className="text-xs text-muted-foreground mt-1">Start by sending your first transfer</p>
                <Button className="mt-4 rounded-2xl" onClick={() => { setTab("send"); reset(); }}>
                  <Send className="h-4 w-4 mr-2" /> Send Money
                </Button>
              </div>
            ) : (
              (transfers as any[]).map((t: any, i: number) => {
                const st = STATUS[t.status] || { label: t.status, color: "bg-muted text-muted-foreground", icon: Clock };
                const StIcon = st.icon;
                return (
                  <motion.div
                    key={t.id}
                    custom={i}
                    variants={stagger}
                    initial="hidden"
                    animate="show"
                  >
                    <Card
                      className="cursor-pointer border-border/40 hover:border-primary/30 hover:shadow-md transition-all active:scale-[0.98]"
                      onClick={() => trackMut.mutate(t.id)}
                    >
                      <CardContent className="p-3.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{flag(t.receiver_country)}</span>
                            <div>
                              <p className="text-sm font-semibold text-foreground">{t.receiver_name}</p>
                              <p className="text-[10px] text-muted-foreground">{name(t.receiver_country)} · {dm(t.delivery_method || "").label}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-foreground">{(t.amount_out || 0).toLocaleString()} {t.currency_out}</p>
                            <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${st.color}`}>
                              <StIcon className="h-2.5 w-2.5" />{st.label}
                            </span>
                          </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          {new Date(t.created_at).toLocaleDateString()} · {(t.partner_reference || "").slice(0, 16)}
                        </p>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })
            )}
          </motion.div>
        )}
      </div>

      {/* ── Tracking Dialog ──────────────────────────── */}
      <Dialog open={!!trackDialog} onOpenChange={() => setTrackDialog(null)}>
        <DialogContent className="max-w-md max-h-[80vh] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Transfer Tracking</DialogTitle>
          </DialogHeader>
          {trackDialog && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    ["Reference", trackDialog.remittance?.partner_reference],
                    ["Status", trackDialog.remittance?.status],
                    ["Receiver", trackDialog.remittance?.receiver_name],
                    ["Destination", trackDialog.remittance?.receiver_country],
                    ["Amount", `${(trackDialog.remittance?.amount_out || 0).toLocaleString()} ${trackDialog.remittance?.currency_out}`],
                    ["Fee", `${(trackDialog.remittance?.fee_total || 0).toLocaleString()} ${trackDialog.remittance?.currency_in}`],
                  ].map(([l, v]) => (
                    <div key={l as string} className="rounded-xl bg-muted/30 p-2.5">
                      <p className="text-[10px] text-muted-foreground">{l}</p>
                      <p className="text-xs font-semibold text-foreground mt-0.5">{String(v || "—")}</p>
                    </div>
                  ))}
                </div>

                {/* Timeline */}
                {trackDialog.events?.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-foreground mb-3">Timeline</p>
                    <div className="space-y-0">
                      {trackDialog.events.map((ev: any, idx: number) => {
                        const isLast = idx === trackDialog.events.length - 1;
                        return (
                          <div key={ev.id} className="flex gap-3 items-start relative">
                            <div className="flex flex-col items-center">
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: idx * 0.1 }}
                                className={`flex h-8 w-8 items-center justify-center rounded-xl z-10 ${
                                  isLast ? "bg-primary/15" : "bg-muted/50"
                                }`}
                              >
                                {isLast ? (
                                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                                ) : (
                                  <Clock className="h-3 w-3 text-muted-foreground" />
                                )}
                              </motion.div>
                              {!isLast && (
                                <div className="w-0.5 flex-1 bg-border/50" style={{ minHeight: 20 }} />
                              )}
                            </div>
                            <div className={`pt-1 ${isLast ? "" : "pb-4"}`}>
                              <p className="text-xs font-semibold text-foreground capitalize">{(ev.event_type || "").replace(/_/g, " ")}</p>
                              <p className="text-[10px] text-muted-foreground">{new Date(ev.created_at).toLocaleString()}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
