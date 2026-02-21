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
      const { data: institution } = await supabase.from("institutions").select("id").eq("user_id", user.id).maybeSingle();
      if (!institution) { navigate('/register'); return; }
      const { data: invs } = await supabase.from("institution_invoices").select("*").eq("institution_id", institution.id).order("created_at", { ascending: false });
      setInvoices(invs || []);
      const { data: fees } = await supabase.from("fee_structures").select("*").eq("institution_id", institution.id).order("created_at", { ascending: false });
      setFeeStructures(fees || []);
      const { data: waivers } = await supabase.from("fee_waivers").select("*").eq("institution_id", institution.id).order("created_at", { ascending: false });
      setFeeWaivers(waivers || []);
    } catch (error) { console.error("Error loading billing:", error); }
    finally { setLoading(false); }
  };

  const invoiceStatusColor = (status: string) => {
    const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = { paid: "default", pending: "outline", overdue: "destructive", sent: "secondary" };
    return map[status] || "outline";
  };

  const totalOutstanding = invoices.filter(i => i.status !== 'paid').reduce((sum, i) => sum + Number(i.total_amount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-muted"><Receipt className="h-5 w-5 text-muted-foreground" /></div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Billing</h1>
            <p className="text-xs text-muted-foreground">Invoices, fee structures, and waivers</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}><RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Invoices", value: invoices.length, icon: Receipt },
          { label: "Outstanding", value: `${totalOutstanding.toLocaleString()} XAF`, icon: DollarSign },
          { label: "Fee Structures", value: feeStructures.length, icon: DollarSign },
          { label: "Active Waivers", value: feeWaivers.filter(w => w.is_active).length, icon: Percent },
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

      <Tabs defaultValue="invoices" className="space-y-4">
        <TabsList className="inline-flex h-9 items-center rounded-lg bg-muted p-1">
          <TabsTrigger value="invoices" className="rounded-md px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">Invoices</TabsTrigger>
          <TabsTrigger value="fees" className="rounded-md px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">Fee Structures</TabsTrigger>
          <TabsTrigger value="waivers" className="rounded-md px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">Waivers</TabsTrigger>
        </TabsList>

        <TabsContent value="invoices"><Card className="border-border/60"><CardHeader><CardTitle className="text-sm font-semibold">Invoices</CardTitle></CardHeader><CardContent>
          {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : invoices.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><Receipt className="h-10 w-10 mx-auto mb-3 opacity-30" /><p className="text-sm">No invoices</p></div>
          ) : (
            <Table><TableHeader><TableRow className="hover:bg-transparent"><TableHead className="text-xs">Invoice #</TableHead><TableHead className="text-xs">Period</TableHead><TableHead className="text-xs">Transactions</TableHead><TableHead className="text-xs">Amount</TableHead><TableHead className="text-xs">Due Date</TableHead><TableHead className="text-xs">Status</TableHead></TableRow></TableHeader>
              <TableBody>{invoices.map(inv => (<TableRow key={inv.id}><TableCell className="font-mono text-xs text-muted-foreground">{inv.invoice_number}</TableCell><TableCell className="text-sm">{format(new Date(inv.period_start), 'PP')} - {format(new Date(inv.period_end), 'PP')}</TableCell><TableCell className="text-sm">{inv.total_transactions}</TableCell><TableCell className="font-medium text-sm">{Number(inv.total_amount).toLocaleString()} {inv.currency || 'XAF'}</TableCell><TableCell className="text-xs text-muted-foreground">{format(new Date(inv.due_date), 'PP')}</TableCell><TableCell><Badge variant={invoiceStatusColor(inv.status)} className="text-[10px]">{inv.status}</Badge></TableCell></TableRow>))}</TableBody></Table>
          )}
        </CardContent></Card></TabsContent>

        <TabsContent value="fees"><Card className="border-border/60"><CardHeader><CardTitle className="text-sm font-semibold">Fee Structures</CardTitle></CardHeader><CardContent>
          {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : feeStructures.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><DollarSign className="h-10 w-10 mx-auto mb-3 opacity-30" /><p className="text-sm">No fee structures</p></div>
          ) : (
            <Table><TableHeader><TableRow className="hover:bg-transparent"><TableHead className="text-xs">Transaction Type</TableHead><TableHead className="text-xs">Fee Model</TableHead><TableHead className="text-xs">Fixed</TableHead><TableHead className="text-xs">Percentage</TableHead><TableHead className="text-xs">Effective</TableHead><TableHead className="text-xs">Status</TableHead></TableRow></TableHeader>
              <TableBody>{feeStructures.map(f => (<TableRow key={f.id}><TableCell className="font-medium text-sm">{f.transaction_type}</TableCell><TableCell><Badge variant="outline" className="text-[10px]">{f.fee_model}</Badge></TableCell><TableCell className="text-sm">{f.fixed_amount ? `${Number(f.fixed_amount).toLocaleString()} XAF` : '--'}</TableCell><TableCell className="text-sm">{f.percentage_rate ? `${f.percentage_rate}%` : '--'}</TableCell><TableCell className="text-xs text-muted-foreground">{format(new Date(f.effective_from), 'PP')}</TableCell><TableCell><Badge variant={f.is_active ? "default" : "secondary"} className="text-[10px]">{f.is_active ? "Active" : "Inactive"}</Badge></TableCell></TableRow>))}</TableBody></Table>
          )}
        </CardContent></Card></TabsContent>

        <TabsContent value="waivers"><Card className="border-border/60"><CardHeader><CardTitle className="text-sm font-semibold">Fee Waivers</CardTitle></CardHeader><CardContent>
          {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : feeWaivers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><Percent className="h-10 w-10 mx-auto mb-3 opacity-30" /><p className="text-sm">No fee waivers</p></div>
          ) : (
            <Table><TableHeader><TableRow className="hover:bg-transparent"><TableHead className="text-xs">Type</TableHead><TableHead className="text-xs">Reason</TableHead><TableHead className="text-xs">Discount</TableHead><TableHead className="text-xs">Uses</TableHead><TableHead className="text-xs">Valid Until</TableHead><TableHead className="text-xs">Status</TableHead></TableRow></TableHeader>
              <TableBody>{feeWaivers.map(w => (<TableRow key={w.id}><TableCell><Badge variant="outline" className="text-[10px]">{w.waiver_type}</Badge></TableCell><TableCell className="max-w-[200px] truncate text-sm">{w.reason}</TableCell><TableCell className="text-sm">{w.discount_percentage ? `${w.discount_percentage}%` : w.discount_fixed_amount ? `${Number(w.discount_fixed_amount).toLocaleString()} XAF` : 'Full'}</TableCell><TableCell className="text-sm">{w.current_uses || 0}{w.max_uses ? `/${w.max_uses}` : ''}</TableCell><TableCell className="text-xs text-muted-foreground">{format(new Date(w.effective_until), 'PP')}</TableCell><TableCell><Badge variant={w.is_active ? "default" : "secondary"} className="text-[10px]">{w.is_active ? "Active" : "Inactive"}</Badge></TableCell></TableRow>))}</TableBody></Table>
          )}
        </CardContent></Card></TabsContent>
      </Tabs>
    </div>
  );
}
