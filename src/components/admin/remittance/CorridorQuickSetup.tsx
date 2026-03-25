import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/components/ui/use-toast";
import { Zap, Globe, ArrowRight, Check } from "lucide-react";

const COUNTRY_FLAGS: Record<string, string> = {
  CM: "🇨🇲", FR: "🇫🇷", GB: "🇬🇧", US: "🇺🇸", DE: "🇩🇪", CA: "🇨🇦",
  NG: "🇳🇬", GH: "🇬🇭", KE: "🇰🇪", SN: "🇸🇳", CI: "🇨🇮", ZA: "🇿🇦",
  RW: "🇷🇼", TZ: "🇹🇿", UG: "🇺🇬", ML: "🇲🇱", BF: "🇧🇫", BJ: "🇧🇯",
};

const COUNTRY_NAMES: Record<string, string> = {
  CM: "Cameroon", FR: "France", GB: "United Kingdom", US: "United States",
  DE: "Germany", CA: "Canada", NG: "Nigeria", GH: "Ghana", KE: "Kenya",
  SN: "Senegal", CI: "Côte d'Ivoire", ZA: "South Africa", RW: "Rwanda",
  TZ: "Tanzania", UG: "Uganda", ML: "Mali", BF: "Burkina Faso", BJ: "Benin",
};

const CURRENCY_MAP: Record<string, string> = {
  CM: "XAF", FR: "EUR", GB: "GBP", US: "USD", DE: "EUR", CA: "CAD",
  NG: "NGN", GH: "GHS", KE: "KES", SN: "XOF", CI: "XOF", ZA: "ZAR",
  RW: "RWF", TZ: "TZS", UG: "UGX", ML: "XOF", BF: "XOF", BJ: "XOF",
};

const PARTNER_CORRIDOR_TEMPLATES: Record<string, Array<{
  from: string; to: string; fx_rate: number; fee_pct: number; fixed_fee: number;
  fee_currency: string; delivery_secs: number; kyc: string; methods: string[];
  direction: string; min: number; max: number;
}>> = {
  thunes: [
    { from: "FR", to: "CM", fx_rate: 655.957, fee_pct: 1.5, fixed_fee: 1.99, fee_currency: "EUR", delivery_secs: 900, kyc: "basic", methods: ["mobile_money", "bank_transfer"], direction: "inbound", min: 10, max: 5000 },
    { from: "GB", to: "CM", fx_rate: 765.50, fee_pct: 1.2, fixed_fee: 1.49, fee_currency: "GBP", delivery_secs: 900, kyc: "basic", methods: ["mobile_money", "bank_transfer"], direction: "inbound", min: 10, max: 5000 },
    { from: "US", to: "CM", fx_rate: 605.50, fee_pct: 1.8, fixed_fee: 2.99, fee_currency: "USD", delivery_secs: 1800, kyc: "basic", methods: ["mobile_money", "bank_transfer"], direction: "inbound", min: 10, max: 10000 },
    { from: "DE", to: "CM", fx_rate: 655.957, fee_pct: 1.5, fixed_fee: 1.99, fee_currency: "EUR", delivery_secs: 900, kyc: "basic", methods: ["mobile_money", "bank_transfer"], direction: "inbound", min: 10, max: 5000 },
    { from: "CA", to: "CM", fx_rate: 445.20, fee_pct: 1.6, fixed_fee: 2.49, fee_currency: "CAD", delivery_secs: 1800, kyc: "basic", methods: ["mobile_money", "bank_transfer"], direction: "inbound", min: 15, max: 7500 },
  ],
  terrapay: [
    { from: "NG", to: "CM", fx_rate: 0.403, fee_pct: 2.0, fixed_fee: 500, fee_currency: "NGN", delivery_secs: 3600, kyc: "basic", methods: ["mobile_money"], direction: "inbound", min: 5000, max: 5000000 },
    { from: "GH", to: "CM", fx_rate: 41.50, fee_pct: 2.0, fixed_fee: 5, fee_currency: "GHS", delivery_secs: 3600, kyc: "basic", methods: ["mobile_money"], direction: "inbound", min: 20, max: 50000 },
    { from: "CM", to: "NG", fx_rate: 2.48, fee_pct: 2.0, fixed_fee: 500, fee_currency: "XAF", delivery_secs: 3600, kyc: "enhanced", methods: ["mobile_money", "bank_transfer"], direction: "outbound", min: 5000, max: 3000000 },
  ],
  onafriq: [
    { from: "KE", to: "CM", fx_rate: 4.68, fee_pct: 2.5, fixed_fee: 100, fee_currency: "KES", delivery_secs: 7200, kyc: "basic", methods: ["mobile_money"], direction: "inbound", min: 500, max: 500000 },
    { from: "CM", to: "SN", fx_rate: 1.0, fee_pct: 1.0, fixed_fee: 250, fee_currency: "XAF", delivery_secs: 1800, kyc: "basic", methods: ["mobile_money"], direction: "outbound", min: 1000, max: 5000000 },
    { from: "CM", to: "CI", fx_rate: 1.0, fee_pct: 1.0, fixed_fee: 250, fee_currency: "XAF", delivery_secs: 1800, kyc: "basic", methods: ["mobile_money"], direction: "outbound", min: 1000, max: 5000000 },
  ],
  kob_internal: [
    { from: "CM", to: "CM", fx_rate: 1, fee_pct: 0.5, fixed_fee: 100, fee_currency: "XAF", delivery_secs: 30, kyc: "none", methods: ["mobile_money", "wallet"], direction: "domestic", min: 500, max: 5000000 },
  ],
  flutterwave: [
    { from: "NG", to: "CM", fx_rate: 0.403, fee_pct: 1.8, fixed_fee: 300, fee_currency: "NGN", delivery_secs: 3600, kyc: "basic", methods: ["mobile_money"], direction: "inbound", min: 5000, max: 5000000 },
    { from: "GH", to: "CM", fx_rate: 41.50, fee_pct: 1.8, fixed_fee: 3, fee_currency: "GHS", delivery_secs: 3600, kyc: "basic", methods: ["mobile_money"], direction: "inbound", min: 20, max: 50000 },
  ],
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partners: Array<{ id: string; name: string; display_name: string }>;
  existingCorridors: Array<{ from_country: string; to_country: string; partner_id: string }>;
}

