import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useFeeEstimate } from "@/hooks/useFeeEstimate";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Wallet, Loader2, Shield, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { PaymentMethodSelector } from "@/components/funding/PaymentMethodSelector";
import { AmountInput } from "@/components/funding/AmountInput";
import { FundingResult } from "@/components/funding/FundingResult";
import { FundingHistory } from "@/components/funding/FundingHistory";
import { BankSelector } from "@/components/funding/BankSelector";
import { API_CONFIG } from "@/config/api";
import { extractEdgeFunctionError } from '@/lib/edge-function-error';
import { PinConfirmDialog } from "@/components/pwa/PinConfirmDialog";

const fmt = (n: number) => new Intl.NumberFormat("fr-CM", { style: "currency", currency: "XAF", minimumFractionDigits: 0 }).format(n);

const MerchantFundWallet = () => {
  const [searchParams] = useSearchParams();
  const [amount, setAmount] = useState(searchParams.get("amount") || "");
  const [method, setMethod] = useState(searchParams.get("method") || "mobile_money");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [selectedBankCode, setSelectedBankCode] = useState("");
  const [selectedBankName, setSelectedBankName] = useState("");
  const [selectedBankSource, setSelectedBankSource] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [pinOpen, setPinOpen] = useState(false);

  // Sync from query params on mount
  useEffect(() => {
    const m = searchParams.get("method");
    const a = searchParams.get("amount");
    if (m) setMethod(m);
    if (a) setAmount(a);
  }, [searchParams]);

  const { data: merchant } = useQuery({
    queryKey: ["my-merchant"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("gateway_merchants").select("id, business_name").eq("user_id", user.id).maybeSingle();
      return data;
    },
  });

  const { data: wallets, refetch: refetchWallets } = useQuery({
    queryKey: ["merchant-wallets", merchant?.id],
    queryFn: async () => {
      if (!merchant?.id) return [];
      const { data } = await supabase.from("gateway_merchant_wallets").select("*").eq("merchant_id", merchant.id);
      return data || [];
    },
    enabled: !!merchant?.id,
  });

  const { fee: feeData, isLoading: feeLoading } = useFeeEstimate({ channel: method, amount: Number(amount), scope: "merchant", merchantId: merchant?.id });

  const validateAndOpenPin = () => {
    if (!merchant?.id) { toast.error("Merchant account not found. Please set up your merchant profile first."); return; }
    if (!amount || Number(amount) <= 0) { toast.error("Please enter a valid funding amount"); return; }
    if (method === "mobile_money" && !phone) { toast.error("Phone number is required for Mobile Money payments"); return; }
    if (method === "bank_transfer" && !selectedBankCode) { toast.error("Please select a bank to transfer from"); return; }
    if (method === "bank_transfer" && !bankAccountNumber) { toast.error("Please enter your bank account number"); return; }
    setPinOpen(true);
  };

  const handleFund = async () => {
    setPinOpen(false);
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("gateway-create-funding-intent", {
        body: {
          amount: Number(amount),
          currency: "XAF",
          method,
          funding_scope: "merchant",
          merchant_id: merchant!.id,
          target_description: "Merchant wallet top-up",
          customer: { phone, email },
          bank_code: method === "bank_transfer" ? selectedBankCode : undefined,
          bank_name: method === "bank_transfer" ? selectedBankName : undefined,
          bank_source: method === "bank_transfer" ? selectedBankSource : undefined,
          account_number: method === "bank_transfer" ? bankAccountNumber : undefined,
          return_url: `${API_CONFIG.SITE_URL}/merchant`,
        },
      });
      if (error) throw error;
      setResult(data);
      toast.success("Funding request submitted — follow the instructions to complete payment");
      refetchWallets();
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err, "Failed to create funding intent. Please try again."));
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
          <Wallet className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Fund Wallet</h1>
          <p className="text-muted-foreground text-sm">Top up your merchant wallet balance</p>
        </div>
      </div>

      {/* Wallet Balances */}
      {wallets && wallets.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {wallets.map((w: any) => (
            <Card key={w.id} className="overflow-hidden border-border/60">
              <div className="h-0.5 bg-gradient-to-r from-primary to-secondary" />
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground">{w.currency} Wallet</span>
                  <TrendingUp className="h-3.5 w-3.5 text-secondary" />
                </div>
                <p className="text-xl font-bold text-foreground">{fmt(w.available_balance)}</p>
                <div className="flex gap-3 mt-1.5 text-[11px] text-muted-foreground">
                  <span>Pending: {fmt(w.pending_balance)}</span>
                  <span>Ledger: {fmt(w.ledger_balance)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!result ? (
        <Card className="overflow-hidden border-border/60 shadow-sm">
          <div className="h-1 bg-gradient-to-r from-primary to-secondary" />
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">New Wallet Top-Up</CardTitle>
                <CardDescription>Choose an amount and payment method</CardDescription>
              </div>
              <span className="rounded-full bg-secondary/10 px-3 py-1 text-xs font-semibold text-secondary">{(feeData.feePercent * 100).toFixed(1)}% fee</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <AmountInput value={amount} onChange={setAmount} feeData={feeData} feeLoading={feeLoading} fmt={fmt} presets={[25000, 50000, 100000, 500000]} />

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Payment Method</Label>
              <PaymentMethodSelector value={method} onChange={(v) => { setMethod(v); setSelectedBankCode(""); setSelectedBankName(""); setSelectedBankSource(""); setBankAccountNumber(""); }} />
            </div>

            {method === "mobile_money" && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Phone Number</Label>
                <Input placeholder="237677123456" value={phone} onChange={e => setPhone(e.target.value)} className="h-11" />
              </div>
            )}

            {method === "bank_transfer" && (
              <BankSelector
                selectedBank={selectedBankCode}
                onBankChange={(code, name, source) => { setSelectedBankCode(code); setSelectedBankName(name); setSelectedBankSource(source); }}
                accountNumber={bankAccountNumber}
                onAccountNumberChange={setBankAccountNumber}
              />
            )}

            {(method === "card" || method === "paypal") && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Email</Label>
                <Input type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} className="h-11" />
              </div>
            )}

            <Button onClick={validateAndOpenPin} disabled={loading} className="w-full h-12 text-base font-semibold" size="lg">
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {loading ? "Processing..." : `Fund ${amount && Number(amount) > 0 ? fmt(Number(amount)) : "Wallet"}`}
            </Button>

            <PinConfirmDialog
              open={pinOpen}
              onOpenChange={setPinOpen}
              onConfirmed={() => handleFund()}
              title="Confirm Wallet Top-Up"
              description={`Enter your 6-digit PIN to fund ${amount ? fmt(Number(amount)) : "your wallet"}`}
            />



            <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <Shield className="h-3.5 w-3.5" /> Secured with end-to-end encryption
            </p>
          </CardContent>
        </Card>
      ) : (
        <FundingResult result={result} fmt={fmt} onSuccess={() => refetchWallets()} />
      )}

      <FundingHistory scope="merchant" merchantId={merchant?.id} fmt={fmt} />
    </div>
  );
};

export default MerchantFundWallet;
