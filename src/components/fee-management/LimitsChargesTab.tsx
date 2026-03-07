import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Loader2, Save, Send, Banknote, ArrowDownToLine, ArrowUpFromLine, Smartphone, Building2, CreditCard, FileText, Code } from "lucide-react";

type CategoryData = Record<string, number | string | boolean>;

interface FieldDef {
  key: string;
  label: string;
  suffix: "%" | "XAF" | "";
  hint?: string;
}

const CATEGORIES: {
  key: string;
  label: string;
  icon: React.ElementType;
  fields: FieldDef[];
}[] = [
  {
    key: "send_money",
    label: "Send Money",
    icon: Send,
    fields: [
      { key: "percentage_charge", label: "Percentage Charge", suffix: "%" },
      { key: "fixed_charge", label: "Fixed Charge", suffix: "XAF" },
      { key: "min_amount", label: "Minimum Amount", suffix: "XAF" },
      { key: "max_amount", label: "Maximum Amount", suffix: "XAF" },
      { key: "daily_limit", label: "Daily Transfer Limit", suffix: "XAF", hint: "Put -1 if you don't want limit" },
      { key: "daily_request_accept_limit", label: "Daily Request Accept Limit", suffix: "XAF", hint: "Put -1 for unlimited" },
      { key: "monthly_limit", label: "Monthly Send Money Limit", suffix: "XAF", hint: "Put -1 if you don't want limit" },
      { key: "monthly_request_accept_limit", label: "Monthly Request Accept Limit", suffix: "XAF", hint: "Put -1 if you don't want limit" },
      { key: "referral_percent_commission", label: "Referral Percentage Commission", suffix: "%" },
      { key: "referral_fixed_commission", label: "Referral Fixed Commission", suffix: "XAF" },
      { key: "max_charge_cap", label: "Maximum Charge Cap", suffix: "XAF", hint: "Put -1 if you don't want charge cap" },
    ],
  },
  {
    key: "cash_in",
    label: "Cash In",
    icon: ArrowDownToLine,
    fields: [
      { key: "min_amount", label: "Minimum Amount", suffix: "XAF" },
      { key: "max_amount", label: "Maximum Amount", suffix: "XAF" },
      { key: "agent_commission_fixed", label: "Agent Commission (fixed)", suffix: "XAF" },
      { key: "agent_commission_percent", label: "Agent Commission (%)", suffix: "%" },
      { key: "daily_limit", label: "Daily Money In Limit", suffix: "XAF", hint: "Put -1 if you don't want limit" },
      { key: "monthly_limit", label: "Monthly Money In Limit", suffix: "XAF", hint: "Put -1 if you don't want limit" },
    ],
  },
  {
    key: "cash_out",
    label: "Cash Out",
    icon: ArrowUpFromLine,
    fields: [
      { key: "percentage_charge", label: "Percentage Charge", suffix: "%" },
      { key: "fixed_charge", label: "Fixed Charge", suffix: "XAF" },
      { key: "min_amount", label: "Minimum Amount", suffix: "XAF" },
      { key: "max_amount", label: "Maximum Amount", suffix: "XAF" },
      { key: "agent_commission_fixed", label: "Agent Commission (fixed)", suffix: "XAF" },
      { key: "agent_commission_percent", label: "Agent Commission (%)", suffix: "%" },
      { key: "daily_limit", label: "Daily Cash Out Limit", suffix: "XAF", hint: "Put -1 if you don't want limit" },
      { key: "monthly_limit", label: "Monthly Cash Out Limit", suffix: "XAF", hint: "Put -1 if you don't want limit" },
      { key: "referral_percent_commission", label: "Referral Percentage Commission", suffix: "%" },
      { key: "referral_fixed_commission", label: "Referral Fixed Commission", suffix: "XAF" },
    ],
  },
  {
    key: "mobile_recharge",
    label: "Mobile Recharge",
    icon: Smartphone,
    fields: [
      { key: "percentage_charge", label: "Percentage Charge", suffix: "%" },
      { key: "fixed_charge", label: "Fixed Charge", suffix: "XAF" },
      { key: "min_amount", label: "Minimum Amount", suffix: "XAF" },
      { key: "max_amount", label: "Maximum Amount", suffix: "XAF" },
      { key: "referral_percent_commission", label: "Referral Percentage Commission", suffix: "%" },
      { key: "referral_fixed_commission", label: "Referral Fixed Commission", suffix: "XAF" },
    ],
  },
  {
    key: "bank_transfer",
    label: "Bank Transfer",
    icon: Building2,
    fields: [
      { key: "percentage_charge", label: "Percentage Charge", suffix: "%" },
      { key: "fixed_charge", label: "Fixed Charge", suffix: "XAF" },
      { key: "min_amount", label: "Minimum Amount", suffix: "XAF" },
      { key: "max_amount", label: "Maximum Amount", suffix: "XAF" },
      { key: "daily_limit", label: "Daily Bank Transfer Limit", suffix: "XAF", hint: "Put -1 if you don't want limit" },
      { key: "monthly_limit", label: "Monthly Bank Transfer Limit", suffix: "XAF", hint: "Put -1 if you don't want limit" },
      { key: "referral_percent_commission", label: "Referral Percentage Commission", suffix: "%" },
      { key: "referral_fixed_commission", label: "Referral Fixed Commission", suffix: "XAF" },
    ],
  },
  {
    key: "payment_charges",
    label: "Payment Charges",
    icon: CreditCard,
    fields: [
      { key: "merchant_percent_charge", label: "Merchant Percent Charge", suffix: "%" },
      { key: "merchant_fixed_charge", label: "Merchant Fixed Charge", suffix: "XAF" },
      { key: "user_percent_charge", label: "User Percent Charge", suffix: "%" },
      { key: "user_fixed_charge", label: "User Fixed Charge", suffix: "XAF" },
      { key: "max_charge_cap", label: "Payment Maximum Charge Cap", suffix: "XAF", hint: "Put -1 if you don't want charge cap" },
      { key: "referral_percent_commission", label: "Referral Percentage Commission", suffix: "%" },
      { key: "referral_fixed_commission", label: "Referral Fixed Commission", suffix: "XAF" },
    ],
  },
  {
    key: "invoice_create",
    label: "Invoices Create Charge",
    icon: FileText,
    fields: [
      { key: "percentage_charge", label: "Percentage Charge", suffix: "%" },
      { key: "fixed_charge", label: "Fixed Charge", suffix: "XAF" },
      { key: "min_amount", label: "Minimum Amount", suffix: "XAF" },
      { key: "max_amount", label: "Maximum Amount", suffix: "XAF" },
      { key: "daily_count_limit", label: "Daily Invoices Create Limit", suffix: "", hint: "Put -1 if you don't want limit" },
      { key: "max_charge_cap", label: "Maximum Charge Cap", suffix: "XAF", hint: "Put -1 if you don't want charge cap" },
    ],
  },
  {
    key: "api_payment",
    label: "API Payment Charge",
    icon: Code,
    fields: [
      { key: "percentage_charge", label: "Percentage Charge", suffix: "%" },
      { key: "fixed_charge", label: "Fixed Charge", suffix: "XAF" },
      { key: "max_charge_cap", label: "Maximum Charge Cap", suffix: "XAF", hint: "Put -1 if you don't want charge cap" },
    ],
  },
];

