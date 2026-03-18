import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Pause, Clock, Calendar, TrendingUp, AlertTriangle, Layers, Activity } from "lucide-react";

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
    daily: Clock,
    weekly: Calendar,
    monthly: Calendar,
    threshold: TrendingUp,
  };

  const activeCount = rules.filter((r: any) => r.is_enabled).length;
  const failingCount = rules.filter((r: any) => r.consecutive_failures >= 2).length;

  const statCards = [
    { label: "Total Rules", value: rules.length, icon: Layers, color: "bg-primary/10 text-primary" },
    { label: "Active", value: activeCount, icon: Activity, color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" },
    { label: "Failing", value: failingCount, icon: AlertTriangle, color: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400" },
  ];

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-12 rounded-lg bg-muted/40 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Mini stats */}
      <div className="grid grid-cols-3 gap-3">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="flex items-center gap-3 rounded-xl border border-border/40 bg-card p-3">
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${stat.color}`}>
                <Icon className="h-4 w-4" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                <p className="text-xl font-bold text-foreground tabular-nums">{stat.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {rules.length === 0 ? (
        <div className="text-center py-16">
          <div className="h-12 w-12 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto mb-3">
            <Clock className="h-6 w-6 text-muted-foreground/50" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">No auto-withdrawal rules configured</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Rules created by users and merchants will appear here</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/30">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                {["Owner", "Type", "Schedule", "Amount Mode", "Min Balance", "Next Run", "Last Run", "Failures", "Status", "Actions"].map((h) => (
                  <TableHead key={h} className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule: any, index: number) => {
                const Icon = scheduleIcons[rule.schedule_type] || Clock;
                return (
                  <motion.tr
                    key={rule.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.02 }}
                    className={`border-b border-border/20 transition-colors hover:bg-muted/20 ${rule.consecutive_failures >= 3 ? "bg-red-50/50 dark:bg-red-950/10" : ""}`}
                  >
                    <TableCell className="py-3">
                      <span className="inline-flex items-center rounded-md border border-border/60 bg-muted/30 px-1.5 py-0.5 text-[10px] font-semibold text-foreground">{rule.owner_type}</span>
                      <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{rule.owner_id?.slice(0, 8)}…</p>
                    </TableCell>
                    <TableCell className="py-3">
                      <span className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/30 px-1.5 py-0.5 text-[10px] font-semibold">
                        <Icon className="h-3 w-3" />{rule.schedule_type}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground py-3">
                      {rule.schedule_type === "daily" && `At ${rule.schedule_config?.hour ?? 18}:${String(rule.schedule_config?.minute ?? 0).padStart(2, "0")} UTC`}
                      {rule.schedule_type === "weekly" && `Day ${rule.schedule_config?.day_of_week ?? 5}`}
                      {rule.schedule_type === "monthly" && `Day ${rule.schedule_config?.day_of_month ?? 1}`}
                      {rule.schedule_type === "threshold" && `≥ ${rule.schedule_config?.threshold_amount?.toLocaleString() || "—"}`}
                    </TableCell>
                    <TableCell className="py-3">
                      <span className="inline-flex items-center rounded-md border border-border/60 bg-muted/30 px-1.5 py-0.5 text-[10px] font-semibold">{rule.amount_mode}</span>
                      {rule.amount_mode === "fixed" && <span className="text-[11px] ml-1 text-muted-foreground">({rule.amount_value?.toLocaleString()})</span>}
                      {rule.amount_mode === "percentage" && <span className="text-[11px] ml-1 text-muted-foreground">({rule.amount_value}%)</span>}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums py-3">{rule.min_balance_to_keep?.toLocaleString() || 0} {rule.currency}</TableCell>
                    <TableCell className="text-[11px] font-mono text-muted-foreground py-3">
                      {rule.next_run_at ? format(new Date(rule.next_run_at), "MMM dd, HH:mm") : "—"}
                    </TableCell>
                    <TableCell className="text-[11px] font-mono text-muted-foreground py-3">
                      {rule.last_run_at ? format(new Date(rule.last_run_at), "MMM dd, HH:mm") : "Never"}
                    </TableCell>
                    <TableCell className="py-3">
                      {rule.consecutive_failures > 0 ? (
                        <span className="inline-flex items-center rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800">
                          {rule.consecutive_failures}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="py-3">
                      {rule.is_enabled ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">Active</span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-gray-50 border border-gray-200 px-2 py-0.5 text-[10px] font-semibold text-gray-500 dark:bg-gray-900/40 dark:text-gray-400">Disabled</span>
                      )}
                    </TableCell>
                    <TableCell className="py-3">
                      {rule.is_enabled && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => disableRule.mutate(rule.id)}
                          disabled={disableRule.isPending}
                          className="h-7 px-2 text-[10px] rounded-lg gap-1"
                        >
                          <Pause className="h-3 w-3" />Disable
                        </Button>
                      )}
                    </TableCell>
                  </motion.tr>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
