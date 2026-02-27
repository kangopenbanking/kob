import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Wallet, Loader2, ArrowLeft, Shield } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { PaymentMethodSelector } from "@/components/funding/PaymentMethodSelector";
import { AmountInput } from "@/components/funding/AmountInput";
import { FundingResult } from "@/components/funding/FundingResult";

const fmt = (n: number) => new Intl.NumberFormat("fr-CM", { style: "currency", currency: "XAF", minimumFractionDigits: 0 }).format(n);

const CustomerFundAccount = () => {
  const navigate = useNavigate();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("mobile_money");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const { data: accounts } = useQuery({
    queryKey: ["my-accounts-for-funding"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase.from("accounts").select("id, account_holder_name, account_id, currency, nickname").eq("user_id", user.id).eq("is_active", true);
      return data || [];
    },
  });

  const handleFund = async () => {
    if (!selectedAccountId) { toast.error("Select an account to fund"); return; }
    if (!amount || Number(amount) <= 0) { toast.error("Enter a valid amount"); return; }
    if (method === "mobile_money" && !phone) { toast.error("Phone number required for Mobile Money"); return; }

    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("gateway-create-funding-intent", {
        body: {
          amount: Number(amount),
          currency: "XAF",
          method,
          funding_scope: "end_user",
          account_id: selectedAccountId,
          customer: { phone, email },
          return_url: `${window.location.origin}/fund-account`,
        },
      });
      if (error) throw error;
      setResult(data);
      toast.success("Funding intent created");
    } catch (err: any) {
      toast.error(err.message || "Failed to create funding intent");
    }
    setLoading(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="mt-1 shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Wallet className="h-5 w-5 text-primary" />
            </div>
            Fund Account
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Add funds to your account securely</p>
        </div>
      </div>

      {!result ? (
        <Card className="overflow-hidden border-border/60 shadow-sm">
          <div className="h-1 bg-gradient-to-r from-primary to-secondary" />
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Add Funds</CardTitle>
            <CardDescription>Choose your account, amount, and payment method</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Account Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Destination Account</Label>
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Select account to fund" />
                </SelectTrigger>
                <SelectContent>
                  {accounts?.map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.nickname || a.account_holder_name} — {a.account_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Amount */}
            <AmountInput value={amount} onChange={setAmount} feePercent={0.025} fmt={fmt} presets={[5000, 10000, 25000, 50000]} />

            {/* Payment Method */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Payment Method</Label>
              <PaymentMethodSelector value={method} onChange={setMethod} />
            </div>

            {/* Conditional Fields */}
            {method === "mobile_money" && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Phone Number</Label>
                <Input placeholder="237677123456" value={phone} onChange={e => setPhone(e.target.value)} className="h-11" />
              </div>
            )}
            {(method === "card" || method === "paypal") && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Email</Label>
                <Input type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} className="h-11" />
              </div>
            )}

            <Button onClick={handleFund} disabled={loading} className="w-full h-12 text-base font-semibold" size="lg">
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {loading ? "Processing..." : `Fund ${amount && Number(amount) > 0 ? fmt(Number(amount)) : "Account"}`}
            </Button>

            <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <Shield className="h-3.5 w-3.5" /> Secured with end-to-end encryption
            </p>
          </CardContent>
        </Card>
      ) : (
        <FundingResult result={result} fmt={fmt} />
      )}
    </div>
  );
};

export default CustomerFundAccount;
