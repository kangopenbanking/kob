import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { Clock, Calendar, TrendingUp, Plus, Trash2, ChevronDown, Zap, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AutoCashOutRulesProps {
  userId: string;
  linkedAccounts: any[];
  ownerType?: "consumer" | "merchant";
  ownerId?: string;
}

export function AutoCashOutRules({ userId, linkedAccounts, ownerType = "consumer", ownerId }: AutoCashOutRulesProps) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const effectiveOwnerId = ownerId || userId;

  // Form state
  const [scheduleType, setScheduleType] = useState("daily");
  const [amountMode, setAmountMode] = useState("sweep_all");
  const [amountValue, setAmountValue] = useState("");
  const [minBalance, setMinBalance] = useState("0");
  const [destinationId, setDestinationId] = useState("");
  const [hour, setHour] = useState("18");

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["auto-withdraw-rules", effectiveOwnerId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("gateway-auto-withdrawal-rules", {
        method: "GET",
        body: undefined,
        headers: { "Content-Type": "application/json" },
      });
      // GET with query params — use body workaround
      const { data: result, error: fetchError } = await (supabase as any)
        .from("payout_schedules")
        .select("*")
        .eq("owner_id", effectiveOwnerId)
        .eq("owner_type", ownerType)
        .order("created_at", { ascending: false });
      if (fetchError) throw fetchError;
      return result || [];
    },
    enabled: !!effectiveOwnerId,
  });

  const createRule = useMutation({
    mutationFn: async () => {
      if (!destinationId) throw new Error("Select a destination account");

      const scheduleConfig: any = { hour: parseInt(hour), minute: 0 };
      if (scheduleType === "threshold") {
        scheduleConfig.threshold_amount = parseFloat(amountValue) || 100000;
      }

      const { data, error } = await supabase.functions.invoke("gateway-auto-withdrawal-rules", {
        body: {
          owner_type: ownerType,
          owner_id: effectiveOwnerId,
          destination_id: destinationId,
          destination_type: ownerType,
          schedule_type: scheduleType,
          schedule_config: scheduleConfig,
          amount_mode: amountMode,
          amount_value: parseFloat(amountValue) || 0,
          min_balance_to_keep: parseFloat(minBalance) || 0,
          currency: "XAF",
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.message || data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auto-withdraw-rules", effectiveOwnerId] });
      toast.success("Auto cash-out rule created!");
      setShowCreate(false);
      resetForm();
    },
    onError: (e: any) => toast.error(e.message || "Failed to create rule"),
  });

  const deleteRule = useMutation({
    mutationFn: async (ruleId: string) => {
      const { data, error } = await supabase.functions.invoke("gateway-auto-withdrawal-rules", {
        body: { id: ruleId },
        method: "DELETE",
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.message || data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auto-withdraw-rules", effectiveOwnerId] });
      toast.success("Rule disabled");
    },
    onError: (e: any) => toast.error(e.message || "Failed to disable rule"),
  });

  const toggleRule = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { data, error } = await supabase.functions.invoke("gateway-auto-withdrawal-rules", {
        body: { id, is_enabled: enabled },
        method: "PUT",
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.message || data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auto-withdraw-rules", effectiveOwnerId] });
    },
    onError: (e: any) => toast.error(e.message || "Failed to update rule"),
  });

  const resetForm = () => {
    setScheduleType("daily");
    setAmountMode("sweep_all");
    setAmountValue("");
    setMinBalance("0");
    setDestinationId("");
    setHour("18");
  };

  const scheduleLabels: Record<string, { label: string; icon: any; desc: string }> = {
    daily: { label: "Daily", icon: Clock, desc: "Withdraw every day at a set time" },
    weekly: { label: "Weekly", icon: Calendar, desc: "Withdraw once per week" },
    monthly: { label: "Monthly", icon: Calendar, desc: "Withdraw once per month" },
    threshold: { label: "When balance reaches", icon: TrendingUp, desc: "Withdraw when balance exceeds a threshold" },
  };

  const activeRules = rules.filter((r: any) => r.is_enabled);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center justify-between rounded-2xl border border-border/50 bg-card p-4 text-left hover:bg-muted/30 transition-colors">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Zap className="h-5 w-5 text-primary" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Auto Cash Out</p>
              <p className="text-[11px] text-muted-foreground">
                {activeRules.length > 0 ? `${activeRules.length} active rule${activeRules.length > 1 ? "s" : ""}` : "Set up automatic withdrawals"}
              </p>
            </div>
          </div>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-3 space-y-3">
        {/* Existing Rules */}
        {isLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : rules.length > 0 ? (
          <div className="space-y-2">
            {rules.map((rule: any) => {
              const cfg = scheduleLabels[rule.schedule_type] || scheduleLabels.daily;
              const Icon = cfg.icon;
              return (
                <div key={rule.id} className="flex items-center gap-3 rounded-xl border border-border/40 bg-card p-3">
                  <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground">{cfg.label}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {rule.amount_mode === "sweep_all" ? "Sweep all" : rule.amount_mode === "fixed" ? `${rule.amount_value?.toLocaleString()} XAF` : `${rule.amount_value}%`}
                      {rule.min_balance_to_keep > 0 && ` · Keep ${rule.min_balance_to_keep.toLocaleString()}`}
                    </p>
                    {rule.consecutive_failures >= 2 && (
                      <p className="text-[10px] text-destructive mt-0.5">{rule.consecutive_failures} failures</p>
                    )}
                  </div>
                  <Switch
                    checked={rule.is_enabled}
                    onCheckedChange={(checked) => toggleRule.mutate({ id: rule.id, enabled: checked })}
                    className="shrink-0"
                  />
                  <button
                    onClick={() => deleteRule.mutate(rule.id)}
                    className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : null}

        {/* Create New Rule */}
        {showCreate ? (
          <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
            <p className="text-sm font-bold text-foreground">New Auto Cash Out Rule</p>

            {/* Schedule Type */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Schedule</Label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(scheduleLabels).map(([key, cfg]) => {
                  const Icon = cfg.icon;
                  return (
                    <button
                      key={key}
                      onClick={() => setScheduleType(key)}
                      className={cn(
                        "flex items-center gap-2 rounded-xl border p-3 text-left transition-all text-xs",
                        scheduleType === key ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border/40 hover:border-primary/30"
                      )}
                    >
                      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="font-semibold">{cfg.label}</p>
                        <p className="text-[10px] text-muted-foreground">{cfg.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time (for non-threshold) */}
            {scheduleType !== "threshold" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Time (UTC hour)</Label>
                <Select value={hour} onValueChange={setHour}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => (
                      <SelectItem key={i} value={String(i)}>{String(i).padStart(2, "0")}:00</SelectItem>
                    ))}</SelectContent>
                </Select>
              </div>
            )}

            {/* Amount Mode */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Amount</Label>
              <Select value={amountMode} onValueChange={setAmountMode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sweep_all">Sweep entire balance</SelectItem>
                  <SelectItem value="fixed">Fixed amount</SelectItem>
                  <SelectItem value="percentage">Percentage of balance</SelectItem>
                </SelectContent>
              </Select>
              {(amountMode === "fixed" || amountMode === "percentage" || scheduleType === "threshold") && (
                <Input
                  type="number"
                  placeholder={amountMode === "percentage" ? "e.g. 80" : scheduleType === "threshold" ? "Threshold amount" : "Amount in XAF"}
                  value={amountValue}
                  onChange={(e) => setAmountValue(e.target.value)}
                  className="mt-2"
                />
              )}
            </div>

            {/* Min balance to keep */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Minimum balance to keep (XAF)</Label>
              <Input
                type="number"
                placeholder="0"
                value={minBalance}
                onChange={(e) => setMinBalance(e.target.value)}
              />
            </div>

            {/* Destination */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Destination</Label>
              {linkedAccounts.length === 0 ? (
                <p className="text-xs text-muted-foreground">No linked accounts available. Link an account first.</p>
              ) : (
                <Select value={destinationId} onValueChange={setDestinationId}>
                  <SelectTrigger><SelectValue placeholder="Select destination" /></SelectTrigger>
                  <SelectContent>
                    {linkedAccounts.map((acc: any) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.account_name || acc.bank_name || acc.account_type} {acc.last4 ? `•••• ${acc.last4}` : ""}
                      </SelectItem>
                    ))}</SelectContent>
                </Select>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={() => setShowCreate(false)} variant="outline" className="flex-1 rounded-xl">
                Cancel
              </Button>
              <Button
                onClick={() => createRule.mutate()}
                disabled={createRule.isPending || !destinationId}
                className="flex-1 rounded-xl"
              >
                {createRule.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Create Rule
              </Button>
            </div>
          </div>
        ) : (
          <Button
            onClick={() => setShowCreate(true)}
            variant="outline"
            disabled={rules.filter((r: any) => r.is_enabled).length >= 3}
            className="w-full rounded-xl"
          >
            <Plus className="h-4 w-4 mr-1" />
            {rules.filter((r: any) => r.is_enabled).length >= 3 ? "Max 3 active rules" : "Add Auto Cash Out Rule"}
          </Button>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
