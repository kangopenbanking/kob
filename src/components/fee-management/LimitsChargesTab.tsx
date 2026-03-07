import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, Send, Banknote, ArrowDownToLine, ArrowUpFromLine, Smartphone, Building2, CreditCard, FileText, Code, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

type CategoryData = Record<string, number | string | boolean>;

interface FieldDef {
  key: string;
  label: string;
  suffix: "%" | "XAF" | "";
  hint?: string;
}

const CATEGORY_COLORS: Record<string, { bg: string; iconBg: string; border: string; badge: string }> = {
  send_money: {
    bg: "bg-[hsl(217,91%,97%)]",
    iconBg: "bg-[hsl(217,91%,35%)]",
    border: "border-[hsl(217,91%,85%)]",
    badge: "bg-[hsl(217,91%,93%)] text-[hsl(217,91%,35%)]",
  },
  cash_in: {
    bg: "bg-[hsl(155,72%,96%)]",
    iconBg: "bg-[hsl(155,72%,40%)]",
    border: "border-[hsl(155,72%,82%)]",
    badge: "bg-[hsl(155,72%,92%)] text-[hsl(155,72%,30%)]",
  },
  cash_out: {
    bg: "bg-[hsl(351,88%,97%)]",
    iconBg: "bg-[hsl(351,88%,46%)]",
    border: "border-[hsl(351,88%,88%)]",
    badge: "bg-[hsl(351,88%,94%)] text-[hsl(351,88%,40%)]",
  },
  mobile_recharge: {
    bg: "bg-[hsl(38,92%,96%)]",
    iconBg: "bg-[hsl(38,92%,50%)]",
    border: "border-[hsl(38,92%,82%)]",
    badge: "bg-[hsl(38,92%,92%)] text-[hsl(38,70%,35%)]",
  },
  bank_transfer: {
    bg: "bg-[hsl(258,80%,97%)]",
    iconBg: "bg-[hsl(258,80%,58%)]",
    border: "border-[hsl(258,80%,88%)]",
    badge: "bg-[hsl(258,80%,94%)] text-[hsl(258,80%,45%)]",
  },
  payment_charges: {
    bg: "bg-[hsl(172,66%,96%)]",
    iconBg: "bg-[hsl(172,66%,40%)]",
    border: "border-[hsl(172,66%,82%)]",
    badge: "bg-[hsl(172,66%,92%)] text-[hsl(172,66%,30%)]",
  },
  invoice_create: {
    bg: "bg-[hsl(45,100%,96%)]",
    iconBg: "bg-[hsl(45,100%,40%)]",
    border: "border-[hsl(45,100%,80%)]",
    badge: "bg-[hsl(45,100%,92%)] text-[hsl(45,80%,30%)]",
  },
  api_payment: {
    bg: "bg-[hsl(210,40%,96%)]",
    iconBg: "bg-[hsl(217,33%,30%)]",
    border: "border-[hsl(210,40%,85%)]",
    badge: "bg-[hsl(210,40%,92%)] text-[hsl(217,33%,30%)]",
  },
};

