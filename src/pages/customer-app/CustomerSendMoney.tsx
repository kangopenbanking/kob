import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/components/ui/use-toast";
import { HowItWorksFlow, type FlowStep } from "@/components/customer-app/HowItWorksFlow";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Globe, ArrowRight, Banknote, Clock, CheckCircle2, ChevronLeft,
  Building2, Smartphone, Loader2, AlertTriangle, Search, History,
  TrendingUp, ShieldCheck, Zap, ArrowUpRight, Eye,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const STATUS_MAP: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  created: { label: "Submitted", color: "bg-muted text-muted-foreground", icon: Clock },
  pending: { label: "Processing", color: "bg-amber-100 text-amber-800", icon: Loader2 },
  received: { label: "In Transit", color: "bg-blue-100 text-blue-800", icon: TrendingUp },
  credited: { label: "Delivered", color: "bg-green-100 text-green-800", icon: CheckCircle2 },
  settled: { label: "Settled", color: "bg-green-100 text-green-800", icon: CheckCircle2 },
  failed: { label: "Failed", color: "bg-destructive/10 text-destructive", icon: AlertTriangle },
};

const HOW_IT_WORKS_STEPS: FlowStep[] = [
  { icon: Globe, title: "Choose Destination", description: "Select the country and currency corridor for your transfer", color: "hsl(217,85%,93%)", iconColor: "hsl(217,91%,35%)" },
  { icon: Banknote, title: "Enter Amount & Details", description: "Specify how much to send and provide receiver information", color: "hsl(142,70%,90%)", iconColor: "hsl(142,76%,36%)" },
  { icon: Eye, title: "Review Quote", description: "See the exact FX rate, fees, and amount the receiver gets", color: "hsl(38,90%,90%)", iconColor: "hsl(38,92%,40%)" },
  { icon: Send, title: "Confirm & Send", description: "Approve the transfer — funds are delivered within hours", color: "hsl(258,75%,92%)", iconColor: "hsl(258,80%,50%)" },
];

type Step = "corridors" | "form" | "quote" | "confirm" | "success";
type Tab = "send" | "history";

const cardVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.98 },
  visible: (i: number) => ({ opacity: 1, y: 0, scale: 1, transition: { delay: i * 0.06, duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const } }),
};

const stepTransition = { initial: { opacity: 0, x: 30 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -30 }, transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const } };

