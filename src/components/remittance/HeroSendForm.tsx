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
} from "lucide-react";

/* ─── Types ─── */
type FormStage = "calculate" | "details" | "quote_review" | "processing" | "success";

interface CurrencyOption {
  code: string;
  name: string;
  flag: string;
  rate: number;
  fee_pct: number;
}

interface DestCountry {
  currency: string;
  country: string;
  flag: string;
  countryCode: string;
}

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

/* ─── Country metadata map ─── */
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

/* ─── Delivery method config ─── */
const DELIVERY_CONFIG: Record<string, { label: string; icon: typeof Smartphone; color: string; bgColor: string }> = {
  mobile_money: { label: "Mobile Money", icon: Smartphone, color: "text-emerald-600 dark:text-emerald-400", bgColor: "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800" },
  wallet: { label: "KOB Wallet", icon: Smartphone, color: "text-blue-600 dark:text-blue-400", bgColor: "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800" },
  bank_transfer: { label: "Bank Transfer", icon: Landmark, color: "text-violet-600 dark:text-violet-400", bgColor: "bg-violet-50 dark:bg-violet-950/40 border-violet-200 dark:border-violet-800" },
  bill_payment: { label: "Bills & Fees", icon: Receipt, color: "text-amber-600 dark:text-amber-400", bgColor: "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800" },
  paypal_email: { label: "PayPal", icon: Mail, color: "text-sky-600 dark:text-sky-400", bgColor: "bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800" },
};

const deliveryMethodMap: Record<string, string> = {
  mobile_money: "mobile_wallet",
  wallet: "mobile_wallet",
  bank_transfer: "bank_transfer",
  bill_payment: "bill_payment",
  paypal_email: "paypal_email",
};

/* ─── Hooks ─── */

function useRemittanceCorridors() {
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

function useAdminRates(): CurrencyOption[] {
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
      } catch { /* fallback silently */ }
    })();
  }, []);
  return currencies;
}

