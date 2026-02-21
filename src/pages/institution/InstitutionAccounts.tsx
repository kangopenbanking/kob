import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, Wallet, TrendingUp } from "lucide-react";
import { format } from "date-fns";

export default function InstitutionAccounts() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [balances, setBalances] = useState<Record<string, any[]>>({});
  const [institutionId, setInstitutionId] = useState<string | null>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth'); return; }
      const { data: institution } = await supabase.from("institutions").select("id").eq("user_id", user.id).maybeSingle();
      if (!institution) { navigate('/register'); return; }
      setInstitutionId(institution.id);
      const { data: accts } = await supabase.from("accounts").select("*").eq("institution_id", institution.id).order("created_at", { ascending: false });
      setAccounts(accts || []);
      if (accts && accts.length > 0) {
        const { data: bals } = await supabase.from("account_balances").select("*").in("account_id", accts.map(a => a.id));
        const grouped: Record<string, any[]> = {};
        (bals || []).forEach(b => { if (!grouped[b.account_id]) grouped[b.account_id] = []; grouped[b.account_id].push(b); });
        setBalances(grouped);
      }
    } catch (error) { console.error("Error loading accounts:", error); }
    finally { setLoading(false); }
  };

  const totalBalance = Object.values(balances).flat()
    .filter(b => b.balance_type === 'ClosingAvailable' || b.balance_type === 'InterimAvailable')
    .reduce((sum, b) => sum + Number(b.amount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-muted">
            <Wallet className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Accounts</h1>
            <p className="text-xs text-muted-foreground">Manage institution accounts and balances</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Total Accounts", value: accounts.length, icon: Wallet },
          { label: "Active Accounts", value: accounts.filter(a => a.is_active).length, icon: TrendingUp },
          { label: "Total Balance", value: `${totalBalance.toLocaleString()} XAF`, icon: Wallet },
        ].map(s => (
          <Card key={s.label} className="border-border/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-muted">
                <s.icon className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-20" /> : s.value}</div></CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/60">
        <CardHeader><CardTitle className="text-sm font-semibold">All Accounts</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Wallet className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No accounts found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs">Account Holder</TableHead>
                  <TableHead className="text-xs">Account ID</TableHead>
                  <TableHead className="text-xs">Type</TableHead>
                  <TableHead className="text-xs">Currency</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Opened</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map(account => (
                  <TableRow key={account.id}>
                    <TableCell className="font-medium text-sm">{account.account_holder_name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{account.account_id}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{account.account_type}</Badge></TableCell>
                    <TableCell className="text-sm">{account.currency}</TableCell>
                    <TableCell>
                      <Badge variant={account.is_active ? "default" : "secondary"} className="text-[10px]">
                        {account.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{account.opened_date ? format(new Date(account.opened_date), 'PP') : '--'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
