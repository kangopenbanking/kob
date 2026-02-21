import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, Users, Clock, FileText } from "lucide-react";
import { format } from "date-fns";

export default function InstitutionBeneficiaries() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [beneficiaries, setBeneficiaries] = useState<any[]>([]);
  const [standingOrders, setStandingOrders] = useState<any[]>([]);
  const [directDebits, setDirectDebits] = useState<any[]>([]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth'); return; }
      const { data: institution } = await supabase.from("institutions").select("id").eq("user_id", user.id).maybeSingle();
      if (!institution) { navigate('/register'); return; }
      const { data: accounts } = await supabase.from("accounts").select("id").eq("institution_id", institution.id);
      const accountIds = (accounts || []).map(a => a.id);
      if (accountIds.length > 0) {
        const { data: bens } = await supabase.from("beneficiaries").select("*").in("account_id", accountIds).order("created_at", { ascending: false });
        setBeneficiaries(bens || []);
        const { data: sos } = await supabase.from("standing_orders").select("*").in("account_id", accountIds).order("created_at", { ascending: false });
        setStandingOrders(sos || []);
        const { data: dds } = await supabase.from("direct_debits").select("*").in("account_id", accountIds).order("created_at", { ascending: false });
        setDirectDebits(dds || []);
      }
    } catch (error) { console.error("Error loading beneficiaries:", error); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-muted"><Users className="h-5 w-5 text-muted-foreground" /></div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Beneficiaries & Payments</h1>
            <p className="text-xs text-muted-foreground">Beneficiaries, standing orders, and direct debits</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}><RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Beneficiaries", value: beneficiaries.length, icon: Users },
          { label: "Standing Orders", value: standingOrders.length, icon: Clock },
          { label: "Direct Debits", value: directDebits.length, icon: FileText },
        ].map(s => (
          <Card key={s.label} className="border-border/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-muted"><s.icon className="h-3.5 w-3.5 text-muted-foreground" /></div>
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : s.value}</div></CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="beneficiaries" className="space-y-4">
        <TabsList className="inline-flex h-9 items-center rounded-lg bg-muted p-1">
          <TabsTrigger value="beneficiaries" className="rounded-md px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">Beneficiaries</TabsTrigger>
          <TabsTrigger value="standing-orders" className="rounded-md px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">Standing Orders</TabsTrigger>
          <TabsTrigger value="direct-debits" className="rounded-md px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">Direct Debits</TabsTrigger>
        </TabsList>

        <TabsContent value="beneficiaries"><Card className="border-border/60"><CardHeader><CardTitle className="text-sm font-semibold">Registered Beneficiaries</CardTitle></CardHeader><CardContent>
          {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : beneficiaries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><Users className="h-10 w-10 mx-auto mb-3 opacity-30" /><p className="text-sm">No beneficiaries</p></div>
          ) : (
            <Table><TableHeader><TableRow className="hover:bg-transparent"><TableHead className="text-xs">Name</TableHead><TableHead className="text-xs">Scheme</TableHead><TableHead className="text-xs">Identification</TableHead><TableHead className="text-xs">Reference</TableHead><TableHead className="text-xs">Status</TableHead><TableHead className="text-xs">Created</TableHead></TableRow></TableHeader>
              <TableBody>{beneficiaries.map(b => (<TableRow key={b.id}><TableCell className="font-medium text-sm">{b.beneficiary_name}</TableCell><TableCell className="text-sm">{b.identification_scheme}</TableCell><TableCell className="font-mono text-xs text-muted-foreground">{b.identification_value}</TableCell><TableCell className="text-sm">{b.reference || '--'}</TableCell><TableCell><Badge variant={b.is_active ? "default" : "secondary"} className="text-[10px]">{b.is_active ? "Active" : "Inactive"}</Badge></TableCell><TableCell className="text-xs text-muted-foreground">{b.created_at ? format(new Date(b.created_at), 'PP') : '--'}</TableCell></TableRow>))}</TableBody></Table>
          )}
        </CardContent></Card></TabsContent>

        <TabsContent value="standing-orders"><Card className="border-border/60"><CardHeader><CardTitle className="text-sm font-semibold">Standing Orders</CardTitle></CardHeader><CardContent>
          {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : standingOrders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><Clock className="h-10 w-10 mx-auto mb-3 opacity-30" /><p className="text-sm">No standing orders</p></div>
          ) : (
            <Table><TableHeader><TableRow className="hover:bg-transparent"><TableHead className="text-xs">Creditor</TableHead><TableHead className="text-xs">Frequency</TableHead><TableHead className="text-xs">Amount</TableHead><TableHead className="text-xs">Next Payment</TableHead><TableHead className="text-xs">Status</TableHead></TableRow></TableHeader>
              <TableBody>{standingOrders.map(so => (<TableRow key={so.id}><TableCell className="font-medium text-sm">{so.creditor_name}</TableCell><TableCell className="text-sm">{so.frequency}</TableCell><TableCell className="text-sm">{Number(so.first_payment_amount).toLocaleString()} {so.currency}</TableCell><TableCell className="text-xs text-muted-foreground">{so.next_payment_date ? format(new Date(so.next_payment_date), 'PP') : '--'}</TableCell><TableCell><Badge variant={so.status === 'Active' ? "default" : "secondary"} className="text-[10px]">{so.status}</Badge></TableCell></TableRow>))}</TableBody></Table>
          )}
        </CardContent></Card></TabsContent>

        <TabsContent value="direct-debits"><Card className="border-border/60"><CardHeader><CardTitle className="text-sm font-semibold">Direct Debits</CardTitle></CardHeader><CardContent>
          {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : directDebits.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><FileText className="h-10 w-10 mx-auto mb-3 opacity-30" /><p className="text-sm">No direct debits</p></div>
          ) : (
            <Table><TableHeader><TableRow className="hover:bg-transparent"><TableHead className="text-xs">Name</TableHead><TableHead className="text-xs">Mandate ID</TableHead><TableHead className="text-xs">Last Amount</TableHead><TableHead className="text-xs">Last Payment</TableHead><TableHead className="text-xs">Status</TableHead></TableRow></TableHeader>
              <TableBody>{directDebits.map(dd => (<TableRow key={dd.id}><TableCell className="font-medium text-sm">{dd.name}</TableCell><TableCell className="font-mono text-xs text-muted-foreground">{dd.mandate_identification}</TableCell><TableCell className="text-sm">{dd.previous_payment_amount ? `${Number(dd.previous_payment_amount).toLocaleString()} ${dd.currency}` : '--'}</TableCell><TableCell className="text-xs text-muted-foreground">{dd.previous_payment_date ? format(new Date(dd.previous_payment_date), 'PP') : '--'}</TableCell><TableCell><Badge variant={dd.direct_debit_status === 'Active' ? "default" : "secondary"} className="text-[10px]">{dd.direct_debit_status}</Badge></TableCell></TableRow>))}</TableBody></Table>
          )}
        </CardContent></Card></TabsContent>
      </Tabs>
    </div>
  );
}
