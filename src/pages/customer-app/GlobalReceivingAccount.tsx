import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { DateRangePicker, type DateRange } from "@/components/ui/date-range-picker";
import { subDays, startOfDay, endOfDay, format as formatDate } from "date-fns";
import {
  Globe2,
  Copy,
  Plus,
  Wallet,
  Smartphone,
  Loader2,
  ArrowDownLeft,
  CheckCircle2,
  Building2,
  Search,
  Download,
  Check,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShieldAlert, ChevronsUpDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  ALLOWED_NIUM_POP_CODES,
  DEFAULT_NIUM_POP_CODE,
  type NiumPopCode,
} from "@/constants/nium-compliance";
import { TransactionPreview } from "@/components/global-accounts/TransactionPreview";
import { NameCorrectionDialog } from "@/components/global-accounts/NameCorrectionDialog";
import { NameCorrectionUpdates } from "@/components/global-accounts/NameCorrectionUpdates";
import { HowItWorksFlow } from "@/components/customer-app/HowItWorksFlow";
import type { FlowStep } from "@/components/customer-app/HowItWorksFlow";
import { Briefcase, RotateCcw, Store, ArrowRight } from "lucide-react";

type Currency =
  | "USD" | "EUR" | "GBP" | "AUD" | "CAD" | "SGD" | "AED" | "JPY"
  | "INR" | "ZAR" | "HKD" | "CHF" | "NZD" | "SEK" | "NOK" | "DKK" | "CNY";

type AccountKind = "virtual" | "global";

type GlobalAccount = {
  id: string;
  currency: Currency;
  account_kind?: AccountKind;
  iban: string | null;
  account_number: string | null;
  routing_code: string | null;
  bic: string | null;
  bank_name: string;
  bank_address: string | null;
  beneficiary_name: string;
  status: string;
  payout_preference_override: "KANG_WALLET" | "MOBILE_MONEY" | null;
  payout_channel_override: string | null;
  mode: string;
};

type IncomingPayment = {
  id: string;
  source_amount: number;
  source_currency: string;
  xaf_net_credited: number;
  routing: "KANG_WALLET" | "MOBILE_MONEY";
  status: string;
  created_at: string;
  description?: string | null;
  reference?: string | null;
};

type UserDefaults = {
  payout_preference: "KANG_WALLET" | "MOBILE_MONEY";
  payout_channel: string | null;
};

type CurrencyMeta = {
  symbol: string;
  label: string;
  region: string;
  bg: string;
  ring: string;
  text: string;
  soft: string;
};

