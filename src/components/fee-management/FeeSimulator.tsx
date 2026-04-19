import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Calculator, Zap, DollarSign, TrendingUp, ArrowRight, Building2, Store, Info, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const CHANNELS = [
  { value: "mobile_money_charge", label: "Mobile Money" },
  { value: "card_payment", label: "Card Payment" },
  { value: "bank_transfer", label: "Bank Transfer (Generic)" },
  { value: "intra_bank_transfer", label: "Intra-Bank Transfer (same bank)" },
  { value: "inter_bank_transfer", label: "Inter-Bank Transfer (different banks)" },
  { value: "transfer", label: "Account Transfer" },
  { value: "bill_payment", label: "Bill Payment" },
  { value: "gateway_charge", label: "Gateway Charge" },
  { value: "gateway_payout", label: "Gateway Payout" },
  { value: "virtual_card_topup", label: "Virtual Card Top-up" },
  { value: "qr_payment", label: "QR Payment" },
  { value: "withdrawal", label: "Cash Out" },
  { value: "international_transfer", label: "International Transfer" },
  { value: "loan_disbursement", label: "Loan Disbursement" },
  { value: "loan_repayment", label: "Loan Repayment" },
  { value: "savings_deposit", label: "Savings Deposit" },
  { value: "paypal_payment", label: "PayPal Payment" },
  { value: "ussd_payment", label: "USSD Payment" },
  { value: "remittance_inbound", label: "Remittance Inbound" },
  { value: "remittance_outbound", label: "Remittance Outbound" },
  { value: "remittance_bank_credit", label: "Remittance Bank Credit" },
  { value: "remittance_wallet_credit", label: "Remittance Wallet Credit" },
  { value: "remittance_bill_payment", label: "Remittance Bill Payment" },
  { value: "remittance_fx_markup", label: "Remittance FX Markup" },
  { value: "overdraft_fee", label: "Overdraft Fee" },
  { value: "overdraft_interest", label: "Overdraft Interest" },
  { value: "overdraft_setup_fee", label: "Overdraft Setup Fee" },
  { value: "overdraft_renewal_fee", label: "Overdraft Renewal Fee" },
  // Travel & Tourism
  { value: "travel_booking", label: "Travel Booking (Generic)" },
  { value: "hotel_booking", label: "Hotel Booking" },
  { value: "flight_booking", label: "Flight Booking" },
  { value: "tour_booking", label: "Tour Booking" },
  { value: "travel_cancellation_fee", label: "Travel Cancellation Fee" },
  // CrediQ
  { value: "credit_score_inquiry", label: "Credit Score Inquiry (Bank)" },
  { value: "credit_report_inquiry", label: "Credit Report Inquiry (Bank)" },
  { value: "credit_premium_subscription", label: "CrediQ Premium Subscription (User)" },
  // Other
  { value: "fx_conversion", label: "FX Conversion" },
  { value: "escrow_payment", label: "Escrow Payment" },
  { value: "mobile_recharge", label: "Mobile Recharge" },
  { value: "atm_withdrawal", label: "ATM Withdrawal" },
  { value: "standing_order", label: "Standing Order" },
  { value: "dormancy_fee", label: "Dormancy Fee" },
  { value: "account_funding", label: "Account Funding" },
  { value: "credit_report_purchase", label: "Credit Report Purchase" },
  { value: "loan_processing_fee", label: "Loan Processing Fee" },
  { value: "invoice_create", label: "Invoice Create" },
];

const PRESETS = [1000, 5000, 10000, 50000, 100000, 500000, 1000000];

interface FeeSimulatorProps {
  institutions?: any[];
  merchants?: any[];
}

