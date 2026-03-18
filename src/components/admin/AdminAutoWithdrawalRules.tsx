import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format } from "date-fns";
import { Pause, Clock, Calendar, TrendingUp, AlertTriangle } from "lucide-react";

export function AdminAutoWithdrawalRules() {
  const queryClient = useQueryClient();

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["admin-payout-schedules"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("payout_schedules")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  const disableRule = useMutation({
    mutationFn: async (ruleId: string) => {
      const { error } = await (supabase as any)
        .from("payout_schedules")
        .update({ is_enabled: false })
        .eq("id", ruleId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-payout-schedules"] });
      toast.success("Rule disabled");
    },
    onError: (e: any) => toast.error(e.message || "Failed to disable rule"),
  });

  const scheduleIcons: Record<string, any> = {
    daily: <Clock className="h-3 w-3" />,
    weekly: <Calendar className="h-3 w-3" />,
    monthly: <Calendar className="h-3 w-3" />,
    threshold: <TrendingUp className="h-3 w-3" />,
  };

  const activeCount = rules.filter((r: any) => r.is_enabled).length;
  const failingCount = rules.filter((r: any) => r.consecutive_failures >= 2).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-sm">
        <span className="text-muted-foreground">Total rules: <strong>{rules.length}</strong></span>
        <span className="text-muted-foreground">Active: <strong className="text-emerald-600">{activeCount}</strong></span>
        {failingCount > 0 && (
          <span className="flex items-center gap-1 text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" />{failingCount} failing
          </span>
        )}
      </div>

      {isLoading ? (
        <p className="text-center py-8 text-muted-foreground">Loading rules...</p>
      ) : rules.length === 0 ? (
        <p className="text-center py-8 text-muted-foreground">No auto-withdrawal rules configured</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Owner</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Amount Mode</TableHead>
                <TableHead>Min Balance</TableHead>
                <TableHead>Next Run</TableHead>
                <TableHead>Last Run</TableHead>
                <TableHead>Failures</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule: any) => (
                <TableRow key={rule.id} className={rule.consecutive_failures >= 3 ? "bg-destructive/5" : ""}>
                  <TableCell>
                    <div>
                      <Badge variant="outline" className="text-[10px]">{rule.owner_type}</Badge>
                      <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{rule.owner_id?.slice(0, 8)}…</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      {scheduleIcons[rule.schedule_type]}{rule.schedule_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {rule.schedule_type === "daily" && `At ${rule.schedule_config?.hour ?? 18}:${String(rule.schedule_config?.minute ?? 0).padStart(2, "0")} UTC`}
                    {rule.schedule_type === "weekly" && `Day ${rule.schedule_config?.day_of_week ?? 5}`}
                    {rule.schedule_type === "monthly" && `Day ${rule.schedule_config?.day_of_month ?? 1}`}
                    {rule.schedule_type === "threshold" && `≥ ${rule.schedule_config?.threshold_amount?.toLocaleString() || "—"}`}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">{rule.amount_mode}</Badge>
                    {rule.amount_mode === "fixed" && <span className="text-xs ml-1">({rule.amount_value?.toLocaleString()})</span>}
                    {rule.amount_mode === "percentage" && <span className="text-xs ml-1">({rule.amount_value}%)</span>}
                  </TableCell>
                  <TableCell className="text-xs">{rule.min_balance_to_keep?.toLocaleString() || 0} {rule.currency}</TableCell>
                  <TableCell className="text-xs font-mono">
                    {rule.next_run_at ? format(new Date(rule.next_run_at), "MMM dd, HH:mm") : "—"}
                  </TableCell>
                  <TableCell className="text-xs font-mono">
                    {rule.last_run_at ? format(new Date(rule.last_run_at), "MMM dd, HH:mm") : "Never"}
                  </TableCell>
                  <TableCell>
                    {rule.consecutive_failures > 0 ? (
                      <Badge variant="destructive" className="text-[10px]">{rule.consecutive_failures}</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={rule.is_enabled ? "default" : "secondary"} className="text-[10px]">
                      {rule.is_enabled ? "Active" : "Disabled"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {rule.is_enabled && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => disableRule.mutate(rule.id)}
                        disabled={disableRule.isPending}
                        title="Disable this rule"
                      >
                        <Pause className="h-3 w-3 mr-1" />Disable
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