function useBankList() {
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

const billPurposes = [
  { value: "school_fees", label: "School Fees" },
  { value: "utilities", label: "Utilities" },
  { value: "medical", label: "Medical Bills" },
  { value: "rent", label: "Rent / Housing" },
  { value: "other", label: "Other" },
];

/* ─── Component ─── */
export function HeroSendForm() {
  const currencies = useAdminRates();
  const banks = useBankList();
  const { data: supportedCountries } = useSupportedCountries("consumer");
  const { data: corridors, isLoading: corridorsLoading, isError: corridorsError } = useRemittanceCorridors();
  const navigate = useNavigate();

  const [stage, setStage] = useState<FormStage>("calculate");
  const [amount, setAmount] = useState("1000");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showDestDropdown, setShowDestDropdown] = useState(false);
  const [selectedDestIdx, setSelectedDestIdx] = useState(0);
  const [deliveryMethod, setDeliveryMethod] = useState("");

  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [selectedCountryCode, setSelectedCountryCode] = useState("+237");
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [billPurpose, setBillPurpose] = useState("");
  const [billReference, setBillReference] = useState("");

  const [nameSuggestions, setNameSuggestions] = useState<{ id: string; full_name: string; phone: string }[]>([]);
  const [showNameSuggestions, setShowNameSuggestions] = useState(false);
  const [nameSearching, setNameSearching] = useState(false);
  const nameRef = useRef<HTMLDivElement>(null);
  const countryRef = useRef<HTMLDivElement>(null);

  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [txRef, setTxRef] = useState("");

  /* ─── Derive destination countries ONLY from active corridors ─── */
  const destCountries = useMemo<DestCountry[]>(() => {
    if (!corridors || corridors.length === 0) return [];

    const seen = new Set<string>();
    const result: DestCountry[] = [];

    corridors.forEach((c) => {
      const key = `${c.to_country}-${c.to_currency}`;
      if (seen.has(key)) return;
      seen.add(key);

      const meta = COUNTRY_META[c.to_country];
      result.push({
        currency: c.to_currency,
        country: meta?.name || c.to_country,
        flag: meta?.flag || "🌍",
        countryCode: c.to_country,
      });
    });

    return result;
  }, [corridors]);

  /* ─── Available delivery methods for selected route ─── */
  const availableDeliveryMethods = useMemo(() => {
    if (!corridors || destCountries.length === 0) return [];

    const dest = destCountries[selectedDestIdx];
    if (!dest) return [];

    const srcCurrency = currencies[selectedIdx]?.code;
    const srcCountry = Object.entries(COUNTRY_META).find(([, v]) => v.currency === srcCurrency)?.[0];

    // Find corridors matching this route
    const matching = corridors.filter((c) => {
      const matchesDest = c.to_country === dest.countryCode && c.to_currency === dest.currency;
      const matchesSrc = !srcCountry || c.from_country === srcCountry || c.from_currency === srcCurrency;
      return matchesDest && (matchesSrc || true); // show all methods to dest
    });

    const methodSet = new Set<string>();
    matching.forEach((c) => {
      (c.delivery_methods || []).forEach((m: string) => methodSet.add(m));
    });

    return Array.from(methodSet);
  }, [corridors, destCountries, selectedDestIdx, selectedIdx, currencies]);

  // Auto-select first delivery method when available methods change
  useEffect(() => {
    if (availableDeliveryMethods.length > 0 && !availableDeliveryMethods.includes(deliveryMethod)) {
      setDeliveryMethod(availableDeliveryMethods[0]);
    }
  }, [availableDeliveryMethods, deliveryMethod]);

  /* ─── Phone country codes ─── */
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

  /* ─── Click outside handlers ─── */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (nameRef.current && !nameRef.current.contains(e.target as Node)) setShowNameSuggestions(false);
      if (countryRef.current && !countryRef.current.contains(e.target as Node)) setShowCountryDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* ─── Name autocomplete ─── */
  useEffect(() => {
    const trimmed = recipientName.trim();
    if (trimmed.length < 2) { setNameSuggestions([]); setShowNameSuggestions(false); return; }
    const timer = setTimeout(async () => {
      setNameSearching(true);
      try {
        const { data } = await supabase.rpc("search_profiles_by_name", { _query: trimmed, _limit: 6 });
        const results = (data || []).map((p: any) => ({ id: p.id, full_name: p.full_name || "", phone: p.phone_masked || "" }));
        setNameSuggestions(results);
        setShowNameSuggestions(results.length > 0);
      } catch { setNameSuggestions([]); setShowNameSuggestions(false); }
      finally { setNameSearching(false); }
    }, 250);
    return () => clearTimeout(timer);
  }, [recipientName]);

  /* ─── Derived values ─── */
  const selectedCurrency = currencies[selectedIdx] || currencies[0];
  const destCountry = destCountries[selectedDestIdx] || destCountries[0];
  const destCurrLabel = destCountry?.currency || "XAF";
  const destFlag = destCountry?.flag || "🇨🇲";
  const numericAmount = parseFloat(amount) || 0;
  const feePercent = (selectedCurrency.fee_pct || 0.5) / 100;
  const fee = Math.round(numericAmount * feePercent * 100) / 100;

  const convertedAmount = useMemo(() => {
    const netAmount = numericAmount - fee;
    if (netAmount <= 0) return 0;
    const sourceToXaf = selectedCurrency.rate;
    if (destCurrLabel === "XAF") return Math.round(netAmount * sourceToXaf);
    const destCurrencyEntry = currencies.find((c) => c.code === destCurrLabel);
    if (destCurrencyEntry && destCurrencyEntry.rate > 0) {
      const crossRate = sourceToXaf / destCurrencyEntry.rate;
      return Math.round(netAmount * crossRate * 100) / 100;
    }
    if (selectedCurrency.code === destCurrLabel) return Math.round(netAmount * 100) / 100;
    return Math.round(netAmount * sourceToXaf);
  }, [numericAmount, fee, selectedCurrency.rate, selectedCurrency.code, destCurrLabel, currencies]);

  const displayRate = useMemo(() => {
    if (destCurrLabel === "XAF") return `1 ${selectedCurrency.code} = ${selectedCurrency.rate.toLocaleString()} XAF`;
    const destEntry = currencies.find((c) => c.code === destCurrLabel);
    if (destEntry && destEntry.rate > 0) return `1 ${selectedCurrency.code} = ${(selectedCurrency.rate / destEntry.rate).toFixed(4)} ${destCurrLabel}`;
    if (selectedCurrency.code === destCurrLabel) return `1 ${selectedCurrency.code} = 1 ${destCurrLabel}`;
    return `1 ${selectedCurrency.code} = ${selectedCurrency.rate.toLocaleString()} XAF`;
  }, [selectedCurrency, destCurrLabel, currencies]);

  /* ─── Estimated delivery time from corridor ─── */
  const estDelivery = useMemo(() => {
    if (!corridors || !destCountry) return "Instant";
    const match = corridors.find((c) => c.to_country === destCountry.countryCode && (c.delivery_methods || []).includes(deliveryMethod));
    if (!match?.est_delivery_seconds) return "Instant";
    const secs = match.est_delivery_seconds;
    if (secs < 60) return "Instant";
    if (secs < 3600) return `~${Math.round(secs / 60)} min`;
    return `~${Math.round(secs / 3600)} hours`;
  }, [corridors, destCountry, deliveryMethod]);

  /* ─── Validation ─── */
  const isDetailsValid = useCallback(() => {
    if (!recipientName.trim()) return false;
    if (deliveryMethod === "mobile_money" || deliveryMethod === "wallet") {
      if (!/^\d{6,12}$/.test(recipientPhone.replace(/\s/g, ""))) return false;
    }
    if (deliveryMethod === "bank_transfer" && (!bankCode || !accountNumber.trim())) return false;
    if (deliveryMethod === "bill_payment" && (!billPurpose || !billReference.trim())) return false;
    if (deliveryMethod === "paypal_email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) return false;
    return true;
  }, [recipientName, recipientPhone, deliveryMethod, bankCode, accountNumber, billPurpose, billReference, recipientEmail]);

  /* ─── Handlers ─── */
  const selectSuggestion = async (s: { id: string; full_name: string; phone: string }) => {
    setRecipientName(s.full_name);
    setShowNameSuggestions(false);
    if (deliveryMethod === "mobile_money" || deliveryMethod === "wallet") {
      try {
        const { data: fullPhone } = await supabase.rpc("get_profile_phone", { _profile_id: s.id });
        if (fullPhone) {
          const phoneStr = (fullPhone as string).replace(/\s/g, "");
          const sorted = [...phoneCountries].sort((a, b) => b.code.length - a.code.length);
          const matched = sorted.find((c) => phoneStr.startsWith(c.code));
          if (matched) { setSelectedCountryCode(matched.code); setRecipientPhone(phoneStr.slice(matched.code.length)); }
          else setRecipientPhone(phoneStr.replace(/^\+\d{1,4}/, ""));
        }
      } catch { /* silent */ }
    }
  };

  const handleGetQuote = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate(`/app/send-money?amount=${amount}&currency=${selectedCurrency.code}&dest=${deliveryMethod}`); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("remittance-outbound", {
        body: {
          action: "get_quote", amount: numericAmount, source_currency: selectedCurrency.code,
          destination_currency: destCurrLabel, delivery_method: deliveryMethodMap[deliveryMethod] || deliveryMethod,
          destination_country: destCountry.countryCode,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setQuote(data?.quote || { fee, rate: selectedCurrency.rate, receive_amount: convertedAmount, delivery_estimate: estDelivery });
      setStage("quote_review");
    } catch {
      setQuote({ fee, rate: selectedCurrency.rate, receive_amount: convertedAmount, delivery_estimate: estDelivery, source: "estimate" });
      setStage("quote_review");
    } finally { setLoading(false); }
  };

  const handleConfirmSend = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate("/app/send-money"); return; }
    setStage("processing");
    try {
      const rd: any = { name: recipientName };
      if (deliveryMethod === "mobile_money" || deliveryMethod === "wallet") rd.phone = `${selectedCountryCode}${recipientPhone.replace(/\s/g, "")}`;
      else if (deliveryMethod === "bank_transfer") { rd.bank_code = bankCode; rd.account_number = accountNumber; }
      else if (deliveryMethod === "paypal_email") { rd.email = recipientEmail; }
      else { rd.purpose = billPurpose; rd.reference = billReference; }
      const { data, error } = await supabase.functions.invoke("remittance-outbound", {
        body: {
          action: "send", amount: numericAmount, source_currency: selectedCurrency.code,
          destination_currency: destCurrLabel, delivery_method: deliveryMethodMap[deliveryMethod] || deliveryMethod,
          destination_country: destCountry.countryCode, recipient: rd,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setTxRef(data?.reference || data?.id || "TX-" + Date.now().toString(36).toUpperCase());
      setStage("success");
    } catch (err: any) { toast.error(err.message || "Transfer failed"); setStage("quote_review"); }
  };

  const handleReset = () => {
    setStage("calculate"); setRecipientName(""); setRecipientPhone(""); setRecipientEmail("");
    setSelectedCountryCode("+237"); setBankCode(""); setAccountNumber("");
    setBillPurpose(""); setBillReference(""); setQuote(null); setTxRef("");
    setNameSuggestions([]); setShowNameSuggestions(false);
  };

  /* ─── Shared UI helpers ─── */
  const stageIdx = stage === "calculate" ? 0 : stage === "details" ? 1 : stage === "quote_review" ? 2 : 3;

  const ProgressSteps = () => (
    <div className="flex gap-1.5 mb-6">
      {["Amount", "Details", "Review", "Done"].map((label, i) => (
        <div key={label} className="flex-1 space-y-1">
          <motion.div
            className={`h-1.5 rounded-full transition-colors duration-500 ${i <= stageIdx ? "bg-primary" : "bg-border/40"}`}
            animate={{ scaleY: i === stageIdx ? 1.5 : 1 }}
            transition={{ type: "spring", stiffness: 300 }}
          />
          <p className={`text-[10px] text-center font-semibold ${i <= stageIdx ? "text-primary" : "text-muted-foreground/40"}`}>{label}</p>
        </div>
      ))}
    </div>
  );

  const CurrencyDropdown = ({ items, selected, onPick, show, onClose }: {
    items: { flag: string; code: string; label: string }[]; selected: number; onPick: (i: number) => void; show: boolean; onClose: () => void;
  }) => (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -6, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.96 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          className="absolute right-0 top-[calc(100%+6px)] bg-background/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-border/50 z-50 min-w-[260px] max-h-[320px] overflow-y-auto p-1.5"
        >
          {items.map((item, i) => (
            <button key={item.code + item.label} onClick={() => { onPick(i); onClose(); }}
              className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm transition-all ${
                i === selected ? "bg-primary/10 text-primary font-semibold" : "hover:bg-muted/60 text-foreground"
              }`}>
              <span className="text-xl">{item.flag}</span>
              <span className="font-semibold">{item.code}</span>
              <span className="text-muted-foreground text-xs ml-auto truncate max-w-[120px]">{item.label}</span>
              {i === selected && <CheckCircle2 className="h-4 w-4 text-primary ml-1 shrink-0" />}
            </button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );

  /* ═══════════════ SUCCESS ═══════════════ */
  if (stage === "success") {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}
        className="bg-background rounded-3xl shadow-2xl p-7 lg:p-9 w-full max-w-md border border-border/30 text-center">
        <ProgressSteps />
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, delay: 0.15 }}>
          <div className="h-20 w-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-5">
            <CheckCircle className="h-10 w-10 text-primary" />
          </div>
        </motion.div>
        <h3 className="text-2xl font-bold text-foreground mb-2">Transfer Initiated! 🎉</h3>
        <p className="text-muted-foreground text-sm mb-5">
          <span className="font-bold text-foreground">{numericAmount.toLocaleString()} {selectedCurrency.code}</span> is on its way.
        </p>
        <div className="bg-muted/40 rounded-2xl p-5 mb-6 text-left space-y-3">
          {[
            { l: "Reference", v: txRef, mono: true },
            { l: "Recipient", v: recipientName },
            { l: "Receives", v: `${convertedAmount.toLocaleString()} ${destCurrLabel}`, hl: true },
            { l: "Via", v: DELIVERY_CONFIG[deliveryMethod]?.label || deliveryMethod },
          ].map((r) => (
            <div key={r.l} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{r.l}</span>
              <span className={`font-semibold ${r.hl ? "text-primary" : "text-foreground"} ${r.mono ? "font-mono text-xs" : ""}`}>{r.v}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleReset} className="flex-1 rounded-2xl h-12 font-semibold">Send Another</Button>
          <Link to="/app/send-money" className="flex-1"><Button className="w-full rounded-2xl h-12 font-semibold">View Transfers</Button></Link>
        </div>
      </motion.div>
    );
  }

  /* ═══════════════ PROCESSING ═══════════════ */
  if (stage === "processing") {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="bg-background rounded-3xl shadow-2xl p-7 lg:p-9 w-full max-w-md border border-border/30 text-center">
        <ProgressSteps />
        <Loader2 className="h-14 w-14 text-primary mx-auto animate-spin mb-5" />
        <h3 className="text-xl font-bold text-foreground mb-2">Processing Transfer</h3>
        <p className="text-muted-foreground text-sm">Securely routing your funds…</p>
      </motion.div>
    );
  }

  /* ═══════════════ QUOTE REVIEW ═══════════════ */
  if (stage === "quote_review" && quote) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="bg-background rounded-3xl shadow-2xl p-7 lg:p-9 w-full max-w-md border border-border/30">
        <ProgressSteps />
        <button onClick={() => setStage("details")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors group">
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" /> Edit details
        </button>
        <h3 className="text-lg font-bold text-foreground mb-5">Review your transfer</h3>
        <div className="bg-muted/30 rounded-2xl p-5 space-y-3 mb-4">
          {[
            { l: "You send", v: `${numericAmount.toLocaleString()} ${selectedCurrency.code}`, bold: true },
            { l: `Fee (${selectedCurrency.fee_pct}%)`, v: `${(quote.fee || fee).toFixed(2)} ${selectedCurrency.code}` },
            { l: "Exchange rate", v: `1 ${selectedCurrency.code} = ${(quote.rate || selectedCurrency.rate).toLocaleString()} ${destCurrLabel}` },
          ].map((r) => (
            <div key={r.l} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{r.l}</span>
              <span className={`${r.bold ? "font-bold" : "font-semibold"} text-foreground`}>{r.v}</span>
            </div>
          ))}
          <div className="border-t border-border/50 pt-3 flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Recipient gets</span>
            <span className="font-bold text-primary text-xl">{(quote.receive_amount || convertedAmount).toLocaleString()} {destCurrLabel}</span>
          </div>
        </div>
        <div className="bg-muted/20 rounded-2xl p-4 space-y-2.5 mb-5">
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">To</span><span className="font-semibold text-foreground">{recipientName}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Via</span><span className="font-semibold text-foreground">{DELIVERY_CONFIG[deliveryMethod]?.label || deliveryMethod}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Delivery</span><span className="font-semibold text-primary flex items-center gap-1"><Zap className="h-3 w-3" />{quote.delivery_estimate || estDelivery}</span></div>
        </div>
        {quote.source === "estimate" && (
          <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-xl p-3 text-center mb-4">
            ℹ️ Estimated quote — final amounts may vary slightly.
          </p>
        )}
        <Button onClick={handleConfirmSend} className="w-full h-14 rounded-2xl text-lg font-bold shadow-lg hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all gap-2" size="lg">
          <Send className="h-5 w-5" /> Confirm & Send
        </Button>
      </motion.div>
    );
  }

  /* ═══════════════ MAIN FORM ═══════════════ */
  return (
    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="bg-background rounded-3xl shadow-2xl p-7 lg:p-9 w-full max-w-md border border-border/30">
      <ProgressSteps />

      {stage === "details" && (
        <motion.button initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} onClick={() => setStage("calculate")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors group">
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" /> Back
        </motion.button>
      )}

      {/* ── Loading / Error state ── */}
      {corridorsLoading && (
        <div className="flex items-center gap-2 bg-muted/30 rounded-2xl p-3 mb-4">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground">Loading corridors…</span>
        </div>
      )}

      {corridorsError && (
        <div className="flex items-center gap-2 bg-destructive/10 rounded-2xl p-3 mb-4">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <span className="text-xs text-destructive">Failed to load corridors. Please refresh.</span>
        </div>
      )}

      {!corridorsLoading && !corridorsError && destCountries.length === 0 && (
        <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/30 rounded-2xl p-3 mb-4">
          <Globe className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <span className="text-xs text-amber-700 dark:text-amber-300">No corridors available. Please contact support.</span>
        </div>
      )}

      {/* ── You send ── */}
      <div className="space-y-2 mb-5">
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">You send</label>
        <div className="flex items-center border-2 rounded-2xl overflow-hidden border-border/60 focus-within:border-primary/60 transition-colors bg-background">
          <Input type="number" value={amount}
            onChange={(e) => { setAmount(e.target.value); if (stage === "details") setStage("calculate"); }}
            className="border-0 text-2xl font-bold h-16 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent pl-5"
            placeholder="0" disabled={stage === "details"} />
          <div className="relative">
            <button onClick={() => stage === "calculate" && setShowDropdown(!showDropdown)}
              className="flex items-center gap-2 px-4 h-16 bg-muted/40 hover:bg-muted/60 transition-all font-semibold text-sm min-w-[130px] justify-center">
              <span className="text-xl">{selectedCurrency.flag}</span>
              <span>{selectedCurrency.code}</span>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${showDropdown ? "rotate-180" : ""}`} />
            </button>
            <CurrencyDropdown items={currencies.map((c) => ({ flag: c.flag, code: c.code, label: c.name }))}
              selected={selectedIdx} onPick={setSelectedIdx} show={showDropdown} onClose={() => setShowDropdown(false)} />
          </div>
        </div>
      </div>

      {/* ── Fee breakdown ── */}
      <div className="space-y-2.5 py-3.5 border-y border-border/30 mb-5 text-sm">
        {[
          { icon: Banknote, label: `Fee (${selectedCurrency.fee_pct}%)`, value: `${fee.toFixed(2)} ${selectedCurrency.code}`, color: "text-muted-foreground" },
          { icon: Repeat, label: "Rate", value: displayRate, color: "text-muted-foreground" },
          { icon: Clock, label: "Delivery", value: estDelivery, color: "text-primary" },
        ].map((r) => (
          <div key={r.label} className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1.5"><r.icon className="h-3.5 w-3.5" /> {r.label}</span>
            <motion.span key={r.value} initial={{ opacity: 0.5 }} animate={{ opacity: 1 }}
              className={`font-semibold ${r.color}`}>{r.value}</motion.span>
          </div>
        ))}
      </div>

      {/* ── Recipient gets ── */}
      <div className="space-y-2 mb-5">
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Recipient gets</label>
        <div className="flex items-center border-2 rounded-2xl overflow-hidden border-border/60 bg-muted/10">
          <div className="flex-1 pl-5 py-4">
            <motion.span key={convertedAmount} initial={{ opacity: 0.5, y: 2 }} animate={{ opacity: 1, y: 0 }}
              className="text-2xl font-bold text-foreground">{convertedAmount.toLocaleString()}</motion.span>
          </div>
          <div className="relative">
            <button onClick={() => stage === "calculate" && destCountries.length > 1 && setShowDestDropdown(!showDestDropdown)}
              className="flex items-center gap-2 px-4 h-16 bg-muted/40 hover:bg-muted/60 transition-all font-semibold text-sm min-w-[130px] justify-center">
              <span className="text-xl">{destFlag}</span>
              <span>{destCurrLabel}</span>
              {destCountries.length > 1 && <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${showDestDropdown ? "rotate-180" : ""}`} />}
            </button>
            <CurrencyDropdown items={destCountries.map((dc) => ({ flag: dc.flag, code: dc.currency, label: dc.country }))}
              selected={selectedDestIdx} onPick={setSelectedDestIdx} show={showDestDropdown} onClose={() => setShowDestDropdown(false)} />
          </div>
        </div>
      </div>

      {/* ── Delivery method — dynamic from corridors ── */}
      {availableDeliveryMethods.length > 0 && (
        <div className="space-y-2.5 mb-5">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Pay via <span className="text-primary font-bold">·</span> {destCountry?.country || ""}
          </label>
          <div className={`grid gap-2 ${availableDeliveryMethods.length <= 2 ? "grid-cols-2" : availableDeliveryMethods.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
            {availableDeliveryMethods.map((method) => {
              const config = DELIVERY_CONFIG[method] || { label: method, icon: Globe, color: "text-foreground", bgColor: "bg-muted/30 border-border" };
              const Icon = config.icon;
              const active = deliveryMethod === method;
              return (
                <motion.button key={method} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }}
                  onClick={() => { setDeliveryMethod(method); if (stage === "details") setStage("calculate"); }}
                  className={`flex flex-col items-center gap-1.5 rounded-2xl p-3.5 text-xs font-semibold border-2 transition-all duration-200 ${
                    active
                      ? `border-primary bg-primary/10 ${config.color} shadow-md shadow-primary/10`
                      : `${config.bgColor} hover:border-primary/30`
                  }`}>
                  <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${active ? "bg-primary/20" : "bg-background/60"}`}>
                    <Icon className={`h-4.5 w-4.5 ${active ? "text-primary" : config.color}`} />
                  </div>
                  <span className={active ? "text-primary" : "text-foreground"}>{config.label}</span>
                </motion.button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Stage actions ── */}
      <AnimatePresence mode="wait">
        {stage === "calculate" ? (
          <motion.div key="calc" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -8 }}>
            <Button onClick={() => {
              if (numericAmount <= 0) { toast.error("💰 Enter an amount to send"); return; }
              if (!deliveryMethod) { toast.error("Please select a payment method"); return; }
              setStage("details");
            }}
              disabled={destCountries.length === 0}
              className="w-full h-14 rounded-2xl text-lg font-bold shadow-lg hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all gap-2" size="lg">
              <Send className="h-5 w-5" /> Continue
            </Button>
          </motion.div>
        ) : stage === "details" ? (
          <motion.div key="details" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }} className="space-y-4">

            {/* Name autocomplete */}
            <div className="space-y-1.5 relative" ref={nameRef}>
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Recipient name</Label>
              <div className="relative">
                <Input value={recipientName} onChange={(e) => setRecipientName(e.target.value)}
                  className="h-12 rounded-2xl pr-12" placeholder="Full name" />
                {nameSearching && <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                {!nameSearching && recipientName.length >= 2 && nameSuggestions.length === 0 && (
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-md">New</span>
                )}
              </div>
              <AnimatePresence>
                {showNameSuggestions && nameSuggestions.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: -6, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.96 }}
                    className="absolute left-0 right-0 top-full mt-1.5 bg-background/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-border/50 z-50 overflow-hidden p-1.5">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-3 pt-1 pb-2">Matching contacts</p>
                    {nameSuggestions.map((s) => (
                      <button key={s.id} onClick={() => selectSuggestion(s)}
                        className="flex items-center justify-between w-full px-3.5 py-3 rounded-xl text-sm text-left transition-colors hover:bg-muted/60">
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

            {/* Mobile Money / Wallet fields */}
            {(deliveryMethod === "mobile_money" || deliveryMethod === "wallet") && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Phone number</Label>
                <div className="flex items-center border-2 rounded-2xl overflow-hidden border-border/60 focus-within:border-primary/60 transition-colors">
                  <div className="relative" ref={countryRef}>
                    <button onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                      className="flex items-center gap-1.5 px-3 h-12 bg-muted/40 hover:bg-muted/60 transition-all text-sm font-semibold min-w-[100px]">
                      <span className="text-lg">{phoneCountries.find((c) => c.code === selectedCountryCode)?.flag || "🌍"}</span>
                      <span className="text-xs font-bold">{selectedCountryCode}</span>
                      <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform duration-200 ${showCountryDropdown ? "rotate-180" : ""}`} />
                    </button>
                    <AnimatePresence>
                      {showCountryDropdown && (
                        <motion.div initial={{ opacity: 0, y: -6, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.96 }}
                          className="absolute left-0 top-[calc(100%+6px)] bg-background/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-border/50 z-50 min-w-[240px] max-h-[260px] overflow-y-auto p-1.5">
                          {phoneCountries.map((c) => (
                            <button key={`${c.code}-${c.country}`}
                              onClick={() => { setSelectedCountryCode(c.code); setShowCountryDropdown(false); }}
                              className={`flex items-center gap-2.5 w-full px-3.5 py-2.5 rounded-xl text-sm transition-all ${
                                c.code === selectedCountryCode ? "bg-primary/10 text-primary font-semibold" : "hover:bg-muted/60"
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

            {/* PayPal email field */}
            {deliveryMethod === "paypal_email" && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">PayPal email</Label>
                <div className="flex items-center border-2 rounded-2xl overflow-hidden border-border/60 focus-within:border-primary/60 transition-colors">
                  <div className="px-3 h-12 bg-muted/40 flex items-center">
                    <Mail className="h-4 w-4 text-sky-500" />
                  </div>
                  <Input type="email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)}
                    className="border-0 h-12 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent text-sm" placeholder="recipient@email.com" />
                </div>
              </motion.div>
            )}

            {/* Bank fields */}
            {deliveryMethod === "bank_transfer" && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Select bank</Label>
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

            {/* Bills fields */}
            {deliveryMethod === "bill_payment" && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Purpose</Label>
                  <Select value={billPurpose} onValueChange={setBillPurpose}>
                    <SelectTrigger className="h-12 rounded-2xl"><SelectValue placeholder="Select purpose" /></SelectTrigger>
                    <SelectContent>{billPurposes.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Invoice / Reference</Label>
                  <Input value={billReference} onChange={(e) => setBillReference(e.target.value)} placeholder="e.g. INV-2024-001" className="h-12 rounded-2xl" />
                </div>
              </motion.div>
            )}

            <Button onClick={handleGetQuote} disabled={!isDetailsValid() || loading}
              className="w-full h-14 rounded-2xl text-lg font-bold shadow-lg hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all gap-2 mt-1" size="lg">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              {loading ? "Getting quote…" : "Get Quote & Send"}
            </Button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* ── Trust badges ── */}
      <div className="flex items-center justify-center gap-4 mt-5 pt-4 border-t border-border/20">
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Shield className="h-3 w-3 text-primary" /> Bank-grade security
        </div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Lock className="h-3 w-3 text-primary" /> Encrypted
        </div>
      </div>
    </motion.div>
  );
}