export function CorridorQuickSetup({ open, onOpenChange, partners, existingCorridors }: Props) {
  const queryClient = useQueryClient();
  const [selectedPartner, setSelectedPartner] = useState<string>("");
  const [selectedCorridors, setSelectedCorridors] = useState<Set<string>>(new Set());

  const partner = partners.find(p => p.id === selectedPartner);
  const templates = partner ? PARTNER_CORRIDOR_TEMPLATES[partner.name] || [] : [];

  const existingSet = new Set(existingCorridors.map(c => `${c.from_country}-${c.to_country}-${c.partner_id}`));

  const availableTemplates = templates.filter(
    t => !existingSet.has(`${t.from}-${t.to}-${selectedPartner}`)
  );

  const toggleCorridor = (key: string) => {
    setSelectedCorridors(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedCorridors(new Set(availableTemplates.map(t => `${t.from}-${t.to}`)));
  };

  const bulkMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const toCreate = availableTemplates.filter(t => selectedCorridors.has(`${t.from}-${t.to}`));

      for (const t of toCreate) {
        const res = await supabase.functions.invoke("remittance-engine", {
          body: {
            action: "admin_manage_corridor",
            operation: "create",
            corridor_data: {
              partner_id: selectedPartner,
              from_country: t.from,
              to_country: t.to,
              from_currency: CURRENCY_MAP[t.from] || "XAF",
              to_currency: CURRENCY_MAP[t.to] || "XAF",
              min_amount: t.min,
              max_amount: t.max,
              est_delivery_seconds: t.delivery_secs,
              fees_model: { fx_rate: t.fx_rate, fee_percentage: t.fee_pct, fixed_fee: t.fixed_fee, fee_currency: t.fee_currency },
              is_active: true,
              settlement_delay_hours: t.direction === "domestic" ? 0 : 24,
              requires_kyc_level: t.kyc,
              delivery_methods: t.methods,
              direction: t.direction,
            },
          },
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
        });
        if (res.error) throw new Error(`Failed to create ${t.from}→${t.to}: ${res.error.message}`);
      }
      return toCreate.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["admin-remittance-corridors"] });
      toast({ title: `${count} corridor(s) created successfully` });
      onOpenChange(false);
      setSelectedPartner("");
      setSelectedCorridors(new Set());
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const formatDelivery = (secs: number) => {
    if (secs < 60) return `~${secs}s`;
    if (secs < 3600) return `~${Math.round(secs / 60)} min`;
    return `~${(secs / 3600).toFixed(0)} hr${secs >= 7200 ? "s" : ""}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" /> Quick Setup — Bulk Corridor Creation
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Select Partner</Label>
            <Select value={selectedPartner} onValueChange={v => { setSelectedPartner(v); setSelectedCorridors(new Set()); }}>
              <SelectTrigger><SelectValue placeholder="Choose a partner…" /></SelectTrigger>
              <SelectContent>
                {partners.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.display_name || p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedPartner && availableTemplates.length === 0 && (
            <div className="rounded-xl border border-border/50 bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              <Globe className="h-8 w-8 mx-auto mb-2 opacity-50" />
              All corridors for this partner are already configured.
            </div>
          )}

          {availableTemplates.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{availableTemplates.length} corridor(s) available</p>
                <Button variant="ghost" size="sm" onClick={selectAll}>Select All</Button>
              </div>
              <ScrollArea className="h-[300px] rounded-xl border border-border/50">
                <div className="space-y-1 p-2">
                  {availableTemplates.map(t => {
                    const key = `${t.from}-${t.to}`;
                    const isSelected = selectedCorridors.has(key);
                    return (
                      <button
                        key={key}
                        onClick={() => toggleCorridor(key)}
                        className={`w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-colors ${
                          isSelected ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/50 border border-transparent"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`h-5 w-5 rounded-md border flex items-center justify-center transition-colors ${
                            isSelected ? "bg-primary border-primary text-primary-foreground" : "border-border"
                          }`}>
                            {isSelected && <Check className="h-3 w-3" />}
                          </div>
                          <span className="text-lg">{COUNTRY_FLAGS[t.from] || t.from}</span>
                          <span className="font-medium">{COUNTRY_NAMES[t.from] || t.from}</span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <span className="text-lg">{COUNTRY_FLAGS[t.to] || t.to}</span>
                          <span className="font-medium">{COUNTRY_NAMES[t.to] || t.to}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{CURRENCY_MAP[t.from]}→{CURRENCY_MAP[t.to]}</span>
                          <Badge variant="outline" className="text-[10px]">{t.fee_pct}% + {t.fixed_fee}</Badge>
                          <span>{formatDelivery(t.delivery_secs)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={selectedCorridors.size === 0 || bulkMutation.isPending}
            onClick={() => bulkMutation.mutate()}
          >
            <Zap className="h-4 w-4 mr-1" />
            {bulkMutation.isPending ? "Creating…" : `Create ${selectedCorridors.size} Corridor(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