const CURRENCY_META: Record<Currency, CurrencyMeta> = {
  USD: { symbol: "$",  label: "US Dollar",         region: "United States",        bg: "bg-emerald-600", ring: "ring-emerald-600", text: "text-emerald-700 dark:text-emerald-400", soft: "bg-emerald-50 dark:bg-emerald-950/40" },
  EUR: { symbol: "€",  label: "Euro",              region: "Eurozone",             bg: "bg-sky-600",     ring: "ring-sky-600",     text: "text-sky-700 dark:text-sky-400",         soft: "bg-sky-50 dark:bg-sky-950/40" },
  GBP: { symbol: "£",  label: "British Pound",     region: "United Kingdom",       bg: "bg-violet-600",  ring: "ring-violet-600",  text: "text-violet-700 dark:text-violet-400",   soft: "bg-violet-50 dark:bg-violet-950/40" },
  AUD: { symbol: "A$", label: "Australian Dollar", region: "Australia",            bg: "bg-amber-600",   ring: "ring-amber-600",   text: "text-amber-700 dark:text-amber-400",     soft: "bg-amber-50 dark:bg-amber-950/40" },
  CAD: { symbol: "C$", label: "Canadian Dollar",   region: "Canada",               bg: "bg-red-600",     ring: "ring-red-600",     text: "text-red-700 dark:text-red-400",         soft: "bg-red-50 dark:bg-red-950/40" },
  SGD: { symbol: "S$", label: "Singapore Dollar",  region: "Singapore",            bg: "bg-rose-600",    ring: "ring-rose-600",    text: "text-rose-700 dark:text-rose-400",       soft: "bg-rose-50 dark:bg-rose-950/40" },
  AED: { symbol: "د.إ", label: "UAE Dirham",        region: "United Arab Emirates", bg: "bg-teal-600",    ring: "ring-teal-600",    text: "text-teal-700 dark:text-teal-400",       soft: "bg-teal-50 dark:bg-teal-950/40" },
  JPY: { symbol: "¥",  label: "Japanese Yen",      region: "Japan",                bg: "bg-fuchsia-600", ring: "ring-fuchsia-600", text: "text-fuchsia-700 dark:text-fuchsia-400", soft: "bg-fuchsia-50 dark:bg-fuchsia-950/40" },
  INR: { symbol: "₹",  label: "Indian Rupee",      region: "India",                bg: "bg-orange-600",  ring: "ring-orange-600",  text: "text-orange-700 dark:text-orange-400",   soft: "bg-orange-50 dark:bg-orange-950/40" },
  ZAR: { symbol: "R",  label: "South African Rand",region: "South Africa",         bg: "bg-lime-600",    ring: "ring-lime-600",    text: "text-lime-700 dark:text-lime-400",       soft: "bg-lime-50 dark:bg-lime-950/40" },
  HKD: { symbol: "HK$",label: "Hong Kong Dollar",  region: "Hong Kong",            bg: "bg-pink-600",    ring: "ring-pink-600",    text: "text-pink-700 dark:text-pink-400",       soft: "bg-pink-50 dark:bg-pink-950/40" },
  CHF: { symbol: "CHF",label: "Swiss Franc",       region: "Switzerland",          bg: "bg-slate-600",   ring: "ring-slate-600",   text: "text-slate-700 dark:text-slate-400",     soft: "bg-slate-50 dark:bg-slate-950/40" },
  NZD: { symbol: "NZ$",label: "New Zealand Dollar",region: "New Zealand",          bg: "bg-cyan-600",    ring: "ring-cyan-600",    text: "text-cyan-700 dark:text-cyan-400",       soft: "bg-cyan-50 dark:bg-cyan-950/40" },
  SEK: { symbol: "kr", label: "Swedish Krona",     region: "Sweden",               bg: "bg-blue-600",    ring: "ring-blue-600",    text: "text-blue-700 dark:text-blue-400",       soft: "bg-blue-50 dark:bg-blue-950/40" },
  NOK: { symbol: "kr", label: "Norwegian Krone",   region: "Norway",               bg: "bg-indigo-600",  ring: "ring-indigo-600",  text: "text-indigo-700 dark:text-indigo-400",   soft: "bg-indigo-50 dark:bg-indigo-950/40" },
  DKK: { symbol: "kr", label: "Danish Krone",      region: "Denmark",              bg: "bg-purple-600",  ring: "ring-purple-600",  text: "text-purple-700 dark:text-purple-400",   soft: "bg-purple-50 dark:bg-purple-950/40" },
  CNY: { symbol: "¥",  label: "Chinese Yuan",      region: "China",                bg: "bg-yellow-600",  ring: "ring-yellow-600",  text: "text-yellow-700 dark:text-yellow-400",   soft: "bg-yellow-50 dark:bg-yellow-950/40" },
};

