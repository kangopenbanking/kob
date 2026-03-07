import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { motion, AnimatePresence } from "framer-motion";
import { DollarSign, Percent, Layers, Plus, Trash2 } from "lucide-react";

const TRANSACTION_TYPES = [
  { value: "transfer", label: "Account Transfer", icon: "💸" },
  { value: "payment", label: "Payment", icon: "💳" },
  { value: "bill_payment", label: "Bill Payment", icon: "🧾" },
  { value: "mobile_money_transfer", label: "Mobile Money Transfer", icon: "📱" },
  { value: "mobile_money_charge", label: "Mobile Money Charge", icon: "📲" },
  { value: "bank_transfer", label: "Bank Transfer", icon: "🏦" },
  { value: "card_payment", label: "Card Payment", icon: "💳" },
  { value: "virtual_card_topup", label: "Virtual Card Top-up", icon: "🔄" },
  { value: "qr_payment", label: "QR Payment", icon: "📷" },
  { value: "piggybank_deposit", label: "Piggy Bank Deposit", icon: "🐷" },
  { value: "piggybank_withdrawal", label: "Piggy Bank Withdrawal", icon: "🐷" },
  { value: "njangi_contribution", label: "Njangi Contribution", icon: "🤝" },
  { value: "njangi_payout", label: "Njangi Payout", icon: "🤝" },
  { value: "rent_payment", label: "Rent Payment", icon: "🏠" },
  { value: "loan_disbursement", label: "Loan Disbursement", icon: "📤" },
  { value: "loan_repayment", label: "Loan Repayment", icon: "📥" },
  { value: "savings_deposit", label: "Savings Deposit", icon: "💰" },
  { value: "savings_withdrawal", label: "Savings Withdrawal", icon: "💰" },
  { value: "international_transfer", label: "International Transfer", icon: "🌍" },
  { value: "ussd_payment", label: "USSD Payment", icon: "📞" },
  { value: "withdrawal", label: "Cash Out", icon: "🏧" },
  { value: "account_funding", label: "Account Funding", icon: "➕" },
  { value: "gateway_charge", label: "Gateway Charge", icon: "⚡" },
  { value: "gateway_payout", label: "Gateway Payout", icon: "📤" },
  { value: "paypal_payment", label: "PayPal Payment", icon: "🌐" },
  { value: "fx_conversion", label: "FX Conversion", icon: "💱" },
  { value: "escrow_payment", label: "Escrow Payment", icon: "🔒" },
  { value: "api_request", label: "API Request", icon: "🔌" },
  { value: "mobile_recharge", label: "Mobile Recharge", icon: "📶" },
  { value: "invoice_create", label: "Invoice Create", icon: "📄" },
];

const FEE_MODELS = [
  { value: "fixed", label: "Fixed Amount", desc: "A flat fee per transaction", icon: <DollarSign className="h-5 w-5" /> },
  { value: "percentage", label: "Percentage", desc: "A percentage of the transaction", icon: <Percent className="h-5 w-5" /> },
  { value: "hybrid", label: "Hybrid", desc: "Fixed fee + percentage", icon: <Layers className="h-5 w-5" /> },
  { value: "tiered", label: "Tiered", desc: "Volume-based tiers", icon: <Layers className="h-5 w-5" /> },
];

interface TierRate {
  min: number;
  max: number | null;
  fixed: number;
  percentage: number;
}

interface CreateFeeStructureFormProps {
  institutions: any[];
  onSubmit: (formData: any) => void;
  onCancel: () => void;
  initialData?: any;
}

