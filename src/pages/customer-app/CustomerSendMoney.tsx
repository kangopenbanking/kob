import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { PinConfirmDialog } from "@/components/pwa/PinConfirmDialog";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFeeEstimate } from "@/hooks/useFeeEstimate";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { useSupportedCountries } from "@/hooks/useSupportedCountries";
import { formatErrorForToast } from "@/lib/error-handler";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Globe, ArrowRight, Banknote, Clock, CheckCircle2, ChevronLeft,
  Building2, Smartphone, Loader2, AlertTriangle, History,
  TrendingUp, ShieldCheck, ArrowUpDown, Wallet, CreditCard,
  PartyPopper, MapPin, User, FileText, ChevronRight,
  RefreshCw, Copy, ExternalLink, Landmark, Receipt, Mail,
  ArrowLeft, Zap, Phone, Sparkles, CheckCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
/* CM_BANKS removed — local_bank_transfer now uses KOB v1 institutions from DB */

/* ═══ Types & Constants ══════════════════════════════════════ */

type Step = "amount" | "recipient" | "review" | "sending" | "success";
type Tab = "send" | "history";

interface CorridorRow {
  id: string;
  from_country: string;
  to_country: string;
  from_currency: string;
  to_currency: string;
  delivery_methods: string[];
  is_active: boolean;
  direction: string;
  fees_model: any;
  est_delivery_seconds: number;
  remittance_partners: { name: string; display_name: string; status: string };
}

interface DestOption {
  currency: string;
  country: string;
  flag: string;
  countryCode: string;
}

interface CurrencyOption {
  code: string;
  name: string;
  flag: string;
  rate: number;
  fee_pct: number;
}

const COUNTRY_META: Record<string, { name: string; flag: string; currency: string }> = {
  CM: { name: "Cameroon", flag: "🇨🇲", currency: "XAF" },
  NG: { name: "Nigeria", flag: "🇳🇬", currency: "NGN" },
  GH: { name: "Ghana", flag: "🇬🇭", currency: "GHS" },
  KE: { name: "Kenya", flag: "🇰🇪", currency: "KES" },
  SN: { name: "Senegal", flag: "🇸🇳", currency: "XOF" },
  GA: { name: "Gabon", flag: "🇬🇦", currency: "XAF" },
  CG: { name: "Congo", flag: "🇨🇬", currency: "XAF" },
  TD: { name: "Chad", flag: "🇹🇩", currency: "XAF" },
  CF: { name: "Central African Rep.", flag: "🇨🇫", currency: "XAF" },
  CD: { name: "DR Congo", flag: "🇨🇩", currency: "CDF" },
  BJ: { name: "Benin", flag: "🇧🇯", currency: "XOF" },
  TG: { name: "Togo", flag: "🇹🇬", currency: "XOF" },
  ML: { name: "Mali", flag: "🇲🇱", currency: "XOF" },
  BF: { name: "Burkina Faso", flag: "🇧🇫", currency: "XOF" },
  NE: { name: "Niger", flag: "🇳🇪", currency: "XOF" },
  GN: { name: "Guinea", flag: "🇬🇳", currency: "GNF" },
  CI: { name: "Ivory Coast", flag: "🇨🇮", currency: "XOF" },
  US: { name: "United States", flag: "🇺🇸", currency: "USD" },
  CA: { name: "Canada", flag: "🇨🇦", currency: "CAD" },
  FR: { name: "France", flag: "🇫🇷", currency: "EUR" },
  GB: { name: "United Kingdom", flag: "🇬🇧", currency: "GBP" },
  DE: { name: "Germany", flag: "🇩🇪", currency: "EUR" },
  ZA: { name: "South Africa", flag: "🇿🇦", currency: "ZAR" },
  RW: { name: "Rwanda", flag: "🇷🇼", currency: "RWF" },
  UG: { name: "Uganda", flag: "🇺🇬", currency: "UGX" },
  TZ: { name: "Tanzania", flag: "🇹🇿", currency: "TZS" },
  ET: { name: "Ethiopia", flag: "🇪🇹", currency: "ETB" },
  EG: { name: "Egypt", flag: "🇪🇬", currency: "EGP" },
  MA: { name: "Morocco", flag: "🇲🇦", currency: "MAD" },
  TN: { name: "Tunisia", flag: "🇹🇳", currency: "TND" },
  IN: { name: "India", flag: "🇮🇳", currency: "INR" },
  CN: { name: "China", flag: "🇨🇳", currency: "CNY" },
  JP: { name: "Japan", flag: "🇯🇵", currency: "JPY" },
  AU: { name: "Australia", flag: "🇦🇺", currency: "AUD" },
  BR: { name: "Brazil", flag: "🇧🇷", currency: "BRL" },
};

const METHOD_META: Record<string, { label: string; icon: typeof Smartphone; desc: string }> = {
  mobile_money: { label: "Mobile Money", icon: Smartphone, desc: "To mobile wallet" },
  wallet: { label: "KOB Wallet", icon: Smartphone, desc: "To KOB wallet" },
  mobile_wallet: { label: "Mobile Wallet", icon: Wallet, desc: "To mobile wallet" },
  bank_transfer: { label: "Bank Transfer", icon: Landmark, desc: "Flutterwave banking" },
  local_bank_transfer: { label: "Credit Unions", icon: Building2, desc: "KOB v1 API institutions" },
  bill_payment: { label: "Bills & Fees", icon: Receipt, desc: "Pay bills directly" },
  paypal_email: { label: "PayPal", icon: Mail, desc: "To PayPal account" },
  paypal: { label: "PayPal", icon: CreditCard, desc: "To PayPal account" },
  card: { label: "Card", icon: CreditCard, desc: "To debit/credit card" },
};
const dm = (k: string) => METHOD_META[k] || { label: k.replace(/_/g, " "), icon: Banknote, desc: "Transfer" };

const METHOD_MAP: Record<string, string> = {
  mobile_money: "mobile_wallet", wallet: "mobile_wallet",
  bank_transfer: "bank_transfer", local_bank_transfer: "local_bank_transfer", bill_payment: "bill_payment", paypal_email: "paypal_email",
};

/** Map delivery method to the correct fee_structures transaction_type */
const METHOD_TO_FEE_CHANNEL: Record<string, string> = {
  mobile_money: "remittance_outbound",
  wallet: "remittance_wallet_credit",
  mobile_wallet: "remittance_outbound",
  bank_transfer: "remittance_bank_credit",
  local_bank_transfer: "remittance_bank_credit",
  bill_payment: "remittance_bill_payment",
  paypal_email: "remittance_outbound",
  paypal: "remittance_outbound",
};

const STATUS: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  created: { label: "Submitted", color: "bg-muted text-muted-foreground", icon: Clock },
  pending: { label: "Processing", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400", icon: Loader2 },
  received: { label: "Funds on the way", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400", icon: TrendingUp },
  credited: { label: "Delivered", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", icon: CheckCircle2 },
  settled: { label: "Settled", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", icon: CheckCircle2 },
  failed: { label: "Failed", color: "bg-destructive/10 text-destructive", icon: AlertTriangle },
};

const BILL_PURPOSES = [
  { value: "school_fees", label: "School Fees" },
  { value: "utilities", label: "Utilities" },
  { value: "medical", label: "Medical Bills" },
  { value: "rent", label: "Rent / Housing" },
  { value: "other", label: "Other" },
];

const ease = [0.22, 1, 0.36, 1] as const;

/* ═══ Confetti ═══════════════════════════════════════════════ */
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
        <motion.div key={p.id}
          initial={{ x: "50%", y: "40%", opacity: 1, scale: 0, rotate: 0 }}
          animate={{ x: `calc(50% + ${p.x}vw)`, y: `calc(40% + ${p.y}vh)`, opacity: [1, 1, 0], scale: p.scale, rotate: p.rot }}
          transition={{ duration: 1.8, delay: p.delay, ease: "easeOut" }}
          className="absolute" style={{ left: 0, top: 0 }}
        >
          <div className={p.shape === "circle" ? "rounded-full" : "rounded-sm"}
            style={{ width: p.shape === "circle" ? 8 : 6, height: p.shape === "circle" ? 8 : 10, backgroundColor: p.color }} />
        </motion.div>
      ))}
    </div>
  );
}

