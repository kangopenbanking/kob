import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Building2, Loader2, Shield } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { PaymentMethodSelector } from "@/components/funding/PaymentMethodSelector";
import { AmountInput } from "@/components/funding/AmountInput";
import { FundingResult } from "@/components/funding/FundingResult";
import { FundingHistory } from "@/components/funding/FundingHistory";
import { API_CONFIG } from "@/config/api";

const fmt = (n: number) => new Intl.NumberFormat("fr-CM", { style: "currency", currency: "XAF", minimumFractionDigits: 0 }).format(n);

const InstitutionFundAccount = () => {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("mobile_money");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const { data: accounts } = useQuery({
    queryKey: ["institution-accounts-for-funding"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data: inst } = await supabase.from("institutions").select("id").eq("user_id", user.id).maybeSingle();
      let institutionId = inst?.id;
      if (!institutionId) {
        const { data: staff } = await supabase.from("staff_assignments").select("institution_id").eq("user_id", user.id).eq("is_active", true).maybeSingle();
        institutionId = staff?.institution_id;
      }
      if (!institutionId) return [];
      const { data } = await supabase.from("accounts").select("id, account_holder_name, account_id, currency, nickname").eq("institution_id", institutionId).eq("is_active", true);
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
          funding_scope: "institution",
          account_id: selectedAccountId,
          target_description: description || "Institution account funding",
          customer: { phone, email },
          return_url: `${API_CONFIG.SITE_URL}/fi-portal/fund-account`,
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
          <Building2 className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Fund Institution Account</h1>
          <p className="text-muted-foreground text-sm">Add funds to float, clearing, or customer accounts</p>
        </div>
      </div>

      {!result ? (
        <Card className="overflow-hidden border-border/60 shadow-sm">
          <div className="h-1 bg-gradient-to-r from-primary to-secondary" />
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">New Account Funding</CardTitle>
                <CardDescription>Select a target account and payment method</CardDescription>
              </div>
              <span className="rounded-full bg-secondary/10 px-3 py-1 text-xs font-semibold text-secondary">1.5% fee</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Account Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Target Account</Label>
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

            <AmountInput value={amount} onChange={setAmount} feePercent={0.015} fmt={fmt} presets={[100000, 250000, 500000, 1000000]} />

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Payment Method</Label>
              <PaymentMethodSelector value={method} onChange={setMethod} />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Description (optional)</Label>
              <Input placeholder="e.g. Float account top-up Q1 2026" value={description} onChange={e => setDescription(e.target.value)} className="h-11" />
            </div>

            {method === "mobile_money" && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Phone Number</Label>
                <Input placeholder="237677123456" value={phone} onChange={e => setPhone(e.target.value)} className="h-11" />
              </div>
            )}
            {(method === "card" || method === "paypal") && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Email</Label>
                <Input type="email" placeholder="finance@institution.com" value={email} onChange={e => setEmail(e.target.value)} className="h-11" />
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

      <FundingHistory scope="institution" accountId={selectedAccountId} fmt={fmt} />
    </div>
  );
};

export default InstitutionFundAccount;
