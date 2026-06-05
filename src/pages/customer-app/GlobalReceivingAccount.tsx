import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Globe2, Copy, Plus, Wallet, Smartphone, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type GlobalAccount = {
  id: string;
  currency: "USD" | "EUR" | "GBP";
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

type UserDefaults = { payout_preference: "KANG_WALLET" | "MOBILE_MONEY"; payout_channel: string | null };

export default function GlobalReceivingAccount() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [accounts, setAccounts] = useState<GlobalAccount[]>([]);
  const [payments, setPayments] = useState<IncomingPayment[]>([]);
  const [defaults, setDefaults] = useState<UserDefaults>({ payout_preference: "KANG_WALLET", payout_channel: null });
  const [newCurrency, setNewCurrency] = useState<"USD" | "EUR" | "GBP">("USD");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("nium-list-global-accounts");
    if (error) toast({ title: "Failed to load", description: error.message, variant: "destructive" });
    else {
      setAccounts(data.accounts ?? []);
      setPayments(data.incoming_payments ?? []);
      setDefaults(data.user_defaults ?? { payout_preference: "KANG_WALLET", payout_channel: null });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const createAccount = async () => {
    setCreating(true);
    const { data, error } = await supabase.functions.invoke("nium-create-global-account", {
      body: { currency: newCurrency },
    });
    setCreating(false);
    if (error) return toast({ title: "Couldn't generate account", description: error.message, variant: "destructive" });
    toast({ title: data?.reused ? "Account already exists" : "Global account generated", description: `${newCurrency} ready to receive` });
    load();
  };

  const saveUserDefaults = async (pref: "KANG_WALLET" | "MOBILE_MONEY", phone: string | null) => {
    const { error } = await supabase.functions.invoke("nium-update-payout-preference", {
      body: { scope: "user", payout_preference: pref, payout_channel: phone },
    });
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    setDefaults({ payout_preference: pref, payout_channel: phone });
    toast({ title: "Cash-out preference saved" });
  };

  const copy = (txt: string | null, label: string) => {
    if (!txt) return;
    navigator.clipboard.writeText(txt);
    toast({ title: `${label} copied` });
  };

  return (
    <div className="container max-w-3xl py-6 space-y-6">
      <header className="flex items-center gap-3">
        <Globe2 className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Global Receiving Accounts</h1>
          <p className="text-sm text-muted-foreground">
            Get a real USD, EUR or GBP bank account to receive payouts from YouTube, TikTok and global payers — settled in XAF.
          </p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Default cash-out preference</CardTitle>
          <CardDescription>How incoming funds are paid out by default. Each account can override this.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={defaults.payout_preference === "KANG_WALLET" ? "default" : "outline"}
              onClick={() => saveUserDefaults("KANG_WALLET", null)}
              className="justify-start gap-2"
            >
              <Wallet className="h-4 w-4" /> Kang Wallet (XAF)
            </Button>
            <Button
              variant={defaults.payout_preference === "MOBILE_MONEY" ? "default" : "outline"}
              onClick={() => {
                const phone = defaults.payout_channel ?? prompt("Mobile Money phone number (e.g. 237677123456)") ?? "";
                if (phone) saveUserDefaults("MOBILE_MONEY", phone);
              }}
              className="justify-start gap-2"
            >
              <Smartphone className="h-4 w-4" /> Mobile Money
            </Button>
          </div>
          {defaults.payout_preference === "MOBILE_MONEY" && (
            <div className="grid gap-2">
              <Label htmlFor="def-phone">Mobile Money phone</Label>
              <Input
                id="def-phone"
                placeholder="237677123456"
                defaultValue={defaults.payout_channel ?? ""}
                onBlur={(e) => e.target.value && saveUserDefaults("MOBILE_MONEY", e.target.value)}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Generate a new global account</CardTitle>
          <CardDescription>Pick a currency. We'll provision real bank details via Nium.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-end gap-2">
          <div className="flex-1">
            <Label>Currency</Label>
            <Select value={newCurrency} onValueChange={(v) => setNewCurrency(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD — United States</SelectItem>
                <SelectItem value="EUR">EUR — Eurozone (IBAN)</SelectItem>
                <SelectItem value="GBP">GBP — United Kingdom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={createAccount} disabled={creating}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            <span className="ml-2">Generate</span>
          </Button>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : accounts.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No global accounts yet. Generate your first one above.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {accounts.map((a) => (
            <Card key={a.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{a.currency} — {a.bank_name}</CardTitle>
                  <Badge variant={a.mode === "live" ? "default" : "outline"}>{a.mode}</Badge>
                </div>
                <CardDescription>Beneficiary: {a.beneficiary_name}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {a.iban && <DetailRow label="IBAN" value={a.iban} onCopy={() => copy(a.iban, "IBAN")} />}
                {a.account_number && <DetailRow label="Account number" value={a.account_number} onCopy={() => copy(a.account_number, "Account")} />}
                {a.routing_code && <DetailRow label="Routing / Sort code" value={a.routing_code} onCopy={() => copy(a.routing_code, "Routing code")} />}
                {a.bic && <DetailRow label="BIC / SWIFT" value={a.bic} onCopy={() => copy(a.bic, "BIC")} />}
                {a.bank_address && <p className="text-xs text-muted-foreground pt-1">{a.bank_address}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {payments.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Recent incoming payments</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between border-b last:border-0 py-2">
                <div>
                  <div className="font-medium">{p.source_amount} {p.source_currency} → {p.xaf_net_credited.toLocaleString()} XAF</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(p.created_at).toLocaleString()} · {p.routing === "KANG_WALLET" ? "Wallet" : "Mobile Money"}
                  </div>
                </div>
                <Badge variant={p.status === "credited" || p.status === "payout_completed" ? "default" : "outline"}>{p.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DetailRow({ label, value, onCopy }: { label: string; value: string; onCopy: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-mono">{value}</div>
      </div>
      <Button size="icon" variant="ghost" onClick={onCopy} aria-label={`Copy ${label}`}>
        <Copy className="h-4 w-4" />
      </Button>
    </div>
  );
}
