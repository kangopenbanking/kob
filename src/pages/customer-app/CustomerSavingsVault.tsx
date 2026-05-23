import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, ArrowDownLeft, ArrowUpRight, PiggyBank, Wallet, Building2,
  Settings2, Download, FileText, CheckCircle2, Copy, AlertTriangle,
} from "lucide-react";
import jsPDF from "jspdf";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";
import { useCustomerAccounts } from "@/hooks/useCustomerData";
import {
  useVaultBalance, useVaultTransactions, useWithdrawVault,
  useVaultLimits, useUpdateVaultLimits, useVaultStatement,
  type WithdrawResult,
} from "@/hooks/savings/useSavingsVault";
import { extractEdgeFunctionError } from "@/lib/edge-function-error";

const fmt = (n: number, c = "XAF") =>
  new Intl.NumberFormat("fr-CM").format(Math.round(n)) + " " + c;

type Step = "form" | "confirm" | "receipt";

const CustomerSavingsVault: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useCustomerAuth();
  const { data: balance, isLoading: balLoading } = useVaultBalance();
  const { data: txData } = useVaultTransactions(50);
  const { data: limits } = useVaultLimits();
  const { data: accounts = [] } = useCustomerAccounts(user?.id);
  const withdraw = useWithdrawVault();
  const updateLimits = useUpdateVaultLimits();
  const statement = useVaultStatement();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("form");
  const [amount, setAmount] = useState("");
  const [destAccount, setDestAccount] = useState<string>("");
  const [receipt, setReceipt] = useState<WithdrawResult | null>(null);

  const [limitsOpen, setLimitsOpen] = useState(false);
  const [dailyInput, setDailyInput] = useState("");
  const [monthlyInput, setMonthlyInput] = useState("");

  const txs = txData?.transactions ?? [];
  const currency = balance?.currency ?? "XAF";
  const bal = balance?.balance ?? 0;

  const accountOptions = accounts.map((a: any) => ({
    id: a.id,
    label: a.nickname || a.account_holder_name || "Account",
    kind: (a.account_type === "bank" || a.account_subtype === "bank" ? "bank" : "wallet") as "wallet" | "bank",
  }));

  const dest = accountOptions.find((a) => a.id === destAccount);
  const amt = Number(amount) || 0;

  const resetSheet = () => {
    setStep("form");
    setAmount("");
    setDestAccount("");
    setReceipt(null);
  };

  const openWithdraw = () => {
    resetSheet();
    setOpen(true);
  };

  const goConfirm = () => {
    if (!amt || amt <= 0) return toast({ title: "Enter a valid amount", variant: "destructive" });
    if (amt > bal) return toast({ title: "Insufficient vault balance", description: `Available: ${fmt(bal, currency)}`, variant: "destructive" });
    if (limits && amt > limits.remaining_today) {
      return toast({
        title: "Daily limit reached",
        description: `You can still withdraw ${fmt(limits.remaining_today, currency)} today.`,
        variant: "destructive",
      });
    }
    if (limits && amt > limits.remaining_this_month) {
      return toast({
        title: "Monthly limit reached",
        description: `You can still withdraw ${fmt(limits.remaining_this_month, currency)} this month.`,
        variant: "destructive",
      });
    }
    if (!destAccount) return toast({ title: "Choose a destination account", variant: "destructive" });
    setStep("confirm");
  };

  const submitWithdraw = async () => {
    try {
      const res = await withdraw.mutateAsync({
        amount: amt,
        destination_kind: dest?.kind ?? "wallet",
        destination_account_id: destAccount,
      });
      setReceipt(res);
      setStep("receipt");
    } catch (e: any) {
      const msg = extractEdgeFunctionError(e, "Withdrawal failed. Please try again.");
      toast({ title: "Withdrawal failed", description: msg, variant: "destructive" });
    }
  };

  const saveLimits = async () => {
    const d = Number(dailyInput);
    const m = Number(monthlyInput);
    if (!Number.isFinite(d) || d < 0) return toast({ title: "Invalid daily limit", variant: "destructive" });
    if (!Number.isFinite(m) || m < 0) return toast({ title: "Invalid monthly limit", variant: "destructive" });
    if (d > m) return toast({ title: "Daily cannot exceed monthly", variant: "destructive" });
    try {
      await updateLimits.mutateAsync({ daily_withdrawal_limit: d, monthly_withdrawal_limit: m });
      toast({ title: "Limits updated" });
      setLimitsOpen(false);
    } catch (e: any) {
      toast({ title: "Could not save limits", description: extractEdgeFunctionError(e, ""), variant: "destructive" });
    }
  };

  const openLimits = () => {
    setDailyInput(String(limits?.daily_withdrawal_limit ?? balance?.daily_withdrawal_limit ?? 100000));
    setMonthlyInput(String(limits?.monthly_withdrawal_limit ?? balance?.monthly_withdrawal_limit ?? 1000000));
    setLimitsOpen(true);
  };

  const exportCSV = async () => {
    try {
      const data = await statement.mutateAsync({});
      const rows = [
        ["Reference", "Date", "Type", "Amount", "Currency", "Balance After", "Destination", "Description"],
        ...data.transactions.map((t) => [
          t.reference_code ?? t.id,
          new Date(t.created_at).toISOString(),
          t.kind,
          String(t.amount),
          data.currency,
          String(t.balance_after),
          t.destination_kind ?? "",
          (t.description ?? "").replace(/"/g, '""'),
        ]),
      ];
      const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `vault-statement-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e: any) {
      toast({ title: "Export failed", description: extractEdgeFunctionError(e, ""), variant: "destructive" });
    }
  };

  const exportPDF = async () => {
    try {
      const data = await statement.mutateAsync({});
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const W = doc.internal.pageSize.getWidth();
      let y = 56;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("Saving Vault Statement", 40, y);
      y += 22;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Generated: ${new Date(data.generated_at).toLocaleString()}`, 40, y); y += 14;
      doc.text(`Current balance: ${fmt(data.balance, data.currency)}`, 40, y); y += 14;
      doc.text(`Total transactions: ${data.transactions.length}`, 40, y); y += 22;

      doc.setFont("helvetica", "bold");
      doc.text("Ref", 40, y);
      doc.text("Date", 130, y);
      doc.text("Type", 260, y);
      doc.text("Amount", 320, y);
      doc.text("Balance", 400, y);
      doc.text("Destination", 480, y);
      y += 8;
      doc.setLineWidth(0.5);
      doc.line(40, y, W - 40, y);
      y += 12;
      doc.setFont("helvetica", "normal");

      for (const t of data.transactions) {
        if (y > 780) { doc.addPage(); y = 56; }
        doc.text((t.reference_code ?? "—").slice(0, 18), 40, y);
        doc.text(new Date(t.created_at).toLocaleDateString(), 130, y);
        doc.text(t.kind, 260, y);
        doc.text(`${t.kind === "credit" ? "+" : "−"}${Math.round(Number(t.amount)).toLocaleString()}`, 320, y);
        doc.text(Math.round(Number(t.balance_after)).toLocaleString(), 400, y);
        doc.text(t.destination_kind ?? "—", 480, y);
        y += 14;
      }
      doc.save(`vault-statement-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e: any) {
      toast({ title: "Export failed", description: extractEdgeFunctionError(e, ""), variant: "destructive" });
    }
  };

  const copyRef = (ref: string) => {
    navigator.clipboard?.writeText(ref);
    toast({ title: "Reference copied" });
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-10 flex items-center gap-2 bg-background/90 px-4 py-3 backdrop-blur border-b border-border">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-muted">
          <ArrowLeft className="h-5 w-5" strokeWidth={1.5} />
        </button>
        <h1 className="flex-1 text-base font-semibold">Saving Vault</h1>
        <button
          onClick={openLimits}
          className="rounded-full p-2 hover:bg-muted"
          aria-label="Withdrawal limits"
        >
          <Settings2 className="h-5 w-5" strokeWidth={1.5} />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="rounded-full p-2 hover:bg-muted" aria-label="Export statement">
              <Download className="h-5 w-5" strokeWidth={1.5} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={exportCSV} disabled={statement.isPending}>
              <FileText className="mr-2 h-4 w-4" /> Export as CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportPDF} disabled={statement.isPending}>
              <FileText className="mr-2 h-4 w-4" /> Export as PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <div className="px-4 pt-4 space-y-5">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border-2 border-foreground bg-[hsl(180,40%,92%)] p-6 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-background/60">
              <PiggyBank className="h-6 w-6 text-[hsl(180,60%,30%)]" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Vault Balance</p>
              <p className="text-2xl font-bold text-foreground">{balLoading ? "—" : fmt(bal, currency)}</p>
            </div>
          </div>
          <p className="mt-3 text-[12px] text-muted-foreground leading-snug">
            Spare change collected from your round-ups. Independent from your goals and free to withdraw at any time.
          </p>
          <Button
            onClick={openWithdraw}
            disabled={bal <= 0}
            className="mt-4 w-full rounded-2xl bg-foreground text-background hover:bg-foreground/90"
          >
            Withdraw
          </Button>
        </motion.div>

        {limits && (
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Withdrawal Limits</p>
              <button onClick={openLimits} className="text-[11px] font-semibold text-foreground underline-offset-2 hover:underline">
                Edit
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] text-muted-foreground">Today</p>
                <p className="text-sm font-semibold text-foreground">{fmt(limits.used_today, currency)} <span className="text-muted-foreground font-normal">/ {fmt(limits.daily_withdrawal_limit, currency)}</span></p>
                <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-foreground/70" style={{ width: `${Math.min(100, (limits.used_today / Math.max(1, limits.daily_withdrawal_limit)) * 100)}%` }} />
                </div>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">This month</p>
                <p className="text-sm font-semibold text-foreground">{fmt(limits.used_this_month, currency)} <span className="text-muted-foreground font-normal">/ {fmt(limits.monthly_withdrawal_limit, currency)}</span></p>
                <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-foreground/70" style={{ width: `${Math.min(100, (limits.used_this_month / Math.max(1, limits.monthly_withdrawal_limit)) * 100)}%` }} />
                </div>
              </div>
            </div>
          </div>
        )}

        <div>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Activity</p>
          {txs.length === 0 ? (
            <p className="rounded-2xl border border-border p-6 text-center text-sm text-muted-foreground">
              No vault activity yet. Round-ups will appear here as you spend.
            </p>
          ) : (
            <ul className="space-y-2">
              {txs.map((t) => {
                const isCredit = t.kind === "credit";
                const Icon = isCredit ? ArrowDownLeft : ArrowUpRight;
                return (
                  <li key={t.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${isCredit ? "bg-[hsl(150,40%,90%)]" : "bg-[hsl(25,80%,92%)]"}`}>
                      <Icon className={`h-5 w-5 ${isCredit ? "text-[hsl(150,40%,35%)]" : "text-[hsl(25,60%,40%)]"}`} strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{t.description || (isCredit ? "Round-up credit" : "Withdrawal")}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(t.created_at).toLocaleString()}
                        {t.reference_code ? ` · ${t.reference_code}` : ""}
                      </p>
                    </div>
                    <p className={`text-sm font-semibold ${isCredit ? "text-[hsl(150,40%,30%)]" : "text-foreground"}`}>
                      {isCredit ? "+" : "−"}{fmt(Number(t.amount), currency)}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Withdraw sheet: form → confirm → receipt */}
      <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetSheet(); }}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>
              {step === "form" ? "Withdraw from Vault" : step === "confirm" ? "Confirm Withdrawal" : "Withdrawal Receipt"}
            </SheetTitle>
          </SheetHeader>

          {step === "form" && (
            <div className="space-y-4 pt-4">
              <div>
                <Label htmlFor="amt">Amount ({currency})</Label>
                <Input
                  id="amt"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="0"
                  className="mt-1 text-lg"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Available: {fmt(bal, currency)} · Withdrawals are free
                </p>
                {limits && (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Remaining today: {fmt(limits.remaining_today, currency)} · this month: {fmt(limits.remaining_this_month, currency)}
                  </p>
                )}
              </div>

              <div>
                <Label>Destination</Label>
                {accountOptions.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">No linked accounts available.</p>
                ) : (
                  <RadioGroup value={destAccount} onValueChange={setDestAccount} className="mt-2 space-y-2">
                    {accountOptions.map((a) => (
                      <label
                        key={a.id}
                        htmlFor={`d-${a.id}`}
                        className="flex items-center gap-3 rounded-2xl border border-border p-3 cursor-pointer hover:bg-muted/30"
                      >
                        <RadioGroupItem id={`d-${a.id}`} value={a.id} />
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted">
                          {a.kind === "bank" ? <Building2 className="h-4 w-4" strokeWidth={1.5} /> : <Wallet className="h-4 w-4" strokeWidth={1.5} />}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{a.label}</p>
                          <p className="text-[11px] text-muted-foreground capitalize">{a.kind}</p>
                        </div>
                      </label>
                    ))}
                  </RadioGroup>
                )}
              </div>

              <Button
                onClick={goConfirm}
                className="w-full rounded-2xl bg-foreground text-background hover:bg-foreground/90"
              >
                Continue
              </Button>
            </div>
          )}

          {step === "confirm" && (
            <div className="space-y-4 pt-4">
              <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                <Row label="Amount" value={fmt(amt, currency)} />
                <Row label="Destination" value={dest?.label ?? "—"} />
                <Row label="Type" value={dest?.kind === "bank" ? "Bank account" : "Wallet"} />
                <Row label="Fee" value="Free" />
                <div className="border-t border-border pt-3">
                  <Row label="Vault after" value={fmt(Math.max(0, bal - amt), currency)} bold />
                </div>
              </div>
              <p className="flex items-start gap-2 text-[11px] text-muted-foreground">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                Please verify the details. Withdrawals are final once confirmed.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("form")} className="flex-1 rounded-2xl">
                  Back
                </Button>
                <Button
                  onClick={submitWithdraw}
                  disabled={withdraw.isPending}
                  className="flex-1 rounded-2xl bg-foreground text-background hover:bg-foreground/90"
                >
                  {withdraw.isPending ? "Processing…" : "Confirm"}
                </Button>
              </div>
            </div>
          )}

          {step === "receipt" && receipt && (
            <div className="space-y-4 pt-4">
              <div className="flex flex-col items-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[hsl(150,40%,90%)]">
                  <CheckCircle2 className="h-7 w-7 text-[hsl(150,60%,35%)]" strokeWidth={2} />
                </div>
                <p className="mt-2 text-base font-semibold">Withdrawal Successful</p>
                <p className="text-2xl font-bold mt-1">{fmt(Number(receipt.transaction.amount), currency)}</p>
                <p className="text-[12px] text-muted-foreground">Sent to {receipt.destination.label}</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                <Row label="Reference" value={
                  <button onClick={() => copyRef(receipt.reference_code)} className="inline-flex items-center gap-1.5 font-mono">
                    {receipt.reference_code} <Copy className="h-3.5 w-3.5" />
                  </button>
                } />
                <Row label="Destination" value={`${receipt.destination.label} (${receipt.destination.kind})`} />
                <Row label="Date" value={new Date(receipt.transaction.created_at).toLocaleString()} />
                <Row label="Vault balance" value={fmt(receipt.new_balance, currency)} bold />
              </div>
              <Button
                onClick={() => { setOpen(false); resetSheet(); }}
                className="w-full rounded-2xl bg-foreground text-background hover:bg-foreground/90"
              >
                Done
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Limits dialog */}
      <Dialog open={limitsOpen} onOpenChange={setLimitsOpen}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>Withdrawal limits</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label htmlFor="daily">Daily limit ({currency})</Label>
              <Input
                id="daily"
                inputMode="numeric"
                value={dailyInput}
                onChange={(e) => setDailyInput(e.target.value.replace(/[^0-9]/g, ""))}
                className="mt-1"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">Maximum you can withdraw per day.</p>
            </div>
            <div>
              <Label htmlFor="monthly">Monthly limit ({currency})</Label>
              <Input
                id="monthly"
                inputMode="numeric"
                value={monthlyInput}
                onChange={(e) => setMonthlyInput(e.target.value.replace(/[^0-9]/g, ""))}
                className="mt-1"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">Maximum across the current calendar month.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLimitsOpen(false)} className="rounded-2xl">Cancel</Button>
            <Button
              onClick={saveLimits}
              disabled={updateLimits.isPending}
              className="rounded-2xl bg-foreground text-background hover:bg-foreground/90"
            >
              {updateLimits.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

function Row({ label, value, bold }: { label: string; value: React.ReactNode; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={bold ? "font-semibold text-foreground" : "text-foreground"}>{value}</span>
    </div>
  );
}

export default CustomerSavingsVault;