/* ═══ Step Indicator ═════════════════════════════════════════ */
const STEP_LABELS = ["Amount", "Recipient", "Review"];
const STEP_ICONS = [Banknote, User, FileText];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-1 px-1">
      {STEP_LABELS.map((label, i) => {
        const Icon = STEP_ICONS[i];
        const active = i <= current;
        const isCurrent = i === current;
        return (
          <div key={label} className="flex-1 flex flex-col items-center gap-1.5">
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
              {i < STEP_LABELS.length - 1 && (
                <div className={`flex-1 h-0.5 rounded-full transition-all duration-500 ${active ? "bg-white/40" : "bg-white/10"}`} />
              )}
            </div>
            <span className={`text-[9px] font-semibold transition-colors duration-300 ${
              isCurrent ? "text-white" : active ? "text-white/60" : "text-white/30"
            }`}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ═══ Currency Picker (mobile-optimized) ═════════════════════ */
function MobileCurrencyPicker({ items, selectedIdx, onSelect, label }: {
  items: { flag: string; code: string; name: string }[];
  selectedIdx: number;
  onSelect: (i: number) => void;
  label?: string;
}) {
  const safe = selectedIdx >= 0 && selectedIdx < items.length ? selectedIdx : 0;
  const selected = items[safe];
  if (!selected) return <div className="h-14 flex items-center px-3 text-xs text-muted-foreground">Loading…</div>;

  return (
    <Select value={String(safe)} onValueChange={(v) => onSelect(Number(v))}>
      <SelectTrigger className="h-14 w-[115px] shrink-0 rounded-none rounded-r-2xl border-0 border-l border-border/30 bg-muted/40 px-2.5 font-semibold text-sm shadow-none focus:ring-0 focus:ring-offset-0 [&>svg]:ml-0">
        <SelectValue>
          <span className="flex items-center gap-1.5">
            <span className="text-base">{selected.flag}</span>
            <span className="font-bold text-xs">{selected.code}</span>
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="rounded-2xl border-border/50 bg-background/95 backdrop-blur-xl max-h-64">
        {items.map((item, idx) => (
          <SelectItem key={`${item.code}-${item.name}-${idx}`} value={String(idx)} className="rounded-xl py-2.5">
            <div className="flex items-center gap-2.5">
              <span className="text-base">{item.flag}</span>
              <span className="font-semibold text-sm">{item.code}</span>
              <span className="text-muted-foreground text-xs truncate">{item.name}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/* ═══ Hooks ══════════════════════════════════════════════════ */
function useCorridors() {
  return useQuery({
    queryKey: ["remittance-corridors-mobile"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("remittance_corridors")
        .select("*, remittance_partners!inner(name, display_name, status)")
        .eq("is_active", true)
        .eq("remittance_partners.status", "active");
      if (error) throw error;
      return (data || []) as CorridorRow[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

function useRates(): CurrencyOption[] {
  const FLAG_MAP: Record<string, { flag: string; name: string }> = {
    EUR: { flag: "🇪🇺", name: "Euro" }, USD: { flag: "🇺🇸", name: "US Dollar" },
    GBP: { flag: "🇬🇧", name: "British Pound" }, CAD: { flag: "🇨🇦", name: "Canadian Dollar" },
    CHF: { flag: "🇨🇭", name: "Swiss Franc" }, XAF: { flag: "🇨🇲", name: "CFA Franc" },
    NGN: { flag: "🇳🇬", name: "Nigerian Naira" }, GHS: { flag: "🇬🇭", name: "Ghanaian Cedi" },
    KES: { flag: "🇰🇪", name: "Kenyan Shilling" }, ZAR: { flag: "🇿🇦", name: "South African Rand" },
    XOF: { flag: "🇸🇳", name: "CFA Franc BCEAO" }, AUD: { flag: "🇦🇺", name: "Australian Dollar" },
    INR: { flag: "🇮🇳", name: "Indian Rupee" }, CNY: { flag: "🇨🇳", name: "Chinese Yuan" },
    JPY: { flag: "🇯🇵", name: "Japanese Yen" }, BRL: { flag: "🇧🇷", name: "Brazilian Real" },
    MAD: { flag: "🇲🇦", name: "Moroccan Dirham" }, TND: { flag: "🇹🇳", name: "Tunisian Dinar" },
    EGP: { flag: "🇪🇬", name: "Egyptian Pound" }, RWF: { flag: "🇷🇼", name: "Rwandan Franc" },
    UGX: { flag: "🇺🇬", name: "Ugandan Shilling" }, TZS: { flag: "🇹🇿", name: "Tanzanian Shilling" },
    ETB: { flag: "🇪🇹", name: "Ethiopian Birr" }, CDF: { flag: "🇨🇩", name: "Congolese Franc" },
    GNF: { flag: "🇬🇳", name: "Guinean Franc" },
  };

  const DEFAULTS: CurrencyOption[] = [
    { code: "EUR", name: "Euro", flag: "🇪🇺", rate: 655.957, fee_pct: 0.5 },
    { code: "USD", name: "US Dollar", flag: "🇺🇸", rate: 605.22, fee_pct: 0.8 },
    { code: "GBP", name: "British Pound", flag: "🇬🇧", rate: 765.43, fee_pct: 0.6 },
    { code: "CAD", name: "Canadian Dollar", flag: "🇨🇦", rate: 445.18, fee_pct: 0.7 },
    { code: "CHF", name: "Swiss Franc", flag: "🇨🇭", rate: 680.50, fee_pct: 0.5 },
    { code: "XAF", name: "CFA Franc", flag: "🇨🇲", rate: 1, fee_pct: 0.5 },
  ];

  const [currencies, setCurrencies] = useState<CurrencyOption[]>(DEFAULTS);

  useEffect(() => {
    (async () => {
      try {
        // 1) Load admin-set rates (authoritative)
        const { data: adminData } = await supabase
          .from("admin_exchange_rates")
          .select("base_currency, rate, effective_rate, margin_percentage")
          .eq("is_active", true)
          .eq("target_currency", "XAF");

        const adminMap = new Map<string, { rate: number; fee_pct: number }>();
        (adminData || []).forEach((d: any) => {
          adminMap.set(d.base_currency, {
            rate: Number(d.effective_rate || d.rate),
            fee_pct: Number(d.margin_percentage) || 0,
          });
        });

        // 2) Identify currencies that need live rates (not in admin table & not XAF)
        const allCodes = new Set<string>();
        DEFAULTS.forEach(c => allCodes.add(c.code));
        Object.values(COUNTRY_META).forEach(m => allCodes.add(m.currency));
        allCodes.delete("XAF"); // XAF is always 1

        const needLive: string[] = [];
        allCodes.forEach(code => { if (!adminMap.has(code)) needLive.push(code); });

        // 3) Fetch live rates from edge function for missing currencies
        const liveMap = new Map<string, number>();
        if (needLive.length > 0) {
          const batches: string[][] = [];
          for (let i = 0; i < needLive.length; i += 6) batches.push(needLive.slice(i, i + 6));

          for (const batch of batches) {
            const results = await Promise.allSettled(
              batch.map(async (code) => {
                // DIRECT BACKEND ONLY — Standing Order: always use VITE_SUPABASE_URL
                const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/exchange-rate-get?from=${code}&to=XAF`;
                const res = await fetch(url, {
                  headers: { "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "" },
                });
                if (!res.ok) return null;
                const d = await res.json();
                return d.rate ? { code, rate: d.rate as number } : null;
              })
            );
            results.forEach(r => {
              if (r.status === "fulfilled" && r.value?.rate) {
                liveMap.set(r.value.code, r.value.rate);
              }
            });
          }
        }

        // 4) Merge all sources: admin > live > hardcoded defaults
        const finalMap = new Map<string, CurrencyOption>();

        // Start with defaults
        DEFAULTS.forEach(d => finalMap.set(d.code, { ...d }));

        // Apply live rates
        liveMap.forEach((rate, code) => {
          const info = FLAG_MAP[code] || { flag: "🌍", name: code };
          const existing = finalMap.get(code);
          finalMap.set(code, { code, name: info.name, flag: info.flag, rate, fee_pct: existing?.fee_pct ?? 0.5 });
        });

        // Apply admin rates (highest priority)
        adminMap.forEach((val, code) => {
          const info = FLAG_MAP[code] || { flag: "🌍", name: code };
          const existing = finalMap.get(code);
          finalMap.set(code, { code, name: existing?.name || info.name, flag: existing?.flag || info.flag, rate: val.rate, fee_pct: val.fee_pct });
        });

        // Ensure XAF is always 1
        finalMap.set("XAF", { code: "XAF", name: "CFA Franc", flag: "🇨🇲", rate: 1, fee_pct: 0 });

        // Add any corridor currencies not yet present
        allCodes.forEach(code => {
          if (!finalMap.has(code)) {
            const info = FLAG_MAP[code] || { flag: "🌍", name: code };
            finalMap.set(code, { code, name: info.name, flag: info.flag, rate: 0, fee_pct: 0.5 });
          }
        });

        setCurrencies(Array.from(finalMap.values()));
      } catch (e) {
        console.error("Failed to load exchange rates:", e);
        /* keep defaults */
      }
    })();
  }, []);
  return currencies;
}

/* ═══ Page Transition ════════════════════════════════════════ */
const pageVar = {
  enter: (d: number) => ({ x: d > 0 ? 50 : -50, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { duration: 0.3, ease } },
  exit: (d: number) => ({ x: d > 0 ? -50 : 50, opacity: 0, transition: { duration: 0.2, ease } }),
};

const stagger = {
  hidden: { opacity: 0, y: 10 },
  show: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.05, duration: 0.35, ease } as const,
  }),
};

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export default function CustomerSendMoney() {
  const navigate = useNavigate();
  const currencies = useRates();
  const { data: supportedCountries } = useSupportedCountries("consumer");
  const { data: corridors, isLoading: loadingCorridors, isError: errorCorridors } = useCorridors();

  const { data: kobInstitutions } = useQuery({
    queryKey: ["kob-v1-institutions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("institutions" as any)
        .select("id, institution_name, institution_type, country, status")
        .eq("status", "active")
        .order("institution_name") as { data: any[] | null };
      return (data || []).filter((i: any) => ["credit_union", "bank", "fintech"].includes(i.institution_type)) as { id: string; institution_name: string; institution_type: string; country?: string }[];
    },
    staleTime: 10 * 60 * 1000,
  });

  const [tab, setTab] = useState<Tab>("send");
  const [step, setStep] = useState<Step>("amount");
  const [dir, setDir] = useState(1);

  // Form state — matches desktop HeroSendForm pattern
  const [amount, setAmount] = useState("1000");
  const [srcIdx, setSrcIdx] = useState(0);
  const [destIdx, setDestIdx] = useState(0);
  const [method, setMethod] = useState("");

  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [dialCode, setDialCode] = useState("+237");
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [billPurpose, setBillPurpose] = useState("");
  const [billRef, setBillRef] = useState("");
  const [narration, setNarration] = useState("");

  const [suggestions, setSuggestions] = useState<{ id: string; full_name: string; phone: string }[]>([]);
  const [showSugg, setShowSugg] = useState(false);
  const [searching, setSearching] = useState(false);
  const nameRef = useRef<HTMLDivElement>(null);

  const [quote, setQuote] = useState<any>(null);
  const [txRef, setTxRef] = useState("");
  const [result, setResult] = useState<any>(null);
  const [liveStatus, setLiveStatus] = useState<string>("pending");
  const [trackDialog, setTrackDialog] = useState<any>(null);
  const [showPin, setShowPin] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const goTo = useCallback((s: Step, d = 1) => { setDir(d); setStep(s); }, []);

  /* ── Derived: Source countries from corridors ── */
  const srcCountries = useMemo<DestOption[]>(() => {
    if (!corridors?.length) return [];
    const seen = new Set<string>();
    const res: DestOption[] = [];
    corridors.forEach((c) => {
      const k = `${c.from_country}-${c.from_currency}`;
      if (seen.has(k)) return;
      seen.add(k);
      const m = COUNTRY_META[c.from_country];
      res.push({ currency: c.from_currency, country: m?.name || c.from_country, flag: m?.flag || "🌍", countryCode: c.from_country });
    });
    return res;
  }, [corridors]);

  const safeSrcIdx = srcIdx < srcCountries.length ? srcIdx : 0;
  const srcCountry = srcCountries[safeSrcIdx];
  const srcCur = srcCountry?.currency || "EUR";
  const srcFlag = srcCountry?.flag || "🌍";

  const srcRate = useMemo(() => {
    const entry = currencies.find((c) => c.code === srcCur);
    return entry || { code: srcCur, name: srcCur, flag: srcFlag, rate: 1, fee_pct: 0.5 };
  }, [currencies, srcCur, srcFlag]);

  const numAmt = parseFloat(amount) || 0;

  /* ── Dynamic fee from fee_structures (delivery-method aware) ──
     Fee structures store amounts in XAF. We need to convert the send amount
     to XAF first, calculate the fee in XAF, then derive the net in XAF. */
  const feeChannel = METHOD_TO_FEE_CHANNEL[method] || "remittance_outbound";
  const sendAmountXAF = useMemo(() => Math.round(numAmt * srcRate.rate), [numAmt, srcRate.rate]);
  const { fee: feeEstimate, isLoading: feeLoading } = useFeeEstimate({
    channel: feeChannel,
    amount: sendAmountXAF, // Pass XAF-equivalent so fixed fees are correct
    enabled: sendAmountXAF > 0 && !!method,
  });
  const feePct = feeEstimate.feePercent;
  const feeXAF = feeEstimate.totalFee; // fee in XAF
  // Convert fee back to source currency for display
  const fee = srcRate.rate > 0 ? Math.round(feeXAF / srcRate.rate * 100) / 100 : 0;
  const feeSource = feeEstimate.source;

  /* ── Destination countries filtered by source ── */
  const destCountries = useMemo<DestOption[]>(() => {
    if (!corridors?.length || !srcCountry) return [];
    const seen = new Set<string>();
    const res: DestOption[] = [];
    corridors
      .filter((c) => c.from_country === srcCountry.countryCode)
      .forEach((c) => {
        const k = `${c.to_country}-${c.to_currency}`;
        if (seen.has(k)) return;
        seen.add(k);
        const m = COUNTRY_META[c.to_country];
        res.push({ currency: c.to_currency, country: m?.name || c.to_country, flag: m?.flag || "🌍", countryCode: c.to_country });
      });
    return res;
  }, [corridors, srcCountry]);

  useEffect(() => { setDestIdx(0); }, [safeSrcIdx]);

  const safeDestIdx = destIdx < destCountries.length ? destIdx : 0;
  const dest = destCountries[safeDestIdx];
  const destCur = dest?.currency || "XAF";
  const destFlag = dest?.flag || "🇨🇲";

  /* ── Converted amount ──
     1. Convert full send amount to XAF: sendAmountXAF
     2. Subtract fee (in XAF): netXAF
     3. Convert netXAF to destination currency */
  const converted = useMemo(() => {
    const netXAF = sendAmountXAF - feeXAF;
    if (netXAF <= 0) return 0;
    if (destCur === "XAF" || destCur === "XOF") return Math.round(netXAF); // XOF = XAF (CEMAC/UEMOA parity)
    const destEntry = currencies.find((c) => c.code === destCur);
    if (destEntry && destEntry.rate > 0) return Math.round(netXAF / destEntry.rate * 100) / 100;
    // Same currency as source (e.g., GBP→GBP)
    if (srcRate.code === destCur && srcRate.rate > 0) return Math.round(netXAF / srcRate.rate * 100) / 100;
    return Math.round(netXAF);
  }, [sendAmountXAF, feeXAF, destCur, currencies, srcRate.code, srcRate.rate]);

  const rateLabel = useMemo(() => {
    if (destCur === "XAF") return `1 ${srcRate.code} = ${srcRate.rate.toLocaleString()} XAF`;
    const de = currencies.find((c) => c.code === destCur);
    if (de && de.rate > 0) return `1 ${srcRate.code} = ${(srcRate.rate / de.rate).toFixed(4)} ${destCur}`;
    return `1 ${srcRate.code} = ${srcRate.rate.toLocaleString()} XAF`;
  }, [srcRate, destCur, currencies]);

  /* ── Methods from corridors ── */
  const methods = useMemo(() => {
    if (!corridors || !dest || !srcCountry) return [];
    const set = new Set<string>();
    corridors
      .filter((c) => c.from_country === srcCountry.countryCode && c.from_currency === srcCur && c.to_country === dest.countryCode && c.to_currency === dest.currency)
      .forEach((c) => (c.delivery_methods || []).forEach((m: string) => set.add(m)));
    return Array.from(set);
  }, [corridors, dest, srcCountry, srcCur]);

  const matchedCorridor = useMemo(() => {
    if (!corridors || !dest || !srcCountry) return null;
    const match = (c: CorridorRow) =>
      c.from_country === srcCountry.countryCode && c.from_currency === srcCur &&
      c.to_country === dest.countryCode && c.to_currency === dest.currency;
    return corridors.find((c) => match(c) && (c.delivery_methods || []).includes(method)) ||
           corridors.find((c) => match(c)) || null;
  }, [corridors, dest, method, srcCountry, srcCur]);

  const canSubmitRoute = Boolean(method && matchedCorridor);

  const estDelivery = useMemo(() => {
    if (!corridors || !dest || !srcCountry) return "Instant";
    const m = corridors.find(
      (c) => c.from_country === srcCountry.countryCode && c.from_currency === srcCur &&
        c.to_country === dest.countryCode && c.to_currency === dest.currency && (c.delivery_methods || []).includes(method)
    );
    if (!m?.est_delivery_seconds) return "Instant";
    const s = m.est_delivery_seconds;
    if (s < 60) return "Instant";
    if (s < 3600) return `~${Math.round(s / 60)} min`;
    return `~${Math.round(s / 3600)}h`;
  }, [corridors, dest, method, srcCountry, srcCur]);

  useEffect(() => {
    if (methods.length > 0 && !methods.includes(method)) setMethod(methods[0]);
  }, [methods, method]);

  /* ── Phone countries ── */
  const phoneCountries = useMemo(() => {
    if (!supportedCountries?.length) {
      return [
        { code: "+237", country: "Cameroon", flag: "🇨🇲" },
        { code: "+234", country: "Nigeria", flag: "🇳🇬" },
        { code: "+233", country: "Ghana", flag: "🇬🇭" },
        { code: "+1", country: "USA", flag: "🇺🇸" },
        { code: "+44", country: "UK", flag: "🇬🇧" },
        { code: "+33", country: "France", flag: "🇫🇷" },
      ];
    }
    return supportedCountries.map((c) => ({ code: c.dial_code || c.code, country: c.country, flag: c.flag }));
  }, [supportedCountries]);

  /* ── Name search / autocomplete ── */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (nameRef.current && !nameRef.current.contains(e.target as Node)) setShowSugg(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const q = recipientName.trim();
    if (q.length < 2) { setSuggestions([]); setShowSugg(false); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await supabase.rpc("search_profiles_by_name", { _query: q, _limit: 6 });
        const r = (data || []).map((p: any) => ({ id: p.id, full_name: p.full_name || "", phone: p.phone_masked || "" }));
        setSuggestions(r);
        setShowSugg(r.length > 0);
      } catch { setSuggestions([]); setShowSugg(false); }
      finally { setSearching(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [recipientName]);

  const pickSuggestion = async (s: { id: string; full_name: string }) => {
    setRecipientName(s.full_name);
    setShowSugg(false);
    if (method === "mobile_money" || method === "wallet") {
      try {
        const { data: ph } = await supabase.rpc("get_profile_phone", { _profile_id: s.id });
        if (ph) {
          const p = (ph as string).replace(/\s/g, "");
          const sorted = [...phoneCountries].sort((a, b) => b.code.length - a.code.length);
          const match = sorted.find((c) => p.startsWith(c.code));
          if (match) { setDialCode(match.code); setRecipientPhone(p.slice(match.code.length)); }
          else setRecipientPhone(p.replace(/^\+\d{1,4}/, ""));
        }
      } catch { /* silent */ }
    }
  };

  /* ── Validation ── */
  const recipientValid = useCallback(() => {
    if (!recipientName.trim()) return false;
    if (method === "mobile_money" || method === "wallet" || method === "mobile_wallet") return /^\d{6,12}$/.test(recipientPhone.replace(/\s/g, ""));
    if (method === "bank_transfer") return !!(bankCode && accountNumber.trim());
    if (method === "local_bank_transfer") return !!(bankCode && accountNumber.trim());
    if (method === "bill_payment") return !!(billPurpose && billRef.trim());
    if (method === "paypal_email" || method === "paypal") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail);
    return true;
  }, [recipientName, recipientPhone, method, bankCode, accountNumber, billPurpose, billRef, recipientEmail]);

  /* ── Transfers history ── */
  const { data: transfers, refetch: refetchTransfers } = useQuery({
    queryKey: ["my-outbound-transfers"],
    queryFn: async () => {
      const res = await supabase.functions.invoke("remittance-outbound", { body: { action: "list_outbound", limit: 30 } });
      return res.data?.transfers || [];
    },
  });

  /* ── Mutations ── */
  const quoteMut = useMutation({
    mutationFn: async () => {
      const corridorId = matchedCorridor?.id;
      if (!corridorId) throw new Error("No corridor available for this route");
      const { data, error } = await supabase.functions.invoke("remittance-outbound", {
        body: {
          action: "get_quote", amount: numAmt, source_currency: srcRate.code,
          corridor_id: corridorId, currency_in: srcRate.code,
          destination_currency: destCur, delivery_method: METHOD_MAP[method] || method,
          destination_country: dest?.countryCode,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data || { fee_total: fee, fx_rate: srcRate.rate, amount_out: converted };
    },
    onSuccess: (data) => { setQuote(data); goTo("review"); },
    onError: (e: any) => {
      const { title, description } = formatErrorForToast(e);
      toast.error(title, { description });
    },
  });

  const sendMut = useMutation({
    mutationFn: async () => {
      const corridorId = matchedCorridor?.id;
      if (!corridorId) throw new Error("No corridor available");
      const recPhone = (method === "mobile_money" || method === "wallet" || method === "mobile_wallet")
        ? `${dialCode}${recipientPhone.replace(/\s/g, "")}` : undefined;
      const { data, error } = await supabase.functions.invoke("remittance-outbound", {
        body: {
          action: "send", amount: numAmt, corridor_id: corridorId,
          currency_in: srcRate.code, source_currency: srcRate.code,
          destination_currency: destCur, delivery_method: METHOD_MAP[method] || method,
          destination_country: dest?.countryCode,
          receiver_name: recipientName, receiver_phone: recPhone,
          receiver_email: (method === "paypal_email" || method === "paypal") ? recipientEmail : undefined,
          receiver_bank_code: (method === "bank_transfer" || method === "local_bank_transfer") ? bankCode : undefined,
          receiver_account_number: (method === "bank_transfer" || method === "local_bank_transfer") ? accountNumber : undefined,
          receiver_mobile_wallet: recPhone, receiver_country: dest?.countryCode,
          purpose_code: method === "bill_payment" ? billPurpose : "personal",
          narration: method === "bill_payment" ? `${billPurpose} - ${billRef}` : narration || undefined,
          quote_id: quote?.quote_id || null,
        },
      });

      // supabase.functions.invoke may return error for non-2xx OR embed result in error.context
      if (error) {
        // Check if the response body actually contains a successful result (e.g. 201 treated as error)
        let body: any = null;
        try {
          const raw = error?.context?.body;
          body = typeof raw === "string" ? JSON.parse(raw) : raw;
        } catch { /* ignore */ }
        if (body?.remittance_id) return body; // It was actually successful
        throw error;
      }
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      setResult(data);
      setTxRef(data?.partner_reference || data?.remittance_id || "TX-" + Date.now().toString(36).toUpperCase());
      setLiveStatus(data?.status || "pending");
      const remId = data?.remittance_id;

      // If wallet (instant), skip polling and go straight to success
      if (data?.status === "credited" || data?.status === "delivered") {
        setLiveStatus("credited");
        goTo("success");
        refetchTransfers();
        return;
      }

      // Start polling for status updates
      goTo("sending");
      if (remId) {
        pollingRef.current = setInterval(async () => {
          try {
            const res = await supabase.functions.invoke("remittance-outbound", {
              body: { action: "track", remittance_id: remId },
            });
            const st = res.data?.remittance?.status;
            if (st) setLiveStatus(st);
            if (st === "credited" || st === "settled") {
              if (pollingRef.current) clearInterval(pollingRef.current);
              pollingRef.current = null;
              goTo("success");
              refetchTransfers();
            } else if (st === "failed") {
              if (pollingRef.current) clearInterval(pollingRef.current);
              pollingRef.current = null;
              toast.error("Transfer failed", { description: res.data?.remittance?.cancellation_reason || "Please try again" });
              goTo("review", -1);
            }
          } catch { /* silent */ }
        }, 4000);

        // Auto-stop polling after 2 minutes and show success anyway
        setTimeout(() => {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
            goTo("success");
            refetchTransfers();
          }
        }, 120000);
      } else {
        // No remittance_id — fallback to success after delay
        setTimeout(() => { goTo("success"); refetchTransfers(); }, 3000);
      }
    },
    onError: (e: any) => {
      console.error("Send transfer error:", e);
      const { title, description } = formatErrorForToast(e);
      toast.error(title, { description });
      goTo("review", -1);
    },
  });

  const trackMut = useMutation({
    mutationFn: async (id: string) => {
      const res = await supabase.functions.invoke("remittance-outbound", { body: { action: "track", remittance_id: id } });
      return res.data;
    },
    onSuccess: (data) => setTrackDialog(data),
  });

  /* ── Actions ── */
  const confirmAndSend = () => { setShowPin(true); };
  const executeSend = () => { goTo("sending"); sendMut.mutate(); };

  const reset = () => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    setStep("amount"); setRecipientName(""); setRecipientPhone(""); setRecipientEmail("");
    setDialCode("+237"); setBankCode(""); setAccountNumber(""); setBillPurpose(""); setBillRef("");
    setQuote(null); setTxRef(""); setResult(null); setNarration(""); setSuggestions([]); setShowSugg(false);
    setLiveStatus("pending"); setDir(1);
  };

  const goBack = () => {
    if (step === "amount") navigate(-1);
    else if (step === "recipient") goTo("amount", -1);
    else if (step === "review") goTo("recipient", -1);
    else goTo("amount", -1);
  };

  const stepIdx = step === "amount" ? 0 : step === "recipient" ? 1 : 2;

  const copyRef = (ref: string) => { navigator.clipboard.writeText(ref); toast.success("Reference copied!"); };

  /* ═══════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════ */
  return (
    <div className="max-w-lg mx-auto pb-24">
      {/* ── Sticky Header ── */}
      <div className="sticky top-0 z-40">
        <div className="rounded-b-3xl overflow-hidden" style={{ background: "var(--gradient-hero)" }}>
          <div className="px-4 pt-3 pb-4">
            <div className="flex items-center gap-3 mb-3">
              <motion.button whileTap={{ scale: 0.9 }} onClick={goBack}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-white">
                <ChevronLeft className="h-5 w-5" />
              </motion.button>
              <div className="flex-1">
                <h1 className="text-base font-bold text-white">Send Money</h1>
                <p className="text-[10px] text-white/60">International transfers</p>
              </div>
              <motion.button whileTap={{ scale: 0.9 }}
                onClick={() => setTab(tab === "send" ? "history" : "send")}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-white">
                {tab === "send" ? <History className="h-4 w-4" /> : <Send className="h-4 w-4" />}
              </motion.button>
            </div>
            {tab === "send" && step !== "success" && step !== "sending" && (
              <StepIndicator current={stepIdx} />
            )}
          </div>
        </div>
      </div>

      <div className="px-4 mt-4">
        {/* ── SEND TAB ── */}
        {tab === "send" && (
          <AnimatePresence mode="wait" custom={dir}>

            {/* ═══ STEP 1: AMOUNT (You Send / They Receive) ═══ */}
            {step === "amount" && (
              <motion.div key="amount" custom={dir} variants={pageVar} initial="enter" animate="center" exit="exit">
                {/* Loading/Error states */}
                {loadingCorridors && (
                  <div className="flex items-center gap-2 bg-muted/30 rounded-2xl p-3 mb-3">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-xs text-muted-foreground">Loading corridors…</span>
                  </div>
                )}
                {errorCorridors && (
                  <div className="flex items-center gap-2 bg-destructive/10 rounded-2xl p-3 mb-3">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <span className="text-xs text-destructive">Failed to load corridors.</span>
                  </div>
                )}

                {/* Amount Card */}
                <Card className="border-0 shadow-lg overflow-hidden mb-4">
                  <CardContent className="p-0">
                    {/* You Send */}
                    <div className="p-4 pb-3">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 block">You Send</label>
                      <div className="flex items-center rounded-2xl border-2 border-border/50 focus-within:border-primary transition-colors overflow-hidden bg-background">
                        <Input
                          type="number" inputMode="numeric" placeholder="0"
                          value={amount} onChange={(e) => setAmount(e.target.value)}
                          className="border-0 text-2xl font-bold h-14 focus-visible:ring-0 bg-transparent pl-4 flex-1 min-w-0"
                        />
                        <MobileCurrencyPicker
                          items={srcCountries.map((c) => ({ flag: c.flag, code: c.currency, name: c.country }))}
                          selectedIdx={safeSrcIdx} onSelect={setSrcIdx}
                        />
                      </div>
                      {/* Quick presets */}
                      <div className="flex gap-2 mt-2">
                        {[10000, 50000, 100000, 500000].map((p) => (
                          <motion.button key={p} whileTap={{ scale: 0.93 }} onClick={() => setAmount(String(p))}
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
                    <div className="flex items-center justify-between py-2.5 px-4 bg-muted/20 border-y border-border/20">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center">
                          <ArrowUpDown className="h-3 w-3 text-primary" />
                        </div>
                        <span className="text-[11px] font-medium">{rateLabel}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px]">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className="font-semibold text-primary">{estDelivery}</span>
                      </div>
                    </div>

                    {/* They Receive */}
                    <div className="p-4 pt-3">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 block">They Receive</label>
                      <div className="flex items-center rounded-2xl border-2 border-border/30 overflow-hidden bg-muted/5">
                        <div className="flex-1 pl-4 py-3.5">
                          <motion.span key={converted} initial={{ opacity: 0.5, y: 2 }} animate={{ opacity: 1, y: 0 }}
                            className="text-2xl font-bold text-foreground">{converted.toLocaleString()}</motion.span>
                        </div>
                        <MobileCurrencyPicker
                          items={destCountries.map((d) => ({ flag: d.flag, code: d.currency, name: d.country }))}
                          selectedIdx={safeDestIdx} onSelect={setDestIdx}
                        />
                      </div>
                      <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
                        <Banknote className="h-3 w-3" />
                        <span>Fee: <strong className="text-foreground">{fee.toFixed(0)} {srcRate.code}</strong> ({(feePct * 100).toFixed(1)}%{feeEstimate.fixedFee > 0 ? ` + ${feeEstimate.fixedFee} fixed` : ""})</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Delivery methods */}
                {methods.length > 0 && (
                  <div className="mb-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 px-1">
                      Deliver to {dest?.country || ""}
                    </p>
                    <div className={`grid gap-2 ${methods.length <= 2 ? "grid-cols-2" : "grid-cols-3"}`}>
                      {methods.map((m, i) => {
                        const meta = dm(m);
                        const Icon = meta.icon;
                        const active = method === m;
                        return (
                          <motion.button key={m} custom={i} variants={stagger} initial="hidden" animate="show"
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setMethod(m)}
                            className={`flex flex-col items-center gap-1.5 rounded-2xl p-3 text-[11px] font-semibold border-2 transition-all ${
                              active ? "border-primary bg-primary/10 text-primary" : "border-border/40 bg-card text-muted-foreground hover:border-primary/20"
                            }`}
                          >
                            <div className={`h-8 w-8 rounded-xl flex items-center justify-center ${active ? "bg-primary/20" : "bg-muted/50"}`}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <span className="text-center leading-tight">{meta.label}</span>
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {destCountries.length > 0 && methods.length === 0 && !loadingCorridors && (
                  <div className="mb-4 rounded-2xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>No receiving method available for this route combination.</span>
                  </div>
                )}

                <motion.div whileTap={{ scale: 0.98 }}>
                  <Button
                    className="w-full h-13 rounded-2xl text-sm font-bold"
                    disabled={numAmt <= 0 || !canSubmitRoute || destCountries.length === 0}
                    onClick={() => {
                      if (numAmt <= 0) { toast.error("Enter an amount"); return; }
                      if (!method) { toast.error("Select a delivery method"); return; }
                      if (!matchedCorridor) { toast.error("This route is not available"); return; }
                      goTo("recipient");
                    }}
                  >
                    Continue <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </motion.div>
              </motion.div>
            )}

            {/* ═══ STEP 2: RECIPIENT ═══ */}
            {step === "recipient" && (
              <motion.div key="recipient" custom={dir} variants={pageVar} initial="enter" animate="center" exit="exit" className="space-y-4">
                <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  onClick={() => goTo("amount", -1)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <ArrowLeft className="h-3.5 w-3.5" /> Back
                </motion.button>

                {/* Transfer summary */}
                <div className="flex items-center justify-between bg-primary/5 rounded-2xl px-3.5 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{srcFlag}</span>
                    <span className="font-bold text-sm text-foreground">{numAmt.toLocaleString()} {srcRate.code}</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-primary" />
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-primary">{converted.toLocaleString()} {destCur}</span>
                    <span className="text-lg">{destFlag}</span>
                  </div>
                </div>

                <Card className="border-0 shadow-md">
                  <CardContent className="p-4 space-y-3.5">
                    {/* Recipient name with autocomplete */}
                    <div className="space-y-1.5 relative" ref={nameRef}>
                      <Label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                        <User className="h-3 w-3" /> Recipient Name *
                      </Label>
                      <div className="relative">
                        <Input value={recipientName} onChange={(e) => setRecipientName(e.target.value)}
                          className="h-11 rounded-xl border-border/40 pr-12" placeholder="Full name" />
                        {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                        {!searching && recipientName.length >= 2 && suggestions.length === 0 && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-md">New</span>
                        )}
                      </div>
                      <AnimatePresence>
                        {showSugg && suggestions.length > 0 && (
                          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                            className="absolute left-0 right-0 top-full mt-1 bg-background/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-border/50 z-50 overflow-hidden p-1.5">
                            <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider px-3 pt-1 pb-1.5">Matching contacts</p>
                            {suggestions.map((s) => (
                              <button key={s.id} onClick={() => pickSuggestion(s)}
                                className="flex items-center justify-between w-full px-3 py-2 rounded-xl text-sm text-left hover:bg-muted/60">
                                <div className="flex items-center gap-2.5">
                                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-[10px]">
                                    {s.full_name.slice(0, 2).toUpperCase()}
                                  </div>
                                  <div>
                                    <p className="font-semibold text-foreground text-xs">{s.full_name}</p>
                                    {s.phone && <p className="text-muted-foreground text-[10px]">{s.phone}</p>}
                                  </div>
                                </div>
                                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Method-specific fields */}
                    <AnimatePresence mode="wait">
                      {(method === "mobile_money" || method === "wallet" || method === "mobile_wallet") && (
                        <motion.div key="phone" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-1.5 overflow-hidden">
                          <Label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                            <Phone className="h-3 w-3" /> Phone Number *
                          </Label>
                          <div className="flex gap-2">
                            <Select value={dialCode} onValueChange={setDialCode}>
                              <SelectTrigger className="w-[90px] rounded-xl h-11 border-border/40 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="rounded-2xl max-h-48">
                                {phoneCountries.map((pc) => (
                                  <SelectItem key={pc.code} value={pc.code} className="rounded-xl text-xs">
                                    {pc.flag} {pc.code}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)}
                              placeholder="6XX XXX XXX" className="flex-1 h-11 rounded-xl border-border/40" />
                          </div>
                        </motion.div>
                      )}

                      {method === "bank_transfer" && (
                        <motion.div key="bank" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-3 overflow-hidden">
                          <div className="space-y-1.5">
                            <Label className="text-[11px] font-semibold text-muted-foreground">SWIFT/BIC Code *</Label>
                            <Input placeholder="e.g. ECOCCMCX" value={bankCode} onChange={(e) => setBankCode(e.target.value)} className="h-11 rounded-xl border-border/40" />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[11px] font-semibold text-muted-foreground">Account / IBAN *</Label>
                            <Input placeholder="Account number" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} className="h-11 rounded-xl border-border/40" />
                          </div>
                        </motion.div>
                      )}

                      {method === "local_bank_transfer" && (
                        <motion.div key="local-bank" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-3 overflow-hidden">
                          <div className="space-y-1.5">
                            <Label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                              <Building2 className="h-3 w-3" /> Credit Union / Financial Institution *
                            </Label>
                            <Select value={bankCode} onValueChange={setBankCode}>
                              <SelectTrigger className="rounded-xl h-11 border-border/40"><SelectValue placeholder="Select institution" /></SelectTrigger>
                              <SelectContent className="max-h-60">
                                {kobInstitutions && kobInstitutions.length > 0 ? (
                                  <>
                                    {kobInstitutions.filter(i => i.institution_type === "credit_union").length > 0 && (
                                      <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Credit Unions</div>
                                    )}
                                    {kobInstitutions.filter(i => i.institution_type === "credit_union").map((inst) => (
                                      <SelectItem key={inst.id} value={inst.id} className="text-xs">
                                        <span className="flex items-center gap-2">
                                          {inst.institution_name}
                                          <span className="text-[9px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">CU</span>
                                        </span>
                                      </SelectItem>
                                    ))}
                                    {kobInstitutions.filter(i => i.institution_type === "bank").length > 0 && (
                                      <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Banks</div>
                                    )}
                                    {kobInstitutions.filter(i => i.institution_type === "bank").map((inst) => (
                                      <SelectItem key={inst.id} value={inst.id} className="text-xs">{inst.institution_name}</SelectItem>
                                    ))}
                                    {kobInstitutions.filter(i => i.institution_type === "fintech").length > 0 && (
                                      <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Fintech</div>
                                    )}
                                    {kobInstitutions.filter(i => i.institution_type === "fintech").map((inst) => (
                                      <SelectItem key={inst.id} value={inst.id} className="text-xs">{inst.institution_name}</SelectItem>
                                    ))}
                                  </>
                                ) : (
                                  <div className="py-3 text-center text-xs text-muted-foreground">No KOB institutions available</div>
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[11px] font-semibold text-muted-foreground">RIB / Account Number *</Label>
                            <Input placeholder="23-digit RIB (e.g. 10005 00001 12345678901 23)" value={accountNumber}
                              onChange={(e) => setAccountNumber(e.target.value)}
                              className="h-11 rounded-xl border-border/40 font-mono tracking-wide" maxLength={27} />
                            <p className="text-[9px] text-muted-foreground">Format: Bank Code (5) + Branch (5) + Account (11) + Key (2)</p>
                          </div>
                        </motion.div>
                      )}

                      {method === "bill_payment" && (
                        <motion.div key="bill" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-3 overflow-hidden">
                          <div className="space-y-1.5">
                            <Label className="text-[11px] font-semibold text-muted-foreground">Bill Type *</Label>
                            <Select value={billPurpose} onValueChange={setBillPurpose}>
                              <SelectTrigger className="rounded-xl h-11 border-border/40"><SelectValue placeholder="Select type" /></SelectTrigger>
                              <SelectContent>
                                {BILL_PURPOSES.map((bp) => (
                                  <SelectItem key={bp.value} value={bp.value}>{bp.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[11px] font-semibold text-muted-foreground">Bill Reference *</Label>
                            <Input placeholder="Reference number" value={billRef} onChange={(e) => setBillRef(e.target.value)} className="h-11 rounded-xl border-border/40" />
                          </div>
                        </motion.div>
                      )}

                      {(method === "paypal_email" || method === "paypal") && (
                        <motion.div key="paypal" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-1.5 overflow-hidden">
                          <Label className="text-[11px] font-semibold text-muted-foreground">PayPal Email *</Label>
                          <Input placeholder="paypal@email.com" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} className="h-11 rounded-xl border-border/40" />
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Note */}
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-semibold text-muted-foreground">Note (optional)</Label>
                      <Textarea placeholder="Message to recipient..." value={narration}
                        onChange={(e) => setNarration(e.target.value)} rows={2} className="rounded-xl border-border/40 resize-none" />
                    </div>
                  </CardContent>
                </Card>

                <motion.div whileTap={{ scale: 0.98 }}>
                  <Button
                    className="w-full h-13 rounded-2xl text-sm font-bold"
                    disabled={!recipientValid() || quoteMut.isPending}
                    onClick={() => quoteMut.mutate()}
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

            {/* ═══ STEP 3: REVIEW ═══ */}
            {step === "review" && quote && (
              <motion.div key="review" custom={dir} variants={pageVar} initial="enter" animate="center" exit="exit" className="space-y-4">
                <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  onClick={() => goTo("recipient", -1)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <ArrowLeft className="h-3.5 w-3.5" /> Edit details
                </motion.button>

                <Card className="border-0 shadow-lg overflow-hidden">
                  <div className="text-center py-5 px-4" style={{ background: "linear-gradient(135deg, hsl(var(--primary) / 0.06), hsl(var(--primary) / 0.02))" }}>
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <span className="text-2xl">{srcFlag}</span>
                      <motion.div animate={{ x: [0, 4, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                        <ArrowRight className="h-4 w-4 text-primary" />
                      </motion.div>
                      <span className="text-2xl">{destFlag}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mb-1">Recipient gets</p>
                    <motion.p initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                      className="text-3xl font-extrabold text-primary">
                      {(quote.amount_out || quote.receive_amount || converted).toLocaleString()}
                      <span className="text-base text-muted-foreground ml-1.5">{destCur}</span>
                    </motion.p>
                  </div>

                  <CardContent className="p-4 space-y-3">
                    <div className="rounded-2xl bg-muted/20 border border-border/30 p-3.5 space-y-2.5">
                      {[
                        { l: "You Send", v: `${numAmt.toLocaleString()} ${srcRate.code}` },
                        { l: `Fee (${(feePct * 100).toFixed(1)}%)`, v: `${(quote.fee_total || quote.fee || fee).toFixed(0)} ${srcRate.code}`, color: "text-destructive" },
                        { l: "Rate", v: rateLabel },
                        { l: "Delivery", v: estDelivery },
                      ].map((row) => (
                        <div key={row.l} className="flex justify-between items-center">
                          <span className="text-[11px] text-muted-foreground">{row.l}</span>
                          <span className={`text-[11px] font-semibold ${row.color || "text-foreground"}`}>{row.v}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border/30">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary/10 shrink-0">
                        <User className="h-4 w-4 text-secondary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">{recipientName}</p>
                        <p className="text-[10px] text-muted-foreground">{dest?.country} · {dm(method).label}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2 rounded-xl bg-primary/5 border border-primary/10 p-3">
                      <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        By confirming, you agree this transfer is lawful and recipient details are correct.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1 rounded-2xl h-12" onClick={() => goTo("recipient", -1)}>Edit</Button>
                  <motion.div className="flex-1" whileTap={{ scale: 0.97 }}>
                    <Button className="w-full rounded-2xl h-12 font-bold" disabled={!canSubmitRoute} onClick={confirmAndSend}>
                      <Send className="h-4 w-4 mr-2" /> Confirm & Send
                    </Button>
                  </motion.div>
                </div>
              </motion.div>
            )}

            {/* ═══ SENDING (live status) ═══ */}
            {step === "sending" && (
              <motion.div key="sending" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-20 gap-6">
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                  className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                  <Send className="h-8 w-8 text-primary" />
                </motion.div>
                <div className="text-center">
                  <h2 className="text-lg font-bold text-foreground">
                    {liveStatus === "received" ? "Funds on the Way" : liveStatus === "credited" ? "Delivered!" : "Processing Transfer"}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    {liveStatus === "received" ? "Your money is being delivered to the recipient…" : liveStatus === "pending" ? "Initiating payout…" : "Securing your funds…"}
                  </p>
                </div>
                {/* Status dots */}
                <div className="flex items-center gap-3">
                  {["pending", "received", "credited"].map((s, i) => {
                    const reached = ["pending", "received", "credited"].indexOf(liveStatus) >= i;
                    return (
                      <div key={s} className="flex items-center gap-1.5">
                        <motion.div
                          className={`h-3 w-3 rounded-full ${reached ? "bg-primary" : "bg-muted"}`}
                          animate={s === liveStatus ? { scale: [1, 1.3, 1] } : {}}
                          transition={{ repeat: Infinity, duration: 1.5 }}
                        />
                        <span className={`text-[10px] font-medium ${reached ? "text-foreground" : "text-muted-foreground"}`}>
                          {s === "pending" ? "Processing" : s === "received" ? "In Transit" : "Delivered"}
                        </span>
                        {i < 2 && <div className={`w-6 h-0.5 ${reached ? "bg-primary/40" : "bg-muted"}`} />}
                      </div>
                    );
                  })}
                </div>
                <motion.div className="w-48 h-1.5 rounded-full bg-muted overflow-hidden">
                  <motion.div className="h-full bg-primary rounded-full" initial={{ width: "0%" }}
                    animate={{ width: liveStatus === "credited" ? "100%" : liveStatus === "received" ? "66%" : "33%" }}
                    transition={{ duration: 1, ease: "easeInOut" }} />
                </motion.div>
              </motion.div>
            )}

            {/* ═══ SUCCESS 🎉 ═══ */}
            {step === "success" && (
              <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 22 }} className="relative space-y-4">
                <ConfettiBurst />
                <Card className="border-0 shadow-xl overflow-hidden">
                  <div className="relative py-8 text-center overflow-hidden" style={{ background: "linear-gradient(135deg, hsl(142 76% 36% / 0.12), hsl(142 76% 36% / 0.04))" }}>
                    <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", stiffness: 400, damping: 15, delay: 0.3 }}
                      className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-lg">
                      <CheckCircle className="h-10 w-10 text-secondary" />
                    </motion.div>
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
                      <h2 className="text-xl font-extrabold text-foreground flex items-center justify-center gap-2">
                        Transfer Sent! <PartyPopper className="h-5 w-5" style={{ color: "hsl(38 92% 50%)" }} />
                      </h2>
                      <p className="text-xs text-muted-foreground mt-1">
                        <strong className="text-foreground">{numAmt.toLocaleString()} {srcRate.code}</strong> is on its way
                      </p>
                    </motion.div>
                  </div>
                  <CardContent className="p-4 space-y-4">
                    <div className="rounded-2xl bg-muted/20 border border-border/30 p-3.5 space-y-2.5">
                      {[
                        { l: "Reference", v: txRef },
                        { l: "Recipient", v: recipientName },
                        { l: "Receives", v: `${converted.toLocaleString()} ${destCur}` },
                        { l: "Via", v: dm(method).label },
                      ].map((row) => (
                        <div key={row.l} className="flex justify-between items-center">
                          <span className="text-[11px] text-muted-foreground">{row.l}</span>
                          <span className="text-[11px] font-semibold text-foreground">{row.v}</span>
                        </div>
                      ))}
                    </div>
                    {txRef && (
                      <motion.button whileTap={{ scale: 0.97 }} onClick={() => copyRef(txRef)}
                        className="w-full flex items-center justify-center gap-2 rounded-xl border border-border/40 py-2.5 text-xs font-medium text-muted-foreground hover:bg-muted/30 transition-colors">
                        <Copy className="h-3.5 w-3.5" /> Copy Reference
                      </motion.button>
                    )}
                    <div className="flex gap-3">
                      <motion.div className="flex-1" whileTap={{ scale: 0.97 }}>
                        <Button variant="outline" onClick={reset} className="w-full rounded-2xl h-12 font-semibold">
                          <RefreshCw className="h-4 w-4 mr-2" /> Send Another
                        </Button>
                      </motion.div>
                      <motion.div className="flex-1" whileTap={{ scale: 0.97 }}>
                        <Button onClick={() => { setTab("history"); reset(); }} className="w-full rounded-2xl h-12 font-semibold">
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

        {/* ── HISTORY TAB ── */}
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
                const tFlag = COUNTRY_META[t.receiver_country]?.flag || "🌍";
                const tName = COUNTRY_META[t.receiver_country]?.name || t.receiver_country;
                return (
                  <motion.div key={t.id} custom={i} variants={stagger} initial="hidden" animate="show">
                    <Card className="cursor-pointer border-border/40 hover:border-primary/30 hover:shadow-md transition-all active:scale-[0.98]"
                      onClick={() => trackMut.mutate(t.id)}>
                      <CardContent className="p-3.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{tFlag}</span>
                            <div>
                              <p className="text-sm font-semibold text-foreground">{t.receiver_name}</p>
                              <p className="text-[10px] text-muted-foreground">{tName} · {dm(t.delivery_method || "").label}</p>
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

      {/* ── Tracking Dialog ── */}
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
                {trackDialog.events?.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-foreground mb-3">Timeline</p>
                    {trackDialog.events.map((ev: any, idx: number) => {
                      const isLast = idx === trackDialog.events.length - 1;
                      return (
                        <div key={ev.id} className="flex gap-3 items-start relative">
                          <div className="flex flex-col items-center">
                            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: idx * 0.1 }}
                              className={`flex h-8 w-8 items-center justify-center rounded-xl z-10 ${isLast ? "bg-primary/15" : "bg-muted/50"}`}>
                              {isLast ? <Sparkles className="h-3.5 w-3.5 text-primary" /> : <Clock className="h-3 w-3 text-muted-foreground" />}
                            </motion.div>
                            {!isLast && <div className="w-0.5 flex-1 bg-border/50" style={{ minHeight: 20 }} />}
                          </div>
                          <div className={`pt-1 ${isLast ? "" : "pb-4"}`}>
                            <p className="text-xs font-semibold text-foreground capitalize">{(ev.event_type || "").replace(/_/g, " ")}</p>
                            <p className="text-[10px] text-muted-foreground">{new Date(ev.created_at).toLocaleString()}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      <PinConfirmDialog open={showPin} onOpenChange={setShowPin} onConfirmed={executeSend} />
    </div>
  );
}
