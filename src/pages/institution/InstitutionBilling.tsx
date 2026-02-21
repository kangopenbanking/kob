import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, Receipt, DollarSign, Percent } from "lucide-react";
import { format } from "date-fns";

export default function InstitutionBilling() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [feeStructures, setFeeStructures] = useState<any[]>([]);
  const [feeWaivers, setFeeWaivers] = useState<any[]>([]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth'); return; }
      const { data: institution } = await supabase
        .from("institutions").select("id").eq("user_id", user.id).maybeSingle();
      if (!institution) { navigate('/register'); return; }

      const { data: invs } = await supabase
        .from("institution_invoices").select("*").eq("institution_id", institution.id).order("created_at", { ascending: false });
      setInvoices(invs || []);

      const { data: fees } = await supabase
        .from("fee_structures").select("*").eq("institution_id", institution.id).order("created_at", { ascending: false });
      setFeeStructures(fees || []);

      const { data: waivers } = await supabase
        .from("fee_waivers").select("*").eq("institution_id", institution.id).order("created_at", { ascending: false });
      setFeeWaivers(waivers || []);
    } catch (error) {
      console.error("Error loading billing:", error);
    } finally { setLoading(false); }
  };

  const invoiceStatusColor = (status: string) => {
    const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      paid: "default", pending: "outline", overdue: "destructive", sent: "secondary"
    };
    return map[status] || "outline";
  };

  const totalOutstanding = invoices.filter(i => i.status !== 'paid').reduce((sum, i) => sum + Number(i.total_amount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Billing</h1>
          <p className="text-muted-foreground">Invoices, fee structures, and waivers</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Invoices</CardTitle><Receipt className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : invoices.length}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Outstanding</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : `${totalOutstanding.toLocaleString()} XAF`}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Fee Structures</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : feeStructures.length}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Active Waivers</CardTitle><Percent className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : feeWaivers.filter(w => w.is_active).length}</div></CardContent></Card>
      </div>

      <Tabs defaultValue="invoices" className="space-y-4">
        <TabsList>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="fees">Fee Structures</TabsTrigger>
          <TabsTrigger value="waivers">Waivers</TabsTrigger>
        </TabsList>

        <TabsContent value="invoices">
          <Card><CardHeader><CardTitle>Invoices</CardTitle></CardHeader><CardContent>
            {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : invoices.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground"><Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No invoices</p></div>
            ) : (
              <Table><TableHeader><TableRow><TableHead>Invoice #</TableHead><TableHead>Period</TableHead><TableHead>Transactions</TableHead><TableHead>Amount</TableHead><TableHead>Due Date</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>{invoices.map(inv => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-xs">{inv.invoice_number}</TableCell>
                    <TableCell>{format(new Date(inv.period_start), 'PP')} - {format(new Date(inv.period_end), 'PP')}</TableCell>
                    <TableCell>{inv.total_transactions}</TableCell>
                    <TableCell className="font-medium">{Number(inv.total_amount).toLocaleString()} {inv.currency || 'XAF'}</TableCell>
                    <TableCell>{format(new Date(inv.due_date), 'PP')}</TableCell>
                    <TableCell><Badge variant={invoiceStatusColor(inv.status)}>{inv.status}</Badge></TableCell>
                  </TableRow>
                ))}</TableBody></Table>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="fees">
          <Card><CardHeader><CardTitle>Fee Structures</CardTitle></CardHeader><CardContent>
            {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : feeStructures.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground"><DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No fee structures</p></div>
            ) : (
              <Table><TableHeader><TableRow><TableHead>Transaction Type</TableHead><TableHead>Fee Model</TableHead><TableHead>Fixed</TableHead><TableHead>Percentage</TableHead><TableHead>Effective</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>{feeStructures.map(f => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.transaction_type}</TableCell>
                    <TableCell><Badge variant="outline">{f.fee_model}</Badge></TableCell>
                    <TableCell>{f.fixed_amount ? `${Number(f.fixed_amount).toLocaleString()} XAF` : '—'}</TableCell>
                    <TableCell>{f.percentage_rate ? `${f.percentage_rate}%` : '—'}</TableCell>
                    <TableCell>{format(new Date(f.effective_from), 'PP')}</TableCell>
                    <TableCell><Badge variant={f.is_active ? "default" : "secondary"}>{f.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                  </TableRow>
                ))}</TableBody></Table>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="waivers">
          <Card><CardHeader><CardTitle>Fee Waivers</CardTitle></CardHeader><CardContent>
            {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : feeWaivers.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground"><Percent className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No fee waivers</p></div>
            ) : (
              <Table><TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Reason</TableHead><TableHead>Discount</TableHead><TableHead>Uses</TableHead><TableHead>Valid Until</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>{feeWaivers.map(w => (
                  <TableRow key={w.id}>
                    <TableCell><Badge variant="outline">{w.waiver_type}</Badge></TableCell>
                    <TableCell className="max-w-[200px] truncate">{w.reason}</TableCell>
                    <TableCell>{w.discount_percentage ? `${w.discount_percentage}%` : w.discount_fixed_amount ? `${Number(w.discount_fixed_amount).toLocaleString()} XAF` : 'Full'}</TableCell>
                    <TableCell>{w.current_uses || 0}{w.max_uses ? `/${w.max_uses}` : ''}</TableCell>
                    <TableCell>{format(new Date(w.effective_until), 'PP')}</TableCell>
                    <TableCell><Badge variant={w.is_active ? "default" : "secondary"}>{w.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                  </TableRow>
                ))}</TableBody></Table>
            )}
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