export function CreateFeeStructureForm({ institutions, onSubmit, onCancel, initialData }: CreateFeeStructureFormProps) {
  const [formData, setFormData] = useState({
    institution_id: initialData?.institution_id || '',
    fee_scope: initialData?.fee_scope || 'institution',
    transaction_type: initialData?.transaction_type || '',
    fee_model: initialData?.fee_model || '',
    fixed_amount: initialData?.fixed_amount || 0,
    percentage_rate: initialData?.percentage_rate || 0,
    min_fee_amount: initialData?.min_fee_amount || 0,
    max_fee_amount: initialData?.max_fee_amount || null as number | null,
    effective_from: initialData?.effective_from?.split('T')[0] || new Date().toISOString().split('T')[0],
    effective_until: initialData?.effective_until?.split('T')[0] || '',
  });

  const [tiers, setTiers] = useState<TierRate[]>(
    initialData?.tiered_rates || [{ min: 0, max: 10000, fixed: 100, percentage: 0 }]
  );

  const [step, setStep] = useState(1);

  const addTier = () => {
    const lastTier = tiers[tiers.length - 1];
    setTiers([...tiers, { min: (lastTier?.max || 0) + 1, max: null, fixed: 0, percentage: 0 }]);
  };

  const removeTier = (idx: number) => {
    setTiers(tiers.filter((_, i) => i !== idx));
  };

  const updateTier = (idx: number, field: keyof TierRate, value: number | null) => {
    const updated = [...tiers];
    updated[idx] = { ...updated[idx], [field]: value };
    setTiers(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => s < step && setStep(s)}
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-all ${
                s === step ? 'bg-primary text-primary-foreground shadow-md' :
                s < step ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
              }`}
            >
              {s}
            </button>
            {s < 3 && <div className={`h-0.5 w-8 ${s < step ? 'bg-primary' : 'bg-muted'}`} />}
          </div>
        ))}
        <span className="ml-3 text-sm font-medium text-muted-foreground">
          {step === 1 ? 'Select Scope' : step === 2 ? 'Fee Model' : 'Configure Rates'}
        </span>
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Institution</Label>
              <Select value={formData.institution_id} onValueChange={(v) => setFormData({ ...formData, institution_id: v })}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Select an institution" /></SelectTrigger>
                <SelectContent>
                  {institutions.map((inst: any) => (
                    <SelectItem key={inst.id} value={inst.id}>{inst.institution_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Transaction Type</Label>
              <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-1">
                {TRANSACTION_TYPES.map((tt) => (
                  <button
                    key={tt.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, transaction_type: tt.value })}
                    className={`flex items-center gap-2 rounded-lg border p-3 text-left text-sm transition-all hover:border-primary/50 ${
                      formData.transaction_type === tt.value ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'bg-card'
                    }`}
                  >
                    <span className="text-lg">{tt.icon}</span>
                    <span className="font-medium">{tt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <Label className="text-sm font-semibold">Fee Model</Label>
            <div className="grid grid-cols-2 gap-3">
              {FEE_MODELS.map((fm) => (
                <button
                  key={fm.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, fee_model: fm.value })}
                  className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all hover:border-primary/50 ${
                    formData.fee_model === fm.value ? 'border-primary bg-primary/5 ring-1 ring-primary shadow-sm' : 'bg-card'
                  }`}
                >
                  <div className={`rounded-lg p-2 ${formData.fee_model === fm.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                    {fm.icon}
                  </div>
                  <span className="font-semibold text-sm">{fm.label}</span>
                  <span className="text-xs text-muted-foreground">{fm.desc}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            {(formData.fee_model === 'fixed' || formData.fee_model === 'hybrid') && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Fixed Amount (XAF)</Label>
                <Input type="number" min={0} value={formData.fixed_amount} onChange={(e) => setFormData({ ...formData, fixed_amount: Number(e.target.value) })} className="h-11" />
              </div>
            )}

            {(formData.fee_model === 'percentage' || formData.fee_model === 'hybrid') && (
              <>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Percentage Rate (%)</Label>
                  <Input type="number" step="0.01" min={0} max={100} value={formData.percentage_rate} onChange={(e) => setFormData({ ...formData, percentage_rate: Number(e.target.value) })} className="h-11" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Min Fee (XAF)</Label>
                    <Input type="number" min={0} value={formData.min_fee_amount} onChange={(e) => setFormData({ ...formData, min_fee_amount: Number(e.target.value) })} className="h-11" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Max Fee (XAF)</Label>
                    <Input type="number" min={0} value={formData.max_fee_amount || ''} onChange={(e) => setFormData({ ...formData, max_fee_amount: e.target.value ? Number(e.target.value) : null })} placeholder="No cap" className="h-11" />
                  </div>
                </div>
              </>
            )}

            {formData.fee_model === 'tiered' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Volume Tiers</Label>
                  <Button type="button" size="sm" variant="outline" onClick={addTier}><Plus className="h-3 w-3 mr-1" /> Add Tier</Button>
                </div>
                {tiers.map((tier, idx) => (
                  <div key={idx} className="grid grid-cols-5 gap-2 items-end rounded-lg border bg-muted/30 p-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Min (XAF)</Label>
                      <Input type="number" value={tier.min} onChange={(e) => updateTier(idx, 'min', Number(e.target.value))} className="h-9 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Max (XAF)</Label>
                      <Input type="number" value={tier.max || ''} onChange={(e) => updateTier(idx, 'max', e.target.value ? Number(e.target.value) : null)} placeholder="∞" className="h-9 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Fixed</Label>
                      <Input type="number" value={tier.fixed} onChange={(e) => updateTier(idx, 'fixed', Number(e.target.value))} className="h-9 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">%</Label>
                      <Input type="number" step="0.01" value={tier.percentage} onChange={(e) => updateTier(idx, 'percentage', Number(e.target.value))} className="h-9 text-sm" />
                    </div>
                    <Button type="button" size="icon" variant="ghost" className="h-9 w-9" onClick={() => removeTier(idx)} disabled={tiers.length <= 1}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Effective From</Label>
                <Input type="date" value={formData.effective_from} onChange={(e) => setFormData({ ...formData, effective_from: e.target.value })} className="h-11" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Effective Until (optional)</Label>
                <Input type="date" value={formData.effective_until} onChange={(e) => setFormData({ ...formData, effective_until: e.target.value })} className="h-11" />
              </div>
            </div>

            {/* Preview */}
            <div className="rounded-xl border bg-gradient-to-br from-primary/5 to-primary/10 p-4">
              <h4 className="text-sm font-bold mb-2">Fee Preview</h4>
              <div className="text-sm text-muted-foreground space-y-1">
                <p><span className="font-medium text-foreground">Institution:</span> {institutions.find(i => i.id === formData.institution_id)?.institution_name || '—'}</p>
                <p><span className="font-medium text-foreground">Type:</span> {TRANSACTION_TYPES.find(t => t.value === formData.transaction_type)?.label || '—'}</p>
                <p><span className="font-medium text-foreground">Model:</span> {FEE_MODELS.find(m => m.value === formData.fee_model)?.label || '—'}</p>
                {formData.fixed_amount > 0 && <p><span className="font-medium text-foreground">Fixed:</span> {formData.fixed_amount.toLocaleString()} XAF</p>}
                {formData.percentage_rate > 0 && <p><span className="font-medium text-foreground">Rate:</span> {formData.percentage_rate}%</p>}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-2 pt-2">
        {step > 1 && <Button type="button" variant="outline" onClick={() => setStep(step - 1)}>Back</Button>}
        <div className="flex-1" />
        {step < 3 ? (
          <Button type="button" onClick={() => setStep(step + 1)} disabled={!canProceed()}>Continue</Button>
        ) : (
          <Button type="submit">{initialData ? 'Update Fee Structure' : 'Create Fee Structure'}</Button>
        )}
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}