const CATEGORIES: {
  key: string;
  label: string;
  description: string;
  icon: React.ElementType;
  fields: FieldDef[];
}[] = [
  {
    key: "send_money", label: "Send Money", description: "P2P transfers & request money",
    icon: Send,
    fields: [
      { key: "percentage_charge", label: "Percentage Charge", suffix: "%" },
      { key: "fixed_charge", label: "Fixed Charge", suffix: "XAF" },
      { key: "min_amount", label: "Minimum Amount", suffix: "XAF" },
      { key: "max_amount", label: "Maximum Amount", suffix: "XAF" },
      { key: "daily_limit", label: "Daily Transfer Limit", suffix: "XAF", hint: "-1 for unlimited" },
      { key: "daily_request_accept_limit", label: "Daily Request Accept Limit", suffix: "XAF", hint: "-1 for unlimited" },
      { key: "monthly_limit", label: "Monthly Send Money Limit", suffix: "XAF", hint: "-1 for unlimited" },
      { key: "monthly_request_accept_limit", label: "Monthly Request Accept Limit", suffix: "XAF", hint: "-1 for unlimited" },
      { key: "referral_percent_commission", label: "Referral % Commission", suffix: "%" },
      { key: "referral_fixed_commission", label: "Referral Fixed Commission", suffix: "XAF" },
      { key: "max_charge_cap", label: "Max Charge Cap", suffix: "XAF", hint: "-1 for no cap" },
    ],
  },
  {
    key: "cash_in", label: "Add Money", description: "Account funding & deposits",
    icon: ArrowDownToLine,
    fields: [
      { key: "percentage_charge", label: "Percentage Charge", suffix: "%" },
      { key: "fixed_charge", label: "Fixed Charge", suffix: "XAF" },
      { key: "min_amount", label: "Minimum Deposit", suffix: "XAF" },
      { key: "max_amount", label: "Maximum Deposit", suffix: "XAF" },
      { key: "daily_limit", label: "Daily Deposit Limit", suffix: "XAF", hint: "-1 for unlimited" },
      { key: "monthly_limit", label: "Monthly Deposit Limit", suffix: "XAF", hint: "-1 for unlimited" },
      { key: "max_charge_cap", label: "Max Charge Cap", suffix: "XAF", hint: "-1 for no cap" },
    ],
  },
  {
    key: "cash_out", label: "Cash Out", description: "Withdrawals to linked accounts",
    icon: ArrowUpFromLine,
    fields: [
      { key: "percentage_charge", label: "Percentage Charge", suffix: "%" },
      { key: "fixed_charge", label: "Fixed Charge", suffix: "XAF" },
      { key: "min_amount", label: "Minimum Amount", suffix: "XAF" },
      { key: "max_amount", label: "Maximum Amount", suffix: "XAF" },
      { key: "daily_limit", label: "Daily Cash Out Limit", suffix: "XAF", hint: "-1 for unlimited" },
      { key: "monthly_limit", label: "Monthly Cash Out Limit", suffix: "XAF", hint: "-1 for unlimited" },
      { key: "referral_percent_commission", label: "Referral % Commission", suffix: "%" },
      { key: "referral_fixed_commission", label: "Referral Fixed Commission", suffix: "XAF" },
      { key: "max_charge_cap", label: "Max Charge Cap", suffix: "XAF", hint: "-1 for no cap" },
    ],
  },
  {
    key: "mobile_recharge", label: "Mobile Recharge", description: "Airtime & data top-ups",
    icon: Smartphone,
    fields: [
      { key: "percentage_charge", label: "Percentage Charge", suffix: "%" },
      { key: "fixed_charge", label: "Fixed Charge", suffix: "XAF" },
      { key: "min_amount", label: "Minimum Amount", suffix: "XAF" },
      { key: "max_amount", label: "Maximum Amount", suffix: "XAF" },
      { key: "referral_percent_commission", label: "Referral % Commission", suffix: "%" },
      { key: "referral_fixed_commission", label: "Referral Fixed Commission", suffix: "XAF" },
    ],
  },
  {
    key: "bank_transfer", label: "Bank Transfer", description: "Bank-to-bank transfers",
    icon: Building2,
    fields: [
      { key: "percentage_charge", label: "Percentage Charge", suffix: "%" },
      { key: "fixed_charge", label: "Fixed Charge", suffix: "XAF" },
      { key: "min_amount", label: "Minimum Amount", suffix: "XAF" },
      { key: "max_amount", label: "Maximum Amount", suffix: "XAF" },
      { key: "daily_limit", label: "Daily Bank Transfer Limit", suffix: "XAF", hint: "-1 for unlimited" },
      { key: "monthly_limit", label: "Monthly Bank Transfer Limit", suffix: "XAF", hint: "-1 for unlimited" },
      { key: "referral_percent_commission", label: "Referral % Commission", suffix: "%" },
      { key: "referral_fixed_commission", label: "Referral Fixed Commission", suffix: "XAF" },
    ],
  },
  {
    key: "payment_charges", label: "Payment Charges", description: "Merchant & user payment fees",
    icon: CreditCard,
    fields: [
      { key: "merchant_percent_charge", label: "Merchant % Charge", suffix: "%" },
      { key: "merchant_fixed_charge", label: "Merchant Fixed Charge", suffix: "XAF" },
      { key: "user_percent_charge", label: "User % Charge", suffix: "%" },
      { key: "user_fixed_charge", label: "User Fixed Charge", suffix: "XAF" },
      { key: "max_charge_cap", label: "Max Charge Cap", suffix: "XAF", hint: "-1 for no cap" },
      { key: "referral_percent_commission", label: "Referral % Commission", suffix: "%" },
      { key: "referral_fixed_commission", label: "Referral Fixed Commission", suffix: "XAF" },
    ],
  },
  {
    key: "invoice_create", label: "Invoice Create Charge", description: "Per-invoice creation fees",
    icon: FileText,
    fields: [
      { key: "percentage_charge", label: "Percentage Charge", suffix: "%" },
      { key: "fixed_charge", label: "Fixed Charge", suffix: "XAF" },
      { key: "min_amount", label: "Minimum Amount", suffix: "XAF" },
      { key: "max_amount", label: "Maximum Amount", suffix: "XAF" },
      { key: "daily_count_limit", label: "Daily Create Limit", suffix: "", hint: "-1 for unlimited" },
      { key: "max_charge_cap", label: "Max Charge Cap", suffix: "XAF", hint: "-1 for no cap" },
    ],
  },
  {
    key: "api_payment", label: "API Payment Charge", description: "Developer API transaction fees",
    icon: Code,
    fields: [
      { key: "percentage_charge", label: "Percentage Charge", suffix: "%" },
      { key: "fixed_charge", label: "Fixed Charge", suffix: "XAF" },
      { key: "max_charge_cap", label: "Max Charge Cap", suffix: "XAF", hint: "-1 for no cap" },
    ],
  },
];

