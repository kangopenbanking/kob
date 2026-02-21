import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, Banknote, FileText, Calendar, CreditCard } from "lucide-react";
import { format } from "date-fns";

export default function InstitutionLoans() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [repayments, setRepayments] = useState<any[]>([]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth'); return; }
      const { data: institution } = await supabase.from("institutions").select("id").eq("user_id", user.id).maybeSingle();
      if (!institution) { navigate('/register'); return; }
      const { data: prods } = await supabase.from("loan_products").select("*").eq("institution_id", institution.id).order("created_at", { ascending: false });
      setProducts(prods || []);
      const productIds = (prods || []).map(p => p.id);
      if (productIds.length > 0) {
        const { data: apps } = await supabase.from("loan_applications").select("*").in("loan_product_id", productIds).order("created_at", { ascending: false });
        setApplications(apps || []);
        const appIds = (apps || []).map(a => a.id);
        if (appIds.length > 0) {
          const { data: reps } = await supabase.from("loan_repayments").select("*").in("loan_id", appIds).order("created_at", { ascending: false }).limit(100);
          setRepayments(reps || []);
        }
      }
    } catch (error) { console.error("Error loading loans:", error); }
    finally { setLoading(false); }
  };

  const statusColor = (status: string) => {
    const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = { applied: "outline", under_review: "secondary", approved: "default", disbursed: "default", rejected: "destructive", defaulted: "destructive", closed: "secondary" };
    return map[status] || "outline";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-muted"><Banknote className="h-5 w-5 text-muted-foreground" /></div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Loans</h1>
            <p className="text-xs text-muted-foreground">Manage loan products, applications, and repayments</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}><RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Products", value: products.length, icon: Banknote },
          { label: "Applications", value: applications.length, icon: FileText },
          { label: "Active Loans", value: applications.filter(a => a.status === 'disbursed').length, icon: CreditCard },
          { label: "Repayments", value: repayments.length, icon: Calendar },
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

      <Tabs defaultValue="products" className="space-y-4">
        <TabsList className="inline-flex h-9 items-center rounded-lg bg-muted p-1">
          <TabsTrigger value="products" className="rounded-md px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">Products</TabsTrigger>
          <TabsTrigger value="applications" className="rounded-md px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">Applications</TabsTrigger>
          <TabsTrigger value="repayments" className="rounded-md px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">Repayments</TabsTrigger>
        </TabsList>

        <TabsContent value="products">
          <Card className="border-border/60"><CardHeader><CardTitle className="text-sm font-semibold">Loan Products</CardTitle></CardHeader><CardContent>
            {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : products.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground"><Banknote className="h-10 w-10 mx-auto mb-3 opacity-30" /><p className="text-sm">No loan products</p></div>
            ) : (
              <Table><TableHeader><TableRow className="hover:bg-transparent"><TableHead className="text-xs">Product</TableHead><TableHead className="text-xs">Code</TableHead><TableHead className="text-xs">Type</TableHead><TableHead className="text-xs">Interest Rate</TableHead><TableHead className="text-xs">Amount Range</TableHead><TableHead className="text-xs">Tenure</TableHead><TableHead className="text-xs">Status</TableHead></TableRow></TableHeader>
                <TableBody>{products.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium text-sm">{p.product_name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{p.product_code}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{p.loan_type}</Badge></TableCell>
                    <TableCell className="text-sm">{p.interest_rate}%</TableCell>
                    <TableCell className="text-sm">{Number(p.min_amount).toLocaleString()} - {Number(p.max_amount).toLocaleString()}</TableCell>
                    <TableCell className="text-sm">{p.min_tenure_months}-{p.max_tenure_months} months</TableCell>
                    <TableCell><Badge variant={p.is_active ? "default" : "secondary"} className="text-[10px]">{p.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                  </TableRow>
                ))}</TableBody></Table>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="applications">
          <Card className="border-border/60"><CardHeader><CardTitle className="text-sm font-semibold">Loan Applications</CardTitle></CardHeader><CardContent>
            {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : applications.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground"><FileText className="h-10 w-10 mx-auto mb-3 opacity-30" /><p className="text-sm">No loan applications</p></div>
            ) : (
              <Table><TableHeader><TableRow className="hover:bg-transparent"><TableHead className="text-xs">Application #</TableHead><TableHead className="text-xs">Amount</TableHead><TableHead className="text-xs">Tenure</TableHead><TableHead className="text-xs">Purpose</TableHead><TableHead className="text-xs">Status</TableHead><TableHead className="text-xs">Date</TableHead></TableRow></TableHeader>
                <TableBody>{applications.map(a => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">{a.application_number}</TableCell>
                    <TableCell className="text-sm">{Number(a.requested_amount).toLocaleString()} XAF</TableCell>
                    <TableCell className="text-sm">{a.tenure_months} months</TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm">{a.purpose}</TableCell>
                    <TableCell><Badge variant={statusColor(a.status)} className="text-[10px]">{a.status}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{a.created_at ? format(new Date(a.created_at), 'PP') : '--'}</TableCell>
                  </TableRow>
                ))}</TableBody></Table>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="repayments">
          <Card className="border-border/60"><CardHeader><CardTitle className="text-sm font-semibold">Loan Repayments</CardTitle></CardHeader><CardContent>
            {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : repayments.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground"><Calendar className="h-10 w-10 mx-auto mb-3 opacity-30" /><p className="text-sm">No repayments recorded</p></div>
            ) : (
              <Table><TableHeader><TableRow className="hover:bg-transparent"><TableHead className="text-xs">Amount</TableHead><TableHead className="text-xs">Principal</TableHead><TableHead className="text-xs">Interest</TableHead><TableHead className="text-xs">Fees</TableHead><TableHead className="text-xs">Method</TableHead><TableHead className="text-xs">Date</TableHead></TableRow></TableHeader>
                <TableBody>{repayments.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium text-sm">{Number(r.amount).toLocaleString()} XAF</TableCell>
                    <TableCell className="text-sm">{Number(r.principal_paid).toLocaleString()}</TableCell>
                    <TableCell className="text-sm">{Number(r.interest_paid).toLocaleString()}</TableCell>
                    <TableCell className="text-sm">{Number(r.fees_paid).toLocaleString()}</TableCell>
                    <TableCell className="text-sm">{r.payment_method || '--'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.created_at ? format(new Date(r.created_at), 'PP') : '--'}</TableCell>
                  </TableRow>
                ))}</TableBody></Table>
            )}
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
