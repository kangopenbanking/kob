import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard, Smartphone, Building2, RefreshCw, ArrowUpRight, Clock, CheckCircle2, XCircle } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export default function InstitutionPayments() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [mobileMoneyTx, setMobileMoneyTx] = useState<any[]>([]);
  const [cardTx, setCardTx] = useState<any[]>([]);
  const [bankTx, setBankTx] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => { loadData(); }, [statusFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth'); return; }

      const { data: institution } = await supabase
        .from("institutions").select("id").eq("user_id", user.id).maybeSingle();
      if (!institution) { navigate('/register'); return; }
      setInstitutionId(institution.id);

      // Mobile Money
      let mmQuery = supabase.from("mobile_money_transactions").select("*")
        .eq("facilitated_institution_id", institution.id)
        .order("created_at", { ascending: false }).limit(50);
      if (statusFilter !== "all") mmQuery = mmQuery.eq("status", statusFilter);
      const { data: mm } = await mmQuery;
      setMobileMoneyTx(mm || []);

      // Card Payments
      let cardQuery = supabase.from("card_payment_transactions").select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }).limit(50);
      if (statusFilter !== "all") cardQuery = cardQuery.eq("status", statusFilter);
      const { data: cards } = await cardQuery;
      setCardTx(cards || []);

      // Bank Transfers
      let bankQuery = supabase.from("bank_transfer_transactions").select("*")
        .eq("facilitated_institution_id", institution.id)
        .order("created_at", { ascending: false }).limit(50);
      if (statusFilter !== "all") bankQuery = bankQuery.eq("status", statusFilter);
      const { data: bank } = await bankQuery;
      setBankTx(bank || []);
    } catch (error: any) {
      toast({ title: "Error loading payments", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"><CheckCircle2 className="h-3 w-3 mr-1" />Completed</Badge>;
      case 'pending': return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'failed': return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const PaymentList = ({ payments, type }: { payments: any[]; type: string }) => (
    loading ? (
      <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
    ) : payments.length === 0 ? (
      <div className="text-center py-12 text-muted-foreground">
        <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No {type} payments found</p>
      </div>
    ) : (
      <div className="space-y-3">
        {payments.map(payment => (
          <div key={payment.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
            <div>
              <p className="font-medium">{payment.transaction_ref || payment.id.slice(0, 12)}</p>
              <p className="text-sm text-muted-foreground">
                {payment.narration || payment.description || payment.transaction_type || type}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {format(new Date(payment.created_at), "PPp")}
              </p>
            </div>
            <div className="text-right">
              <p className="font-bold">{Number(payment.amount).toLocaleString()} {payment.currency || 'XAF'}</p>
              {getStatusBadge(payment.status)}
            </div>
          </div>
        ))}
      </div>
    )
  );

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Payments</h1>
            <p className="text-muted-foreground">Monitor all payment channels — Mobile Money, Cards, and Bank Transfers</p>
          </div>
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={loadData}><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button>
          </div>
        </div>

        {/* Summary */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Mobile Money</CardTitle>
              <Smartphone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mobileMoneyTx.length}</div>
              <p className="text-xs text-muted-foreground">{mobileMoneyTx.reduce((s, t) => s + Number(t.amount || 0), 0).toLocaleString()} XAF volume</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Card Payments</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{cardTx.length}</div>
              <p className="text-xs text-muted-foreground">{cardTx.reduce((s, t) => s + Number(t.amount || 0), 0).toLocaleString()} XAF volume</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Bank Transfers</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{bankTx.length}</div>
              <p className="text-xs text-muted-foreground">{bankTx.reduce((s, t) => s + Number(t.amount || 0), 0).toLocaleString()} XAF volume</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="mobile-money" className="space-y-4">
          <TabsList>
            <TabsTrigger value="mobile-money"><Smartphone className="h-4 w-4 mr-2" />Mobile Money</TabsTrigger>
            <TabsTrigger value="cards"><CreditCard className="h-4 w-4 mr-2" />Cards</TabsTrigger>
            <TabsTrigger value="bank"><Building2 className="h-4 w-4 mr-2" />Bank Transfers</TabsTrigger>
          </TabsList>
          <TabsContent value="mobile-money">
            <Card><CardHeader><CardTitle>Mobile Money Transactions</CardTitle></CardHeader>
              <CardContent><PaymentList payments={mobileMoneyTx} type="mobile money" /></CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="cards">
            <Card><CardHeader><CardTitle>Card Payment Transactions</CardTitle></CardHeader>
              <CardContent><PaymentList payments={cardTx} type="card" /></CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="bank">
            <Card><CardHeader><CardTitle>Bank Transfer Transactions</CardTitle></CardHeader>
              <CardContent><PaymentList payments={bankTx} type="bank transfer" /></CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