export function FeeSimulator({ institutions = [], merchants = [] }: FeeSimulatorProps) {
  const [amount, setAmount] = useState(10000);
  const [channel, setChannel] = useState("mobile_money_charge");
  const [currency, setCurrency] = useState("XAF");
  const [institutionId, setInstitutionId] = useState("");
  const [merchantId, setMerchantId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);

  const simulate = async () => {
    if (!amount || amount <= 0) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const params = new URLSearchParams({
        amount: String(amount),
        channel,
        currency,
      });
      if (institutionId) params.set("institution_id", institutionId);
      if (merchantId) params.set("merchant_id", merchantId);
      // DIRECT BACKEND ONLY — Standing Order: never route through custom domain or hardcoded project ID
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gateway-fee-estimate?${params.toString()}`;
      const resp = await fetch(url, {
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });

      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Simulation failed");

      setResult(json);
      setHistory((prev) => [
        { ...json, channel, timestamp: new Date().toISOString() },
        ...prev.slice(0, 9),
      ]);
    } catch (err: any) {
      setError(err.message || "Failed to simulate fee");
    }
    setLoading(false);
  };

  // Client-side quick estimate using DB function via RPC
  const simulateViaRPC = async () => {
    if (!amount || amount <= 0) return;
    if (!institutionId) {
      setError("Please select an institution for RPC-based simulation");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const { data, error: rpcError } = await supabase.rpc("calculate_transaction_fee", {
        _institution_id: institutionId,
        _transaction_type: channel,
        _transaction_amount: amount,
      });

      if (rpcError) throw rpcError;

      const parsed = typeof data === "string" ? JSON.parse(data) : data;
      setResult({
        amount,
        currency,
        channel,
        fee_amount: parsed.final_fee,
        net_amount: amount - parsed.final_fee,
        fee_breakdown: {
          effective_rate: `${((parsed.final_fee / amount) * 100).toFixed(2)}%`,
          fee_model: parsed.fee_model,
          fixed_component: parsed.fixed_component,
          percentage_component: parsed.percentage_component,
          percentage_rate: parsed.percentage_rate,
          calculated_fee: parsed.calculated_fee,
          waived_amount: parsed.waived_amount,
          waiver_type: parsed.waiver_type,
          currency,
        },
      });
      setHistory((prev) => [
        { amount, fee_amount: parsed.final_fee, channel, timestamp: new Date().toISOString(), source: "rpc" },
        ...prev.slice(0, 9),
      ]);
    } catch (err: any) {
      setError(err.message || "RPC simulation failed");
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-foreground">Fee Simulator</h3>
          <p className="text-xs text-muted-foreground">
            Test fee calculations in real-time using the platform's fee engine
          </p>
        </div>
        <Badge variant="outline" className="gap-1.5 text-xs">
          <Calculator className="h-3 w-3" /> Live Calculator
        </Badge>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Input Panel */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border shadow-sm">
            <CardContent className="p-5 space-y-4">
              {/* Amount */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Transaction Amount</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    min={1}
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="pl-9 h-11 text-lg font-bold"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {PRESETS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setAmount(p)}
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[11px] font-medium border transition-colors",
                        amount === p
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      )}
                    >
                      {p >= 1000000 ? `${p / 1000000}M` : p >= 1000 ? `${p / 1000}K` : p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Channel */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Transaction Type</Label>
                <Select value={channel} onValueChange={setChannel}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANNELS.map((ch) => (
                      <SelectItem key={ch.value} value={ch.value}>
                        {ch.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Currency */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="XAF">XAF (CFA Franc)</SelectItem>
                    <SelectItem value="XOF">XOF (CFA Franc BCEAO)</SelectItem>
                    <SelectItem value="USD">USD (US Dollar)</SelectItem>
                    <SelectItem value="EUR">EUR (Euro)</SelectItem>
                    <SelectItem value="GBP">GBP (British Pound)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Institution */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" /> Institution (optional)
                </Label>
                <Select value={institutionId || "platform_default"} onValueChange={(val) => setInstitutionId(val === "platform_default" ? "" : val)}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Platform default" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="platform_default">Platform Default</SelectItem>
                    {institutions.map((inst: any) => (
                      <SelectItem key={inst.id} value={inst.id}>
                        {inst.institution_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Simulate buttons */}
              <div className="flex gap-2 pt-2">
                <Button onClick={simulate} disabled={loading || !amount} className="flex-1 h-11 rounded-xl">
                  {loading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4 mr-2" />
                  )}
                  Gateway Estimate
                </Button>
                <Button
                  onClick={simulateViaRPC}
                  disabled={loading || !amount || !institutionId}
                  variant="outline"
                  className="flex-1 h-11 rounded-xl"
                >
                  <Calculator className="h-4 w-4 mr-2" />
                  RPC Simulate
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Result Panel */}
        <div className="lg:col-span-3 space-y-4">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3"
            >
              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-destructive">Simulation Error</p>
                <p className="text-xs text-destructive/80 mt-0.5">{error}</p>
              </div>
            </motion.div>
          )}

          {result && (
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="border-2 border-primary/20 shadow-md">
                  <CardContent className="p-6 space-y-5">
                    {/* Summary Row */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground font-medium">Transaction Amount</p>
                        <p className="text-2xl font-bold text-foreground">
                          {Number(result.amount).toLocaleString()} {result.currency}
                        </p>
                      </div>
                      <ArrowRight className="h-5 w-5 text-muted-foreground" />
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground font-medium">Net Amount</p>
                        <p className="text-2xl font-bold text-foreground">
                          {Number(result.net_amount).toLocaleString()} {result.currency}
                        </p>
                      </div>
                    </div>

                    {/* Fee highlight */}
                    <div className="rounded-xl bg-primary/5 border border-primary/10 p-4 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Fee Charged</p>
                      <p className="text-3xl font-black text-primary">
                        {Number(result.fee_amount).toLocaleString()} {result.currency}
                      </p>
                      <p className="text-sm font-semibold text-muted-foreground mt-1">
                        Effective Rate: {result.fee_breakdown?.effective_rate || "—"}
                      </p>
                    </div>

                    {/* Breakdown */}
                    {result.fee_breakdown && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Breakdown</p>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          {result.fee_breakdown.fee_model && (
                            <div className="rounded-lg border p-2.5">
                              <p className="text-[10px] text-muted-foreground">Fee Model</p>
                              <p className="font-bold capitalize">{result.fee_breakdown.fee_model}</p>
                            </div>
                          )}
                          {result.fee_breakdown.fixed_component != null && (
                            <div className="rounded-lg border p-2.5">
                              <p className="text-[10px] text-muted-foreground">Fixed Component</p>
                              <p className="font-bold">{Number(result.fee_breakdown.fixed_component).toLocaleString()} {currency}</p>
                            </div>
                          )}
                          {result.fee_breakdown.percentage_component != null && (
                            <div className="rounded-lg border p-2.5">
                              <p className="text-[10px] text-muted-foreground">Percentage Component</p>
                              <p className="font-bold">{Number(result.fee_breakdown.percentage_component).toLocaleString()} {currency}</p>
                            </div>
                          )}
                          {result.fee_breakdown.percentage_rate != null && (
                            <div className="rounded-lg border p-2.5">
                              <p className="text-[10px] text-muted-foreground">Rate</p>
                              <p className="font-bold">{result.fee_breakdown.percentage_rate}%</p>
                            </div>
                          )}
                          {result.fee_breakdown.waived_amount > 0 && (
                            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-2.5 col-span-2">
                              <p className="text-[10px] text-amber-700">Waiver Applied ({result.fee_breakdown.waiver_type?.replace(/_/g, " ")})</p>
                              <p className="font-bold text-amber-700">-{Number(result.fee_breakdown.waived_amount).toLocaleString()} {currency}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Commissions */}
                    {result.commissions && (result.commissions.agent > 0 || result.commissions.referral > 0) && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Commissions</p>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          {result.commissions.agent > 0 && (
                            <div className="rounded-lg border p-2.5">
                              <p className="text-[10px] text-muted-foreground">Agent Commission</p>
                              <p className="font-bold">{Number(result.commissions.agent).toLocaleString()} {currency}</p>
                            </div>
                          )}
                          {result.commissions.referral > 0 && (
                            <div className="rounded-lg border p-2.5">
                              <p className="text-[10px] text-muted-foreground">Referral Commission</p>
                              <p className="font-bold">{Number(result.commissions.referral).toLocaleString()} {currency}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Limits */}
                    {result.limits && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Limits</p>
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          {result.limits.daily_limit > 0 && (
                            <div className="rounded-lg border p-2.5">
                              <p className="text-[10px] text-muted-foreground">Daily</p>
                              <p className="font-bold">{Number(result.limits.daily_limit).toLocaleString()}</p>
                            </div>
                          )}
                          {result.limits.monthly_limit > 0 && (
                            <div className="rounded-lg border p-2.5">
                              <p className="text-[10px] text-muted-foreground">Monthly</p>
                              <p className="font-bold">{Number(result.limits.monthly_limit).toLocaleString()}</p>
                            </div>
                          )}
                          {result.limits.max_charge_cap > 0 && (
                            <div className="rounded-lg border p-2.5">
                              <p className="text-[10px] text-muted-foreground">Max Cap</p>
                              <p className="font-bold">{Number(result.limits.max_charge_cap).toLocaleString()}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </AnimatePresence>
          )}

          {!result && !error && (
            <div className="rounded-2xl border-2 border-dashed border-border bg-muted/30 p-16 text-center">
              <Calculator className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">Enter an amount and click simulate</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Results will show fee breakdown, commissions, and applicable limits
              </p>
            </div>
          )}

          {/* History */}
          {history.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recent Simulations</p>
              <div className="space-y-1.5">
                {history.map((h, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-muted-foreground">
                        {new Date(h.timestamp).toLocaleTimeString()}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {CHANNELS.find((c) => c.value === h.channel)?.label || h.channel}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-medium">
                        {Number(h.amount).toLocaleString()} {currency}
                      </span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <span className="font-bold text-primary">
                        {Number(h.fee_amount).toLocaleString()} {currency} fee
                      </span>
                      {h.source === "rpc" && (
                        <Badge variant="secondary" className="text-[9px]">RPC</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