export default function CustomerSendMoney() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("send");
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

  const { data: corridors, isLoading: loadingCorridors } = useQuery({
    queryKey: ["outbound-corridors"],
    queryFn: async () => {
      const res = await supabase.functions.invoke("remittance-outbound", { body: { action: "get_corridors" } });
      return res.data?.corridors || [];
    },
  });

  const { data: myTransfers, isLoading: loadingTransfers, refetch: refetchTransfers } = useQuery({
    queryKey: ["my-outbound-transfers"],
    queryFn: async () => {
      const res = await supabase.functions.invoke("remittance-outbound", { body: { action: "list_outbound", limit: 30 } });
      return res.data?.transfers || [];
    },
  });

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

  const sendMutation = useMutation({
    mutationFn: async () => {
      const res = await supabase.functions.invoke("remittance-outbound", {
        body: {
          action: "send", corridor_id: selectedCorridor?.id, amount: parseFloat(amount),
          quote_id: quote?.quote_id, receiver_name: receiverName,
          receiver_phone: receiverPhone || undefined, receiver_email: receiverEmail || undefined,
          receiver_country: selectedCorridor?.to_country,
          receiver_bank_name: receiverBankName || undefined, receiver_bank_code: receiverBankCode || undefined,
          receiver_account_number: receiverAccountNumber || undefined,
          receiver_mobile_wallet: receiverMobileWallet || undefined,
          delivery_method: deliveryMethod, purpose_code: purpose, narration: narration || undefined,
        },
      });
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: (data) => { setResult(data); setStep("success"); refetchTransfers(); },
    onError: (err: any) => toast({ title: "Transfer Failed", description: err.message, variant: "destructive" }),
  });

  const trackMutation = useMutation({
    mutationFn: async (remittanceId: string) => {
      const res = await supabase.functions.invoke("remittance-outbound", { body: { action: "track", remittance_id: remittanceId } });
      return res.data;
    },
    onSuccess: (data) => setTrackingDialog(data),
  });

  const filteredCorridors = corridors?.filter((c: any) => !countryFilter || c.to_country?.toLowerCase().includes(countryFilter.toLowerCase())) || [];

  const resetForm = () => {
    setStep("corridors"); setSelectedCorridor(null); setAmount(""); setReceiverName("");
    setReceiverPhone(""); setReceiverEmail(""); setReceiverBankName(""); setReceiverBankCode("");
    setReceiverAccountNumber(""); setReceiverMobileWallet(""); setQuote(null); setResult(null); setNarration("");
  };

  const goBack = () => {
    if (step === "corridors") navigate(-1);
    else if (step === "form") setStep("corridors");
    else if (step === "quote") setStep("form");
    else if (step === "confirm") setStep("quote");
    else setStep("corridors");
  };

  const stepIndex = ["corridors", "form", "quote", "confirm", "success"].indexOf(step);
  const stepLabels = ["Destination", "Details", "Quote", "Confirm", "Done"];

  return (
    <div className="max-w-lg mx-auto pb-24 px-4">
      {/* ─── Hero Header ───────────────────────────── */}
      <div className="relative -mx-4 overflow-hidden rounded-b-3xl" style={{ background: "var(--gradient-hero)" }}>
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-4 right-8 h-32 w-32 rounded-full bg-white/20 blur-2xl" />
          <div className="absolute bottom-2 left-4 h-20 w-20 rounded-full bg-white/15 blur-xl" />
        </div>
        <div className="relative px-4 pt-4 pb-6">
          <div className="flex items-center gap-3 mb-4">
            <Button variant="ghost" size="icon" onClick={goBack} className="text-white/90 hover:text-white hover:bg-white/10 h-9 w-9">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-lg font-bold text-white">Send Money Abroad</h1>
              <p className="text-xs text-white/70">Fast & secure international transfers</p>
            </div>
            <motion.div
              className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Globe className="h-5 w-5 text-white" />
            </motion.div>
          </div>

          {/* Step Indicator */}
          {activeTab === "send" && step !== "success" && (
            <div className="flex items-center gap-1 mt-2">
              {stepLabels.slice(0, 4).map((label, i) => (
                <div key={label} className="flex-1 flex flex-col items-center gap-1">
                  <div className={`h-1 w-full rounded-full transition-all duration-500 ${i <= stepIndex ? "bg-white" : "bg-white/20"}`} />
                  <span className={`text-[9px] font-medium transition-colors ${i <= stepIndex ? "text-white" : "text-white/40"}`}>{label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── Tab Switcher ──────────────────────────── */}
      <div className="flex gap-2 mt-5 mb-4">
        {[
          { key: "send" as Tab, label: "Send Money", icon: Send },
          { key: "history" as Tab, label: "History", icon: History },
        ].map(({ key, label, icon: Icon }) => (
          <motion.button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm font-semibold transition-all ${
              activeTab === key
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-muted text-muted-foreground"
            }`}
            whileTap={{ scale: 0.97 }}
          >
            <Icon className="h-4 w-4" />
            {label}
          </motion.button>
        ))}
      </div>

      {/* ─── SEND TAB ──────────────────────────────── */}
      {activeTab === "send" && (
        <AnimatePresence mode="wait">
          {/* Step 1: Choose Corridor */}
          {step === "corridors" && (
            <motion.div key="corridors" {...stepTransition} className="space-y-4">
              {/* How it works */}
              <HowItWorksFlow steps={HOW_IT_WORKS_STEPS} title="How international transfers work" />

              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { icon: Zap, label: "Fast", sub: "< 24hrs", color: "hsl(38,92%,50%)" },
                  { icon: ShieldCheck, label: "Secure", sub: "Encrypted", color: "hsl(142,76%,36%)" },
                  { icon: TrendingUp, label: "Low Fees", sub: "From 1%", color: "hsl(217,91%,55%)" },
                ].map((stat, i) => (
                  <motion.div
                    key={stat.label}
                    custom={i}
                    variants={cardVariants}
                    initial="hidden"
                    animate="visible"
                    className="rounded-2xl border border-border/50 bg-card p-3 text-center"
                  >
                    <div className="mx-auto mb-1.5 flex h-8 w-8 items-center justify-center rounded-xl" style={{ backgroundColor: `${stat.color}15` }}>
                      <stat.icon className="h-4 w-4" style={{ color: stat.color }} />
                    </div>
                    <p className="text-xs font-bold text-foreground">{stat.label}</p>
                    <p className="text-[10px] text-muted-foreground">{stat.sub}</p>
                  </motion.div>
                ))}
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by country name..."
                  value={countryFilter}
                  onChange={(e) => setCountryFilter(e.target.value)}
                  className="pl-10 rounded-2xl h-11 bg-muted/50 border-border/50"
                />
              </div>

              <p className="text-xs font-bold text-foreground px-1">Available Corridors</p>

              {loadingCorridors ? (
                <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : filteredCorridors.length > 0 ? (
                <div className="space-y-2">
                  {filteredCorridors.map((c: any, i: number) => (
                    <motion.div
                      key={c.id}
                      custom={i}
                      variants={cardVariants}
                      initial="hidden"
                      animate="visible"
                    >
                      <Card
                        className="cursor-pointer border-border/50 hover:border-primary/40 hover:shadow-md transition-all duration-300 active:scale-[0.98]"
                        onClick={() => { setSelectedCorridor(c); setStep("form"); }}
                      >
                        <CardContent className="p-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
                              <Globe className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-foreground">{c.from_country} → {c.to_country}</p>
                              <p className="text-[11px] text-muted-foreground">{c.from_currency} → {c.to_currency} · {c.remittance_partners?.name || "Partner"}</p>
                            </div>
                          </div>
                          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/5">
                            <ArrowRight className="h-4 w-4 text-primary" />
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-muted">
                    <Globe className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                  <p className="font-semibold text-foreground">No corridors available</p>
                  <p className="text-xs text-muted-foreground mt-1">Contact support to enable new destinations</p>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* Step 2: Receiver Details */}
          {step === "form" && selectedCorridor && (
            <motion.div key="form" {...stepTransition} className="space-y-4">
              {/* Corridor Badge */}
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 rounded-2xl bg-primary/5 border border-primary/10 p-3"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Globe className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-foreground">{selectedCorridor.from_country} → {selectedCorridor.to_country}</p>
                  <p className="text-[11px] text-muted-foreground">{selectedCorridor.from_currency} → {selectedCorridor.to_currency}</p>
                </div>
                <button onClick={() => setStep("corridors")} className="text-xs text-primary font-semibold">Change</button>
              </motion.div>

              {/* Amount */}
              <Card className="border-border/50 shadow-sm">
                <CardContent className="p-4 space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-foreground">Amount ({selectedCorridor.from_currency})</Label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">{selectedCorridor.from_currency}</span>
                      <Input
                        type="number"
                        placeholder="0"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="pl-16 text-xl font-bold h-14 rounded-2xl border-border/50 bg-muted/30"
                      />
                    </div>
                    {/* Amount presets */}
                    <div className="flex gap-2">
                      {[50000, 100000, 250000, 500000].map((p) => (
                        <button
                          key={p}
                          onClick={() => setAmount(String(p))}
                          className={`flex-1 rounded-xl py-1.5 text-[10px] font-semibold border transition-all ${
                            Number(amount) === p
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border/50 text-muted-foreground hover:border-primary/30"
                          }`}
                        >
                          {(p / 1000).toFixed(0)}K
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-foreground">Delivery Method</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: "bank_transfer", label: "Bank Transfer", icon: Building2, color: "hsl(217,91%,55%)" },
                        { value: "mobile_wallet", label: "Mobile Wallet", icon: Smartphone, color: "hsl(142,76%,36%)" },
                      ].map((m) => (
                        <motion.button
                          key={m.value}
                          onClick={() => setDeliveryMethod(m.value)}
                          whileTap={{ scale: 0.97 }}
                          className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3 transition-all ${
                            deliveryMethod === m.value
                              ? "border-primary bg-primary/5 shadow-sm"
                              : "border-border/50 bg-card"
                          }`}
                        >
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: `${m.color}15` }}>
                            <m.icon className="h-4 w-4" style={{ color: m.color }} />
                          </div>
                          <span className="text-[11px] font-semibold text-foreground">{m.label}</span>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Receiver Info */}
              <Card className="border-border/50 shadow-sm">
                <CardContent className="p-4 space-y-3">
                  <p className="text-xs font-bold text-foreground">Receiver Information</p>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground">Full Name *</Label>
                    <Input placeholder="As it appears on ID" value={receiverName} onChange={(e) => setReceiverName(e.target.value)} className="rounded-xl h-11 border-border/50" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-muted-foreground">Phone</Label>
                      <Input placeholder="+234..." value={receiverPhone} onChange={(e) => setReceiverPhone(e.target.value)} className="rounded-xl h-11 border-border/50" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-muted-foreground">Email</Label>
                      <Input placeholder="email@..." value={receiverEmail} onChange={(e) => setReceiverEmail(e.target.value)} className="rounded-xl h-11 border-border/50" />
                    </div>
                  </div>

                  {deliveryMethod === "bank_transfer" && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-3 pt-1">
                      <div className="space-y-1.5">
                        <Label className="text-[11px] text-muted-foreground">Bank Name</Label>
                        <Input placeholder="Receiver's bank" value={receiverBankName} onChange={(e) => setReceiverBankName(e.target.value)} className="rounded-xl h-11 border-border/50" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-[11px] text-muted-foreground">SWIFT/BIC Code</Label>
                          <Input placeholder="SWIFT code" value={receiverBankCode} onChange={(e) => setReceiverBankCode(e.target.value)} className="rounded-xl h-11 border-border/50" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[11px] text-muted-foreground">Account / IBAN *</Label>
                          <Input placeholder="Account number" value={receiverAccountNumber} onChange={(e) => setReceiverAccountNumber(e.target.value)} className="rounded-xl h-11 border-border/50" />
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {deliveryMethod === "mobile_wallet" && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-1.5 pt-1">
                      <Label className="text-[11px] text-muted-foreground">Mobile Wallet Number *</Label>
                      <Input placeholder="+234..." value={receiverMobileWallet} onChange={(e) => setReceiverMobileWallet(e.target.value)} className="rounded-xl h-11 border-border/50" />
                    </motion.div>
                  )}
                </CardContent>
              </Card>

              {/* Purpose & Note */}
              <Card className="border-border/50 shadow-sm">
                <CardContent className="p-4 space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground">Purpose of Transfer</Label>
                    <Select value={purpose} onValueChange={setPurpose}>
                      <SelectTrigger className="rounded-xl h-11 border-border/50"><SelectValue /></SelectTrigger>
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
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground">Note (optional)</Label>
                    <Textarea placeholder="Any additional details..." value={narration} onChange={(e) => setNarration(e.target.value)} rows={2} className="rounded-xl border-border/50 resize-none" />
                  </div>
                </CardContent>
              </Card>

              <motion.div whileTap={{ scale: 0.98 }}>
                <Button
                  className="w-full h-12 rounded-2xl text-sm font-bold shadow-md"
                  disabled={!amount || !receiverName || quoteMutation.isPending}
                  onClick={() => quoteMutation.mutate()}
                >
                  {quoteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Banknote className="h-4 w-4 mr-2" />}
                  Get Quote
                </Button>
              </motion.div>
            </motion.div>
          )}

          {/* Step 3: Quote Review */}
          {step === "quote" && quote && (
            <motion.div key="quote" {...stepTransition} className="space-y-4">
              <Card className="border-primary/20 shadow-lg overflow-hidden">
                <div className="bg-primary/5 px-4 py-3 border-b border-primary/10">
                  <p className="text-sm font-bold text-foreground flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Transfer Quote
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Review the details before sending</p>
                </div>
                <CardContent className="p-4 space-y-4">
                  {/* Big amount display */}
                  <div className="text-center py-3">
                    <p className="text-[11px] text-muted-foreground mb-1">Receiver Gets</p>
                    <motion.p
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="text-3xl font-extrabold text-secondary"
                    >
                      {(quote.amount_out || 0).toLocaleString()} <span className="text-lg">{quote.currency_out}</span>
                    </motion.p>
                  </div>

                  {/* Breakdown */}
                  <div className="rounded-2xl bg-muted/40 border border-border/30 p-4 space-y-3">
                    {[
                      { label: "You Send", value: `${(quote.amount_in || 0).toLocaleString()} ${quote.currency_in}`, bold: true },
                      { label: "Transfer Fee", value: `-${(quote.fee_total || 0).toLocaleString()} ${quote.currency_in}`, color: "text-destructive" },
                      { label: "Exchange Rate", value: `1 ${quote.currency_in} = ${quote.fx_rate} ${quote.currency_out}` },
                    ].map((row) => (
                      <div key={row.label} className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">{row.label}</span>
                        <span className={`text-xs font-semibold ${row.color || "text-foreground"}`}>{row.value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Meta */}
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-1"><Globe className="h-3 w-3" /> {quote.corridor}</div>
                    {quote.delivery_estimate_seconds && (
                      <div className="flex items-center gap-1"><Clock className="h-3 w-3" /> ~{Math.round(quote.delivery_estimate_seconds / 3600)}h</div>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground">Quote expires at {new Date(quote.expires_at).toLocaleTimeString()}</p>

                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1 rounded-xl h-11" onClick={() => setStep("form")}>Edit Details</Button>
                    <motion.div className="flex-1" whileTap={{ scale: 0.97 }}>
                      <Button className="w-full rounded-xl h-11" onClick={() => setStep("confirm")}>
                        <Send className="h-4 w-4 mr-2" /> Continue
                      </Button>
                    </motion.div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Step 4: Confirmation */}
          {step === "confirm" && (
            <motion.div key="confirm" {...stepTransition} className="space-y-4">
              <Card className="border-amber-200/60 overflow-hidden shadow-md">
                <div className="bg-amber-50 px-4 py-3 border-b border-amber-200/40 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <p className="text-sm font-bold text-amber-800">Confirm Transfer</p>
                </div>
                <CardContent className="p-4 space-y-4">
                  <div className="rounded-2xl bg-muted/30 border border-border/30 p-4 space-y-2 text-sm">
                    {[
                      { label: "To", value: `${receiverName} (${selectedCorridor?.to_country})` },
                      { label: "Amount", value: `${(quote?.amount_out || 0).toLocaleString()} ${quote?.currency_out}` },
                      { label: "Fee", value: `${(quote?.fee_total || 0).toLocaleString()} ${quote?.currency_in}` },
                      { label: "Total Debit", value: `${(quote?.amount_in || 0).toLocaleString()} ${quote?.currency_in}` },
                    ].map((row) => (
                      <div key={row.label} className="flex justify-between">
                        <span className="text-muted-foreground text-xs">{row.label}</span>
                        <span className="font-semibold text-xs text-foreground">{row.value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-start gap-2 rounded-xl bg-primary/5 border border-primary/10 p-3">
                    <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <p className="text-[11px] text-muted-foreground">
                      By confirming, you agree this transfer is for lawful purposes and the recipient details are correct.
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1 rounded-xl h-11" onClick={() => setStep("quote")}>Back</Button>
                    <motion.div className="flex-1" whileTap={{ scale: 0.97 }}>
                      <Button className="w-full rounded-xl h-11 font-bold" disabled={sendMutation.isPending} onClick={() => sendMutation.mutate()}>
                        {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                        Send Now
                      </Button>
                    </motion.div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Step 5: Success */}
          {step === "success" && result && (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 25 }} className="space-y-4">
              <Card className="border-secondary/20 overflow-hidden shadow-lg">
                <div className="bg-secondary/5 px-4 py-8 text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 15, delay: 0.2 }}
                    className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary/10"
                  >
                    <CheckCircle2 className="h-8 w-8 text-secondary" />
                  </motion.div>
                  <h2 className="text-xl font-extrabold text-foreground">Transfer Submitted!</h2>
                  <p className="text-xs text-muted-foreground mt-1">You'll receive notifications on status updates</p>
                </div>
                <CardContent className="p-4 space-y-4">
                  <div className="rounded-2xl bg-muted/30 border border-border/30 p-4 space-y-2">
                    {[
                      { label: "Reference", value: result.partner_reference },
                      { label: "Status", value: result.compliance_status === "cleared" ? "✅ Processing" : "🔍 Under Review" },
                      { label: "Amount", value: `${(result.amount_out || 0).toLocaleString()} ${result.currency_out}` },
                    ].map((row) => (
                      <div key={row.label} className="flex justify-between text-sm">
                        <span className="text-muted-foreground text-xs">{row.label}</span>
                        <span className="font-semibold text-xs text-foreground">{row.value}</span>
                      </div>
                    ))}
                  </div>
                  <motion.div whileTap={{ scale: 0.98 }}>
                    <Button onClick={resetForm} className="w-full h-12 rounded-2xl font-bold">
                      <ArrowUpRight className="h-4 w-4 mr-2" /> Send Another Transfer
                    </Button>
                  </motion.div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* ─── HISTORY TAB ───────────────────────────── */}
      {activeTab === "history" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          {loadingTransfers ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : myTransfers && myTransfers.length > 0 ? (
            myTransfers.map((t: any, i: number) => {
              const st = STATUS_MAP[t.status] || { label: t.status, color: "bg-muted text-muted-foreground", icon: Clock };
              const StIcon = st.icon;
              return (
                <motion.div
                  key={t.id}
                  custom={i}
                  variants={cardVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <Card
                    className="cursor-pointer border-border/50 hover:border-primary/30 hover:shadow-md transition-all duration-300 active:scale-[0.98]"
                    onClick={() => trackMutation.mutate(t.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10">
                            <Send className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-foreground">{t.receiver_name}</p>
                            <p className="text-[11px] text-muted-foreground">{t.receiver_country} · {(t.delivery_method || "").replace(/_/g, " ")}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-foreground">{(t.amount_out || 0).toLocaleString()} {t.currency_out}</p>
                          <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${st.color}`}>
                            <StIcon className="h-2.5 w-2.5" />{st.label}
                          </span>
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        {new Date(t.created_at).toLocaleDateString()} · {(t.partner_reference || "").slice(0, 16)}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-muted">
                <Send className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <p className="font-semibold text-foreground">No transfers yet</p>
              <p className="text-xs text-muted-foreground mt-1">Start by sending your first international transfer</p>
            </motion.div>
          )}
        </motion.div>
      )}

      {/* ─── Tracking Dialog ───────────────────────── */}
      <Dialog open={!!trackingDialog} onOpenChange={() => setTrackingDialog(null)}>
        <DialogContent className="max-w-md max-h-[80vh] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Transfer Details</DialogTitle>
          </DialogHeader>
          {trackingDialog && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ["Reference", trackingDialog.remittance?.partner_reference],
                    ["Status", trackingDialog.remittance?.status],
                    ["Receiver", trackingDialog.remittance?.receiver_name],
                    ["Destination", trackingDialog.remittance?.receiver_country],
                    ["Amount", `${(trackingDialog.remittance?.amount_out || 0).toLocaleString()} ${trackingDialog.remittance?.currency_out}`],
                    ["Fee", `${(trackingDialog.remittance?.fee_total || 0).toLocaleString()} ${trackingDialog.remittance?.currency_in}`],
                  ].map(([l, v]) => (
                    <div key={l as string} className="rounded-xl bg-muted/40 p-2.5">
                      <p className="text-[10px] text-muted-foreground">{l}</p>
                      <p className="text-xs font-semibold text-foreground mt-0.5">{String(v || "—")}</p>
                    </div>
                  ))}
                </div>

                {trackingDialog.events?.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-foreground mb-3">Timeline</p>
                    <div className="space-y-0">
                      {trackingDialog.events.map((ev: any, idx: number) => (
                        <div key={ev.id} className="flex gap-3 items-start relative">
                          <div className="flex flex-col items-center">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 z-10">
                              <Clock className="h-3 w-3 text-primary" />
                            </div>
                            {idx < trackingDialog.events.length - 1 && (
                              <div className="w-0.5 flex-1 bg-primary/10" style={{ minHeight: 20 }} />
                            )}
                          </div>
                          <div className={`pt-0.5 ${idx < trackingDialog.events.length - 1 ? "pb-4" : ""}`}>
                            <p className="text-xs font-semibold text-foreground capitalize">{(ev.event_type || "").replace(/_/g, " ")}</p>
                            <p className="text-[10px] text-muted-foreground">{new Date(ev.created_at).toLocaleString()}</p>
                          </div>
                        </div>
                      ))}
                    </div>
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
