import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Plus, Save, Store, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";

const GATEWAY_CHANNELS = [
  { value: "mobile_money_charge", label: "Mobile Money", icon: "📱" },
  { value: "card_payment", label: "Card", icon: "💳" },
  { value: "bank_transfer", label: "Bank Transfer", icon: "🏦" },
  { value: "paypal_payment", label: "PayPal", icon: "🌐" },
  { value: "ussd_payment", label: "USSD", icon: "📞" },
  { value: "account_funding", label: "Account Funding", icon: "💰" },
  { value: "virtual_card_topup", label: "Virtual Card Top-up", icon: "🔄" },
  { value: "gateway_charge", label: "Gateway Charge", icon: "⚡" },
  { value: "gateway_payout", label: "Gateway Payout", icon: "📤" },
];

export function MerchantFeesTab() {
  const queryClient = useQueryClient();
  const [selectedMerchantId, setSelectedMerchantId] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newOverride, setNewOverride] = useState({
    transaction_type: "",
    percentage_rate: 0,
    fixed_amount: 0,
  });
  const [saving, setSaving] = useState(false);

  const { data: merchants, isLoading: loadingMerchants } = useQuery({
    queryKey: ["all-merchants-for-fees"],
    queryFn: async () => {
      const { data } = await supabase
        .from("gateway_merchants")
        .select("id, business_name, status")
        .order("business_name");
      return data || [];
    },
  });

  const { data: overrides, isLoading: loadingOverrides } = useQuery({
    queryKey: ["merchant-fee-overrides", selectedMerchantId],
    queryFn: async () => {
      if (!selectedMerchantId) return [];
      const { data } = await supabase
        .from("fee_structures")
        .select("*")
        .eq("fee_scope", "merchant")
        .eq("merchant_id", selectedMerchantId)
        .eq("is_active", true)
        .order("transaction_type");
      return data || [];
    },
    enabled: !!selectedMerchantId,
  });

  const { data: platformDefaults } = useQuery({
    queryKey: ["platform-fee-defaults"],
    queryFn: async () => {
      const { data } = await supabase
        .from("fee_structures")
        .select("*")
        .eq("fee_scope", "platform")
        .eq("is_active", true)
        .order("transaction_type");
      return data || [];
    },
  });

  const handleAddOverride = async () => {
    if (!selectedMerchantId || !newOverride.transaction_type) {
      toast.error("Select a merchant and transaction type");
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("fee_structures").insert({
        merchant_id: selectedMerchantId,
        transaction_type: newOverride.transaction_type,
        fee_model: "hybrid",
        fixed_amount: newOverride.fixed_amount,
        percentage_rate: newOverride.percentage_rate,
        fee_scope: "merchant",
        is_active: true,
        effective_from: new Date().toISOString().split("T")[0],
        created_by: user?.id,
      });
      if (error) throw error;
      toast.success("Merchant fee override created");
      setShowAddDialog(false);
      setNewOverride({ transaction_type: "", percentage_rate: 0, fixed_amount: 0 });
      queryClient.invalidateQueries({ queryKey: ["merchant-fee-overrides", selectedMerchantId] });
    } catch (err: any) {
      toast.error(err.message || "Failed to create override");
    }
    setSaving(false);
  };

  const handleDeleteOverride = async (id: string) => {
    const { error } = await supabase.from("fee_structures").update({ is_active: false }).eq("id", id);
    if (error) {
      toast.error("Failed to remove override");
    } else {
      toast.success("Override removed");
      queryClient.invalidateQueries({ queryKey: ["merchant-fee-overrides", selectedMerchantId] });
    }
  };

  const selectedMerchant = merchants?.find((m: any) => m.id === selectedMerchantId);

  // For each channel, show platform default vs merchant override
  const channelData = GATEWAY_CHANNELS.map((ch) => {
    const platformRate = platformDefaults?.find((p: any) => p.transaction_type === ch.value);
    const merchantOverride = overrides?.find((o: any) => o.transaction_type === ch.value);
    return {
      ...ch,
      platformRate: platformRate ? `${platformRate.percentage_rate}% + ${Number(platformRate.fixed_amount).toLocaleString()} XAF` : "—",
      merchantRate: merchantOverride ? `${merchantOverride.percentage_rate}% + ${Number(merchantOverride.fixed_amount).toLocaleString()} XAF` : null,
      overrideId: merchantOverride?.id,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-base font-bold">Merchant Fee Overrides</h3>
          <p className="text-xs text-muted-foreground">
            Set per-merchant gateway fee rates. Overrides take priority over platform defaults.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedMerchantId} onValueChange={setSelectedMerchantId}>
            <SelectTrigger className="w-[260px] h-9 text-sm">
              <SelectValue placeholder="Select a merchant" />
            </SelectTrigger>
            <SelectContent>
              {merchants?.map((m: any) => (
                <SelectItem key={m.id} value={m.id}>
                  <div className="flex items-center gap-2">
                    <Store className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{m.business_name}</span>
                    <Badge variant={m.status === "ACTIVE" ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                      {m.status}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!selectedMerchantId ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Store className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">Select a merchant to view and configure fee overrides</p>
          </CardContent>
        </Card>
      ) : loadingOverrides ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              Fee configuration for <span className="text-primary">{selectedMerchant?.business_name}</span>
            </p>
            <Button size="sm" onClick={() => setShowAddDialog(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Override
            </Button>
          </div>

          <div className="grid gap-3">
            <AnimatePresence>
              {channelData.map((ch, idx) => (
                <motion.div
                  key={ch.value}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                >
                  <Card className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{ch.icon}</span>
                          <div>
                            <p className="text-sm font-semibold">{ch.label}</p>
                            <p className="text-xs text-muted-foreground">
                              Platform default: <span className="font-mono">{ch.platformRate}</span>
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {ch.merchantRate ? (
                            <>
                              <div className="text-right">
                                <Badge variant="outline" className="text-xs bg-primary/5 border-primary/30 text-primary">
                                  Override: {ch.merchantRate}
                                </Badge>
                              </div>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => ch.overrideId && handleDeleteOverride(ch.overrideId)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">Using default</Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </>
      )}

      {/* Add Override Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Fee Override</DialogTitle>
            <DialogDescription>
              Set a custom fee rate for {selectedMerchant?.business_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Transaction Type</Label>
              <Select value={newOverride.transaction_type} onValueChange={(v) => setNewOverride({ ...newOverride, transaction_type: v })}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Select channel" /></SelectTrigger>
                <SelectContent>
                  {GATEWAY_CHANNELS.filter((ch) => !overrides?.some((o: any) => o.transaction_type === ch.value)).map((ch) => (
                    <SelectItem key={ch.value} value={ch.value}>
                      <span className="flex items-center gap-2">
                        <span>{ch.icon}</span> {ch.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Percentage Rate (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={newOverride.percentage_rate}
                  onChange={(e) => setNewOverride({ ...newOverride, percentage_rate: Number(e.target.value) })}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Fixed Amount (XAF)</Label>
                <Input
                  type="number"
                  min={0}
                  value={newOverride.fixed_amount}
                  onChange={(e) => setNewOverride({ ...newOverride, fixed_amount: Number(e.target.value) })}
                  className="h-11"
                />
              </div>
            </div>
            <Button onClick={handleAddOverride} disabled={saving || !newOverride.transaction_type} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              {saving ? "Saving…" : "Create Override"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
