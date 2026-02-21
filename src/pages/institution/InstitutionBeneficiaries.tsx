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
      const { data: institution } = await supabase
        .from("institutions").select("id").eq("user_id", user.id).maybeSingle();
      if (!institution) { navigate('/register'); return; }

      const { data: accounts } = await supabase
        .from("accounts").select("id").eq("institution_id", institution.id);
      const accountIds = (accounts || []).map(a => a.id);

      if (accountIds.length > 0) {
        const { data: bens } = await supabase
          .from("beneficiaries").select("*").in("account_id", accountIds).order("created_at", { ascending: false });
        setBeneficiaries(bens || []);

        const { data: sos } = await supabase
          .from("standing_orders").select("*").in("account_id", accountIds).order("created_at", { ascending: false });
        setStandingOrders(sos || []);

        const { data: dds } = await supabase
          .from("direct_debits").select("*").in("account_id", accountIds).order("created_at", { ascending: false });
        setDirectDebits(dds || []);
      }
    } catch (error) {
      console.error("Error loading beneficiaries:", error);
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Beneficiaries & Payments</h1>
          <p className="text-muted-foreground">Beneficiaries, standing orders, and direct debits</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Beneficiaries</CardTitle><Users className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : beneficiaries.length}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Standing Orders</CardTitle><Clock className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : standingOrders.length}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Direct Debits</CardTitle><FileText className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : directDebits.length}</div></CardContent></Card>
      </div>

      <Tabs defaultValue="beneficiaries" className="space-y-4">
        <TabsList>
          <TabsTrigger value="beneficiaries">Beneficiaries</TabsTrigger>
          <TabsTrigger value="standing-orders">Standing Orders</TabsTrigger>
          <TabsTrigger value="direct-debits">Direct Debits</TabsTrigger>
        </TabsList>

        <TabsContent value="beneficiaries">
          <Card><CardHeader><CardTitle>Registered Beneficiaries</CardTitle></CardHeader><CardContent>
            {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : beneficiaries.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground"><Users className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No beneficiaries</p></div>
            ) : (
              <Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Scheme</TableHead><TableHead>Identification</TableHead><TableHead>Reference</TableHead><TableHead>Status</TableHead><TableHead>Created</TableHead></TableRow></TableHeader>
                <TableBody>{beneficiaries.map(b => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.beneficiary_name}</TableCell>
                    <TableCell>{b.identification_scheme}</TableCell>
                    <TableCell className="font-mono text-xs">{b.identification_value}</TableCell>
                    <TableCell>{b.reference || '—'}</TableCell>
                    <TableCell><Badge variant={b.is_active ? "default" : "secondary"}>{b.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                    <TableCell>{b.created_at ? format(new Date(b.created_at), 'PP') : '—'}</TableCell>
                  </TableRow>
                ))}</TableBody></Table>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="standing-orders">
          <Card><CardHeader><CardTitle>Standing Orders</CardTitle></CardHeader><CardContent>
            {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : standingOrders.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground"><Clock className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No standing orders</p></div>
            ) : (
              <Table><TableHeader><TableRow><TableHead>Creditor</TableHead><TableHead>Frequency</TableHead><TableHead>Amount</TableHead><TableHead>Next Payment</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>{standingOrders.map(so => (
                  <TableRow key={so.id}>
                    <TableCell className="font-medium">{so.creditor_name}</TableCell>
                    <TableCell>{so.frequency}</TableCell>
                    <TableCell>{Number(so.first_payment_amount).toLocaleString()} {so.currency}</TableCell>
                    <TableCell>{so.next_payment_date ? format(new Date(so.next_payment_date), 'PP') : '—'}</TableCell>
                    <TableCell><Badge variant={so.status === 'Active' ? "default" : "secondary"}>{so.status}</Badge></TableCell>
                  </TableRow>
                ))}</TableBody></Table>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="direct-debits">
          <Card><CardHeader><CardTitle>Direct Debits</CardTitle></CardHeader><CardContent>
            {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : directDebits.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground"><FileText className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No direct debits</p></div>
            ) : (
              <Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Mandate ID</TableHead><TableHead>Last Amount</TableHead><TableHead>Last Payment</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>{directDebits.map(dd => (
                  <TableRow key={dd.id}>
                    <TableCell className="font-medium">{dd.name}</TableCell>
                    <TableCell className="font-mono text-xs">{dd.mandate_identification}</TableCell>
                    <TableCell>{dd.previous_payment_amount ? `${Number(dd.previous_payment_amount).toLocaleString()} ${dd.currency}` : '—'}</TableCell>
                    <TableCell>{dd.previous_payment_date ? format(new Date(dd.previous_payment_date), 'PP') : '—'}</TableCell>
                    <TableCell><Badge variant={dd.direct_debit_status === 'Active' ? "default" : "secondary"}>{dd.direct_debit_status}</Badge></TableCell>
                  </TableRow>
                ))}</TableBody></Table>
            )}
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