export function LimitsChargesTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [data, setData] = useState<Record<string, CategoryData>>({});

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: rows, error } = await supabase.from("fee_limits_charges" as any).select("*");
    if (error) {
      toast({ title: "Error", description: "Failed to load limits & charges", variant: "destructive" });
    } else if (rows) {
      const mapped: Record<string, CategoryData> = {};
      (rows as any[]).forEach((row: any) => { mapped[row.category] = row; });
      setData(mapped);
    }
    setLoading(false);
  };

  const handleChange = (category: string, key: string, value: string) => {
    setData((prev) => ({
      ...prev,
      [category]: { ...prev[category], [key]: value === "" ? 0 : Number(value) },
    }));
  };

  const handleSave = async (category: string) => {
    setSaving(category);
    try {
      const row = data[category];
      if (!row) return;
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      const catDef = CATEGORIES.find((c) => c.key === category);
      if (!catDef) return;

      const updatePayload: Record<string, any> = { updated_at: new Date().toISOString(), updated_by: userId };
      catDef.fields.forEach((f) => { updatePayload[f.key] = Number(row[f.key]) || 0; });

      const { error } = await supabase.from("fee_limits_charges" as any).update(updatePayload).eq("category", category);
      if (error) throw error;
      toast({ title: "Saved", description: `${catDef.label} updated successfully` });
      setSaved(category);
      setTimeout(() => setSaved(null), 2000);
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to save", variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-foreground">Limits & Charges</h3>
          <p className="text-xs text-muted-foreground">Configure transaction limits, charges, commissions, and referral rates</p>
        </div>
        <Badge variant="outline" className="text-xs font-semibold border-border">
          {CATEGORIES.length} Categories
        </Badge>
      </div>

      <Accordion type="multiple" className="space-y-3">
        {CATEGORIES.map((cat, idx) => {
          const row = data[cat.key] || {};
          const Icon = cat.icon;
          const colors = CATEGORY_COLORS[cat.key] || CATEGORY_COLORS.send_money;
          const fieldCount = cat.fields.length;

          return (
            <motion.div
              key={cat.key}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04, duration: 0.35 }}
            >
              <AccordionItem
                value={cat.key}
                className={`rounded-2xl border ${colors.border} ${colors.bg} overflow-hidden shadow-sm hover:shadow-md transition-shadow`}
              >
                <AccordionTrigger className="hover:no-underline px-5 py-4">
                  <div className="flex items-center gap-3 w-full">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${colors.iconBg} text-primary-foreground shadow-sm`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 text-left">
                      <span className="font-bold text-sm text-foreground">{cat.label}</span>
                      <p className="text-[11px] text-muted-foreground">{cat.description}</p>
                    </div>
                    <Badge className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border-0 ${colors.badge}`}>
                      {fieldCount} fields
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="px-5 pb-5 pt-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {cat.fields.map((field) => (
                        <div key={field.key} className="space-y-1.5">
                          <Label className="text-xs font-semibold text-foreground">
                            {field.label}
                          </Label>
                          <div className="relative">
                            <Input
                              type="number"
                              step="any"
                              value={String(row[field.key] ?? 0)}
                              onChange={(e) => handleChange(cat.key, field.key, e.target.value)}
                              className="pr-14 h-10 rounded-xl border-border bg-card text-sm font-medium shadow-sm focus:ring-2 focus:ring-primary/20"
                            />
                            {field.suffix && (
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-muted-foreground pointer-events-none bg-muted px-1.5 py-0.5 rounded">
                                {field.suffix}
                              </span>
                            )}
                          </div>
                          {field.hint && (
                            <p className="text-[10px] text-muted-foreground italic">{field.hint}</p>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-end mt-5">
                      <Button
                        size="sm"
                        onClick={() => handleSave(cat.key)}
                        disabled={saving === cat.key}
                        className={`rounded-xl shadow-sm px-5 ${saved === cat.key ? 'bg-[hsl(155,72%,40%)] hover:bg-[hsl(155,72%,35%)]' : ''}`}
                      >
                        {saving === cat.key ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                        ) : saved === cat.key ? (
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                        ) : (
                          <Save className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        {saved === cat.key ? "Saved!" : `Save ${cat.label}`}
                      </Button>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </motion.div>
          );
        })}
      </Accordion>
    </div>
  );
}
