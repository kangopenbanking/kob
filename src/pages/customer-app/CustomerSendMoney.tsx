import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Globe, ArrowRight, Banknote, Clock, CheckCircle2, XCircle, ChevronLeft,
  Wallet, Building2, Smartphone, Eye, Loader2, AlertTriangle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  created: { label: "Submitted", color: "bg-muted text-muted-foreground" },
  pending: { label: "Processing", color: "bg-amber-100 text-amber-800" },
  received: { label: "In Transit", color: "bg-blue-100 text-blue-800" },
  credited: { label: "Delivered", color: "bg-green-100 text-green-800" },
  settled: { label: "Settled", color: "bg-green-100 text-green-800" },
  failed: { label: "Failed", color: "bg-red-100 text-red-800" },
};

type Step = "corridors" | "form" | "quote" | "confirm" | "success";

export default function CustomerSendMoney() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("corridors");
  const [selectedCorridor, setSelectedCorridor] = useState<any>(null);
  const [amount, setAmount] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState("bank_transfer");
  const [receiverName, setReceiverName] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [receiverEmail, setReceiverEmail] = useState("");
  const [receiverBankName, setReceiverBankName] = useState("");
  const [receiverBankCode, setReceiverBankCode] = useState("");
  const [receiverAccountNumber, setReceiverAccountNumber] = useState("");
  const [receiverMobileWallet, setReceiverMobileWallet] = useState("");
  const [purpose, setPurpose] = useState("personal");
  const [narration, setNarration] = useState("");
  const [quote, setQuote] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [trackingDialog, setTrackingDialog] = useState<any>(null);
  const [countryFilter, setCountryFilter] = useState("");

  // Corridors
  const { data: corridors, isLoading: loadingCorridors } = useQuery({
    queryKey: ["outbound-corridors"],
    queryFn: async () => {
      const res = await supabase.functions.invoke("remittance-outbound", {
        body: { action: "get_corridors" },
      });
      return res.data?.corridors || [];
    },
  });

  // My transfers
  const { data: myTransfers, isLoading: loadingTransfers, refetch: refetchTransfers } = useQuery({
    queryKey: ["my-outbound-transfers"],
    queryFn: async () => {
      const res = await supabase.functions.invoke("remittance-outbound", {
        body: { action: "list_outbound", limit: 30 },
      });
      return res.data?.transfers || [];
    },
  });

  // Get quote
  const quoteMutation = useMutation({
    mutationFn: async () => {
      const res = await supabase.functions.invoke("remittance-outbound", {
        body: { action: "get_quote", corridor_id: selectedCorridor?.id, amount: parseFloat(amount) },
      });
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: (data) => { setQuote(data); setStep("quote"); },
    onError: (err: any) => toast({ title: "Quote Error", description: err.message, variant: "destructive" }),
  });

  // Send transfer
  const sendMutation = useMutation({
    mutationFn: async () => {
      const res = await supabase.functions.invoke("remittance-outbound", {
        body: {
          action: "send",
          corridor_id: selectedCorridor?.id,
          amount: parseFloat(amount),
          quote_id: quote?.quote_id,
          receiver_name: receiverName,
          receiver_phone: receiverPhone || undefined,
          receiver_email: receiverEmail || undefined,
          receiver_country: selectedCorridor?.to_country,
          receiver_bank_name: receiverBankName || undefined,
          receiver_bank_code: receiverBankCode || undefined,
          receiver_account_number: receiverAccountNumber || undefined,
          receiver_mobile_wallet: receiverMobileWallet || undefined,
          delivery_method: deliveryMethod,
          purpose_code: purpose,
          narration: narration || undefined,
        },
      });
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: (data) => {
      setResult(data);
      setStep("success");
      refetchTransfers();
    },
    onError: (err: any) => toast({ title: "Transfer Failed", description: err.message, variant: "destructive" }),
  });

  // Track
  const trackMutation = useMutation({
    mutationFn: async (remittanceId: string) => {
      const res = await supabase.functions.invoke("remittance-outbound", {
        body: { action: "track", remittance_id: remittanceId },
      });
      return res.data;
    },
    onSuccess: (data) => setTrackingDialog(data),
  });

  const filteredCorridors = corridors?.filter((c: any) => {
    if (!countryFilter) return true;
    return c.to_country?.toLowerCase().includes(countryFilter.toLowerCase());
  }) || [];

  const resetForm = () => {
    setStep("corridors");
    setSelectedCorridor(null);
    setAmount("");
    setReceiverName("");
    setReceiverPhone("");
    setReceiverEmail("");
    setReceiverBankName("");
    setReceiverBankCode("");
    setReceiverAccountNumber("");
    setReceiverMobileWallet("");
    setQuote(null);
    setResult(null);
    setNarration("");
  };

  return (
    <div className="max-w-lg mx-auto pb-24 space-y-6 px-4">
      {/* Header */}
      <div className="flex items-center gap-3 pt-4">
        <Button variant="ghost" size="icon" onClick={() => step === "corridors" ? navigate(-1) : setStep(step === "form" ? "corridors" : step === "quote" ? "form" : step === "confirm" ? "quote" : "corridors")}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">Send Money Abroad</h1>
          <p className="text-sm text-muted-foreground">Fast international transfers from Cameroon</p>
        </div>
      </div>

      <Tabs defaultValue="send">
        <TabsList className="w-full">
          <TabsTrigger value="send" className="flex-1">Send</TabsTrigger>
          <TabsTrigger value="history" className="flex-1">History</TabsTrigger>
        </TabsList>

        <TabsContent value="send" className="mt-4">
          <AnimatePresence mode="wait">
            {/* ─── Step 1: Choose Corridor ──────────────── */}
            {step === "corridors" && (
              <motion.div key="corridors" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <Input placeholder="Search by country..." value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)} />
                {loadingCorridors ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : filteredCorridors.length > 0 ? (
                  <div className="space-y-2">
                    {filteredCorridors.map((c: any) => (
                      <Card key={c.id} className="cursor-pointer hover:border-primary transition-colors" onClick={() => { setSelectedCorridor(c); setStep("form"); }}>
                        <CardContent className="p-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Globe className="h-8 w-8 text-primary" />
                            <div>
                              <p className="font-semibold">{c.from_country} → {c.to_country}</p>
                              <p className="text-xs text-muted-foreground">{c.from_currency} → {c.to_currency} · via {c.remittance_partners?.name || "Partner"}</p>
                            </div>
                          </div>
                          <ArrowRight className="h-5 w-5 text-muted-foreground" />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Globe className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p>No corridors available</p>
                    <p className="text-xs">Contact support to enable new destinations</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* ─── Step 2: Receiver Details ─────────────── */}
            {step === "form" && selectedCorridor && (
              <motion.div key="form" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Globe className="h-4 w-4" /> {selectedCorridor.from_country} → {selectedCorridor.to_country}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Amount ({selectedCorridor.from_currency})</Label>
                      <Input type="number" placeholder="e.g. 50000" value={amount} onChange={(e) => setAmount(e.target.value)} />
                    </div>

                    <div>
                      <Label>Delivery Method</Label>
                      <Select value={deliveryMethod} onValueChange={setDeliveryMethod}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bank_transfer"><div className="flex items-center gap-2"><Building2 className="h-4 w-4" /> Bank Transfer</div></SelectItem>
                          <SelectItem value="mobile_wallet"><div className="flex items-center gap-2"><Smartphone className="h-4 w-4" /> Mobile Wallet</div></SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Receiver Full Name *</Label>
                      <Input placeholder="Full name as on ID" value={receiverName} onChange={(e) => setReceiverName(e.target.value)} />
                    </div>

                    <div>
                      <Label>Receiver Phone</Label>
                      <Input placeholder="+234..." value={receiverPhone} onChange={(e) => setReceiverPhone(e.target.value)} />
                    </div>

                    <div>
                      <Label>Receiver Email</Label>
                      <Input placeholder="receiver@email.com" value={receiverEmail} onChange={(e) => setReceiverEmail(e.target.value)} />
                    </div>

                    {deliveryMethod === "bank_transfer" && (
                      <>
                        <div>
                          <Label>Bank Name</Label>
                          <Input placeholder="Receiver's bank" value={receiverBankName} onChange={(e) => setReceiverBankName(e.target.value)} />
                        </div>
                        <div>
                          <Label>Bank/SWIFT Code</Label>
                          <Input placeholder="SWIFT/BIC code" value={receiverBankCode} onChange={(e) => setReceiverBankCode(e.target.value)} />
                        </div>
                        <div>
                          <Label>Account Number *</Label>
                          <Input placeholder="Account or IBAN" value={receiverAccountNumber} onChange={(e) => setReceiverAccountNumber(e.target.value)} />
                        </div>
                      </>
                    )}

                    {deliveryMethod === "mobile_wallet" && (
                      <div>
                        <Label>Mobile Wallet Number *</Label>
                        <Input placeholder="+234..." value={receiverMobileWallet} onChange={(e) => setReceiverMobileWallet(e.target.value)} />
                      </div>
                    )}

                    <div>
                      <Label>Purpose</Label>
                      <Select value={purpose} onValueChange={setPurpose}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="personal">Personal / Family Support</SelectItem>
                          <SelectItem value="education">Education / School Fees</SelectItem>
                          <SelectItem value="medical">Medical Expenses</SelectItem>
                          <SelectItem value="business">Business Payment</SelectItem>
                          <SelectItem value="investment">Investment</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Note (optional)</Label>
                      <Textarea placeholder="Any additional details..." value={narration} onChange={(e) => setNarration(e.target.value)} rows={2} />
                    </div>

                    <Button className="w-full" disabled={!amount || !receiverName || quoteMutation.isPending}
                      onClick={() => quoteMutation.mutate()}>
                      {quoteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Banknote className="h-4 w-4 mr-2" />}
                      Get Quote
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* ─── Step 3: Quote Review ────────────────── */}
            {step === "quote" && quote && (
              <motion.div key="quote" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <Card className="border-primary/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Transfer Quote</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">You Send</span>
                        <span className="font-bold text-lg">{(quote.amount_in || 0).toLocaleString()} {quote.currency_in}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Fee</span>
                        <span className="text-destructive">-{(quote.fee_total || 0).toLocaleString()} {quote.currency_in}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">FX Rate</span>
                        <span>1 {quote.currency_in} = {quote.fx_rate} {quote.currency_out}</span>
                      </div>
                      <hr />
                      <div className="flex justify-between">
                        <span className="font-medium">Receiver Gets</span>
                        <span className="font-bold text-lg text-green-600">{(quote.amount_out || 0).toLocaleString()} {quote.currency_out}</span>
                      </div>
                    </div>

                    <div className="text-sm space-y-1 text-muted-foreground">
                      <p>📍 {quote.corridor}</p>
                      <p>🏦 Partner: {quote.partner}</p>
                      {quote.delivery_estimate_seconds && (
                        <p>⏱️ Est. delivery: {Math.round(quote.delivery_estimate_seconds / 3600)}h</p>
                      )}
                      <p className="text-xs">Quote expires: {new Date(quote.expires_at).toLocaleTimeString()}</p>
                    </div>

                    <div className="flex gap-3">
                      <Button variant="outline" className="flex-1" onClick={() => setStep("form")}>Edit</Button>
                      <Button className="flex-1" onClick={() => setStep("confirm")}>
                        <Send className="h-4 w-4 mr-2" /> Confirm & Send
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* ─── Step 4: Final Confirmation ──────────── */}
            {step === "confirm" && (
              <motion.div key="confirm" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <Card className="border-amber-200 bg-amber-50/50">
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-center gap-2 text-amber-700">
                      <AlertTriangle className="h-5 w-5" />
                      <p className="font-medium">Confirm International Transfer</p>
                    </div>
                    <div className="text-sm space-y-1">
                      <p><strong>To:</strong> {receiverName} ({selectedCorridor?.to_country})</p>
                      <p><strong>Amount:</strong> {(quote?.amount_out || 0).toLocaleString()} {quote?.currency_out}</p>
                      <p><strong>Fee:</strong> {(quote?.fee_total || 0).toLocaleString()} {quote?.currency_in}</p>
                      <p><strong>Total Debit:</strong> {(quote?.amount_in || 0).toLocaleString()} {quote?.currency_in}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">By confirming, you agree that this transfer is for lawful purposes and the recipient details are correct.</p>
                    <div className="flex gap-3">
                      <Button variant="outline" className="flex-1" onClick={() => setStep("quote")}>Back</Button>
                      <Button className="flex-1" disabled={sendMutation.isPending} onClick={() => sendMutation.mutate()}>
                        {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                        Send Now
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* ─── Step 5: Success ──────────────────────── */}
            {step === "success" && result && (
              <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
                <Card className="border-green-200 bg-green-50/50">
                  <CardContent className="p-6 text-center space-y-4">
                    <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
                    <h2 className="text-xl font-bold">Transfer Submitted!</h2>
                    <p className="text-sm text-muted-foreground">Your transfer is being processed. You'll receive notifications on status updates.</p>
                    <div className="bg-white rounded-lg p-3 text-sm text-left space-y-1">
                      <p><strong>Reference:</strong> {result.partner_reference}</p>
                      <p><strong>Status:</strong> {result.compliance_status === "cleared" ? "Processing" : "Under Review"}</p>
                      <p><strong>Amount:</strong> {(result.amount_out || 0).toLocaleString()} {result.currency_out}</p>
                    </div>
                    <Button onClick={resetForm} className="w-full">Send Another Transfer</Button>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </TabsContent>

        {/* ─── History Tab ──────────────────────────────── */}
        <TabsContent value="history" className="mt-4 space-y-3">
          {loadingTransfers ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : myTransfers && myTransfers.length > 0 ? (
            myTransfers.map((t: any) => {
              const st = STATUS_MAP[t.status] || { label: t.status, color: "bg-muted" };
              return (
                <motion.div key={t.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => trackMutation.mutate(t.id)}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Send className="h-5 w-5 text-primary" />
                          <div>
                            <p className="font-medium">{t.receiver_name}</p>
                            <p className="text-xs text-muted-foreground">{t.receiver_country} · {(t.delivery_method || "").replace(/_/g, " ")}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{(t.amount_out || 0).toLocaleString()} {t.currency_out}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">{new Date(t.created_at).toLocaleDateString()} · Ref: {(t.partner_reference || "").slice(0, 16)}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Send className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>No transfers yet</p>
              <p className="text-xs">Start by sending your first international transfer</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ─── Tracking Dialog ────────────────────────────── */}
      <Dialog open={!!trackingDialog} onOpenChange={() => setTrackingDialog(null)}>
        <DialogContent className="max-w-md max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Transfer Details</DialogTitle>
          </DialogHeader>
          {trackingDialog && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {[
                    ["Reference", trackingDialog.remittance?.partner_reference],
                    ["Status", trackingDialog.remittance?.status],
                    ["Receiver", trackingDialog.remittance?.receiver_name],
                    ["Destination", trackingDialog.remittance?.receiver_country],
                    ["Amount", `${(trackingDialog.remittance?.amount_out || 0).toLocaleString()} ${trackingDialog.remittance?.currency_out}`],
                    ["Fee", `${(trackingDialog.remittance?.fee_total || 0).toLocaleString()} ${trackingDialog.remittance?.currency_in}`],
                  ].map(([l, v]) => (
                    <div key={l as string}>
                      <p className="text-xs text-muted-foreground">{l}</p>
                      <p className="font-medium">{String(v || "—")}</p>
                    </div>
                  ))}
                </div>

                {trackingDialog.events?.length > 0 && (
                  <div>
                    <p className="font-medium text-sm mb-2">Timeline</p>
                    {trackingDialog.events.map((ev: any) => (
                      <div key={ev.id} className="flex gap-2 items-start border-l-2 border-primary/20 pl-3 py-1.5">
                        <Clock className="h-3 w-3 mt-1 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-sm capitalize">{(ev.event_type || "").replace(/_/g, " ")}</p>
                          <p className="text-xs text-muted-foreground">{new Date(ev.created_at).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
