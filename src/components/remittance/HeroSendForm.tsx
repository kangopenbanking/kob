import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSupportedCountries } from "@/hooks/useSupportedCountries";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight, Shield, Zap, Smartphone, CheckCircle2, Clock, Banknote,
  TrendingUp, Lock, ChevronDown, Repeat, Send, Loader2, CheckCircle,
  ArrowLeft, Landmark, Receipt, Globe, CreditCard, Mail, AlertTriangle,
  ArrowUpDown, User, Phone, Building2, FileText, Sparkles,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

type Step = "amount" | "recipient" | "review" | "sending" | "done";

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

interface CurrencyOption {
  code: string;
  name: string;
  flag: string;
  rate: number;
  fee_pct: number;
}

interface DestOption {
  currency: string;
  country: string;
  flag: string;
  countryCode: string;
}

/* ═══════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════ */

const COUNTRY_META: Record<string, { name: string; flag: string; currency: string }> = {
  CM: { name: "Cameroon", flag: "🇨🇲", currency: "XAF" },
  NG: { name: "Nigeria", flag: "🇳🇬", currency: "NGN" },
  GH: { name: "Ghana", flag: "🇬🇭", currency: "GHS" },
  KE: { name: "Kenya", flag: "🇰🇪", currency: "KES" },
  SN: { name: "Senegal", flag: "🇸🇳", currency: "XOF" },
  GA: { name: "Gabon", flag: "🇬🇦", currency: "XAF" },
  CG: { name: "Congo", flag: "🇨🇬", currency: "XAF" },
  TD: { name: "Chad", flag: "🇹🇩", currency: "XAF" },
  US: { name: "United States", flag: "🇺🇸", currency: "USD" },
  CA: { name: "Canada", flag: "🇨🇦", currency: "CAD" },
  FR: { name: "France", flag: "🇫🇷", currency: "EUR" },
  GB: { name: "United Kingdom", flag: "🇬🇧", currency: "GBP" },
  DE: { name: "Germany", flag: "🇩🇪", currency: "EUR" },
};

const METHOD_META: Record<string, { label: string; icon: typeof Smartphone; accent: string }> = {
  mobile_money:  { label: "Mobile Money",  icon: Smartphone, accent: "emerald" },
  wallet:        { label: "KOB Wallet",    icon: Smartphone, accent: "blue" },
  bank_transfer: { label: "Bank Transfer", icon: Landmark,   accent: "violet" },
  bill_payment:  { label: "Bills & Fees",  icon: Receipt,    accent: "amber" },
  paypal_email:  { label: "PayPal",        icon: Mail,       accent: "sky" },
};

const METHOD_MAP: Record<string, string> = {
  mobile_money: "mobile_wallet", wallet: "mobile_wallet",
  bank_transfer: "bank_transfer", bill_payment: "bill_payment", paypal_email: "paypal_email",
};

const BILL_PURPOSES = [
  { value: "school_fees", label: "School Fees" },
  { value: "utilities", label: "Utilities" },
  { value: "medical", label: "Medical Bills" },
  { value: "rent", label: "Rent / Housing" },
  { value: "other", label: "Other" },
];

const ease = [0.22, 1, 0.36, 1] as const;

/* ═══════════════════════════════════════════════════════════════
   Hooks
   ═══════════════════════════════════════════════════════════════ */

