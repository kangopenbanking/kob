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
import { subDays, startOfDay, endOfDay } from "date-fns";
import {
  Globe2,
  Copy,
  Plus,
  Wallet,
  Smartphone,
  Loader2,
  Sparkles,
  ArrowDownLeft,
  CheckCircle2,
  Building2,
  ShieldCheck,
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
};

type UserDefaults = {
  payout_preference: "KANG_WALLET" | "MOBILE_MONEY";
  payout_channel: string | null;
};

const CURRENCY_META: Record<
  Currency,
  { flag: string; label: string; region: string; gradient: string; ring: string }
> = {
  USD: {
    flag: "🇺🇸",
    label: "US Dollar",
    region: "United States",
    gradient: "from-emerald-500/90 via-emerald-600/80 to-teal-700/90",
    ring: "ring-emerald-400/30",
  },
  EUR: {
    flag: "🇪🇺",
    label: "Euro",
    region: "Eurozone (IBAN)",
    gradient: "from-indigo-500/90 via-blue-600/80 to-violet-700/90",
    ring: "ring-indigo-400/30",
  },
  GBP: {
    flag: "🇬🇧",
    label: "British Pound",
    region: "United Kingdom",
    gradient: "from-rose-500/90 via-pink-600/80 to-fuchsia-700/90",
    ring: "ring-rose-400/30",
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

  // Activity feed: date-range filter + pagination
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfDay(subDays(new Date(), 29)),
    to: endOfDay(new Date()),
  });
  const [activityPage, setActivityPage] = useState(1);
  const [activityPageSize, setActivityPageSize] = useState(10);

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
      title: data?.reused ? "Account already exists" : "Global account generated",
      description: `${newCurrency} ready to receive`,
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
    toast({ title: "Cash-out preference saved" });
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
    return payments.filter((p) => {
      const t = new Date(p.created_at).getTime();
      return t >= from && t <= to;
    });
  }, [payments, dateRange]);

  const pagedPayments = useMemo(() => {
    const start = (activityPage - 1) * activityPageSize;
    return filteredPayments.slice(start, start + activityPageSize);
  }, [filteredPayments, activityPage, activityPageSize]);

  useEffect(() => {
    setActivityPage(1);
  }, [dateRange, activityPageSize]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent pointer-events-none" />
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl pointer-events-none" />

        <div className="relative container max-w-3xl pt-8 pb-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-background/60 backdrop-blur px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Powered by Nium · Real bank rails
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">
            Your world,{" "}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              one wallet
            </span>
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground md:text-base">
            Receive USD, EUR or GBP into real bank accounts. We convert and settle to your Kang
            Wallet or Mobile Money in XAF — instantly.
          </p>

          {/* Stat strip */}
          <div className="mt-6 grid grid-cols-3 gap-3">
            <StatCard label="Accounts" value={String(accounts.length)} icon={<Globe2 className="h-4 w-4" />} />
            <StatCard
              label="Inflows"
              value={String(payments.length)}
              icon={<ArrowDownLeft className="h-4 w-4" />}
            />
            <StatCard
              label="Received"
              value={`${(totalReceivedXAF / 1000).toFixed(1)}k XAF`}
              icon={<Wallet className="h-4 w-4" />}
            />
          </div>
        </div>
      </div>

      <div className="container max-w-3xl pb-12 space-y-6">
        {/* Cash-out preference */}
        <Card className="border-border/60 shadow-sm">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <h2 className="text-base font-semibold">Default cash-out</h2>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  How incoming funds settle by default. Each account can override.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Default cash-out preference">
              <PreferenceTile
                active={defaults.payout_preference === "KANG_WALLET"}
                onClick={() => saveUserDefaults("KANG_WALLET", null)}
                icon={<Wallet className="h-4 w-4" aria-hidden="true" />}
                title="Kang Wallet"
                subtitle="XAF · instant"
                ariaLabel="Cash out to Kang Wallet in XAF"
              />
              <PreferenceTile
                active={defaults.payout_preference === "MOBILE_MONEY"}
                onClick={() => {
                  const phone =
                    defaults.payout_channel ??
                    prompt("Mobile Money phone number (e.g. 237677123456)") ??
                    "";
                  if (phone) saveUserDefaults("MOBILE_MONEY", phone);
                }}
                icon={<Smartphone className="h-4 w-4" aria-hidden="true" />}
                title="Mobile Money"
                subtitle="MTN · Orange"
                ariaLabel="Cash out to Mobile Money (MTN or Orange)"
              />
            </div>

            {defaults.payout_preference === "MOBILE_MONEY" && (
              <div className="grid gap-2 pt-1">
                <Label htmlFor="def-phone" className="text-xs">
                  Mobile Money phone
                </Label>
                <Input
                  id="def-phone"
                  placeholder="237677123456"
                  defaultValue={defaults.payout_channel ?? ""}
                  onBlur={(e) =>
                    e.target.value && saveUserDefaults("MOBILE_MONEY", e.target.value)
                  }
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Generate */}
        <Card className="border-border/60 shadow-sm">
          <CardContent className="p-5 space-y-4">
            <div>
              <h2 className="text-base font-semibold">Open a new global account</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Pick a currency. Real IBAN / routing details provisioned in seconds.
              </p>
            </div>

            <div
              className="grid grid-cols-3 gap-2"
              role="radiogroup"
              aria-label="New global account currency"
            >
              {(Object.keys(CURRENCY_META) as Currency[]).map((c) => {
                const selected = newCurrency === c;
                return (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={`${CURRENCY_META[c].label} (${c})`}
                    onClick={() => setNewCurrency(c)}
                    className={cn(
                      "rounded-xl border p-3 text-left transition-all active:scale-[0.98]",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      "contrast-more:border-foreground",
                      selected
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20 contrast-more:bg-primary/20"
                        : "border-border/60 hover:border-border",
                    )}
                  >
                    <div className="text-xl leading-none" aria-hidden="true">
                      {CURRENCY_META[c].flag}
                    </div>
                    <div className="mt-2 text-sm font-semibold">{c}</div>
                    <div className="text-[10px] text-muted-foreground leading-tight">
                      {CURRENCY_META[c].region}
                    </div>
                  </button>
                );
              })}
            </div>

            <Button
              onClick={createAccount}
              disabled={creating}
              size="lg"
              className="w-full bg-gradient-to-r from-primary to-primary/90 shadow-lg shadow-primary/20"
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              <span className="ml-2">Generate {newCurrency} account</span>
            </Button>
          </CardContent>
        </Card>

        {/* Accounts */}
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Your accounts
            </h2>
            {accounts.length > 0 && (
              <span className="text-xs text-muted-foreground">{accounts.length} active</span>
            )}
          </div>

          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-44 w-full rounded-2xl" />
              <Skeleton className="h-44 w-full rounded-2xl" />
            </div>
          ) : accounts.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-10 text-center">
                <Globe2 className="h-10 w-10 mx-auto text-muted-foreground/40" />
                <p className="mt-3 text-sm font-medium">No global accounts yet</p>
                <p className="text-xs text-muted-foreground">
                  Generate your first one above to start receiving worldwide.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {accounts.map((a) => (
                <AccountCard key={a.id} account={a} onCopy={copy} />
              ))}
            </div>
          )}
        </section>

        {/* Activity */}
        {payments.length > 0 && (
          <section className="space-y-3" aria-labelledby="activity-heading">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-1">
              <h2
                id="activity-heading"
                className="text-sm font-semibold text-muted-foreground uppercase tracking-wide"
              >
                Recent activity
              </h2>
              <DateRangePicker
                value={dateRange}
                onChange={setDateRange}
                className="w-full sm:w-auto"
              />
            </div>
            <Card className="border-border/60 shadow-sm overflow-hidden">
              <CardContent className="p-0">
                {filteredPayments.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    No activity in the selected range.
                  </div>
                ) : (
                  <ul
                    className="divide-y divide-border/60"
                    aria-label="Incoming global account payments"
                  >
                    {pagedPayments.map((p) => (
                      <li key={p.id} className="flex items-center gap-3 p-4">
                        <div
                          className="h-9 w-9 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0"
                          aria-hidden="true"
                        >
                          <ArrowDownLeft className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">
                            +{p.source_amount.toLocaleString()} {p.source_currency}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            <time dateTime={p.created_at}>
                              {new Date(p.created_at).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </time>{" "}
                            · {p.routing === "KANG_WALLET" ? "Wallet" : "Mobile Money"}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold">
                            {p.xaf_net_credited.toLocaleString()} XAF
                          </div>
                          <Badge
                            variant={
                              p.status === "credited" || p.status === "payout_completed"
                                ? "default"
                                : "outline"
                            }
                            className="mt-0.5 text-[10px] h-4 px-1.5"
                            aria-label={`Status: ${p.status}`}
                          >
                            {p.status === "payout_completed" && (
                              <CheckCircle2 className="h-3 w-3 mr-0.5" aria-hidden="true" />
                            )}
                            {p.status}
                          </Badge>
                        </div>
                      </li>
                    ))}
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
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/60 backdrop-blur p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tracking-tight">{value}</div>
    </div>
  );
}

function PreferenceTile({
  active,
  onClick,
  icon,
  title,
  subtitle,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-xl border p-3 text-left transition-all active:scale-[0.98]",
        active
          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
          : "border-border/60 hover:border-border",
      )}
    >
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "h-7 w-7 rounded-lg flex items-center justify-center",
            active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
          )}
        >
          {icon}
        </div>
        {active && <CheckCircle2 className="h-4 w-4 text-primary ml-auto" />}
      </div>
      <div className="mt-2 text-sm font-semibold">{title}</div>
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
    <Card
      className={cn(
        "overflow-hidden border-border/60 shadow-md transition-shadow hover:shadow-lg",
      )}
    >
      {/* Gradient header — Apple-card style */}
      <div
        className={cn(
          "relative p-5 text-white bg-gradient-to-br",
          meta.gradient,
        )}
      >
        <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex items-start justify-between">
          <div>
            <div className="text-3xl leading-none">{meta.flag}</div>
            <div className="mt-3 text-xs uppercase tracking-wider opacity-80">
              {meta.label}
            </div>
            <div className="text-xl font-semibold">{a.currency}</div>
          </div>
          <Badge
            variant="secondary"
            className="bg-white/15 text-white border-white/20 backdrop-blur"
          >
            {a.mode}
          </Badge>
        </div>
        <div className="relative mt-4 text-xs opacity-90 flex items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5" />
          {a.bank_name}
        </div>
      </div>

      <CardContent className="p-4 space-y-3">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Beneficiary
        </div>
        <div className="text-sm font-medium -mt-2">{a.beneficiary_name}</div>

        <div className="h-px bg-border/60" />

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
            onCopy={() => onCopy(a.routing_code, "Routing code")}
          />
        )}
        {a.bic && (
          <DetailRow label="BIC / SWIFT" value={a.bic} onCopy={() => onCopy(a.bic, "BIC")} />
        )}
        {a.bank_address && (
          <p className="text-[11px] text-muted-foreground pt-1 leading-relaxed">
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
      onClick={onCopy}
      className="w-full flex items-center justify-between gap-2 -mx-1 px-1 py-1.5 rounded-lg hover:bg-muted/60 transition-colors text-left group"
    >
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="font-mono text-sm truncate">{value}</div>
      </div>
      <div className="h-7 w-7 rounded-md bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary flex items-center justify-center transition-colors shrink-0">
        <Copy className="h-3.5 w-3.5" />
      </div>
    </button>
  );
}
