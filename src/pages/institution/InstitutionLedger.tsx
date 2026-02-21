import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, BookOpen, FileSpreadsheet } from "lucide-react";
import { format } from "date-fns";

export default function InstitutionLedger() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [ledgerAccounts, setLedgerAccounts] = useState<any[]>([]);
  const [journalEntries, setJournalEntries] = useState<any[]>([]);

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
        .from("ledger_accounts").select("*").eq("institution_id", institution.id).order("account_code");
      setLedgerAccounts(accounts || []);

      const { data: entries } = await supabase
        .from("journal_entries").select("*").eq("institution_id", institution.id).order("entry_date", { ascending: false }).limit(100);
      setJournalEntries(entries || []);
    } catch (error) {
      console.error("Error loading ledger:", error);
    } finally { setLoading(false); }
  };

  const totalDebits = ledgerAccounts.filter(a => a.account_type === 'asset' || a.account_type === 'expense').reduce((s, a) => s + Number(a.balance || 0), 0);
  const totalCredits = ledgerAccounts.filter(a => a.account_type === 'liability' || a.account_type === 'equity' || a.account_type === 'revenue').reduce((s, a) => s + Number(a.balance || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Ledger</h1>
          <p className="text-muted-foreground">Chart of accounts and journal entries</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Accounts</CardTitle><BookOpen className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : ledgerAccounts.length}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Journal Entries</CardTitle><FileSpreadsheet className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : journalEntries.length}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Debits</CardTitle><BookOpen className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : totalDebits.toLocaleString()}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Credits</CardTitle><BookOpen className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : totalCredits.toLocaleString()}</div></CardContent></Card>
      </div>

      <Tabs defaultValue="chart" className="space-y-4">
        <TabsList>
          <TabsTrigger value="chart">Chart of Accounts</TabsTrigger>
          <TabsTrigger value="journal">Journal Entries</TabsTrigger>
        </TabsList>

        <TabsContent value="chart">
          <Card><CardHeader><CardTitle>Chart of Accounts</CardTitle></CardHeader><CardContent>
            {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : ledgerAccounts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground"><BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No ledger accounts</p></div>
            ) : (
              <Table><TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Balance</TableHead><TableHead>Currency</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>{ledgerAccounts.map(a => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono">{a.account_code}</TableCell>
                    <TableCell className="font-medium">{a.account_name}</TableCell>
                    <TableCell><Badge variant="outline">{a.account_type}</Badge></TableCell>
                    <TableCell className="font-medium">{Number(a.balance).toLocaleString()}</TableCell>
                    <TableCell>{a.currency}</TableCell>
                    <TableCell><Badge variant={a.is_active ? "default" : "secondary"}>{a.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                  </TableRow>
                ))}</TableBody></Table>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="journal">
          <Card><CardHeader><CardTitle>Journal Entries</CardTitle></CardHeader><CardContent>
            {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : journalEntries.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground"><FileSpreadsheet className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No journal entries</p></div>
            ) : (
              <Table><TableHeader><TableRow><TableHead>Entry #</TableHead><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead>Reference</TableHead><TableHead>Reversed</TableHead></TableRow></TableHeader>
                <TableBody>{journalEntries.map(e => (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono text-xs">{e.entry_number}</TableCell>
                    <TableCell>{format(new Date(e.entry_date), 'PP')}</TableCell>
                    <TableCell className="max-w-[300px] truncate">{e.description}</TableCell>
                    <TableCell>{e.reference_type ? `${e.reference_type}` : '—'}</TableCell>
                    <TableCell><Badge variant={e.is_reversed ? "destructive" : "secondary"}>{e.is_reversed ? "Reversed" : "Active"}</Badge></TableCell>
                  </TableRow>
                ))}</TableBody></Table>
            )}
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
