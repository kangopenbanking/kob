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
  const [institutionId, setInstitutionId] = useState<string | null>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth'); return; }
      const { data: institution } = await supabase
        .from("institutions").select("id").eq("user_id", user.id).maybeSingle();
      if (!institution) { navigate('/register'); return; }
      setInstitutionId(institution.id);

      const { data: prods } = await supabase
        .from("loan_products").select("*").eq("institution_id", institution.id).order("created_at", { ascending: false });
      setProducts(prods || []);

      const productIds = (prods || []).map(p => p.id);
      if (productIds.length > 0) {
        const { data: apps } = await supabase
          .from("loan_applications").select("*").in("loan_product_id", productIds).order("created_at", { ascending: false });
        setApplications(apps || []);

        const appIds = (apps || []).map(a => a.id);
        if (appIds.length > 0) {
          const { data: reps } = await supabase
            .from("loan_repayments").select("*").in("loan_id", appIds).order("created_at", { ascending: false }).limit(100);
          setRepayments(reps || []);
        }
      }
    } catch (error) {
      console.error("Error loading loans:", error);
    } finally { setLoading(false); }
  };

  const statusColor = (status: string) => {
    const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      applied: "outline", under_review: "secondary", approved: "default", disbursed: "default",
      rejected: "destructive", defaulted: "destructive", closed: "secondary"
    };
    return map[status] || "outline";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Loans</h1>
          <p className="text-muted-foreground">Manage loan products, applications, and repayments</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Products</CardTitle><Banknote className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : products.length}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Applications</CardTitle><FileText className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : applications.length}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Active Loans</CardTitle><CreditCard className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : applications.filter(a => a.status === 'disbursed').length}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Repayments</CardTitle><Calendar className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : repayments.length}</div></CardContent></Card>
      </div>

      <Tabs defaultValue="products" className="space-y-4">
        <TabsList>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="applications">Applications</TabsTrigger>
          <TabsTrigger value="repayments">Repayments</TabsTrigger>
        </TabsList>

        <TabsContent value="products">
          <Card><CardHeader><CardTitle>Loan Products</CardTitle></CardHeader><CardContent>
            {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : products.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground"><Banknote className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No loan products</p></div>
            ) : (
              <Table><TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Code</TableHead><TableHead>Type</TableHead><TableHead>Interest Rate</TableHead><TableHead>Amount Range</TableHead><TableHead>Tenure</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>{products.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.product_name}</TableCell>
                    <TableCell className="font-mono text-xs">{p.product_code}</TableCell>
                    <TableCell><Badge variant="outline">{p.loan_type}</Badge></TableCell>
                    <TableCell>{p.interest_rate}%</TableCell>
                    <TableCell>{Number(p.min_amount).toLocaleString()} - {Number(p.max_amount).toLocaleString()}</TableCell>
                    <TableCell>{p.min_tenure_months}-{p.max_tenure_months} months</TableCell>
                    <TableCell><Badge variant={p.is_active ? "default" : "secondary"}>{p.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                  </TableRow>
                ))}</TableBody></Table>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="applications">
          <Card><CardHeader><CardTitle>Loan Applications</CardTitle></CardHeader><CardContent>
            {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : applications.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground"><FileText className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No loan applications</p></div>
            ) : (
              <Table><TableHeader><TableRow><TableHead>Application #</TableHead><TableHead>Amount</TableHead><TableHead>Tenure</TableHead><TableHead>Purpose</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
                <TableBody>{applications.map(a => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-xs">{a.application_number}</TableCell>
                    <TableCell>{Number(a.requested_amount).toLocaleString()} XAF</TableCell>
                    <TableCell>{a.tenure_months} months</TableCell>
                    <TableCell className="max-w-[200px] truncate">{a.purpose}</TableCell>
                    <TableCell><Badge variant={statusColor(a.status)}>{a.status}</Badge></TableCell>
                    <TableCell>{a.created_at ? format(new Date(a.created_at), 'PP') : '—'}</TableCell>
                  </TableRow>
                ))}</TableBody></Table>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="repayments">
          <Card><CardHeader><CardTitle>Loan Repayments</CardTitle></CardHeader><CardContent>
            {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : repayments.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground"><Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No repayments recorded</p></div>
            ) : (
              <Table><TableHeader><TableRow><TableHead>Amount</TableHead><TableHead>Principal</TableHead><TableHead>Interest</TableHead><TableHead>Fees</TableHead><TableHead>Method</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
                <TableBody>{repayments.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{Number(r.amount).toLocaleString()} XAF</TableCell>
                    <TableCell>{Number(r.principal_paid).toLocaleString()}</TableCell>
                    <TableCell>{Number(r.interest_paid).toLocaleString()}</TableCell>
                    <TableCell>{Number(r.fees_paid).toLocaleString()}</TableCell>
                    <TableCell>{r.payment_method || '—'}</TableCell>
                    <TableCell>{r.created_at ? format(new Date(r.created_at), 'PP') : '—'}</TableCell>
                  </TableRow>
                ))}</TableBody></Table>
            )}
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
