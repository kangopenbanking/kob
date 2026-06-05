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

type Currency = "USD" | "EUR" | "GBP";

type GlobalAccount = {
  id: string;
  currency: Currency;
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
  // Solid Tailwind color classes (HSL-backed in tailwind palette)
  bg: string;
  ring: string;
  text: string;
  soft: string;
};

const CURRENCY_META: Record<Currency, CurrencyMeta> = {
  USD: {
    symbol: "$",
    label: "US Dollar",
    region: "United States",
    bg: "bg-emerald-600",
    ring: "ring-emerald-600",
    text: "text-emerald-700 dark:text-emerald-400",
    soft: "bg-emerald-50 dark:bg-emerald-950/40",
  },
  EUR: {
    symbol: "€",
    label: "Euro",
    region: "Eurozone",
    bg: "bg-sky-600",
    ring: "ring-sky-600",
    text: "text-sky-700 dark:text-sky-400",
    soft: "bg-sky-50 dark:bg-sky-950/40",
  },
  GBP: {
    symbol: "£",
    label: "British Pound",
    region: "United Kingdom",
    bg: "bg-violet-600",
    ring: "ring-violet-600",
    text: "text-violet-700 dark:text-violet-400",
    soft: "bg-violet-50 dark:bg-violet-950/40",
  },
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
  }, []);

  const createAccount = async () => {
    setCreating(true);
    const { data, error } = await supabase.functions.invoke("nium-create-global-account", {
      body: { currency: newCurrency },
    });
    setCreating(false);
    if (error)
      return toast({
        title: "Couldn't generate account",
        description: error.message,
        variant: "destructive",
      });
    toast({
      title: data?.reused ? "Account already exists" : `${newCurrency} account ready`,
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

  return (
    <div className="min-h-screen bg-background antialiased">
      {/* Header */}
      <header className="border-b border-border/60 bg-gradient-to-b from-card to-background">
        <div className="container max-w-3xl px-4 sm:px-6 py-8 sm:py-14">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-foreground/5 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            <Globe2 className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
            Global Accounts
          </div>
          <h1 className="mt-4 text-3xl sm:text-5xl font-semibold tracking-[-0.022em] text-foreground">
            Receive worldwide.
            <br />
            <span className="text-muted-foreground">Settle in XAF.</span>
          </h1>
          <p className="mt-3 sm:mt-4 max-w-lg text-sm sm:text-[15px] leading-relaxed text-muted-foreground">
            Real bank accounts in USD, EUR and GBP. Funds arrive in your wallet instantly.
          </p>

          <dl className="mt-8 sm:mt-10 grid grid-cols-3 divide-x divide-border/60 rounded-2xl border border-border/60 bg-background overflow-hidden">
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
        {/* New account — list style */}
        <section className="space-y-4" aria-labelledby="new-heading">
          <SectionTitle id="new-heading" title="New account" />
          <Card className="border-border/60">
            <CardContent className="p-2 sm:p-3">
              <ul
                className="divide-y divide-border/60"
                role="radiogroup"
                aria-label="New global account currency"
              >
                {(Object.keys(CURRENCY_META) as Currency[]).map((c) => {
                  const selected = newCurrency === c;
                  const meta = CURRENCY_META[c];
                  return (
                    <li key={c}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        aria-label={`${meta.label} (${c})`}
                        onClick={() => setNewCurrency(c)}
                        className={cn(
                          "group flex w-full items-center gap-4 rounded-xl p-3 sm:p-4 text-left transition-colors",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                          selected ? meta.soft : "hover:bg-muted/50",
                        )}
                      >
                        <div
                          className={cn(
                            "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white text-lg font-semibold shadow-sm",
                            meta.bg,
                          )}
                          aria-hidden="true"
                        >
                          {meta.symbol}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[15px] font-semibold tracking-tight">
                              {c}
                            </span>
                            <span className="text-sm text-muted-foreground truncate">
                              · {meta.label}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">{meta.region}</div>
                        </div>
                        <div
                          className={cn(
                            "flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors",
                            selected
                              ? cn("border-transparent text-white", meta.bg)
                              : "border-border",
                          )}
                          aria-hidden="true"
                        >
                          {selected && <Check className="h-3.5 w-3.5" strokeWidth={2.5} />}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
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
        </section>

        {/* Cash-out */}
        <section className="space-y-4" aria-labelledby="cashout-heading">
          <SectionTitle
            id="cashout-heading"
            title="Cash-out"
            hint="Where incoming funds land."
          />
          <Card className="border-border/60">
            <CardContent className="p-4 sm:p-6 space-y-4">
              <div
                className="grid grid-cols-1 sm:grid-cols-2 gap-2"
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
        </section>

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
              <CardContent className="py-14 text-center">
                <div
                  className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted"
                  aria-hidden="true"
                >
                  <Globe2 className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
                </div>
                <p className="mt-4 text-[15px] font-medium">No accounts yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Generate one to start receiving.
                </p>
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
      </main>
    </div>
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
    <div className="px-3 sm:px-4 py-3 sm:py-4">
      <dt className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1.5 flex items-baseline gap-1 text-xl sm:text-2xl font-semibold tabular-nums tracking-tight">
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
        "rounded-2xl border p-4 text-left transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        active
          ? "border-foreground/20 bg-muted/40"
          : "border-border/60 hover:border-foreground/40",
      )}
    >
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full text-white",
            active ? accent : "bg-muted text-muted-foreground",
          )}
          aria-hidden="true"
        >
          {icon}
        </div>
        {active && (
          <CheckCircle2
            className="ml-auto h-4 w-4 text-foreground"
            strokeWidth={1.75}
            aria-hidden="true"
          />
        )}
      </div>
      <div className="mt-3 text-[15px] font-semibold tracking-tight">{title}</div>
      <div className="text-[11px] text-muted-foreground">{subtitle}</div>
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
