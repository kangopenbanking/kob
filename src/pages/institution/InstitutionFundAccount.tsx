import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Wallet, ArrowRight, CheckCircle2, Loader2, Info, Building2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

const InstitutionFundAccount = () => {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("mobile_money");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Get institution accounts
  const { data: accounts } = useQuery({
    queryKey: ["institution-accounts-for-funding"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      // Get institution via ownership or staff
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
          return_url: `${window.location.origin}/fi-portal/fund-account`,
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

  const fmt = (n: number) => new Intl.NumberFormat("fr-CM", { style: "currency", currency: "XAF", minimumFractionDigits: 0 }).format(n);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><Building2 className="h-8 w-8 text-primary" /> Fund Institution Account</h1>
        <p className="text-muted-foreground mt-1">Add funds to institution accounts (float, clearing, or customer accounts) via Mobile Money, Card, PayPal, or Bank Transfer</p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Institution funding uses a reduced fee tier of <strong>1.5%</strong> (vs 2.5–3.5% for end-users). Funds are credited directly to the selected account balance.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>New Account Funding</CardTitle>
          <CardDescription>Select a target account and payment method</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Target Account</Label>
            <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
              <SelectTrigger><SelectValue placeholder="Select account to fund" /></SelectTrigger>
              <SelectContent>
                {accounts?.map((a: any) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.nickname || a.account_holder_name} — {a.account_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Amount (XAF)</Label>
              <Input type="number" placeholder="e.g. 500000" value={amount} onChange={e => setAmount(e.target.value)} min={1} />
              {amount && Number(amount) > 0 && (
                <p className="text-xs text-muted-foreground">Fee: {fmt(Math.round(Number(amount) * 0.015))} · Net: {fmt(Number(amount) - Math.round(Number(amount) * 0.015))}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mobile_money">Mobile Money</SelectItem>
                  <SelectItem value="card">Card (Stripe)</SelectItem>
                  <SelectItem value="paypal">PayPal</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Input placeholder="e.g. Float account top-up Q1 2026" value={description} onChange={e => setDescription(e.target.value)} />
          </div>

          {method === "mobile_money" && (
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input placeholder="237677123456" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
          )}

          {(method === "card" || method === "paypal") && (
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" placeholder="finance@institution.com" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
          )}

          <Button onClick={handleFund} disabled={loading} className="w-full md:w-auto">
            {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ArrowRight className="h-4 w-4 mr-1" />}
            Fund Account
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Funding Intent Created
              <Badge>{result.status?.replace(/_/g, " ")}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div><span className="text-muted-foreground">Amount:</span> {fmt(result.amount)}</div>
              <div><span className="text-muted-foreground">Fee:</span> {fmt(result.fee_amount)}</div>
              <div><span className="text-muted-foreground">Reference:</span> <span className="font-mono text-xs">{result.reference}</span></div>
              <div><span className="text-muted-foreground">Provider:</span> {result.provider}</div>
            </div>

            {result.next_action?.redirect_url && (
              <Button asChild variant="outline">
                <a href={result.next_action.redirect_url} target="_blank" rel="noopener noreferrer">
                  Complete Payment <ArrowRight className="h-4 w-4 ml-1" />
                </a>
              </Button>
            )}
            {result.next_action?.approval_url && (
              <Button asChild variant="outline">
                <a href={result.next_action.approval_url} target="_blank" rel="noopener noreferrer">
                  Approve on PayPal <ArrowRight className="h-4 w-4 ml-1" />
                </a>
              </Button>
            )}
            {result.next_action?.type === "stripe_confirm" && (
              <Alert><AlertDescription>Use Stripe.js with client_secret to confirm the card payment.</AlertDescription></Alert>
            )}
            {result.next_action?.type === "bank_transfer_instructions" && (
              <div className="bg-muted p-4 rounded-lg space-y-1 text-sm">
                <p><strong>Bank:</strong> {result.next_action.bank_name}</p>
                <p><strong>Account:</strong> {result.next_action.account_number}</p>
                <p><strong>Name:</strong> {result.next_action.account_name}</p>
                <p><strong>Reference:</strong> <span className="font-mono font-bold">{result.next_action.reference}</span></p>
                <p className="text-muted-foreground mt-2">{result.next_action.instructions}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default InstitutionFundAccount;