function useCorridors() {
  return useQuery({
    queryKey: ["remittance-corridors-hero"],
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
  const [currencies, setCurrencies] = useState<CurrencyOption[]>([
    { code: "EUR", name: "Euro", flag: "🇪🇺", rate: 655.957, fee_pct: 0.5 },
    { code: "USD", name: "US Dollar", flag: "🇺🇸", rate: 605.22, fee_pct: 0.8 },
    { code: "GBP", name: "British Pound", flag: "🇬🇧", rate: 765.43, fee_pct: 0.6 },
    { code: "CAD", name: "Canadian Dollar", flag: "🇨🇦", rate: 445.18, fee_pct: 0.7 },
    { code: "CHF", name: "Swiss Franc", flag: "🇨🇭", rate: 680.50, fee_pct: 0.5 },
    { code: "XAF", name: "CFA Franc", flag: "🇨🇲", rate: 1, fee_pct: 0.5 },
  ]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from("admin_exchange_rates")
          .select("base_currency, rate, effective_rate, margin_percentage")
          .eq("is_active", true)
          .eq("target_currency", "XAF");
        if (!data?.length) return;
        const flagMap: Record<string, { flag: string; name: string }> = {
          EUR: { flag: "🇪🇺", name: "Euro" }, USD: { flag: "🇺🇸", name: "US Dollar" },
          GBP: { flag: "🇬🇧", name: "British Pound" }, CAD: { flag: "🇨🇦", name: "Canadian Dollar" },
          CHF: { flag: "🇨🇭", name: "Swiss Franc" }, XAF: { flag: "🇨🇲", name: "CFA Franc" },
        };
        const merged = currencies.map((dc) => {
          const admin = data.find((d: any) => d.base_currency === dc.code);
          return admin ? { ...dc, rate: Number(admin.effective_rate || admin.rate), fee_pct: Number(admin.margin_percentage) || dc.fee_pct } : dc;
        });
        data.forEach((d: any) => {
          if (!merged.find((m) => m.code === d.base_currency)) {
            const info = flagMap[d.base_currency] || { flag: "🌍", name: d.base_currency };
            merged.push({ code: d.base_currency, name: info.name, flag: info.flag, rate: Number(d.effective_rate || d.rate), fee_pct: Number(d.margin_percentage) || 0.5 });
          }
        });
        setCurrencies(merged);
      } catch { /* fallback */ }
    })();
  }, []);
  return currencies;
}

function useBanks() {
  const [banks, setBanks] = useState<{ code: string; name: string }[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const { data: institutions } = await supabase.from("institutions").select("id, institution_name, swift_code").eq("status", "approved").order("institution_name");
        const partnerBanks = (institutions || []).map((inst: any) => ({ code: inst.swift_code || inst.id, name: `${inst.institution_name} ⭐` }));
        try {
          const { data: fwData } = await supabase.functions.invoke("flutterwave-list-banks", { body: { country: "CM" } });
          const fwBanks = (fwData?.banks || []).map((b: any) => ({ code: b.code || b.id?.toString(), name: b.name }));
          const seen = new Set(partnerBanks.map((b: any) => b.name.replace(" ⭐", "")));
          setBanks([...partnerBanks, ...fwBanks.filter((b: any) => !seen.has(b.name))]);
        } catch { setBanks(partnerBanks); }
      } catch {
        setBanks([
          { code: "ECOCCMCX", name: "Ecobank Cameroun" }, { code: "SGCMCMCX", name: "Société Générale Cameroun" },
          { code: "AFRIKMCX", name: "Afriland First Bank" }, { code: "BICECMCX", name: "BICEC" }, { code: "CBARCMCX", name: "UBA Cameroon" },
        ]);
      }
    })();
  }, []);
  return banks;
}

/* ═══════════════════════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════════════════════ */