export function LimitsChargesTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [data, setData] = useState<Record<string, CategoryData>>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: rows, error } = await supabase
      .from("fee_limits_charges" as any)
      .select("*");
    if (error) {
      toast({ title: "Error", description: "Failed to load limits & charges", variant: "destructive" });
    } else if (rows) {
      const mapped: Record<string, CategoryData> = {};
      (rows as any[]).forEach((row: any) => {
        mapped[row.category] = row;
      });
      setData(mapped);
    }
    setLoading(false);
  };

  const handleChange = (category: string, key: string, value: string) => {
    setData((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value === "" ? 0 : Number(value),
      },
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

      const updatePayload: Record<string, any> = {
        updated_at: new Date().toISOString(),
        updated_by: userId,
      };
      catDef.fields.forEach((f) => {
        updatePayload[f.key] = Number(row[f.key]) || 0;
      });

      const { error } = await supabase
        .from("fee_limits_charges" as any)
        .update(updatePayload)
        .eq("category", category);

      if (error) throw error;
      toast({ title: "Saved", description: `${catDef.label} limits & charges updated` });
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
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-bold">Limits & Charges</h3>
        <p className="text-xs text-muted-foreground">
          Configure transaction limits, charges, commissions, and referral rates for each category
        </p>
      </div>

      <Accordion type="multiple" className="space-y-2">
        {CATEGORIES.map((cat) => {
          const row = data[cat.key] || {};
          const Icon = cat.icon;
          return (
            <AccordionItem
              key={cat.key}
              value={cat.key}
              className="rounded-lg border bg-card px-4"
            >
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm">{cat.label}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2 pb-4">
                  {cat.fields.map((field) => (
                    <div key={field.key} className="space-y-1.5">
                      <Label className="text-xs font-medium">
                        {field.label} <span className="text-destructive">*</span>
                      </Label>
                      <div className="relative">
                        <Input
                          type="number"
                          step="any"
                          value={String(row[field.key] ?? 0)}
                          onChange={(e) => handleChange(cat.key, field.key, e.target.value)}
                          className="pr-12"
                        />
                        {field.suffix && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                            {field.suffix}
                          </span>
                        )}
                      </div>
                      {field.hint && (
                        <p className="text-[10px] text-muted-foreground">{field.hint}</p>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex justify-end pb-2">
                  <Button
                    size="sm"
                    onClick={() => handleSave(cat.key)}
                    disabled={saving === cat.key}
                  >
                    {saving === cat.key ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    ) : (
                      <Save className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Save {cat.label}
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
