import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  RefreshCw, BookOpen, FileSpreadsheet, TrendingUp, TrendingDown,
  CheckCircle, AlertTriangle, Search, Download, ArrowUpDown,
  Calendar, Scale, BarChart3, Eye
} from "lucide-react";
import { format, startOfDay, startOfWeek, startOfMonth, startOfYear, endOfDay, subDays, isWithinInterval, parseISO } from "date-fns";

type LedgerAccount = {
  id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  balance: number;
  currency: string;
  is_active: boolean;
  description: string | null;
  parent_account_id: string | null;
  created_at: string;
  updated_at: string;
};

type JournalEntry = {
  id: string;
  entry_number: string;
  entry_date: string;
  description: string;
  reference_type: string | null;
  reference_id: string | null;
  is_reversed: boolean;
  created_at: string;
  posted_by: string | null;
};

type JournalLine = {
  id: string;
  journal_entry_id: string;
  ledger_account_id: string;
  debit: number;
  credit: number;
  description: string | null;
  created_at: string;
};

type PeriodFilter = "today" | "week" | "month" | "year" | "all";

const formatXAF = (amount: number) =>
  new Intl.NumberFormat("fr-CM", { style: "currency", currency: "XAF", maximumFractionDigits: 0 }).format(amount);

export default function InstitutionLedger() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [ledgerAccounts, setLedgerAccounts] = useState<LedgerAccount[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [journalLines, setJournalLines] = useState<JournalLine[]>([]);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("month");
  const [accountTypeFilter, setAccountTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [reconciliationStatus, setReconciliationStatus] = useState<"balanced" | "unbalanced" | "loading">("loading");

  useEffect(() => { loadData(); }, []);

  // Realtime subscription
  useEffect(() => {
    if (!institutionId) return;
    const channel = supabase
      .channel(`ledger-realtime-${institutionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'journal_entries' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'journal_lines' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ledger_accounts' }, () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [institutionId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth'); return; }
      const { data: institution } = await supabase.from("institutions").select("id").eq("user_id", user.id).maybeSingle();
      if (!institution) { navigate('/register'); return; }
      setInstitutionId(institution.id);

      const [accountsRes, entriesRes, linesRes] = await Promise.all([
        supabase.from("ledger_accounts").select("*").eq("institution_id", institution.id).order("account_code"),
        supabase.from("journal_entries").select("*").eq("institution_id", institution.id).eq("is_reversed", false).order("entry_date", { ascending: false }).limit(500),
        supabase.from("journal_lines").select("*").order("created_at", { ascending: false }).limit(1000),
      ]);

      setLedgerAccounts(accountsRes.data || []);
      setJournalEntries(entriesRes.data || []);
      setJournalLines(linesRes.data || []);

      // Check reconciliation
      const accounts = accountsRes.data || [];
      const totalDebits = accounts.filter(a => ['asset', 'expense'].includes(a.account_type)).reduce((s, a) => s + Number(a.balance || 0), 0);
      const totalCredits = accounts.filter(a => ['liability', 'equity', 'revenue'].includes(a.account_type)).reduce((s, a) => s + Number(a.balance || 0), 0);
      setReconciliationStatus(Math.abs(totalDebits - totalCredits) < 0.01 ? "balanced" : "unbalanced");
    } catch (error) {
      console.error("Error loading ledger:", error);
    } finally {
      setLoading(false);
    }
  };

  // Period-filtered entries
  const filteredEntries = useMemo(() => {
    const now = new Date();
    let startDate: Date;
    switch (periodFilter) {
      case "today": startDate = startOfDay(now); break;
      case "week": startDate = startOfWeek(now, { weekStartsOn: 1 }); break;
      case "month": startDate = startOfMonth(now); break;
      case "year": startDate = startOfYear(now); break;
      default: startDate = new Date(0);
    }
    return journalEntries.filter(e => {
      const entryDate = parseISO(e.entry_date);
      return isWithinInterval(entryDate, { start: startDate, end: endOfDay(now) });
    });
  }, [journalEntries, periodFilter]);

  // Lines for filtered entries
  const filteredLines = useMemo(() => {
    const entryIds = new Set(filteredEntries.map(e => e.id));
    return journalLines.filter(l => entryIds.has(l.journal_entry_id));
  }, [filteredEntries, journalLines]);

  // Period totals
  const periodTotals = useMemo(() => {
    const totalDebit = filteredLines.reduce((s, l) => s + Number(l.debit || 0), 0);
    const totalCredit = filteredLines.reduce((s, l) => s + Number(l.credit || 0), 0);
    return { totalDebit, totalCredit, isBalanced: Math.abs(totalDebit - totalCredit) < 0.01 };
  }, [filteredLines]);

  // Filtered accounts
  const filteredAccounts = useMemo(() => {
    let accounts = ledgerAccounts;
    if (accountTypeFilter !== "all") accounts = accounts.filter(a => a.account_type === accountTypeFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      accounts = accounts.filter(a => a.account_name.toLowerCase().includes(q) || a.account_code.includes(q));
    }
    return accounts;
  }, [ledgerAccounts, accountTypeFilter, searchQuery]);

  // Trial balance grouped by type
  const trialBalance = useMemo(() => {
    const groups: Record<string, { accounts: LedgerAccount[]; totalDebit: number; totalCredit: number }> = {};
    for (const a of ledgerAccounts) {
      if (!groups[a.account_type]) groups[a.account_type] = { accounts: [], totalDebit: 0, totalCredit: 0 };
      groups[a.account_type].accounts.push(a);
      if (['asset', 'expense'].includes(a.account_type)) {
        groups[a.account_type].totalDebit += Number(a.balance || 0);
      } else {
        groups[a.account_type].totalCredit += Number(a.balance || 0);
      }
    }
    return groups;
  }, [ledgerAccounts]);

  const grandTotalDebit = Object.values(trialBalance).reduce((s, g) => s + g.totalDebit, 0);
  const grandTotalCredit = Object.values(trialBalance).reduce((s, g) => s + g.totalCredit, 0);

  // Account lookup for journal lines
  const accountMap = useMemo(() => {
    const map: Record<string, LedgerAccount> = {};
    for (const a of ledgerAccounts) map[a.id] = a;
    return map;
  }, [ledgerAccounts]);

  // Get lines for a specific entry
  const getLinesForEntry = (entryId: string) => journalLines.filter(l => l.journal_entry_id === entryId);

  const periodLabels: Record<PeriodFilter, string> = {
    today: "Today", week: "This Week", month: "This Month", year: "This Year", all: "All Time"
  };

  const accountTypeColors: Record<string, string> = {
    asset: "text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950 dark:border-blue-800",
    liability: "text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950 dark:border-amber-800",
    equity: "text-purple-600 bg-purple-50 border-purple-200 dark:text-purple-400 dark:bg-purple-950 dark:border-purple-800",
    revenue: "text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950 dark:border-emerald-800",
    expense: "text-rose-600 bg-rose-50 border-rose-200 dark:text-rose-400 dark:bg-rose-950 dark:border-rose-800",
  };

  const exportCSV = () => {
    const rows = [["Code", "Account", "Type", "Debit", "Credit", "Currency"]];
    for (const a of ledgerAccounts) {
      const isDebit = ['asset', 'expense'].includes(a.account_type);
      rows.push([a.account_code, a.account_name, a.account_type, isDebit ? String(a.balance) : "0", isDebit ? "0" : String(a.balance), a.currency]);
    }
    rows.push(["", "", "TOTALS", String(grandTotalDebit), String(grandTotalCredit), ""]);
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `trial-balance-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-fi-cyan/10 border border-fi-cyan/20">
            <Scale className="h-5 w-5 text-fi-cyan" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">General Ledger & Reconciliation</h1>
            <p className="text-xs text-muted-foreground">Double-entry accounting • Real-time reconciliation</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {reconciliationStatus === "balanced" ? (
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-700 gap-1">
              <CheckCircle className="h-3 w-3" /> Books Balanced
            </Badge>
          ) : reconciliationStatus === "unbalanced" ? (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" /> Imbalance Detected
            </Badge>
          ) : null}
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-3.5 w-3.5 mr-1.5" />Export
          </Button>
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />Refresh
          </Button>
        </div>
      </div>

      {/* Period selector */}
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <div className="flex bg-muted rounded-lg p-0.5 gap-0.5">
          {(["today", "week", "month", "year", "all"] as PeriodFilter[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriodFilter(p)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                periodFilter === p
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Accounts</CardTitle>
            <BookOpen className="h-4 w-4 text-fi-cyan" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-12" /> : ledgerAccounts.length}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">{ledgerAccounts.filter(a => a.is_active).length} active</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{periodLabels[periodFilter]} Entries</CardTitle>
            <FileSpreadsheet className="h-4 w-4 text-fi-indigo" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-12" /> : filteredEntries.length}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">{filteredLines.length} journal lines</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{periodLabels[periodFilter]} Debits</CardTitle>
            <TrendingUp className="h-4 w-4 text-fi-rose" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-rose-600 dark:text-rose-400">{loading ? <Skeleton className="h-8 w-20" /> : formatXAF(periodTotals.totalDebit)}</div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{periodLabels[periodFilter]} Credits</CardTitle>
            <TrendingDown className="h-4 w-4 text-fi-green" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{loading ? <Skeleton className="h-8 w-20" /> : formatXAF(periodTotals.totalCredit)}</div>
          </CardContent>
        </Card>
        <Card className={`border-2 ${periodTotals.isBalanced ? 'border-emerald-300 dark:border-emerald-700' : 'border-destructive'}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Reconciliation</CardTitle>
            <Scale className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className={`text-xl font-bold ${periodTotals.isBalanced ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
              {loading ? <Skeleton className="h-8 w-20" /> : periodTotals.isBalanced ? "✓ Balanced" : formatXAF(Math.abs(periodTotals.totalDebit - periodTotals.totalCredit))}
            </div>
            {!periodTotals.isBalanced && !loading && <p className="text-[10px] text-destructive mt-0.5">Variance detected</p>}
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="trial-balance" className="space-y-4">
        <TabsList className="inline-flex h-9 items-center rounded-lg bg-muted p-1">
          <TabsTrigger value="trial-balance" className="rounded-md px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm gap-1.5">
            <Scale className="h-3 w-3" /> Trial Balance
          </TabsTrigger>
          <TabsTrigger value="chart" className="rounded-md px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm gap-1.5">
            <BookOpen className="h-3 w-3" /> Chart of Accounts
          </TabsTrigger>
          <TabsTrigger value="journal" className="rounded-md px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm gap-1.5">
            <FileSpreadsheet className="h-3 w-3" /> Journal Entries
          </TabsTrigger>
          <TabsTrigger value="reconciliation" className="rounded-md px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm gap-1.5">
            <BarChart3 className="h-3 w-3" /> Reconciliation
          </TabsTrigger>
        </TabsList>

        {/* Trial Balance Tab */}
        <TabsContent value="trial-balance">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Trial Balance</CardTitle>
              <CardDescription className="text-xs">Summary of all account balances — debits must equal credits</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : (
                <div className="space-y-6">
                  {(["asset", "liability", "equity", "revenue", "expense"] as const).map(type => {
                    const group = trialBalance[type];
                    if (!group || group.accounts.length === 0) return null;
                    return (
                      <div key={type}>
                        <div className={`flex items-center gap-2 mb-2 px-2 py-1.5 rounded-md border ${accountTypeColors[type]}`}>
                          <span className="text-xs font-bold uppercase">{type}</span>
                          <span className="ml-auto text-xs font-semibold">
                            {group.totalDebit > 0 ? `DR ${formatXAF(group.totalDebit)}` : `CR ${formatXAF(group.totalCredit)}`}
                          </span>
                        </div>
                        <Table>
                          <TableHeader>
                            <TableRow className="hover:bg-transparent">
                              <TableHead className="text-[10px] w-20">Code</TableHead>
                              <TableHead className="text-[10px]">Account Name</TableHead>
                              <TableHead className="text-[10px] text-right w-32">Debit (DR)</TableHead>
                              <TableHead className="text-[10px] text-right w-32">Credit (CR)</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.accounts.map(a => {
                              const isDebitNormal = ['asset', 'expense'].includes(a.account_type);
                              return (
                                <TableRow key={a.id}>
                                  <TableCell className="font-mono text-xs text-muted-foreground">{a.account_code}</TableCell>
                                  <TableCell className="text-sm font-medium">{a.account_name}</TableCell>
                                  <TableCell className="text-right font-mono text-sm">
                                    {isDebitNormal ? formatXAF(Number(a.balance)) : "—"}
                                  </TableCell>
                                  <TableCell className="text-right font-mono text-sm">
                                    {!isDebitNormal ? formatXAF(Number(a.balance)) : "—"}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    );
                  })}

                  {/* Grand Total */}
                  <div className="border-t-2 border-foreground/20 pt-3">
                    <Table>
                      <TableBody>
                        <TableRow className="hover:bg-transparent font-bold text-base">
                          <TableCell className="w-20"></TableCell>
                          <TableCell>GRAND TOTAL</TableCell>
                          <TableCell className="text-right font-mono w-32">{formatXAF(grandTotalDebit)}</TableCell>
                          <TableCell className="text-right font-mono w-32">{formatXAF(grandTotalCredit)}</TableCell>
                        </TableRow>
                        <TableRow className="hover:bg-transparent">
                          <TableCell></TableCell>
                          <TableCell className="text-sm">
                            {Math.abs(grandTotalDebit - grandTotalCredit) < 0.01 ? (
                              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                                <CheckCircle className="h-4 w-4" /> Trial balance is in equilibrium
                              </span>
                            ) : (
                              <span className="flex items-center gap-1.5 text-destructive font-semibold">
                                <AlertTriangle className="h-4 w-4" /> Variance: {formatXAF(Math.abs(grandTotalDebit - grandTotalCredit))}
                              </span>
                            )}
                          </TableCell>
                          <TableCell></TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Chart of Accounts Tab */}
        <TabsContent value="chart">
          <Card className="border-border/60">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">Chart of Accounts</CardTitle>
                <CardDescription className="text-xs">All ledger accounts with current balances</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search accounts..."
                    className="pl-8 h-8 w-48 text-xs"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
                <Select value={accountTypeFilter} onValueChange={setAccountTypeFilter}>
                  <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="asset">Asset</SelectItem>
                    <SelectItem value="liability">Liability</SelectItem>
                    <SelectItem value="equity">Equity</SelectItem>
                    <SelectItem value="revenue">Revenue</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : filteredAccounts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No ledger accounts found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-[10px] w-20">Code</TableHead>
                      <TableHead className="text-[10px]">Account Name</TableHead>
                      <TableHead className="text-[10px]">Type</TableHead>
                      <TableHead className="text-[10px]">Normal Balance</TableHead>
                      <TableHead className="text-[10px] text-right">Balance</TableHead>
                      <TableHead className="text-[10px]">Currency</TableHead>
                      <TableHead className="text-[10px]">Status</TableHead>
                      <TableHead className="text-[10px]">Last Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAccounts.map(a => (
                      <TableRow key={a.id}>
                        <TableCell className="font-mono text-xs font-semibold">{a.account_code}</TableCell>
                        <TableCell className="font-medium text-sm">{a.account_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] ${accountTypeColors[a.account_type] || ''}`}>
                            {a.account_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {['asset', 'expense'].includes(a.account_type) ? 'Debit' : 'Credit'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm font-semibold">
                          {formatXAF(Number(a.balance))}
                        </TableCell>
                        <TableCell className="text-xs">{a.currency}</TableCell>
                        <TableCell>
                          <Badge variant={a.is_active ? "default" : "secondary"} className="text-[10px]">
                            {a.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {format(new Date(a.updated_at), 'MMM dd, HH:mm')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Journal Entries Tab */}
        <TabsContent value="journal">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Journal Entries — {periodLabels[periodFilter]}</CardTitle>
              <CardDescription className="text-xs">
                {filteredEntries.length} entries • Click a row to view journal lines
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : filteredEntries.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileSpreadsheet className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No journal entries for {periodLabels[periodFilter].toLowerCase()}</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredEntries.map(e => {
                    const lines = getLinesForEntry(e.id);
                    const entryDebit = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
                    const entryCredit = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
                    const isExpanded = expandedEntry === e.id;

                    return (
                      <div key={e.id} className={`border rounded-lg transition-all ${isExpanded ? 'border-fi-cyan/40 bg-fi-cyan/5' : 'border-border/60'}`}>
                        <button
                          onClick={() => setExpandedEntry(isExpanded ? null : e.id)}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 rounded-lg transition-colors"
                        >
                          <Eye className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'text-fi-cyan' : 'text-muted-foreground'}`} />
                          <span className="font-mono text-[10px] text-muted-foreground w-28 shrink-0">{e.entry_number}</span>
                          <span className="text-xs text-muted-foreground w-24 shrink-0">{format(new Date(e.entry_date), 'MMM dd, yyyy')}</span>
                          <span className="text-sm truncate flex-1">{e.description}</span>
                          <Badge variant="outline" className="text-[10px] shrink-0">{e.reference_type || 'manual'}</Badge>
                          <span className="font-mono text-xs text-rose-600 dark:text-rose-400 w-28 text-right shrink-0">DR {formatXAF(entryDebit)}</span>
                          <span className="font-mono text-xs text-emerald-600 dark:text-emerald-400 w-28 text-right shrink-0">CR {formatXAF(entryCredit)}</span>
                          {Math.abs(entryDebit - entryCredit) > 0.01 && (
                            <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                          )}
                        </button>

                        {isExpanded && lines.length > 0 && (
                          <div className="px-4 pb-3 pt-1 border-t border-border/40">
                            <Table>
                              <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                  <TableHead className="text-[10px] w-20">Code</TableHead>
                                  <TableHead className="text-[10px]">Account</TableHead>
                                  <TableHead className="text-[10px]">Description</TableHead>
                                  <TableHead className="text-[10px] text-right w-28">Debit</TableHead>
                                  <TableHead className="text-[10px] text-right w-28">Credit</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {lines.map(l => {
                                  const acct = accountMap[l.ledger_account_id];
                                  return (
                                    <TableRow key={l.id}>
                                      <TableCell className="font-mono text-xs">{acct?.account_code || '—'}</TableCell>
                                      <TableCell className="text-sm">{acct?.account_name || 'Unknown'}</TableCell>
                                      <TableCell className="text-xs text-muted-foreground">{l.description || '—'}</TableCell>
                                      <TableCell className="text-right font-mono text-sm">
                                        {Number(l.debit) > 0 ? formatXAF(Number(l.debit)) : '—'}
                                      </TableCell>
                                      <TableCell className="text-right font-mono text-sm">
                                        {Number(l.credit) > 0 ? formatXAF(Number(l.credit)) : '—'}
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                                <TableRow className="hover:bg-transparent font-semibold border-t">
                                  <TableCell></TableCell>
                                  <TableCell></TableCell>
                                  <TableCell className="text-xs">Entry Total</TableCell>
                                  <TableCell className="text-right font-mono text-sm">{formatXAF(entryDebit)}</TableCell>
                                  <TableCell className="text-right font-mono text-sm">{formatXAF(entryCredit)}</TableCell>
                                </TableRow>
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reconciliation Tab */}
        <TabsContent value="reconciliation">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Balance Sheet Reconciliation */}
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Balance Sheet Reconciliation</CardTitle>
                <CardDescription className="text-xs">Assets = Liabilities + Equity</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {loading ? (
                  <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
                ) : (
                  <>
                    {[
                      { label: "Total Assets", value: trialBalance.asset?.totalDebit || 0, color: "text-blue-600 dark:text-blue-400" },
                      { label: "Total Liabilities", value: trialBalance.liability?.totalCredit || 0, color: "text-amber-600 dark:text-amber-400" },
                      { label: "Total Equity", value: trialBalance.equity?.totalCredit || 0, color: "text-purple-600 dark:text-purple-400" },
                    ].map(item => (
                      <div key={item.label} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                        <span className="text-sm font-medium">{item.label}</span>
                        <span className={`font-mono text-sm font-bold ${item.color}`}>{formatXAF(item.value)}</span>
                      </div>
                    ))}
                    <div className="pt-2 border-t-2 border-foreground/20">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold">Liabilities + Equity</span>
                        <span className="font-mono text-sm font-bold">
                          {formatXAF((trialBalance.liability?.totalCredit || 0) + (trialBalance.equity?.totalCredit || 0))}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        {Math.abs((trialBalance.asset?.totalDebit || 0) - (trialBalance.liability?.totalCredit || 0) - (trialBalance.equity?.totalCredit || 0)) < 0.01 ? (
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-400 gap-1">
                            <CheckCircle className="h-3 w-3" /> Equation Balanced
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" /> Variance: {formatXAF(Math.abs((trialBalance.asset?.totalDebit || 0) - (trialBalance.liability?.totalCredit || 0) - (trialBalance.equity?.totalCredit || 0)))}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Income Statement */}
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Income Statement Summary</CardTitle>
                <CardDescription className="text-xs">Revenue − Expenses = Net Income</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {loading ? (
                  <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
                ) : (
                  <>
                    {[
                      { label: "Total Revenue", value: trialBalance.revenue?.totalCredit || 0, color: "text-emerald-600 dark:text-emerald-400" },
                      { label: "Total Expenses", value: trialBalance.expense?.totalDebit || 0, color: "text-rose-600 dark:text-rose-400" },
                    ].map(item => (
                      <div key={item.label} className="flex items-center justify-between py-2 border-b border-border/40">
                        <span className="text-sm font-medium">{item.label}</span>
                        <span className={`font-mono text-sm font-bold ${item.color}`}>{formatXAF(item.value)}</span>
                      </div>
                    ))}
                    <div className="pt-2 border-t-2 border-foreground/20">
                      {(() => {
                        const netIncome = (trialBalance.revenue?.totalCredit || 0) - (trialBalance.expense?.totalDebit || 0);
                        return (
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold">Net Income</span>
                            <span className={`font-mono text-lg font-bold ${netIncome >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
                              {formatXAF(netIncome)}
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Period Activity Summary */}
            <Card className="border-border/60 md:col-span-2">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Account Activity — {periodLabels[periodFilter]}</CardTitle>
                <CardDescription className="text-xs">Debit/credit movement per account in the selected period</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
                ) : (() => {
                  // Compute per-account activity from filtered lines
                  const activity: Record<string, { debit: number; credit: number }> = {};
                  for (const l of filteredLines) {
                    if (!activity[l.ledger_account_id]) activity[l.ledger_account_id] = { debit: 0, credit: 0 };
                    activity[l.ledger_account_id].debit += Number(l.debit || 0);
                    activity[l.ledger_account_id].credit += Number(l.credit || 0);
                  }
                  const activeAccounts = Object.entries(activity)
                    .map(([id, vals]) => ({ account: accountMap[id], ...vals }))
                    .filter(a => a.account)
                    .sort((a, b) => (b.debit + b.credit) - (a.debit + a.credit));

                  if (activeAccounts.length === 0) {
                    return (
                      <div className="text-center py-8 text-muted-foreground">
                        <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">No activity in this period</p>
                      </div>
                    );
                  }

                  return (
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-[10px] w-20">Code</TableHead>
                          <TableHead className="text-[10px]">Account</TableHead>
                          <TableHead className="text-[10px]">Type</TableHead>
                          <TableHead className="text-[10px] text-right w-28">Total Debits</TableHead>
                          <TableHead className="text-[10px] text-right w-28">Total Credits</TableHead>
                          <TableHead className="text-[10px] text-right w-28">Net Movement</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {activeAccounts.map(a => {
                          const net = a.debit - a.credit;
                          return (
                            <TableRow key={a.account!.id}>
                              <TableCell className="font-mono text-xs">{a.account!.account_code}</TableCell>
                              <TableCell className="text-sm font-medium">{a.account!.account_name}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={`text-[10px] ${accountTypeColors[a.account!.account_type] || ''}`}>
                                  {a.account!.account_type}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm">{a.debit > 0 ? formatXAF(a.debit) : '—'}</TableCell>
                              <TableCell className="text-right font-mono text-sm">{a.credit > 0 ? formatXAF(a.credit) : '—'}</TableCell>
                              <TableCell className={`text-right font-mono text-sm font-semibold ${net > 0 ? 'text-rose-600 dark:text-rose-400' : net < 0 ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
                                {net > 0 ? `DR ${formatXAF(net)}` : net < 0 ? `CR ${formatXAF(Math.abs(net))}` : '—'}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  );
                })()}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
