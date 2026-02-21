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
      const { data: institution } = await supabase.from("institutions").select("id").eq("user_id", user.id).maybeSingle();
      if (!institution) { navigate('/register'); return; }
      const { data: accounts } = await supabase.from("ledger_accounts").select("*").eq("institution_id", institution.id).order("account_code");
      setLedgerAccounts(accounts || []);
      const { data: entries } = await supabase.from("journal_entries").select("*").eq("institution_id", institution.id).order("entry_date", { ascending: false }).limit(100);
      setJournalEntries(entries || []);
    } catch (error) { console.error("Error loading ledger:", error); }
    finally { setLoading(false); }
  };

  const totalDebits = ledgerAccounts.filter(a => a.account_type === 'asset' || a.account_type === 'expense').reduce((s, a) => s + Number(a.balance || 0), 0);
  const totalCredits = ledgerAccounts.filter(a => a.account_type === 'liability' || a.account_type === 'equity' || a.account_type === 'revenue').reduce((s, a) => s + Number(a.balance || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-fi-cyan/10 border border-fi-cyan/20"><BookOpen className="h-5 w-5 text-fi-cyan" /></div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Ledger</h1>
            <p className="text-xs text-muted-foreground">Chart of accounts and journal entries</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}><RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Accounts", value: ledgerAccounts.length, icon: BookOpen, color: "text-fi-cyan bg-fi-cyan/10 border-fi-cyan/20" },
          { label: "Journal Entries", value: journalEntries.length, icon: FileSpreadsheet, color: "text-fi-indigo bg-fi-indigo/10 border-fi-indigo/20" },
          { label: "Total Debits", value: totalDebits.toLocaleString(), icon: BookOpen, color: "text-fi-rose bg-fi-rose/10 border-fi-rose/20" },
          { label: "Total Credits", value: totalCredits.toLocaleString(), icon: BookOpen, color: "text-fi-green bg-fi-green/10 border-fi-green/20" },
        ].map(s => (
          <Card key={s.label} className="border-border/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</CardTitle>
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg border ${s.color}`}><s.icon className="h-3.5 w-3.5" /></div>
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : s.value}</div></CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="chart" className="space-y-4">
        <TabsList className="inline-flex h-9 items-center rounded-lg bg-muted p-1">
          <TabsTrigger value="chart" className="rounded-md px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">Chart of Accounts</TabsTrigger>
          <TabsTrigger value="journal" className="rounded-md px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">Journal Entries</TabsTrigger>
        </TabsList>

        <TabsContent value="chart"><Card className="border-border/60"><CardHeader><CardTitle className="text-sm font-semibold">Chart of Accounts</CardTitle></CardHeader><CardContent>
          {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : ledgerAccounts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><BookOpen className="h-10 w-10 mx-auto mb-3 opacity-30" /><p className="text-sm">No ledger accounts</p></div>
          ) : (
            <Table><TableHeader><TableRow className="hover:bg-transparent"><TableHead className="text-xs">Code</TableHead><TableHead className="text-xs">Name</TableHead><TableHead className="text-xs">Type</TableHead><TableHead className="text-xs">Balance</TableHead><TableHead className="text-xs">Currency</TableHead><TableHead className="text-xs">Status</TableHead></TableRow></TableHeader>
              <TableBody>{ledgerAccounts.map(a => (<TableRow key={a.id}><TableCell className="font-mono text-xs">{a.account_code}</TableCell><TableCell className="font-medium text-sm">{a.account_name}</TableCell><TableCell><Badge variant="outline" className="text-[10px]">{a.account_type}</Badge></TableCell><TableCell className="font-medium text-sm">{Number(a.balance).toLocaleString()}</TableCell><TableCell className="text-sm">{a.currency}</TableCell><TableCell><Badge variant={a.is_active ? "default" : "secondary"} className="text-[10px]">{a.is_active ? "Active" : "Inactive"}</Badge></TableCell></TableRow>))}</TableBody></Table>
          )}
        </CardContent></Card></TabsContent>

        <TabsContent value="journal"><Card className="border-border/60"><CardHeader><CardTitle className="text-sm font-semibold">Journal Entries</CardTitle></CardHeader><CardContent>
          {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : journalEntries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><FileSpreadsheet className="h-10 w-10 mx-auto mb-3 opacity-30" /><p className="text-sm">No journal entries</p></div>
          ) : (
            <Table><TableHeader><TableRow className="hover:bg-transparent"><TableHead className="text-xs">Entry #</TableHead><TableHead className="text-xs">Date</TableHead><TableHead className="text-xs">Description</TableHead><TableHead className="text-xs">Reference</TableHead><TableHead className="text-xs">Status</TableHead></TableRow></TableHeader>
              <TableBody>{journalEntries.map(e => (<TableRow key={e.id}><TableCell className="font-mono text-xs text-muted-foreground">{e.entry_number}</TableCell><TableCell className="text-sm">{format(new Date(e.entry_date), 'PP')}</TableCell><TableCell className="max-w-[300px] truncate text-sm">{e.description}</TableCell><TableCell className="text-sm">{e.reference_type || '--'}</TableCell><TableCell><Badge variant={e.is_reversed ? "destructive" : "secondary"} className="text-[10px]">{e.is_reversed ? "Reversed" : "Active"}</Badge></TableCell></TableRow>))}</TableBody></Table>
          )}
        </CardContent></Card></TabsContent>
      </Tabs>
    </div>
  );
}
