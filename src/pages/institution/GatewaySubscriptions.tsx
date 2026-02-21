import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, CreditCard } from "lucide-react";

export default function GatewaySubscriptions() {
  const [search, setSearch] = useState("");

  const { data: plans, isLoading: plansLoading } = useQuery({
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

  const { data: subscriptions, isLoading: subsLoading } = useQuery({
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Subscriptions & Plans</h1>
        <p className="text-muted-foreground">Manage recurring billing plans and subscribers</p>
      </div>

      <Tabs defaultValue="plans">
        <TabsList>
          <TabsTrigger value="plans">Payment Plans</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
        </TabsList>

        <TabsContent value="plans" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" /> Plans ({(plans || []).length})</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Interval</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plansLoading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                  ) : (plans || []).length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No plans found</TableCell></TableRow>
                  ) : (plans || []).map((plan: any) => (
                    <TableRow key={plan.id}>
                      <TableCell className="font-medium">{plan.name}</TableCell>
                      <TableCell>{plan.amount?.toLocaleString()} {plan.currency}</TableCell>
                      <TableCell className="capitalize">{plan.interval}</TableCell>
                      <TableCell>{plan.duration ? `${plan.duration} cycles` : "∞"}</TableCell>
                      <TableCell><Badge variant={plan.status === "active" ? "default" : "secondary"}>{plan.status}</Badge></TableCell>
                      <TableCell>{new Date(plan.created_at).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subscriptions" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><RefreshCw className="h-5 w-5" /> Subscriptions ({(subscriptions || []).length})</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Next Charge</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subsLoading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                  ) : (subscriptions || []).length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No subscriptions found</TableCell></TableRow>
                  ) : (subscriptions || []).map((sub: any) => (
                    <TableRow key={sub.id}>
                      <TableCell>{sub.customer_email}</TableCell>
                      <TableCell className="font-medium">{sub.gateway_payment_plans?.name}</TableCell>
                      <TableCell>{sub.gateway_payment_plans?.amount?.toLocaleString()} {sub.gateway_payment_plans?.currency}</TableCell>
                      <TableCell><Badge variant={sub.status === "active" ? "default" : sub.status === "cancelled" ? "destructive" : "secondary"}>{sub.status}</Badge></TableCell>
                      <TableCell>{sub.next_charge_date ? new Date(sub.next_charge_date).toLocaleDateString() : "—"}</TableCell>
                      <TableCell>{new Date(sub.created_at).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
