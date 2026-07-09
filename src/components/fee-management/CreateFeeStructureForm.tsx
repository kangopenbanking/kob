import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import {
  DollarSign, Percent, Layers, Plus, Trash2, Globe, Building2, CheckCircle2,
  ArrowRight, ArrowLeft, Sparkles, Calculator, Search, Shield,
  ArrowLeftRight, CreditCard, Receipt, Smartphone, PhoneCall, Landmark,
  QrCode, PiggyBank, Users, Home, ArrowUpFromLine, ArrowDownToLine,
  Wallet, Globe2, Hash, Banknote, Zap, Send, Lock, Plug, Radio, FileText,
  RefreshCw, ChevronDown, ChevronUp, Bot, Heart, HeartHandshake, Upload
} from "lucide-react";

import { cn } from "@/lib/utils";
import { LiveFeePreview } from "./LiveFeePreview";

const TRANSACTION_TYPES = [
  { value: "transfer", label: "Account Transfer", icon: ArrowLeftRight, category: "Core" },
  { value: "payment", label: "Payment", icon: CreditCard, category: "Core" },
  { value: "bill_payment", label: "Bill Payment", icon: Receipt, category: "Core" },
  { value: "mobile_money_transfer", label: "Mobile Money Transfer", icon: Smartphone, category: "Mobile" },
  { value: "mobile_money_charge", label: "Mobile Money Charge", icon: PhoneCall, category: "Mobile" },
  { value: "byo_mobile_money_routing", label: "BYO Routing Fee (Direct Rail)", icon: PhoneCall, category: "Mobile" },
  { value: "byo_fallback_charge", label: "BYO Fallback Charge (Flutterwave Rescue)", icon: PhoneCall, category: "Mobile" },
  { value: "bank_transfer", label: "Bank Transfer (Generic)", icon: Landmark, category: "Banking" },
  { value: "intra_bank_transfer", label: "Intra-Bank Transfer (same bank)", icon: ArrowLeftRight, category: "Banking" },
  { value: "inter_bank_transfer", label: "Inter-Bank Transfer (different banks)", icon: Send, category: "Banking" },
  { value: "card_payment", label: "Card Payment", icon: CreditCard, category: "Cards" },
  { value: "virtual_card_topup", label: "Virtual Card Top-up", icon: RefreshCw, category: "Cards" },
  { value: "card_issuance_fee", label: "Card Issuance Fee (one-off)", icon: CreditCard, category: "Cards" },
  { value: "card_maintenance_fee", label: "Card Maintenance Fee (monthly)", icon: CreditCard, category: "Cards" },
  { value: "card_transaction_fee", label: "Card Transaction Fee (per spend)", icon: CreditCard, category: "Cards" },
  { value: "qr_payment", label: "QR Payment", icon: QrCode, category: "Core" },
  { value: "piggybank_deposit", label: "Piggy Bank Deposit", icon: PiggyBank, category: "Savings" },
  { value: "piggybank_withdrawal", label: "Piggy Bank Withdrawal", icon: PiggyBank, category: "Savings" },
  { value: "njangi_contribution", label: "Njangi Contribution", icon: Users, category: "Social" },
  { value: "njangi_payout", label: "Njangi Payout", icon: Users, category: "Social" },
  { value: "rent_payment", label: "Rent Payment", icon: Home, category: "Core" },
  { value: "loan_disbursement", label: "Loan Disbursement", icon: ArrowUpFromLine, category: "Lending" },
  { value: "loan_repayment", label: "Loan Repayment", icon: ArrowDownToLine, category: "Lending" },
  { value: "savings_deposit", label: "Savings Deposit", icon: Wallet, category: "Savings" },
  { value: "savings_withdrawal", label: "Savings Withdrawal", icon: Wallet, category: "Savings" },
  { value: "international_transfer", label: "International Transfer", icon: Globe2, category: "International" },
  { value: "ussd_payment", label: "USSD Payment", icon: Hash, category: "Mobile" },
  { value: "withdrawal", label: "Cash Out", icon: Banknote, category: "Core" },
  { value: "account_funding", label: "Account Funding", icon: Plus, category: "Core" },
  { value: "gateway_charge", label: "Gateway Charge", icon: Zap, category: "Gateway" },
  { value: "gateway_payout", label: "Gateway Payout", icon: Send, category: "Gateway" },
  { value: "paypal_payment", label: "PayPal Payment", icon: Globe2, category: "International" },
  { value: "fx_conversion", label: "FX Conversion", icon: ArrowLeftRight, category: "International" },
  { value: "escrow_payment", label: "Escrow Payment", icon: Lock, category: "Core" },
  { value: "api_request", label: "API Request", icon: Plug, category: "Gateway" },
  { value: "mobile_recharge", label: "Mobile Recharge", icon: Radio, category: "Mobile" },
  { value: "invoice_create", label: "Invoice Create", icon: FileText, category: "Core" },
  { value: "credit_report_purchase", label: "Credit Report Purchase", icon: FileText, category: "Services" },
  { value: "overdraft_fee", label: "Overdraft Fee", icon: ArrowDownToLine, category: "Lending" },
  { value: "loan_processing_fee", label: "Loan Processing Fee", icon: ArrowUpFromLine, category: "Lending" },
  { value: "atm_withdrawal", label: "ATM Withdrawal", icon: Banknote, category: "Banking" },
  { value: "standing_order", label: "Standing Order", icon: RefreshCw, category: "Banking" },
  { value: "dormancy_fee", label: "Dormancy Fee", icon: Lock, category: "Banking" },
  // Remittance
  { value: "remittance_inbound", label: "Remittance Inbound", icon: ArrowDownToLine, category: "Remittance" },
  { value: "remittance_outbound", label: "Remittance Outbound", icon: Send, category: "Remittance" },
  { value: "remittance_bank_credit", label: "Remittance Bank Credit", icon: Landmark, category: "Remittance" },
  { value: "remittance_wallet_credit", label: "Remittance Wallet Credit", icon: Wallet, category: "Remittance" },
  { value: "remittance_bill_payment", label: "Remittance Bill Payment", icon: Receipt, category: "Remittance" },
  { value: "remittance_fx_markup", label: "Remittance FX Markup", icon: ArrowLeftRight, category: "Remittance" },
  // Overdraft (additional)
  { value: "overdraft_interest", label: "Overdraft Interest", icon: ArrowDownToLine, category: "Lending" },
  { value: "overdraft_setup_fee", label: "Overdraft Setup Fee", icon: ArrowDownToLine, category: "Lending" },
  { value: "overdraft_renewal_fee", label: "Overdraft Renewal Fee", icon: RefreshCw, category: "Lending" },
  // Travel & Tourism
  { value: "travel_booking", label: "Travel Booking (Generic)", icon: Globe2, category: "Travel" },
  { value: "hotel_booking", label: "Hotel Booking", icon: Home, category: "Travel" },
  { value: "flight_booking", label: "Flight Booking", icon: Send, category: "Travel" },
  { value: "tour_booking", label: "Tour Booking", icon: Globe, category: "Travel" },
  { value: "travel_cancellation_fee", label: "Travel Cancellation Fee", icon: Lock, category: "Travel" },
  // Credit Score (CrediQ)
  { value: "credit_score_inquiry", label: "Credit Score Inquiry (Bank)", icon: Hash, category: "CrediQ" },
  { value: "credit_report_inquiry", label: "Credit Report Inquiry (Bank)", icon: FileText, category: "CrediQ" },
  { value: "credit_premium_subscription", label: "CrediQ Premium Subscription (User)", icon: Sparkles, category: "CrediQ" },
  // Statements (PDF downloads)
  { value: "statement_download_consumer", label: "Statement Download — Consumers App", icon: FileText, category: "Statements" },
  { value: "statement_download_banking", label: "Statement Download — Banking App", icon: FileText, category: "Statements" },
];

