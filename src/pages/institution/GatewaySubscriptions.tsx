import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { RefreshCw, CreditCard, Users, Activity, CalendarClock } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const } }),
};

export default function GatewaySubscriptions() {
  const { data: plans, isLoading: plansLoading, refetch: refetchPlans } = useQuery({
    queryKey: ["gateway-payment-plans"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase
        .from("gateway_payment_plans")
        .select("*, gateway_merchants!inner(user_id, business_name)")
        .order("created_at", { ascending: false });
      return (data || []).filter((p: any) => p.gateway_merchants?.user_id === user.id);
    },
  });

  const { data: subscriptions, isLoading: subsLoading, refetch: refetchSubs } = useQuery({
    queryKey: ["gateway-subscriptions"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase
        .from("gateway_subscriptions")
        .select("*, gateway_payment_plans(name, amount, currency, interval), gateway_merchants!inner(user_id, business_name)")
        .order("created_at", { ascending: false });
      return (data || []).filter((s: any) => s.gateway_merchants?.user_id === user.id);
    },
  });

  const activePlans = (plans || []).filter((p: any) => p.status === 'active').length;
  const activeSubs = (subscriptions || []).filter((s: any) => s.status === 'active').length;
  const isLoading = plansLoading || subsLoading;

  const refetchAll = () => { refetchPlans(); refetchSubs(); };

  return (
    <motion.div className="space-y-6" initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.04 } } }}>
      {/* Header */}
      <motion.div custom={0} variants={fadeUp} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
            <RefreshCw className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Subscriptions & Plans</h1>
            <p className="text-xs text-muted-foreground">Manage recurring billing plans and subscribers</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={refetchAll} disabled={isLoading}><RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />Refresh</Button>
      </motion.div>

      {/* Stats */}
      <motion.div custom={1} variants={fadeUp} className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Plans" value={plansLoading ? "..." : (plans || []).length} icon={<CreditCard className="h-4 w-4" />} />
        <StatCard title="Active Plans" value={plansLoading ? "..." : activePlans} icon={<Activity className="h-4 w-4" />} />
        <StatCard title="Total Subscriptions" value={subsLoading ? "..." : (subscriptions || []).length} icon={<Users className="h-4 w-4" />} />
        <StatCard title="Active Subscribers" value={subsLoading ? "..." : activeSubs} icon={<CalendarClock className="h-4 w-4" />} />
      </motion.div>

      {/* Tabs */}
      <motion.div custom={2} variants={fadeUp}>
        <Tabs defaultValue="plans" className="space-y-4">
          <TabsList className="inline-flex h-9 items-center rounded-lg bg-muted p-1">
            <TabsTrigger value="plans" className="rounded-md px-3 text-xs font-medium">Payment Plans ({(plans || []).length})</TabsTrigger>
            <TabsTrigger value="subscriptions" className="rounded-md px-3 text-xs font-medium">Subscriptions ({(subscriptions || []).length})</TabsTrigger>
          </TabsList>

          <TabsContent value="plans">
            <Card className="border-border/60">
              <CardContent className="p-0">
                {plansLoading ? (
                  <div className="space-y-3 p-6">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
                ) : (plans || []).length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p className="text-sm font-medium">No payment plans</p>
                    <p className="text-xs mt-1">Create plans via the API to enable recurring billing</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent border-border/40">
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Name</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Amount</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Interval</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Duration</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(plans || []).map((plan: any) => (
                        <TableRow key={plan.id} className="hover:bg-muted/40 transition-colors">
                          <TableCell className="font-medium text-sm">{plan.name}</TableCell>
                          <TableCell className="text-sm font-semibold text-right tabular-nums">{plan.amount?.toLocaleString()} {plan.currency}</TableCell>
                          <TableCell><Badge variant="outline" className="text-[10px] font-medium capitalize">{plan.interval}</Badge></TableCell>
                          <TableCell className="text-sm">{plan.duration ? `${plan.duration} cycles` : "Unlimited"}</TableCell>
                          <TableCell>
                            <Badge variant={plan.status === "active" ? "default" : "secondary"} className="text-[10px]">
                              <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1.5 ${plan.status === 'active' ? 'bg-emerald-400' : 'bg-muted-foreground/50'}`} />
                              {plan.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{format(new Date(plan.created_at), 'PP')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="subscriptions">
            <Card className="border-border/60">
              <CardContent className="p-0">
                {subsLoading ? (
                  <div className="space-y-3 p-6">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
                ) : (subscriptions || []).length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p className="text-sm font-medium">No subscriptions</p>
                    <p className="text-xs mt-1">Subscriptions will appear when customers subscribe to plans</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent border-border/40">
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Customer</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Plan</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Amount</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Next Charge</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(subscriptions || []).map((sub: any) => (
                        <TableRow key={sub.id} className="hover:bg-muted/40 transition-colors">
                          <TableCell className="text-sm">{sub.customer_email}</TableCell>
                          <TableCell className="font-medium text-sm">{sub.gateway_payment_plans?.name}</TableCell>
                          <TableCell className="text-sm font-semibold text-right tabular-nums">{sub.gateway_payment_plans?.amount?.toLocaleString()} {sub.gateway_payment_plans?.currency}</TableCell>
                          <TableCell>
                            <Badge variant={sub.status === "active" ? "default" : sub.status === "cancelled" ? "destructive" : "secondary"} className="text-[10px]">
                              <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1.5 ${sub.status === 'active' ? 'bg-emerald-400' : sub.status === 'cancelled' ? 'bg-destructive' : 'bg-muted-foreground/50'}`} />
                              {sub.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{sub.next_charge_date ? format(new Date(sub.next_charge_date), 'PP') : "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{format(new Date(sub.created_at), 'PP')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </motion.div>
  );
}
