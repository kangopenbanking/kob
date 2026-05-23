import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowDownLeft, ArrowUpRight, PiggyBank, Wallet, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";
import { useCustomerAccounts } from "@/hooks/useCustomerData";
import { useVaultBalance, useVaultTransactions, useWithdrawVault } from "@/hooks/savings/useSavingsVault";

const fmt = (n: number, c = "XAF") => new Intl.NumberFormat("fr-CM").format(Math.round(n)) + " " + c;

const CustomerSavingsVault: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useCustomerAuth();
  const { data: balance, isLoading: balLoading } = useVaultBalance();
  const { data: txData } = useVaultTransactions(50);
  const { data: accounts = [] } = useCustomerAccounts(user?.id);
  const withdraw = useWithdrawVault();

  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [destAccount, setDestAccount] = useState<string>("");

  const txs = txData?.transactions ?? [];
  const currency = balance?.currency ?? "XAF";
  const bal = balance?.balance ?? 0;

  const accountOptions = accounts.map((a: any) => ({
    id: a.id,
    label: a.nickname || a.account_holder_name || "Account",
    kind: (a.account_type === "bank" || a.account_subtype === "bank" ? "bank" : "wallet") as "wallet" | "bank",
  }));

  const submit = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) return toast({ title: "Enter a valid amount", variant: "destructive" });
    if (amt > bal) return toast({ title: "Insufficient vault balance", variant: "destructive" });
    if (!destAccount) return toast({ title: "Choose a destination account", variant: "destructive" });
    const dest = accountOptions.find((a) => a.id === destAccount);
    try {
      await withdraw.mutateAsync({
        amount: amt,
        destination_kind: dest?.kind ?? "wallet",
        destination_account_id: destAccount,
      });
      toast({ title: "Withdrawal successful", description: `${fmt(amt, currency)} sent to ${dest?.label}` });
      setOpen(false);
      setAmount("");
      setDestAccount("");
    } catch (e: any) {
      toast({ title: "Withdrawal failed", description: e?.message ?? "Try again", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-background/90 px-4 py-3 backdrop-blur border-b border-border">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-muted">
          <ArrowLeft className="h-5 w-5" strokeWidth={1.5} />
        </button>
        <h1 className="text-base font-semibold">Saving Vault</h1>
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
            onClick={() => setOpen(true)}
            disabled={bal <= 0}
            className="mt-4 w-full rounded-2xl bg-foreground text-background hover:bg-foreground/90"
          >
            Withdraw
          </Button>
        </motion.div>

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
                  <li
                    key={t.id}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
                  >
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${isCredit ? "bg-[hsl(150,40%,90%)]" : "bg-[hsl(25,80%,92%)]"}`}>
                      <Icon className={`h-5 w-5 ${isCredit ? "text-[hsl(150,40%,35%)]" : "text-[hsl(25,60%,40%)]"}`} strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{t.description || (isCredit ? "Round-up credit" : "Withdrawal")}</p>
                      <p className="text-[11px] text-muted-foreground">{new Date(t.created_at).toLocaleString()}</p>
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

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>Withdraw from Vault</SheetTitle>
          </SheetHeader>
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
              <p className="mt-1 text-[11px] text-muted-foreground">Available: {fmt(bal, currency)} · Withdrawals are free</p>
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
                        {a.kind === "bank" ? (
                          <Building2 className="h-4 w-4" strokeWidth={1.5} />
                        ) : (
                          <Wallet className="h-4 w-4" strokeWidth={1.5} />
                        )}
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
              onClick={submit}
              disabled={withdraw.isPending}
              className="w-full rounded-2xl bg-foreground text-background hover:bg-foreground/90"
            >
              {withdraw.isPending ? "Processing…" : "Confirm Withdrawal"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default CustomerSavingsVault;