const FEE_MODELS = [
  { value: "fixed", label: "Fixed Amount", desc: "A flat fee charged per transaction regardless of amount", icon: <DollarSign className="h-5 w-5" />, color: "from-emerald-500/20 to-emerald-600/10 border-emerald-200 dark:border-emerald-800" },
  { value: "percentage", label: "Percentage", desc: "A percentage of the transaction value with optional min/max caps", icon: <Percent className="h-5 w-5" />, color: "from-blue-500/20 to-blue-600/10 border-blue-200 dark:border-blue-800" },
  { value: "hybrid", label: "Hybrid", desc: "Combined fixed fee plus a percentage of the transaction value", icon: <Layers className="h-5 w-5" />, color: "from-purple-500/20 to-purple-600/10 border-purple-200 dark:border-purple-800" },
  { value: "tiered", label: "Tiered", desc: "Different rates applied based on transaction volume brackets", icon: <Layers className="h-5 w-5" />, color: "from-amber-500/20 to-amber-600/10 border-amber-200 dark:border-amber-800" },
];

const STEP_LABELS = ["Scope & Type", "Fee Model", "Configure & Review"];

interface TierRate { min: number; max: number | null; fixed: number; percentage: number; }

interface CreateFeeStructureFormProps {
  institutions: any[];
  onSubmit: (formData: any) => void;
  onCancel: () => void;
  initialData?: any;
}