function StepIndicator({ current, steps }: { current: number; steps: string[] }) {
  return (
    <div className="flex items-center gap-1 mb-7">
      {steps.map((label, i) => (
        <React.Fragment key={label}>
          <div className="flex flex-col items-center flex-1 gap-1">
            <motion.div
              className={`h-1 w-full rounded-full ${i <= current ? "bg-primary" : "bg-border/40"}`}
              animate={{ scaleY: i === current ? 1.8 : 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
            />
            <span className={`text-[10px] font-bold tracking-wide ${i <= current ? "text-primary" : "text-muted-foreground/40"}`}>
              {label}
            </span>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

function CurrencyPicker({ items, selectedIdx, onSelect, open, onToggle }: {
  items: { flag: string; code: string; name: string }[];
  selectedIdx: number;
  onSelect: (i: number) => void;
  open: boolean;
  onToggle: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onToggle();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onToggle]);

  const sel = items[selectedIdx] || items[0];
  if (!sel) return <div className="flex items-center px-4 h-14 rounded-r-2xl bg-muted/50 min-w-[120px] justify-center"><span className="text-xs text-muted-foreground">Loading…</span></div>;
  return (
    <div className="relative" ref={ref}>
      <button onClick={onToggle}
        className="flex items-center gap-2 px-4 h-14 rounded-r-2xl bg-muted/50 hover:bg-muted/70 transition-all font-semibold text-sm min-w-[120px] justify-center border-l border-border/30">
        <span className="text-lg">{sel.flag}</span>
        <span className="font-bold">{sel.code}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.18, ease }}
            className="absolute right-0 top-[calc(100%+6px)] bg-background/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-border/50 z-50 min-w-[250px] max-h-[300px] overflow-y-auto p-1"
          >
            {items.map((item, i) => (
              <button key={item.code}
                onClick={() => { onSelect(i); onToggle(); }}
                className={`flex items-center gap-3 w-full px-3.5 py-2.5 rounded-xl text-sm transition-colors ${
                  i === selectedIdx ? "bg-primary/10 text-primary font-bold" : "hover:bg-muted/50 text-foreground"
                }`}>
                <span className="text-lg">{item.flag}</span>
                <span className="font-semibold">{item.code}</span>
                <span className="text-muted-foreground text-xs ml-auto truncate max-w-[100px]">{item.name}</span>
                {i === selectedIdx && <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════ */

export function HeroSendForm() {
  const currencies = useRates();
  const banks = useBanks();
  const { data: supportedCountries } = useSupportedCountries("consumer");
  const { data: corridors, isLoading: loadingCorridors, isError: errorCorridors } = useCorridors();
  const navigate = useNavigate();

  // ── State ──
  const [step, setStep] = useState<Step>("amount");
  const [amount, setAmount] = useState("1000");
  const [srcIdx, setSrcIdx] = useState(0);
  const [destIdx, setDestIdx] = useState(0);
  const [srcOpen, setSrcOpen] = useState(false);
  const [destOpen, setDestOpen] = useState(false);
  const [method, setMethod] = useState("");

  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [dialCode, setDialCode] = useState("+237");
  const [dialOpen, setDialOpen] = useState(false);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [billPurpose, setBillPurpose] = useState("");
  const [billRef, setBillRef] = useState("");

  const [suggestions, setSuggestions] = useState<{ id: string; full_name: string; phone: string }[]>([]);
  const [showSugg, setShowSugg] = useState(false);
  const [searching, setSearching] = useState(false);
  const nameRef = useRef<HTMLDivElement>(null);
  const dialRef = useRef<HTMLDivElement>(null);

  const [quote, setQuote] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [txRef, setTxRef] = useState("");

  // ── Derived: Source countries from corridors ──
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

  // Reset srcIdx if out of bounds
  const safeSrcIdx = srcIdx < srcCountries.length ? srcIdx : 0;
  const srcCountry = srcCountries[safeSrcIdx];
  const srcCur = srcCountry?.currency || "EUR";
  const srcFlag = srcCountry?.flag || "🌍";

  // Find matching rate for source currency
  const srcRate = useMemo(() => {
    const entry = currencies.find((c) => c.code === srcCur);
    return entry || { code: srcCur, name: srcCur, flag: srcFlag, rate: 1, fee_pct: 0.5 };
  }, [currencies, srcCur, srcFlag]);

  const numAmt = parseFloat(amount) || 0;
  const feePct = (srcRate.fee_pct || 0.5) / 100;
  const fee = Math.round(numAmt * feePct * 100) / 100;

  // Destination countries filtered by selected source country
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

  // Reset destIdx when source changes
  useEffect(() => {
    setDestIdx(0);
  }, [safeSrcIdx]);

  const safeDestIdx = destIdx < destCountries.length ? destIdx : 0;
  const dest = destCountries[safeDestIdx];
  const destCur = dest?.currency || "XAF";
  const destFlag = dest?.flag || "🇨🇲";

  const converted = useMemo(() => {
    const net = numAmt - fee;
    if (net <= 0) return 0;
    const toXaf = srcRate.rate;
    if (destCur === "XAF") return Math.round(net * toXaf);
    const destEntry = currencies.find((c) => c.code === destCur);
    if (destEntry && destEntry.rate > 0) return Math.round(net * (toXaf / destEntry.rate) * 100) / 100;
    if (srcRate.code === destCur) return Math.round(net * 100) / 100;
    return Math.round(net * toXaf);
  }, [numAmt, fee, srcRate.rate, srcRate.code, destCur, currencies]);

  const rateLabel = useMemo(() => {
    if (destCur === "XAF") return `1 ${srcRate.code} = ${srcRate.rate.toLocaleString()} XAF`;
    const de = currencies.find((c) => c.code === destCur);
    if (de && de.rate > 0) return `1 ${srcRate.code} = ${(srcRate.rate / de.rate).toFixed(4)} ${destCur}`;
    return `1 ${srcRate.code} = ${srcRate.rate.toLocaleString()} XAF`;
  }, [srcRate, destCur, currencies]);

  const methods = useMemo(() => {
    if (!corridors || !dest) return [];
    const matching = corridors.filter((c) => c.to_country === dest.countryCode && c.to_currency === dest.currency);
    const set = new Set<string>();
    matching.forEach((c) => (c.delivery_methods || []).forEach((m: string) => set.add(m)));
    return Array.from(set);
  }, [corridors, dest]);

  const estDelivery = useMemo(() => {
    if (!corridors || !dest) return "Instant";
    const match = corridors.find((c) => c.to_country === dest.countryCode && (c.delivery_methods || []).includes(method));
    if (!match?.est_delivery_seconds) return "Instant";
    const s = match.est_delivery_seconds;
    if (s < 60) return "Instant";
    if (s < 3600) return `~${Math.round(s / 60)} min`;
    return `~${Math.round(s / 3600)}h`;
  }, [corridors, dest, method]);

  // Auto-select method
  useEffect(() => {
    if (methods.length > 0 && !methods.includes(method)) setMethod(methods[0]);
  }, [methods, method]);

  // Phone countries
  const phoneCountries = useMemo(() => {
    if (!supportedCountries?.length) {
      return [
        { code: "+237", country: "Cameroon", flag: "🇨🇲" },
        { code: "+234", country: "Nigeria", flag: "🇳🇬" },
        { code: "+233", country: "Ghana", flag: "🇬🇭" },
        { code: "+254", country: "Kenya", flag: "🇰🇪" },
        { code: "+1", country: "USA", flag: "🇺🇸" },
        { code: "+33", country: "France", flag: "🇫🇷" },
        { code: "+44", country: "UK", flag: "🇬🇧" },
      ];
    }
    return supportedCountries.map((c) => ({ code: c.dial_code || c.code, country: c.country, flag: c.flag }));
  }, [supportedCountries]);

  // Click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (nameRef.current && !nameRef.current.contains(e.target as Node)) setShowSugg(false);
      if (dialRef.current && !dialRef.current.contains(e.target as Node)) setDialOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Name search
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
          const m = sorted.find((c) => p.startsWith(c.code));
          if (m) { setDialCode(m.code); setRecipientPhone(p.slice(m.code.length)); }
          else setRecipientPhone(p.replace(/^\+\d{1,4}/, ""));
        }
      } catch { /* silent */ }
    }
  };

  // Validation
  const recipientValid = useCallback(() => {
    if (!recipientName.trim()) return false;
    if (method === "mobile_money" || method === "wallet") return /^\d{6,12}$/.test(recipientPhone.replace(/\s/g, ""));
    if (method === "bank_transfer") return !!(bankCode && accountNumber.trim());
    if (method === "bill_payment") return !!(billPurpose && billRef.trim());
    if (method === "paypal_email") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail);
    return true;
  }, [recipientName, recipientPhone, method, bankCode, accountNumber, billPurpose, billRef, recipientEmail]);

  // ── Actions ──
  const getQuote = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate(`/app/send-money?amount=${amount}&currency=${srcRate.code}&dest=${method}`); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("remittance-outbound", {
        body: {
          action: "get_quote", amount: numAmt, source_currency: srcRate.code,
          destination_currency: destCur, delivery_method: METHOD_MAP[method] || method,
          destination_country: dest.countryCode,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setQuote(data?.quote || { fee, rate: srcRate.rate, receive_amount: converted, delivery_estimate: estDelivery });
      setStep("review");
    } catch {
      setQuote({ fee, rate: srcRate.rate, receive_amount: converted, delivery_estimate: estDelivery, source: "estimate" });
      setStep("review");
    } finally { setBusy(false); }
  };

  const confirmSend = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate("/app/send-money"); return; }
    setStep("sending");
    try {
      const rd: any = { name: recipientName };
      if (method === "mobile_money" || method === "wallet") rd.phone = `${dialCode}${recipientPhone.replace(/\s/g, "")}`;
      else if (method === "bank_transfer") { rd.bank_code = bankCode; rd.account_number = accountNumber; }
      else if (method === "paypal_email") rd.email = recipientEmail;
      else { rd.purpose = billPurpose; rd.reference = billRef; }
      const { data, error } = await supabase.functions.invoke("remittance-outbound", {
        body: {
          action: "send", amount: numAmt, source_currency: srcRate.code,
          destination_currency: destCur, delivery_method: METHOD_MAP[method] || method,
          destination_country: dest.countryCode, recipient: rd,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setTxRef(data?.reference || data?.id || "TX-" + Date.now().toString(36).toUpperCase());
      setStep("done");
    } catch (err: any) {
      toast.error(err.message || "Transfer failed");
      setStep("review");
    }
  };

  const reset = () => {
    setStep("amount"); setRecipientName(""); setRecipientPhone(""); setRecipientEmail("");
    setDialCode("+237"); setBankCode(""); setAccountNumber(""); setBillPurpose(""); setBillRef("");
    setQuote(null); setTxRef(""); setSuggestions([]); setShowSugg(false);
  };

  // ── Step index for progress ──
  const stepIdx = step === "amount" ? 0 : step === "recipient" ? 1 : step === "review" ? 2 : 3;

  /* ═══════════════════════════════════════════════════════════════
     Render helpers
     ═══════════════════════════════════════════════════════════════ */

  const methodColor = (accent: string, active: boolean) => {
    const map: Record<string, { bg: string; border: string; text: string }> = {
      emerald: { bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-300 dark:border-emerald-700", text: "text-emerald-600 dark:text-emerald-400" },
      blue:    { bg: "bg-blue-50 dark:bg-blue-950/30",    border: "border-blue-300 dark:border-blue-700",    text: "text-blue-600 dark:text-blue-400" },
      violet:  { bg: "bg-violet-50 dark:bg-violet-950/30",  border: "border-violet-300 dark:border-violet-700",  text: "text-violet-600 dark:text-violet-400" },
      amber:   { bg: "bg-amber-50 dark:bg-amber-950/30",   border: "border-amber-300 dark:border-amber-700",   text: "text-amber-600 dark:text-amber-400" },
      sky:     { bg: "bg-sky-50 dark:bg-sky-950/30",     border: "border-sky-300 dark:border-sky-700",     text: "text-sky-600 dark:text-sky-400" },
    };
    const c = map[accent] || map.blue;
    if (active) return `border-primary bg-primary/10 text-primary shadow-md shadow-primary/10`;
    return `${c.bg} ${c.border} ${c.text}`;
  };

  /* ═══════════════════════════════════════════════════════════════
     DONE
     ═══════════════════════════════════════════════════════════════ */
  if (step === "done") {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease }}
        className="bg-background rounded-3xl shadow-2xl border border-border/30 p-7 lg:p-9 w-full max-w-md text-center">
        <StepIndicator current={3} steps={["Amount", "Recipient", "Review", "Done"]} />
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, delay: 0.15 }}>
          <div className="h-20 w-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-5">
            <CheckCircle className="h-10 w-10 text-primary" />
          </div>
        </motion.div>
        <h3 className="text-2xl font-bold text-foreground mb-1">Transfer Initiated! 🎉</h3>
        <p className="text-muted-foreground text-sm mb-6">
          <span className="font-bold text-foreground">{numAmt.toLocaleString()} {srcRate.code}</span> is on its way
        </p>
        <div className="bg-muted/30 rounded-2xl p-5 mb-6 text-left space-y-3">
          {[
            { l: "Reference", v: txRef, mono: true },
            { l: "Recipient", v: recipientName },
            { l: "Receives", v: `${converted.toLocaleString()} ${destCur}`, hl: true },
            { l: "Via", v: METHOD_META[method]?.label || method },
          ].map((r) => (
            <div key={r.l} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{r.l}</span>
              <span className={`font-semibold ${r.hl ? "text-primary" : "text-foreground"} ${r.mono ? "font-mono text-xs" : ""}`}>{r.v}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={reset} className="flex-1 rounded-2xl h-12 font-semibold">Send Another</Button>
          <Link to="/app/send-money" className="flex-1"><Button className="w-full rounded-2xl h-12 font-semibold">View Transfers</Button></Link>
        </div>
      </motion.div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     SENDING (processing spinner)
     ═══════════════════════════════════════════════════════════════ */
  if (step === "sending") {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="bg-background rounded-3xl shadow-2xl border border-border/30 p-7 lg:p-9 w-full max-w-md text-center">
        <StepIndicator current={3} steps={["Amount", "Recipient", "Review", "Done"]} />
        <Loader2 className="h-14 w-14 text-primary mx-auto animate-spin mb-5" />
        <h3 className="text-xl font-bold text-foreground mb-2">Processing Transfer</h3>
        <p className="text-muted-foreground text-sm">Securely routing your funds…</p>
      </motion.div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     REVIEW
     ═══════════════════════════════════════════════════════════════ */
  if (step === "review" && quote) {
    return (
      <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, ease }}
        className="bg-background rounded-3xl shadow-2xl border border-border/30 p-7 lg:p-9 w-full max-w-md">
        <StepIndicator current={2} steps={["Amount", "Recipient", "Review", "Done"]} />

        <button onClick={() => setStep("recipient")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5 group transition-colors">
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" /> Edit details
        </button>

        <h3 className="text-lg font-bold text-foreground mb-5">Confirm your transfer</h3>

        {/* Amount summary */}
        <div className="rounded-2xl bg-muted/20 border border-border/30 p-5 space-y-3 mb-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">You send</span>
            <span className="font-bold text-foreground">{numAmt.toLocaleString()} {srcRate.code}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Fee ({srcRate.fee_pct}%)</span>
            <span className="font-semibold text-foreground">{(quote.fee || fee).toFixed(2)} {srcRate.code}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Rate</span>
            <span className="font-semibold text-foreground">{rateLabel}</span>
          </div>
          <div className="border-t border-border/30 pt-3 flex justify-between items-center">
            <span className="text-sm font-medium text-muted-foreground">Recipient gets</span>
            <span className="text-xl font-bold text-primary">{(quote.receive_amount || converted).toLocaleString()} {destCur}</span>
          </div>
        </div>

        {/* Recipient summary */}
        <div className="rounded-2xl bg-muted/10 border border-border/20 p-4 space-y-2.5 mb-5">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">To</span>
            <span className="font-semibold text-foreground">{recipientName}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Via</span>
            <span className="font-semibold text-foreground">{METHOD_META[method]?.label || method}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Delivery</span>
            <span className="font-semibold text-primary flex items-center gap-1"><Zap className="h-3 w-3" />{quote.delivery_estimate || estDelivery}</span>
          </div>
        </div>

        {quote.source === "estimate" && (
          <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-xl p-3 text-center mb-4 flex items-center justify-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Estimated quote — final amounts may vary slightly.
          </p>
        )}

        <Button onClick={confirmSend}
          className="w-full h-14 rounded-2xl text-base font-bold shadow-lg hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all gap-2" size="lg">
          <Send className="h-5 w-5" /> Confirm & Send
        </Button>
      </motion.div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     MAIN FORM (Amount + Recipient steps combined in one card)
     ═══════════════════════════════════════════════════════════════ */
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2, ease }}
      className="bg-background rounded-3xl shadow-2xl border border-border/30 p-7 lg:p-9 w-full max-w-md"
    >
      <StepIndicator current={stepIdx} steps={["Amount", "Recipient", "Review", "Done"]} />

      {/* Back button on recipient step */}
      <AnimatePresence>
        {step === "recipient" && (
          <motion.button initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
            onClick={() => setStep("amount")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 group transition-colors">
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" /> Back
          </motion.button>
        )}
      </AnimatePresence>

      {/* Loading / Error / Empty corridors */}
      {loadingCorridors && (
        <div className="flex items-center gap-2 bg-muted/30 rounded-2xl p-3 mb-4">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground">Loading corridors…</span>
        </div>
      )}
      {errorCorridors && (
        <div className="flex items-center gap-2 bg-destructive/10 rounded-2xl p-3 mb-4">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <span className="text-xs text-destructive">Failed to load corridors. Please refresh.</span>
        </div>
      )}
      {!loadingCorridors && !errorCorridors && destCountries.length === 0 && (
        <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/30 rounded-2xl p-3 mb-4">
          <Globe className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <span className="text-xs text-amber-700 dark:text-amber-300">No corridors available at the moment.</span>
        </div>
      )}

      <AnimatePresence mode="wait">
        {/* ── STEP: AMOUNT ── */}
        {step === "amount" && (
          <motion.div key="amount" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.3, ease }}>
            {/* You send */}
            <div className="mb-5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">You send</label>
              <div className="flex items-center rounded-2xl border-2 border-border/50 focus-within:border-primary/60 transition-colors overflow-hidden bg-background">
                <Input
                  type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
                  className="border-0 text-2xl font-bold h-14 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent pl-5 flex-1"
                  placeholder="0"
                />
                <CurrencyPicker
                  items={srcCountries.map((c) => ({ flag: c.flag, code: c.currency, name: c.country }))}
                  selectedIdx={safeSrcIdx} onSelect={setSrcIdx}
                  open={srcOpen} onToggle={() => srcCountries.length > 1 ? setSrcOpen(!srcOpen) : undefined}
                />
              </div>
            </div>

            {/* Live rate strip */}
            <div className="flex items-center justify-between py-3 px-1 mb-5 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <ArrowUpDown className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="font-medium">{rateLabel}</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span className="font-semibold text-primary">{estDelivery}</span>
              </div>
            </div>

            {/* Recipient gets */}
            <div className="mb-5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Recipient gets</label>
              <div className="flex items-center rounded-2xl border-2 border-border/50 overflow-hidden bg-muted/5">
                <div className="flex-1 pl-5 py-3.5">
                  <motion.span key={converted} initial={{ opacity: 0.5, y: 2 }} animate={{ opacity: 1, y: 0 }}
                    className="text-2xl font-bold text-foreground">{converted.toLocaleString()}</motion.span>
                </div>
                <CurrencyPicker
                  items={destCountries.map((d) => ({ flag: d.flag, code: d.currency, name: d.country }))}
                  selectedIdx={destIdx} onSelect={setDestIdx}
                  open={destOpen} onToggle={() => destCountries.length > 1 ? setDestOpen(!destOpen) : undefined}
                />
              </div>
              {/* Fee tag */}
              <div className="flex items-center gap-2 mt-2.5 text-xs text-muted-foreground">
                <Banknote className="h-3 w-3" />
                <span>Fee: <strong className="text-foreground">{fee.toFixed(2)} {srcRate.code}</strong> ({srcRate.fee_pct}%)</span>
              </div>
            </div>

            {/* Delivery method pills */}
            {methods.length > 0 && (
              <div className="mb-6">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2.5 block">
                  Deliver to {dest?.country || ""}
                </label>
                <div className={`grid gap-2 ${methods.length <= 2 ? "grid-cols-2" : methods.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
                  {methods.map((m) => {
                    const meta = METHOD_META[m] || { label: m, icon: Globe, accent: "blue" };
                    const Icon = meta.icon;
                    const active = method === m;
                    return (
                      <motion.button key={m} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }}
                        onClick={() => setMethod(m)}
                        className={`flex flex-col items-center gap-1.5 rounded-2xl p-3 text-xs font-semibold border-2 transition-all duration-200 ${methodColor(meta.accent, active)}`}>
                        <div className={`h-8 w-8 rounded-xl flex items-center justify-center ${active ? "bg-primary/20" : "bg-background/60"}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <span>{meta.label}</span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            )}

            <Button onClick={() => {
              if (numAmt <= 0) { toast.error("Enter an amount to send"); return; }
              if (!method) { toast.error("Select a delivery method"); return; }
              setStep("recipient");
            }}
              disabled={destCountries.length === 0}
              className="w-full h-14 rounded-2xl text-base font-bold shadow-lg hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all gap-2" size="lg">
              Continue <ArrowRight className="h-5 w-5" />
            </Button>
          </motion.div>
        )}

        {/* ── STEP: RECIPIENT ── */}
        {step === "recipient" && (
          <motion.div key="recipient" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.3, ease }}
            className="space-y-4">

            {/* Transfer summary chip */}
            <div className="flex items-center justify-between bg-primary/5 rounded-2xl px-4 py-3 mb-1">
              <div className="flex items-center gap-2">
                <span className="text-lg">{srcRate.flag}</span>
                <span className="font-bold text-sm text-foreground">{numAmt.toLocaleString()} {srcRate.code}</span>
              </div>
              <ArrowRight className="h-4 w-4 text-primary" />
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-primary">{converted.toLocaleString()} {destCur}</span>
                <span className="text-lg">{destFlag}</span>
              </div>
            </div>

            {/* Recipient name with autocomplete */}
            <div className="space-y-1.5 relative" ref={nameRef}>
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <User className="h-3 w-3" /> Recipient name
              </Label>
              <div className="relative">
                <Input value={recipientName} onChange={(e) => setRecipientName(e.target.value)}
                  className="h-12 rounded-2xl pr-12" placeholder="Full name" />
                {searching && <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                {!searching && recipientName.length >= 2 && suggestions.length === 0 && (
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-md">New</span>
                )}
              </div>
              <AnimatePresence>
                {showSugg && suggestions.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: -6, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.96 }}
                    className="absolute left-0 right-0 top-full mt-1.5 bg-background/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-border/50 z-50 overflow-hidden p-1.5">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-3 pt-1 pb-2">Matching contacts</p>
                    {suggestions.map((s) => (
                      <button key={s.id} onClick={() => pickSuggestion(s)}
                        className="flex items-center justify-between w-full px-3.5 py-2.5 rounded-xl text-sm text-left transition-colors hover:bg-muted/60">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                            {s.full_name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">{s.full_name}</p>
                            {s.phone && <p className="text-muted-foreground text-xs">{s.phone}</p>}
                          </div>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Method-specific fields */}
            {(method === "mobile_money" || method === "wallet") && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Phone className="h-3 w-3" /> Phone number
                </Label>
                <div className="flex items-center rounded-2xl border-2 border-border/50 focus-within:border-primary/60 transition-colors overflow-hidden">
                  <div className="relative" ref={dialRef}>
                    <button onClick={() => setDialOpen(!dialOpen)}
                      className="flex items-center gap-1.5 px-3 h-12 bg-muted/40 hover:bg-muted/60 transition-all text-sm font-semibold min-w-[95px]">
                      <span className="text-lg">{phoneCountries.find((c) => c.code === dialCode)?.flag || "🌍"}</span>
                      <span className="text-xs font-bold">{dialCode}</span>
                      <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${dialOpen ? "rotate-180" : ""}`} />
                    </button>
                    <AnimatePresence>
                      {dialOpen && (
                        <motion.div initial={{ opacity: 0, y: -6, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.96 }}
                          className="absolute left-0 top-[calc(100%+6px)] bg-background/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-border/50 z-50 min-w-[220px] max-h-[240px] overflow-y-auto p-1">
                          {phoneCountries.map((c) => (
                            <button key={`${c.code}-${c.country}`}
                              onClick={() => { setDialCode(c.code); setDialOpen(false); }}
                              className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm transition-colors ${
                                c.code === dialCode ? "bg-primary/10 text-primary font-semibold" : "hover:bg-muted/50"
                              }`}>
                              <span className="text-lg">{c.flag}</span>
                              <span className="font-medium">{c.country}</span>
                              <span className="text-muted-foreground text-xs ml-auto">{c.code}</span>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <Input type="tel" value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)}
                    className="border-0 h-12 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent text-sm" placeholder="6XX XXX XXX" />
                </div>
              </motion.div>
            )}

            {method === "paypal_email" && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Mail className="h-3 w-3" /> PayPal email
                </Label>
                <div className="flex items-center rounded-2xl border-2 border-border/50 focus-within:border-primary/60 transition-colors overflow-hidden">
                  <div className="px-3 h-12 bg-muted/40 flex items-center"><Mail className="h-4 w-4 text-sky-500" /></div>
                  <Input type="email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)}
                    className="border-0 h-12 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent text-sm" placeholder="recipient@email.com" />
                </div>
              </motion.div>
            )}

            {method === "bank_transfer" && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Building2 className="h-3 w-3" /> Select bank
                  </Label>
                  <Select value={bankCode} onValueChange={setBankCode}>
                    <SelectTrigger className="h-12 rounded-2xl"><SelectValue placeholder="Choose a bank" /></SelectTrigger>
                    <SelectContent>{banks.map((b) => <SelectItem key={b.code} value={b.code}>{b.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Account number / RIB</Label>
                  <Input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="Account number" className="h-12 rounded-2xl" />
                </div>
              </motion.div>
            )}

            {method === "bill_payment" && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <FileText className="h-3 w-3" /> Purpose
                  </Label>
                  <Select value={billPurpose} onValueChange={setBillPurpose}>
                    <SelectTrigger className="h-12 rounded-2xl"><SelectValue placeholder="Select purpose" /></SelectTrigger>
                    <SelectContent>{BILL_PURPOSES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Invoice / Reference</Label>
                  <Input value={billRef} onChange={(e) => setBillRef(e.target.value)} placeholder="e.g. INV-2024-001" className="h-12 rounded-2xl" />
                </div>
              </motion.div>
            )}

            <Button onClick={getQuote} disabled={!recipientValid() || busy}
              className="w-full h-14 rounded-2xl text-base font-bold shadow-lg hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all gap-2 mt-2" size="lg">
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              {busy ? "Getting quote…" : "Review & Send"}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Trust badges */}
      <div className="flex items-center justify-center gap-5 mt-6 pt-4 border-t border-border/20">
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
          <Shield className="h-3 w-3 text-primary" /> Bank-grade security
        </div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
          <Lock className="h-3 w-3 text-primary" /> 256-bit encrypted
        </div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
          <Zap className="h-3 w-3 text-primary" /> Instant delivery
        </div>
      </div>
    </motion.div>
  );
}