export default function GlobalReceivingAccount() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [accounts, setAccounts] = useState<GlobalAccount[]>([]);
  const [payments, setPayments] = useState<IncomingPayment[]>([]);
  const [defaults, setDefaults] = useState<UserDefaults>({
    payout_preference: "KANG_WALLET",
    payout_channel: null,
  });
  const [newCurrency, setNewCurrency] = useState<Currency>("USD");
  const [accountKind, setAccountKind] = useState<AccountKind>("virtual");
  const [popCode, setPopCode] = useState<NiumPopCode>(DEFAULT_NIUM_POP_CODE);
  const [kycName, setKycName] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const [pendingCorrection, setPendingCorrection] = useState(false);

  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfDay(subDays(new Date(), 29)),
    to: endOfDay(new Date()),
  });
  const [activityPage, setActivityPage] = useState(1);
  const [activityPageSize, setActivityPageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("nium-list-global-accounts");
    if (error) {
      toast({ title: "Failed to load", description: error.message, variant: "destructive" });
    } else {
      setAccounts(data.accounts ?? []);
      setPayments(data.incoming_payments ?? []);
      setDefaults(
        data.user_defaults ?? { payout_preference: "KANG_WALLET", payout_channel: null },
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // Resolve the verified KYC name once for the exact-name banner.
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) return;
      setUserId(auth.user.id);
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", auth.user.id)
        .maybeSingle();
      setKycName(prof?.full_name?.trim() || "");
      const { data: openReq } = await supabase
        .from("nium_name_correction_requests")
        .select("id")
        .eq("user_id", auth.user.id)
        .eq("status", "pending")
        .maybeSingle();
      setPendingCorrection(!!openReq);
    })();
  }, []);

  const createAccount = async () => {
    setCreating(true);
    // COMPLIANCE CHECK: do NOT send beneficiary_name (server pulls from KYC).
    const { data, error } = await supabase.functions.invoke("nium-create-global-account", {
      body: { currency: newCurrency, pop_code: popCode, account_kind: accountKind },
    });
    setCreating(false);
    if (error)
      return toast({
        title: "Couldn't generate account",
        description: error.message,
        variant: "destructive",
      });
    const warnings: Array<{ message: string }> = data?.meta?.warnings ?? [];
    if (warnings.length > 0) {
      toast({
        title: "Request accepted with warnings",
        description: warnings.map((w) => w.message).join(" · "),
      });
    }
    toast({
      title: data?.reused
        ? `${newCurrency} ${accountKind} account already exists`
        : `${newCurrency} ${accountKind} account ready`,
    });
    load();
  };

  const saveUserDefaults = async (
    pref: "KANG_WALLET" | "MOBILE_MONEY",
    phone: string | null,
  ) => {
    const { error } = await supabase.functions.invoke("nium-update-payout-preference", {
      body: { scope: "user", payout_preference: pref, payout_channel: phone },
    });
    if (error)
      return toast({ title: "Failed", description: error.message, variant: "destructive" });
    setDefaults({ payout_preference: pref, payout_channel: phone });
    toast({ title: "Saved" });
  };

  const copy = (txt: string | null, label: string) => {
    if (!txt) return;
    navigator.clipboard.writeText(txt);
    toast({ title: `${label} copied` });
  };

  const totalReceivedXAF = useMemo(
    () => payments.reduce((s, p) => s + (p.xaf_net_credited || 0), 0),
    [payments],
  );

  const filteredPayments = useMemo(() => {
    const from = dateRange.from.getTime();
    const to = dateRange.to.getTime();
    const q = searchTerm.trim().toLowerCase();
    return payments.filter((p) => {
      const t = new Date(p.created_at).getTime();
      if (t < from || t > to) return false;
      if (!q) return true;
      const hay = [
        p.description ?? "",
        p.reference ?? "",
        p.source_currency,
        String(p.source_amount),
        String(p.xaf_net_credited),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [payments, dateRange, searchTerm]);

  const pagedPayments = useMemo(() => {
    const start = (activityPage - 1) * activityPageSize;
    return filteredPayments.slice(start, start + activityPageSize);
  }, [filteredPayments, activityPage, activityPageSize]);

  useEffect(() => {
    setActivityPage(1);
  }, [dateRange, activityPageSize, searchTerm]);

  const exportCsv = () => {
    if (filteredPayments.length === 0) {
      toast({ title: "Nothing to export", description: "No activity in current filters." });
      return;
    }
    const headers = [
      "date",
      "source_amount",
      "source_currency",
      "xaf_net_credited",
      "routing",
      "status",
      "description",
      "reference",
    ];
    const esc = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = filteredPayments.map((p) =>
      [
        new Date(p.created_at).toISOString(),
        p.source_amount,
        p.source_currency,
        p.xaf_net_credited,
        p.routing,
        p.status,
        p.description ?? "",
        p.reference ?? "",
      ]
        .map(esc)
        .join(","),
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const fromStr = formatDate(dateRange.from, "yyyyMMdd");
    const toStr = formatDate(dateRange.to, "yyyyMMdd");
    a.href = url;
    a.download = `global-accounts-activity_${fromStr}-${toStr}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Exported", description: `${filteredPayments.length} rows downloaded.` });
  };

  const globalAccountSteps: FlowStep[] = [
    {
      icon: Globe2,
      title: "Choose your currency",
      description: "Pick a Virtual account for local bank transfers or a Global account for IBAN/SWIFT payments. You can add multiple currencies.",
      color: "hsl(215, 80%, 93%)",
      iconColor: "hsl(215, 60%, 45%)",
    },
    {
      icon: Building2,
      title: "Share your account details",
      description: "Copy the account number, IBAN, or BIC and give them to your employer, marketplace, or anyone sending you money.",
      color: "hsl(215, 80%, 93%)",
      iconColor: "hsl(215, 60%, 45%)",
    },
    {
      icon: ArrowDownLeft,
      title: "Receive the transfer",
      description: "When the sender deposits money, it arrives on the account. We track it and apply the correct reference.",
      color: "hsl(215, 80%, 93%)",
      iconColor: "hsl(215, 60%, 45%)",
    },
    {
      icon: Wallet,
      title: "Settle in XAF",
      description: "Funds are converted and sent to your Kang Wallet or Mobile Money in XAF. You can see every payment under Activity.",
      color: "hsl(215, 80%, 93%)",
      iconColor: "hsl(215, 60%, 45%)",
    },
    {
      icon: CheckCircle2,
      title: "Common uses",
      description: "Freelance payments, marketplace payouts, overseas salary, family support, and business receipts from abroad.",
      color: "hsl(215, 80%, 93%)",
      iconColor: "hsl(215, 60%, 45%)",
    },
  ];

  return (
    <div className="min-h-screen bg-background antialiased">
      {/* Header */}
      <header className="border-b border-border/60 bg-card">
        <div className="container max-w-3xl px-4 sm:px-6 py-6 sm:py-10">
          {/* How it works — placed above the page title */}
          <HowItWorksFlow
            title="How Global Accounts work"
            storageKey="global-accounts"
            steps={globalAccountSteps}
          />

          <div className="mt-4 flex items-center justify-between">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              <Globe2 className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
              Global Accounts
            </div>
          </div>
          <h1 className="mt-3 text-2xl sm:text-3xl font-semibold tracking-[-0.018em] text-foreground">
            Receive worldwide. Settle in XAF.
          </h1>

          <dl className="mt-6 sm:mt-8 grid grid-cols-3 divide-x divide-border/60 rounded-2xl border border-border/60 bg-background overflow-hidden shadow-sm">
            <Stat label="Accounts" value={String(accounts.length)} />
            <Stat label="Inflows" value={String(payments.length)} />
            <Stat
              label="Received"
              value={`${(totalReceivedXAF / 1000).toFixed(1)}k`}
              unit="XAF"
            />
          </dl>
        </div>
      </header>

      <main className="container max-w-3xl px-4 sm:px-6 py-8 sm:py-10 space-y-8 sm:space-y-10">
        {/* Accounts */}
        <section className="space-y-4" aria-labelledby="accounts-heading">
          <SectionTitle
            id="accounts-heading"
            title="Your accounts"
            trailing={
              accounts.length > 0 ? (
                <span className="text-xs tabular-nums text-muted-foreground">
                  {accounts.length} active
                </span>
              ) : null
            }
          />

          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-56 w-full rounded-3xl" />
              <Skeleton className="h-56 w-full rounded-3xl" />
            </div>
          ) : accounts.length === 0 ? (
            <Card className="border-dashed border-border/60">
              <CardContent className="py-10 px-6 text-center">
                <div
                  className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted"
                  aria-hidden="true"
                >
                  <Globe2 className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
                </div>
                <p className="mt-4 text-[15px] font-semibold">No accounts yet</p>
                <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
                  Create your first global account to start receiving money from abroad.
                  It only takes a minute.
                </p>
                <ol className="mt-5 mx-auto max-w-sm text-left text-sm text-muted-foreground space-y-2">
                  <li className="flex gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-foreground/5 text-[11px] font-semibold text-foreground">1</span>
                    <span>Pick a currency above (USD, EUR, GBP and more).</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-foreground/5 text-[11px] font-semibold text-foreground">2</span>
                    <span>Confirm your KYC name matches the sender's records.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-foreground/5 text-[11px] font-semibold text-foreground">3</span>
                    <span>Tap Generate account, then share the details with the sender.</span>
                  </li>
                </ol>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-6 rounded-full"
                  onClick={() =>
                    document
                      .getElementById("new-heading")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" })
                  }
                >
                  Create my first account
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" strokeWidth={1.75} />
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {accounts.map((a) => (
                <AccountCard key={a.id} account={a} onCopy={copy} />
              ))}
            </div>
          )}
        </section>


        {/* Use-case cards — swipeable */}
        <section aria-label="Common use cases">
          <div
            className="-mx-4 px-4 flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          >
            {[
              {
                icon: Briefcase,
                title: "Salary payments",
                desc: "Receive overseas payroll in USD, EUR or GBP straight to your wallet.",
                bg: "hsl(215, 65%, 32%)",
                fg: "hsl(0, 0%, 100%)",
                soft: "hsl(0, 0%, 100%, 0.18)",
              },
              {
                icon: RotateCcw,
                title: "Refunds",
                desc: "Get refunds from foreign merchants without losing money on FX fees.",
                bg: "hsl(174, 62%, 28%)",
                fg: "hsl(0, 0%, 100%)",
                soft: "hsl(0, 0%, 100%, 0.18)",
              },
              {
                icon: Store,
                title: "Merchant payouts",
                desc: "Collect marketplace, Adsense or freelance income and settle in XAF.",
                bg: "hsl(28, 78%, 44%)",
                fg: "hsl(0, 0%, 100%)",
                soft: "hsl(0, 0%, 100%, 0.18)",
              },
            ].map((u) => (
              <div
                key={u.title}
                className="snap-start shrink-0 basis-[60%] sm:basis-[38%] aspect-[3/4] rounded-2xl p-5 shadow-sm transition-transform active:scale-[0.98] flex flex-col"
                style={{ backgroundColor: u.bg, color: u.fg }}
              >
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-full"
                  style={{ backgroundColor: u.soft }}
                >
                  <u.icon className="h-5 w-5" strokeWidth={1.75} style={{ color: u.fg }} />
                </div>
                <div className="mt-auto">
                  <div className="text-base font-semibold" style={{ color: u.fg }}>
                    {u.title}
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed" style={{ color: u.fg, opacity: 0.9 }}>
                    {u.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Swipe to see more</p>

        </section>


        {/* New account — list style */}
        <section className="space-y-4" aria-labelledby="new-heading">
          <SectionTitle id="new-heading" title="New account" />

          {/* COMPLIANCE CHECK: non-dismissible exact-name warning + BEAC PoP picker */}
          <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/30">
            <ShieldAlert className="h-4 w-4 text-amber-700 dark:text-amber-400" />
            <AlertTitle className="text-amber-900 dark:text-amber-200">
              Exact name required
            </AlertTitle>
            <AlertDescription className="text-amber-900/90 dark:text-amber-200/90">
              Your YouTube, TikTok, Adsense or marketplace profile must match the verified
              KYC name on this account exactly — otherwise the payment will be rejected by
              the sending bank.
              <div className="mt-2 rounded-md border border-amber-300/60 bg-background/60 px-3 py-2 text-foreground">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      Beneficiary
                    </div>
                    <div className="font-semibold tabular-nums truncate">
                      {kycName || "Complete identity verification first"}
                    </div>
                  </div>
                  {kycName && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 shrink-0 text-xs"
                      onClick={() => setNameDialogOpen(true)}
                      disabled={pendingCorrection}
                    >
                      {pendingCorrection ? "Review pending" : "Request correction"}
                    </Button>
                  )}
                </div>
                {pendingCorrection && (
                  <p className="mt-1.5 text-[11px] text-amber-900/80 dark:text-amber-200/80">
                    A name correction is under compliance review.
                  </p>
                )}
              </div>
              <fieldset className="mt-3 space-y-1.5">
                <legend className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Purpose of payment (BEAC)
                </legend>
                <div className="grid grid-cols-2 gap-2">
                  {ALLOWED_NIUM_POP_CODES.map((code) => (
                    <label
                      key={code}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-2 text-xs",
                        popCode === code
                          ? "border-foreground bg-background"
                          : "border-amber-300/60 bg-background/60 hover:bg-background",
                      )}
                    >
                      <input
                        type="radio"
                        name="account-pop"
                        className="sr-only"
                        checked={popCode === code}
                        onChange={() => setPopCode(code)}
                      />
                      <span className="font-medium text-foreground">{code}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </AlertDescription>
          </Alert>


          {/* Account kind (Virtual vs Global) — Nium v4.52.0 split */}
          <Card className="border-border/60">
            <CardContent className="p-3 sm:p-4">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
                Account type
              </div>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Account kind">
                {([
                  { k: "virtual" as AccountKind, title: "Virtual", sub: "Local rails · account number" },
                  { k: "global" as AccountKind, title: "Global",  sub: "IBAN / SWIFT · cross-border" },
                ]).map((opt) => {
                  const active = accountKind === opt.k;
                  return (
                    <button
                      key={opt.k}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setAccountKind(opt.k)}
                      className={cn(
                        "rounded-xl border p-3 text-left transition-colors",
                        active ? "border-foreground bg-muted/40" : "border-border/60 hover:bg-muted/30",
                      )}
                    >
                      <div className="text-sm font-semibold">{opt.title}</div>
                      <div className="text-[11px] text-muted-foreground">{opt.sub}</div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardContent className="p-2 sm:p-3">
              <CurrencyCombobox value={newCurrency} onChange={setNewCurrency} />
              <div className="p-2 sm:p-3 pt-2">
                <Button
                  onClick={createAccount}
                  disabled={creating}
                  size="lg"
                  className={cn(
                    "w-full h-12 rounded-full text-[15px] font-medium text-white shadow-sm transition-colors",
                    CURRENCY_META[newCurrency].bg,
                    "hover:opacity-90",
                  )}
                >
                  {creating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" strokeWidth={2} />
                  )}
                  <span className="ml-2">Generate {newCurrency} account</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          <TransactionPreview
            currency={newCurrency}
            defaultRouting={defaults.payout_preference}
          />
        </section>



        {/* Cash-out */}
        <section className="space-y-4" aria-labelledby="cashout-heading">
          <SectionTitle
            id="cashout-heading"
            title="Cash-out"
            hint="Where incoming funds land."
          />
          {loading ? (
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-28 rounded-2xl" />
              <Skeleton className="h-28 rounded-2xl" />
            </div>
          ) : (
            <Card className="border-border/60">
              <CardContent className="p-4 sm:p-6 space-y-4">
                <div
                  className="grid grid-cols-2 gap-3"
                  role="radiogroup"
                  aria-label="Default cash-out preference"
                >
                  <PreferenceTile
                    active={defaults.payout_preference === "KANG_WALLET"}
                    onClick={() => saveUserDefaults("KANG_WALLET", null)}
                    icon={<Wallet className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />}
                    title="Kang Wallet"
                    subtitle="XAF · instant"
                    accent="bg-primary"
                  />
                  <PreferenceTile
                    active={defaults.payout_preference === "MOBILE_MONEY"}
                    onClick={() => {
                      const phone =
                        defaults.payout_channel ??
                        prompt("Mobile Money phone (e.g. 237677123456)") ??
                        "";
                      if (phone) saveUserDefaults("MOBILE_MONEY", phone);
                    }}
                    icon={<Smartphone className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />}
                    title="Mobile Money"
                    subtitle="MTN · Orange"
                    accent="bg-amber-500"
                  />
                </div>

                {defaults.payout_preference === "MOBILE_MONEY" && !defaults.payout_channel && (
                  <p className="text-[11px] text-muted-foreground">
                    Add your Mobile Money phone number below so payouts can be delivered.
                  </p>
                )}

                {defaults.payout_preference === "MOBILE_MONEY" && (
                  <div className="grid gap-2 pt-1">
                    <Label htmlFor="def-phone" className="text-xs">
                      Phone
                    </Label>
                    <Input
                      id="def-phone"
                      placeholder="237677123456"
                      defaultValue={defaults.payout_channel ?? ""}
                      onBlur={(e) =>
                        e.target.value && saveUserDefaults("MOBILE_MONEY", e.target.value)
                      }
                      className="h-11 rounded-xl"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </section>



        {/* Activity */}
        {payments.length > 0 && (
          <section className="space-y-4" aria-labelledby="activity-heading">
            <SectionTitle id="activity-heading" title="Activity" />

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search
                  className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                <Input
                  type="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search description, reference, amount…"
                  className="h-11 rounded-xl pl-9"
                  aria-label="Search activity"
                />
              </div>
              <div className="flex gap-2">
                <DateRangePicker
                  value={dateRange}
                  onChange={setDateRange}
                  className="flex-1 sm:flex-none"
                />
                <Button
                  variant="outline"
                  onClick={exportCsv}
                  className="h-11 rounded-xl gap-2 shrink-0"
                  aria-label="Export activity as CSV"
                >
                  <Download className="h-4 w-4" strokeWidth={1.75} />
                  <span className="hidden sm:inline">Export</span>
                </Button>
              </div>
            </div>

            <Card className="border-border/60 overflow-hidden">
              <CardContent className="p-0">
                {filteredPayments.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    No matching activity.
                  </div>
                ) : (
                  <ul
                    className="divide-y divide-border/60"
                    aria-label="Incoming global account payments"
                  >
                    {pagedPayments.map((p) => {
                      const ccy = (p.source_currency as Currency) in CURRENCY_META
                        ? (p.source_currency as Currency)
                        : null;
                      const meta = ccy ? CURRENCY_META[ccy] : null;
                      return (
                        <li
                          key={p.id}
                          className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-4 transition-colors hover:bg-muted/40"
                        >
                          <div
                            className={cn(
                              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white",
                              meta?.bg ?? "bg-foreground",
                            )}
                            aria-hidden="true"
                          >
                            <ArrowDownLeft className="h-4 w-4" strokeWidth={1.75} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[15px] font-medium tracking-tight truncate">
                              +{p.source_amount.toLocaleString()} {p.source_currency}
                            </div>
                            <div className="mt-0.5 text-xs text-muted-foreground truncate">
                              <time dateTime={p.created_at}>
                                {new Date(p.created_at).toLocaleDateString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </time>{" "}
                              · {p.routing === "KANG_WALLET" ? "Wallet" : "Mobile Money"}
                              {p.description ? ` · ${p.description}` : ""}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-[14px] sm:text-[15px] font-semibold tabular-nums tracking-tight">
                              {p.xaf_net_credited.toLocaleString()} XAF
                            </div>
                            <Badge
                              variant={
                                p.status === "credited" || p.status === "payout_completed"
                                  ? "default"
                                  : "outline"
                              }
                              className="mt-1 h-4 px-1.5 text-[10px] font-medium"
                              aria-label={`Status: ${p.status}`}
                            >
                              {p.status === "payout_completed" && (
                                <CheckCircle2
                                  className="mr-0.5 h-3 w-3"
                                  strokeWidth={1.75}
                                  aria-hidden="true"
                                />
                              )}
                              {p.status}
                            </Badge>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {filteredPayments.length > 0 && (
                  <div className="border-t border-border/60">
                    <DataTablePagination
                      page={activityPage}
                      pageSize={activityPageSize}
                      totalCount={filteredPayments.length}
                      onPageChange={setActivityPage}
                      onPageSizeChange={setActivityPageSize}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        )}
        <section className="mt-6">
          <NameCorrectionUpdates userId={userId} />
        </section>

      </main>

      <NameCorrectionDialog
        open={nameDialogOpen}
        onOpenChange={setNameDialogOpen}
        userId={userId}
        currentName={kycName}
        onSubmitted={() => setPendingCorrection(true)}
      />
    </div>
  );
}

function CurrencyCombobox({
  value,
  onChange,
}: {
  value: Currency;
  onChange: (c: Currency) => void;
}) {
  const [open, setOpen] = useState(false);
  const meta = CURRENCY_META[value];
  const currencies = Object.keys(CURRENCY_META) as Currency[];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-label="Select currency"
          className="flex w-full items-center gap-3 rounded-xl border border-border/60 bg-background p-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white text-base font-semibold shadow-sm",
              meta.bg,
            )}
            aria-hidden="true"
          >
            {meta.symbol}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-semibold tracking-tight">{value}</span>
              <span className="text-sm text-muted-foreground truncate">· {meta.label}</span>
            </div>
            <div className="text-xs text-muted-foreground truncate">{meta.region}</div>
          </div>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 w-[calc(100vw-2rem)] sm:w-[420px]"
        align="start"
        sideOffset={6}
      >
        <Command>
          <CommandInput placeholder="Search currency, code, or country…" />
          <CommandList>
            <CommandEmpty>No currency found.</CommandEmpty>
            <CommandGroup>
              {currencies.map((c) => {
                const m = CURRENCY_META[c];
                const selected = c === value;
                return (
                  <CommandItem
                    key={c}
                    value={`${c} ${m.label} ${m.region}`}
                    onSelect={() => {
                      onChange(c);
                      setOpen(false);
                    }}
                    className="gap-3"
                  >
                    <div
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white text-sm font-semibold",
                        m.bg,
                      )}
                      aria-hidden="true"
                    >
                      {m.symbol}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{c}</span>
                        <span className="text-xs text-muted-foreground truncate">
                          · {m.label}
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {m.region}
                      </div>
                    </div>
                    {selected && <Check className="h-4 w-4 text-foreground" />}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function SectionTitle({
  id,
  title,
  hint,
  trailing,
}: {
  id?: string;
  title: string;
  hint?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-3 px-1">
      <div>
        <h2 id={id} className="text-lg sm:text-xl font-semibold tracking-tight">
          {title}
        </h2>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      {trailing}
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div className="px-2 sm:px-4 py-3 sm:py-4 text-center">
      <dt className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 flex items-baseline justify-center gap-1 text-xl sm:text-2xl font-semibold tabular-nums tracking-tight">
        {value}
        {unit && (
          <span className="text-[11px] font-medium text-muted-foreground">{unit}</span>
        )}
      </dd>
    </div>
  );
}

function PreferenceTile({
  active,
  onClick,
  icon,
  title,
  subtitle,
  accent,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  accent: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      aria-label={title}
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-center justify-center gap-2 rounded-2xl border p-3 text-center transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        active
          ? cn("border-transparent text-white", accent)
          : "border-border/60 bg-muted/30 hover:bg-muted/50",
      )}
    >
      {active && (
        <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-white/20">
          <CheckCircle2
            className="h-3.5 w-3.5 text-white"
            strokeWidth={2}
            aria-hidden="true"
          />
        </div>
      )}
      <div
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-full",
          active ? "bg-white/20 text-white" : cn("text-white", accent),
        )}
        aria-hidden="true"
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className={cn("text-[13px] font-semibold leading-tight", active ? "text-white" : "text-foreground")}>
          {title}
        </div>
        <div className={cn("mt-0.5 text-[11px] leading-tight", active ? "text-white/85" : "text-muted-foreground")}>
          {subtitle}
        </div>
      </div>
    </button>
  );
}


function AccountCard({
  account: a,
  onCopy,
}: {
  account: GlobalAccount;
  onCopy: (txt: string | null, label: string) => void;
}) {
  const meta = CURRENCY_META[a.currency];
  return (
    <Card className="border-border/60 transition-shadow hover:shadow-lg">
      {/* Colour banner */}
      <div className={cn("relative px-5 py-5 sm:px-6 sm:py-6 text-white", meta.bg)}>
        <div
          className="absolute inset-0 opacity-20 bg-gradient-to-br from-white/40 via-transparent to-black/30"
          aria-hidden="true"
        />
        <div className="relative flex items-start justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/20 ring-1 ring-white/40 text-xl font-semibold backdrop-blur-sm"
              aria-hidden="true"
            >
              {meta.symbol}
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/80">
                {meta.region}
              </div>
              <div className="text-lg sm:text-xl font-semibold tracking-tight truncate">
                {a.currency} · {meta.label}
              </div>
              <div className="mt-1 flex items-center gap-1 text-xs text-white/85 truncate">
                <Building2 className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
                <span className="truncate">{a.bank_name}</span>
              </div>
            </div>
          </div>
          <Badge
            variant="outline"
            className="border-white/40 bg-white/10 text-white text-[10px] font-medium uppercase tracking-wider backdrop-blur-sm"
          >
            {a.mode}
          </Badge>
        </div>
      </div>

      <CardContent className="p-4 sm:p-5 space-y-1">
        <div className="pb-3">
          <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Beneficiary
          </div>
          <div className="mt-1 text-sm font-medium">{a.beneficiary_name}</div>
        </div>

        <div className="-mx-2 divide-y divide-border/60">
          {a.iban && <DetailRow label="IBAN" value={a.iban} onCopy={() => onCopy(a.iban, "IBAN")} />}
          {a.account_number && (
            <DetailRow
              label="Account number"
              value={a.account_number}
              onCopy={() => onCopy(a.account_number, "Account")}
            />
          )}
          {a.routing_code && (
            <DetailRow
              label="Routing / Sort code"
              value={a.routing_code}
              onCopy={() => onCopy(a.routing_code, "Routing")}
            />
          )}
          {a.bic && (
            <DetailRow label="BIC / SWIFT" value={a.bic} onCopy={() => onCopy(a.bic, "BIC")} />
          )}
        </div>

        {a.bank_address && (
          <p className="pt-3 text-[11px] leading-relaxed text-muted-foreground">
            {a.bank_address}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function DetailRow({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label={`Copy ${label}: ${value}`}
      className={cn(
        "group flex w-full items-center justify-between gap-3 px-2 py-3 text-left transition-colors hover:bg-muted/50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
      )}
    >
      <div className="min-w-0">
        <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </div>
        <div className="mt-0.5 truncate font-mono text-sm">{value}</div>
      </div>
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors group-hover:bg-foreground group-hover:text-background"
        aria-hidden="true"
      >
        <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
      </div>
    </button>
  );
}