export function CreateFeeStructureForm({ institutions, onSubmit, onCancel, initialData }: CreateFeeStructureFormProps) {
  const [formData, setFormData] = useState({
    institution_id: initialData?.institution_id || '',
    fee_scope: initialData?.fee_scope || (initialData?.institution_id ? 'institution' : 'institution'),
    transaction_type: initialData?.transaction_type || '',
    fee_model: initialData?.fee_model || '',
    fixed_amount: initialData?.fixed_amount || 0,
    percentage_rate: initialData?.percentage_rate || 0,
    min_fee_amount: initialData?.min_fee_amount || 0,
    max_fee_amount: initialData?.max_fee_amount || null as number | null,
    effective_from: initialData?.effective_from?.split('T')[0] || new Date().toISOString().split('T')[0],
    effective_until: initialData?.effective_until?.split('T')[0] || '',
    // Limits & Commissions
    daily_limit: initialData?.daily_limit ?? -1,
    monthly_limit: initialData?.monthly_limit ?? -1,
    max_charge_cap: initialData?.max_charge_cap ?? -1,
    agent_commission_percent: initialData?.agent_commission_percent ?? 0,
    agent_commission_fixed: initialData?.agent_commission_fixed ?? 0,
    referral_percent_commission: initialData?.referral_percent_commission ?? 0,
    referral_fixed_commission: initialData?.referral_fixed_commission ?? 0,
    merchant_percent_charge: initialData?.merchant_percent_charge ?? 0,
    merchant_fixed_charge: initialData?.merchant_fixed_charge ?? 0,
  });

  const [tiers, setTiers] = useState<TierRate[]>(
    initialData?.tiered_rates || [{ min: 0, max: 10000, fixed: 100, percentage: 0 }]
  );

  const [step, setStep] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [showLimits, setShowLimits] = useState(
    initialData ? (
      (initialData.daily_limit != null && initialData.daily_limit !== -1) ||
      (initialData.monthly_limit != null && initialData.monthly_limit !== -1) ||
      (initialData.agent_commission_percent > 0) ||
      (initialData.merchant_percent_charge > 0)
    ) : false
  );

  const categories = useMemo(() => {
    const cats = [...new Set(TRANSACTION_TYPES.map(t => t.category))];
    return cats;
  }, []);

  const filteredTypes = useMemo(() => {
    if (!searchQuery) return TRANSACTION_TYPES;
    const q = searchQuery.toLowerCase();
    return TRANSACTION_TYPES.filter(t => t.label.toLowerCase().includes(q) || t.category.toLowerCase().includes(q));
  }, [searchQuery]);

  const groupedTypes = useMemo(() => {
    const groups: Record<string, typeof TRANSACTION_TYPES> = {};
    filteredTypes.forEach(t => {
      if (!groups[t.category]) groups[t.category] = [];
      groups[t.category].push(t);
    });
    return groups;
  }, [filteredTypes]);

  const addTier = () => {
    const lastTier = tiers[tiers.length - 1];
    setTiers([...tiers, { min: (lastTier?.max || 0) + 1, max: null, fixed: 0, percentage: 0 }]);
  };

  const removeTier = (idx: number) => setTiers(tiers.filter((_, i) => i !== idx));

  const updateTier = (idx: number, field: keyof TierRate, value: number | null) => {
    const updated = [...tiers];
    updated[idx] = { ...updated[idx], [field]: value };
    setTiers(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step !== 3) return;
    const isPlatform = formData.fee_scope === 'platform';
    onSubmit({
      ...formData,
      institution_id: isPlatform ? null : formData.institution_id,
      fee_scope: formData.fee_scope,
      tiered_rates: formData.fee_model === 'tiered' ? tiers : null,
      effective_until: formData.effective_until || null,
    });
  };

  const canProceed = () => {
    if (step === 1) return (formData.fee_scope === 'platform' || formData.institution_id) && formData.transaction_type;
    if (step === 2) return formData.fee_model;
    return true;
  };

  const estimateFee = (amount: number) => {
    if (formData.fee_model === 'fixed') return formData.fixed_amount;
    if (formData.fee_model === 'percentage') {
      let fee = amount * formData.percentage_rate / 100;
      if (formData.min_fee_amount && fee < formData.min_fee_amount) fee = formData.min_fee_amount;
      if (formData.max_fee_amount && fee > formData.max_fee_amount) fee = formData.max_fee_amount;
      return fee;
    }
    if (formData.fee_model === 'hybrid') {
      let fee = formData.fixed_amount + (amount * formData.percentage_rate / 100);
      if (formData.min_fee_amount && fee < formData.min_fee_amount) fee = formData.min_fee_amount;
      if (formData.max_fee_amount && fee > formData.max_fee_amount) fee = formData.max_fee_amount;
      return fee;
    }
    if (formData.fee_model === 'tiered') {
      for (const tier of tiers) {
        if (amount >= tier.min && (tier.max === null || amount < tier.max)) {
          return tier.fixed + (amount * tier.percentage / 100);
        }
      }
    }
    return 0;
  };

  const selectedType = TRANSACTION_TYPES.find(t => t.value === formData.transaction_type);
  const selectedModel = FEE_MODELS.find(m => m.value === formData.fee_model);

  return (
    <form onSubmit={handleSubmit} onKeyDown={(e) => { if (e.key === 'Enter' && step < 3) e.preventDefault(); }} className="space-y-6">
      {/* Progress stepper */}
      <div className="flex items-center justify-between px-1">
        {STEP_LABELS.map((label, idx) => {
          const s = idx + 1;
          const isActive = s === step;
          const isDone = s < step;
          return (
            <div key={s} className="flex items-center gap-2 flex-1">
              <button
                type="button"
                onClick={() => s < step && setStep(s)}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-all shrink-0",
                  isActive && "bg-primary text-primary-foreground shadow-lg ring-4 ring-primary/20",
                  isDone && "bg-primary/20 text-primary",
                  !isActive && !isDone && "bg-muted text-muted-foreground"
                )}
              >
                {isDone ? <CheckCircle2 className="h-4 w-4" /> : s}
              </button>
              <span className={cn("text-xs font-medium hidden sm:inline", isActive ? "text-foreground" : "text-muted-foreground")}>{label}</span>
              {s < 3 && <div className={cn("h-px flex-1 mx-2", isDone ? "bg-primary" : "bg-border")} />}
            </div>
          );
        })}
      </div>

      {/* Selected context badges */}
      {(selectedType || formData.fee_scope) && step > 1 && (
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="gap-1.5 py-1 px-3 text-xs font-medium">
            {formData.fee_scope === 'platform' ? <Globe className="h-3 w-3" /> : <Building2 className="h-3 w-3" />}
            {formData.fee_scope === 'platform' ? 'Platform Default' : institutions.find(i => i.id === formData.institution_id)?.institution_name}
          </Badge>
          {selectedType && (
            <Badge variant="outline" className="gap-1.5 py-1 px-3 text-xs font-medium">
              <selectedType.icon className="h-3 w-3" /> {selectedType.label}
            </Badge>
          )}
          {selectedModel && step > 2 && (
            <Badge variant="outline" className="gap-1.5 py-1 px-3 text-xs font-medium">
              {selectedModel.label}
            </Badge>
          )}
        </div>
      )}

      <AnimatePresence mode="wait">
        {/* STEP 1: Scope & Transaction Type */}
        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="space-y-5">
            {/* Fee Scope Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-foreground">Fee Scope</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, fee_scope: 'platform', institution_id: '' })}
                  className={cn(
                    "relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-all hover:shadow-md",
                    formData.fee_scope === 'platform'
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:border-primary/30"
                  )}
                >
                  <div className={cn("rounded-lg p-2.5", formData.fee_scope === 'platform' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                    <Globe className="h-5 w-5" />
                  </div>
                  <span className="font-semibold text-sm text-foreground">Platform Default</span>
                  <span className="text-[11px] text-muted-foreground leading-tight">Applies to all institutions unless overridden</span>
                  {formData.fee_scope === 'platform' && (
                    <div className="absolute -top-1.5 -right-1.5">
                      <CheckCircle2 className="h-5 w-5 text-primary fill-primary/10" />
                    </div>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, fee_scope: 'institution' })}
                  className={cn(
                    "relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-all hover:shadow-md",
                    formData.fee_scope === 'institution'
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:border-primary/30"
                  )}
                >
                  <div className={cn("rounded-lg p-2.5", formData.fee_scope === 'institution' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                    <Building2 className="h-5 w-5" />
                  </div>
                  <span className="font-semibold text-sm text-foreground">Institution-Specific</span>
                  <span className="text-[11px] text-muted-foreground leading-tight">Custom fees for a specific institution</span>
                  {formData.fee_scope === 'institution' && (
                    <div className="absolute -top-1.5 -right-1.5">
                      <CheckCircle2 className="h-5 w-5 text-primary fill-primary/10" />
                    </div>
                  )}
                </button>
              </div>
            </div>

            {/* Institution Selector */}
            {formData.fee_scope === 'institution' && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-2">
                <Label className="text-sm font-semibold text-foreground">Institution</Label>
                <Select value={formData.institution_id} onValueChange={(v) => setFormData({ ...formData, institution_id: v })}>
                  <SelectTrigger className="h-11 rounded-lg"><SelectValue placeholder="Select an institution" /></SelectTrigger>
                  <SelectContent>
                    {institutions.map((inst: any) => (
                      <SelectItem key={inst.id} value={inst.id}>{inst.institution_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </motion.div>
            )}

            {/* Transaction Type */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold text-foreground">Transaction Type</Label>
                {selectedType && <Badge className="bg-primary/10 text-primary border-0 text-xs gap-1"><selectedType.icon className="h-3 w-3" /> {selectedType.label}</Badge>}
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search transaction types..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-10 rounded-lg"
                />
              </div>
              <div className="max-h-[280px] overflow-y-auto rounded-xl border bg-card p-2 space-y-3">
                {Object.entries(groupedTypes).map(([category, types]) => (
                  <div key={category}>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2 mb-1.5">{category}</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {types.map((tt) => (
                        <button
                          key={tt.value}
                          type="button"
                          onClick={() => setFormData({ ...formData, transaction_type: tt.value })}
                          className={cn(
                            "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-all",
                            formData.transaction_type === tt.value
                              ? "border-primary bg-primary/5 ring-1 ring-primary font-semibold"
                              : "border-transparent hover:bg-muted/50"
                          )}
                        >
                          <tt.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="truncate">{tt.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* STEP 2: Fee Model */}
        {step === 2 && (
          <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="space-y-4">
            <Label className="text-sm font-semibold text-foreground">Select Fee Model</Label>
            <div className="grid grid-cols-2 gap-3">
              {FEE_MODELS.map((fm) => (
                <button
                  key={fm.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, fee_model: fm.value })}
                  className={cn(
                    "relative flex flex-col items-center gap-3 rounded-xl border-2 p-5 text-center transition-all hover:shadow-md",
                    formData.fee_model === fm.value
                      ? "border-primary shadow-sm bg-gradient-to-br " + fm.color
                      : "border-border hover:border-primary/30"
                  )}
                >
                  <div className={cn(
                    "rounded-xl p-3 transition-colors",
                    formData.fee_model === fm.value ? "bg-primary text-primary-foreground shadow-md" : "bg-muted text-muted-foreground"
                  )}>
                    {fm.icon}
                  </div>
                  <span className="font-bold text-sm text-foreground">{fm.label}</span>
                  <span className="text-[11px] text-muted-foreground leading-tight">{fm.desc}</span>
                  {formData.fee_model === fm.value && (
                    <div className="absolute -top-1.5 -right-1.5">
                      <CheckCircle2 className="h-5 w-5 text-primary fill-primary/10" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* STEP 3: Configure Rates */}
        {step === 3 && (
          <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="space-y-5">
            {/* Rate Configuration */}
            <div className="rounded-xl border bg-card p-4 space-y-4">
              <div className="flex items-center gap-2">
                <Calculator className="h-4 w-4 text-primary" />
                <h4 className="text-sm font-bold text-foreground">Rate Configuration</h4>
              </div>

              {(formData.fee_model === 'fixed' || formData.fee_model === 'hybrid') && (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Fixed Amount (XAF)</Label>
                  <Input type="number" min={0} value={formData.fixed_amount} onChange={(e) => setFormData({ ...formData, fixed_amount: Number(e.target.value) })} className="h-11 text-lg font-semibold rounded-lg" />
                </div>
              )}

              {(formData.fee_model === 'percentage' || formData.fee_model === 'hybrid') && (
                <>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Percentage Rate (%)</Label>
                    <Input type="number" step="0.01" min={0} max={100} value={formData.percentage_rate} onChange={(e) => setFormData({ ...formData, percentage_rate: Number(e.target.value) })} className="h-11 text-lg font-semibold rounded-lg" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Min Fee (XAF)</Label>
                      <Input type="number" min={0} value={formData.min_fee_amount} onChange={(e) => setFormData({ ...formData, min_fee_amount: Number(e.target.value) })} className="h-10 rounded-lg" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Max Fee (XAF)</Label>
                      <Input type="number" min={0} value={formData.max_fee_amount || ''} onChange={(e) => setFormData({ ...formData, max_fee_amount: e.target.value ? Number(e.target.value) : null })} placeholder="No cap" className="h-10 rounded-lg" />
                    </div>
                  </div>
                </>
              )}

              {formData.fee_model === 'tiered' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Volume Tiers</Label>
                    <Button type="button" size="sm" variant="outline" onClick={addTier} className="rounded-lg h-8 text-xs">
                      <Plus className="h-3 w-3 mr-1" /> Add Tier
                    </Button>
                  </div>
                  {tiers.map((tier, idx) => (
                    <div key={idx} className="grid grid-cols-5 gap-2 items-end rounded-lg border bg-muted/30 p-3">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Min</Label>
                        <Input type="number" value={tier.min} onChange={(e) => updateTier(idx, 'min', Number(e.target.value))} className="h-9 text-sm rounded-lg" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Max</Label>
                        <Input type="number" value={tier.max || ''} onChange={(e) => updateTier(idx, 'max', e.target.value ? Number(e.target.value) : null)} placeholder="∞" className="h-9 text-sm rounded-lg" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Fixed</Label>
                        <Input type="number" value={tier.fixed} onChange={(e) => updateTier(idx, 'fixed', Number(e.target.value))} className="h-9 text-sm rounded-lg" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Rate %</Label>
                        <Input type="number" step="0.01" value={tier.percentage} onChange={(e) => updateTier(idx, 'percentage', Number(e.target.value))} className="h-9 text-sm rounded-lg" />
                      </div>
                      <Button type="button" size="icon" variant="ghost" className="h-9 w-9 rounded-lg" onClick={() => removeTier(idx)} disabled={tiers.length <= 1}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Effective Dates */}
            <div className="rounded-xl border bg-card p-4 space-y-3">
              <h4 className="text-sm font-bold text-foreground">Effective Period</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">From</Label>
                  <Input type="date" value={formData.effective_from} onChange={(e) => setFormData({ ...formData, effective_from: e.target.value })} className="h-10 rounded-lg" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Until (optional)</Label>
                  <Input type="date" value={formData.effective_until} onChange={(e) => setFormData({ ...formData, effective_until: e.target.value })} className="h-10 rounded-lg" />
                </div>
              </div>
            </div>

            {/* Limits & Commissions (Collapsible) */}
            <div className="rounded-xl border bg-card overflow-hidden">
              <button
                type="button"
                onClick={() => setShowLimits(!showLimits)}
                className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  <h4 className="text-sm font-bold text-foreground">Limits & Commissions</h4>
                  <Badge variant="secondary" className="text-[10px]">Optional</Badge>
                </div>
                {showLimits ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>

              <AnimatePresence>
                {showLimits && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 space-y-4 border-t pt-4">
                      {/* Transaction Limits */}
                      <div className="space-y-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Transaction Limits</p>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Daily Limit</Label>
                            <Input type="number" value={formData.daily_limit} onChange={(e) => setFormData({ ...formData, daily_limit: Number(e.target.value) })} placeholder="-1 = unlimited" className="h-9 text-sm rounded-lg" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Monthly Limit</Label>
                            <Input type="number" value={formData.monthly_limit} onChange={(e) => setFormData({ ...formData, monthly_limit: Number(e.target.value) })} placeholder="-1 = unlimited" className="h-9 text-sm rounded-lg" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Max Charge Cap</Label>
                            <Input type="number" value={formData.max_charge_cap} onChange={(e) => setFormData({ ...formData, max_charge_cap: Number(e.target.value) })} placeholder="-1 = no cap" className="h-9 text-sm rounded-lg" />
                          </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground">Use -1 for unlimited. Max charge cap limits the maximum fee that can be charged.</p>
                      </div>

                      {/* Agent Commissions */}
                      <div className="space-y-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Agent Commission</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Percent (%)</Label>
                            <Input type="number" step="0.01" min={0} value={formData.agent_commission_percent} onChange={(e) => setFormData({ ...formData, agent_commission_percent: Number(e.target.value) })} className="h-9 text-sm rounded-lg" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Fixed (XAF)</Label>
                            <Input type="number" min={0} value={formData.agent_commission_fixed} onChange={(e) => setFormData({ ...formData, agent_commission_fixed: Number(e.target.value) })} className="h-9 text-sm rounded-lg" />
                          </div>
                        </div>
                      </div>

                      {/* Referral Commissions */}
                      <div className="space-y-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Referral Commission</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Percent (%)</Label>
                            <Input type="number" step="0.01" min={0} value={formData.referral_percent_commission} onChange={(e) => setFormData({ ...formData, referral_percent_commission: Number(e.target.value) })} className="h-9 text-sm rounded-lg" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Fixed (XAF)</Label>
                            <Input type="number" min={0} value={formData.referral_fixed_commission} onChange={(e) => setFormData({ ...formData, referral_fixed_commission: Number(e.target.value) })} className="h-9 text-sm rounded-lg" />
                          </div>
                        </div>
                      </div>

                      {/* Merchant Surcharges */}
                      <div className="space-y-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Merchant Surcharge</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Percent (%)</Label>
                            <Input type="number" step="0.01" min={0} value={formData.merchant_percent_charge} onChange={(e) => setFormData({ ...formData, merchant_percent_charge: Number(e.target.value) })} className="h-9 text-sm rounded-lg" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Fixed (XAF)</Label>
                            <Input type="number" min={0} value={formData.merchant_fixed_charge} onChange={(e) => setFormData({ ...formData, merchant_fixed_charge: Number(e.target.value) })} className="h-9 text-sm rounded-lg" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Live Fee Preview */}
            <LiveFeePreview
              estimate={estimateFee}
              transactionType={formData.transaction_type}
              effectiveFrom={formData.effective_from}
              effectiveUntil={formData.effective_until}
              feeScope={formData.fee_scope}
              institutionType={institutions.find((i) => i.id === formData.institution_id)?.institution_type}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex items-center gap-2 pt-2 border-t">
        <Button type="button" variant="ghost" onClick={onCancel} className="text-muted-foreground">Cancel</Button>
        <div className="flex-1" />
        {step > 1 && (
          <Button type="button" variant="outline" onClick={() => setStep(step - 1)} className="gap-1.5 rounded-lg">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Button>
        )}
        {step < 3 && (
          <Button type="button" onClick={() => setStep(step + 1)} disabled={!canProceed()} className="gap-1.5 rounded-lg">
            Continue <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        )}
        {step === 3 && (
          <Button type="submit" className="gap-1.5 rounded-lg shadow-md">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {initialData ? 'Update Structure' : 'Create Structure'}
          </Button>
        )}
      </div>
    </form>
  );
}
