import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { motion } from "framer-motion";
import { RefreshCw, PiggyBank, Percent, ArrowUpDown, Search, Plus, Download, Eye, TrendingUp, Users, Wallet, ToggleLeft } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const } }),
};

export default function InstitutionSavings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [savingsAccounts, setSavingsAccounts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [interestAccruals, setInterestAccruals] = useState<any[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  // Detail sheet
  const [selectedAccount, setSelectedAccount] = useState<any>(null);

  // Create product dialog
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newProduct, setNewProduct] = useState({
    product_name: "", product_code: "", savings_type: "regular" as string,
    base_interest_rate: "3", interest_payment_frequency: "monthly",
    min_opening_balance: "1000", min_balance: "0",
    max_withdrawals_per_month: "", lock_in_period_months: "",
    early_closure_penalty: "", description: "",
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth'); return; }

      // Check for institution owner OR staff
      let instId: string | null = null;
      const { data: institution } = await supabase.from("institutions").select("id").eq("user_id", user.id).maybeSingle();
      if (institution) {
        instId = institution.id;
      } else {
        const { data: staff } = await supabase.from("staff_assignments").select("institution_id").eq("user_id", user.id).eq("is_active", true).maybeSingle();
        if (staff) instId = staff.institution_id;
      }
      if (!instId) { navigate('/register'); return; }
      setInstitutionId(instId);

      const { data: prods } = await supabase.from("savings_products").select("*").eq("institution_id", instId).order("created_at", { ascending: false });
      setProducts(prods || []);
      const productIds = (prods || []).map(p => p.id);
      if (productIds.length > 0) {
        const { data: accts } = await supabase.from("savings_accounts").select("*").in("product_id", productIds).order("created_at", { ascending: false });
        setSavingsAccounts(accts || []);
        const acctIds = (accts || []).map(a => a.id);
        if (acctIds.length > 0) {
          const { data: txns } = await supabase.from("savings_transactions").select("*").in("savings_account_id", acctIds).order("created_at", { ascending: false }).limit(200);
          setTransactions(txns || []);
          const { data: interest } = await supabase.from("interest_accruals").select("*").in("savings_account_id", acctIds).order("accrual_date", { ascending: false }).limit(200);
          setInterestAccruals(interest || []);
        }
      }
    } catch (error) { console.error("Error loading savings:", error); }
    finally { setLoading(false); }
  };

  const handleCreateProduct = async () => {
    if (!institutionId || !newProduct.product_name || !newProduct.product_code) return;
    setCreating(true);
    try {
      const { error } = await supabase.from("savings_products").insert({
        institution_id: institutionId,
        product_name: newProduct.product_name,
        product_code: newProduct.product_code,
        savings_type: newProduct.savings_type as any,
        base_interest_rate: Number(newProduct.base_interest_rate),
        interest_payment_frequency: newProduct.interest_payment_frequency,
        min_opening_balance: Number(newProduct.min_opening_balance),
        min_balance: Number(newProduct.min_balance) || 0,
        max_withdrawals_per_month: newProduct.max_withdrawals_per_month ? Number(newProduct.max_withdrawals_per_month) : null,
        lock_in_period_months: newProduct.lock_in_period_months ? Number(newProduct.lock_in_period_months) : null,
        early_closure_penalty: newProduct.early_closure_penalty ? Number(newProduct.early_closure_penalty) : null,
        description: newProduct.description || null,
        is_active: true,
      });
      if (error) throw error;
      toast.success("Savings product created successfully");
      setShowCreate(false);
      setNewProduct({ product_name: "", product_code: "", savings_type: "regular", base_interest_rate: "3", interest_payment_frequency: "monthly", min_opening_balance: "1000", min_balance: "0", max_withdrawals_per_month: "", lock_in_period_months: "", early_closure_penalty: "", description: "" });
      loadData();
    } catch (err: any) { toast.error(err.message || "Failed to create product"); }
    finally { setCreating(false); }
  };

  const handleToggleProduct = async (productId: string, currentActive: boolean) => {
    const { error } = await supabase.from("savings_products").update({ is_active: !currentActive }).eq("id", productId);
    if (error) { toast.error("Failed to update product"); return; }
    toast.success(`Product ${!currentActive ? 'activated' : 'deactivated'}`);
    loadData();
  };

  const exportCSV = () => {
    const headers = ["Account", "Type", "Balance", "Interest Rate", "Interest Earned", "Status"];
    const rows = savingsAccounts.map(a => [a.account_name || a.account_id, a.savings_type, a.current_balance, a.current_interest_rate, a.total_interest_earned, a.status]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `savings-accounts-${format(new Date(), 'yyyy-MM-dd')}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  // Stats
  const totalBalance = savingsAccounts.reduce((sum, a) => sum + Number(a.current_balance || 0), 0);
  const totalInterest = savingsAccounts.reduce((sum, a) => sum + Number(a.total_interest_earned || 0), 0);
  const activeAccounts = savingsAccounts.filter(a => a.status === 'active').length;
  const totalDeposits = transactions.filter(t => t.transaction_type === 'deposit').reduce((s, t) => s + Number(t.amount || 0), 0);

  // Filtered data
  const filteredProducts = useMemo(() => products.filter(p => {
    if (searchQuery && !p.product_name.toLowerCase().includes(searchQuery.toLowerCase()) && !p.product_code.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (typeFilter !== "all" && p.savings_type !== typeFilter) return false;
    return true;
  }), [products, searchQuery, typeFilter]);

  const filteredAccounts = useMemo(() => savingsAccounts.filter(a => {
    if (searchQuery && !(a.account_name || "").toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    return true;
  }), [savingsAccounts, searchQuery, statusFilter]);

  const stats = [
    { label: "Total Balance", value: `${totalBalance.toLocaleString()} XAF`, icon: Wallet, color: "text-fi-green bg-fi-green/10 border-fi-green/20", sub: `${activeAccounts} active accounts` },
    { label: "Interest Earned", value: `${totalInterest.toLocaleString()} XAF`, icon: TrendingUp, color: "text-fi-amber bg-fi-amber/10 border-fi-amber/20", sub: `${interestAccruals.length} accruals` },
    { label: "Products", value: products.length, icon: PiggyBank, color: "text-fi-teal bg-fi-teal/10 border-fi-teal/20", sub: `${products.filter(p => p.is_active).length} active` },
    { label: "Total Deposits", value: `${totalDeposits.toLocaleString()} XAF`, icon: ArrowUpDown, color: "text-fi-purple bg-fi-purple/10 border-fi-purple/20", sub: `${transactions.length} transactions` },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-fi-green/10 border border-fi-green/20">
            <PiggyBank className="h-5.5 w-5.5 text-fi-green" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Savings Management</h1>
            <p className="text-xs text-muted-foreground">Products, accounts, interest & transactions</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5 text-xs"><Download className="h-3.5 w-3.5" />Export</Button>
          <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5 text-xs bg-fi-green text-white hover:bg-fi-green/90"><Plus className="h-3.5 w-3.5" />New Product</Button>
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /></Button>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s, i) => (
          <motion.div key={s.label} initial="hidden" animate="visible" variants={fadeUp} custom={i + 1}>
            <Card className="border-border/60 hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5">
                <CardTitle className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</CardTitle>
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg border ${s.color}`}><s.icon className="h-3.5 w-3.5" /></div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-20" /> : s.value}</div>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{s.sub}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Search & Filter bar */}
      <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={5} className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search products or accounts..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 h-9 text-sm" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] h-9 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="frozen">Frozen</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[140px] h-9 text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="regular">Regular</SelectItem>
            <SelectItem value="fixed_deposit">Fixed Deposit</SelectItem>
            <SelectItem value="goal_based">Goal Based</SelectItem>
          </SelectContent>
        </Select>
      </motion.div>

      {/* Tabs */}
      <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={6}>
        <Tabs defaultValue="products" className="space-y-4">
          <TabsList className="inline-flex h-9 items-center rounded-lg bg-muted p-1">
            <TabsTrigger value="products" className="rounded-md px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">Products ({filteredProducts.length})</TabsTrigger>
            <TabsTrigger value="accounts" className="rounded-md px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">Accounts ({filteredAccounts.length})</TabsTrigger>
            <TabsTrigger value="transactions" className="rounded-md px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">Transactions ({transactions.length})</TabsTrigger>
            <TabsTrigger value="interest" className="rounded-md px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">Interest ({interestAccruals.length})</TabsTrigger>
          </TabsList>

          {/* Products */}
          <TabsContent value="products">
            <Card className="border-border/60">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold">Savings Products</CardTitle>
                <Badge variant="outline" className="text-[10px]">{products.filter(p => p.is_active).length} active</Badge>
              </CardHeader>
              <CardContent>
                {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div> : filteredProducts.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <PiggyBank className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p className="text-sm font-medium">No savings products</p>
                    <p className="text-xs mt-1">Create a savings product to get started</p>
                    <Button size="sm" onClick={() => setShowCreate(true)} className="mt-4 gap-1.5"><Plus className="h-3.5 w-3.5" />Create Product</Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent border-border/40">
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Product</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Code</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Type</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Interest Rate</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Min Opening</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Accounts</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredProducts.map(p => {
                          const acctCount = savingsAccounts.filter(a => a.product_id === p.id).length;
                          return (
                            <TableRow key={p.id} className="hover:bg-muted/40 transition-colors">
                              <TableCell>
                                <div>
                                  <p className="font-medium text-sm">{p.product_name}</p>
                                  {p.description && <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">{p.description}</p>}
                                </div>
                              </TableCell>
                              <TableCell className="font-mono text-xs text-muted-foreground">{p.product_code}</TableCell>
                              <TableCell><Badge variant="outline" className="text-[10px] capitalize">{p.savings_type?.replace('_', ' ')}</Badge></TableCell>
                              <TableCell className="text-sm font-semibold text-fi-green">{p.base_interest_rate}% p.a.</TableCell>
                              <TableCell className="text-sm">{Number(p.min_opening_balance).toLocaleString()} XAF</TableCell>
                              <TableCell><Badge variant="secondary" className="text-[10px]">{acctCount}</Badge></TableCell>
                              <TableCell><Badge variant={p.is_active ? "default" : "secondary"} className="text-[10px]">{p.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                              <TableCell>
                                <Button variant="ghost" size="sm" onClick={() => handleToggleProduct(p.id, p.is_active)} className="h-7 px-2 text-xs gap-1">
                                  <ToggleLeft className="h-3 w-3" />{p.is_active ? 'Disable' : 'Enable'}
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Accounts */}
          <TabsContent value="accounts">
            <Card className="border-border/60">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold">Savings Accounts</CardTitle>
                <Badge variant="outline" className="text-[10px]">{activeAccounts} active</Badge>
              </CardHeader>
              <CardContent>
                {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div> : filteredAccounts.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p className="text-sm font-medium">No savings accounts</p>
                    <p className="text-xs mt-1">Customers can open accounts from the banking app</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent border-border/40">
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Account</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Type</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Balance</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Rate</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Interest Earned</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Target</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAccounts.map(a => (
                          <TableRow key={a.id} className="hover:bg-muted/40 transition-colors cursor-pointer" onClick={() => setSelectedAccount(a)}>
                            <TableCell>
                              <p className="font-medium text-sm">{a.account_name || 'Savings Account'}</p>
                              <p className="text-[10px] text-muted-foreground font-mono">{a.id.slice(0, 8)}...</p>
                            </TableCell>
                            <TableCell><Badge variant="outline" className="text-[10px] capitalize">{a.savings_type?.replace('_', ' ')}</Badge></TableCell>
                            <TableCell className="text-sm font-semibold">{Number(a.current_balance).toLocaleString()} XAF</TableCell>
                            <TableCell className="text-sm">{a.current_interest_rate}%</TableCell>
                            <TableCell className="text-sm text-fi-green">{Number(a.total_interest_earned).toLocaleString()} XAF</TableCell>
                            <TableCell className="text-sm">{a.target_amount ? `${Number(a.target_amount).toLocaleString()} XAF` : '—'}</TableCell>
                            <TableCell><Badge variant={a.status === 'active' ? "default" : a.status === 'frozen' ? "destructive" : "secondary"} className="text-[10px]">{a.status}</Badge></TableCell>
                            <TableCell><Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={e => { e.stopPropagation(); setSelectedAccount(a); }}><Eye className="h-3 w-3" />View</Button></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Transactions */}
          <TabsContent value="transactions">
            <Card className="border-border/60">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold">Savings Transactions</CardTitle>
                <Badge variant="outline" className="text-[10px]">{transactions.length} records</Badge>
              </CardHeader>
              <CardContent>
                {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : transactions.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground"><ArrowUpDown className="h-12 w-12 mx-auto mb-3 opacity-20" /><p className="text-sm font-medium">No transactions</p></div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent border-border/40">
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Type</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Amount</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Balance After</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Description</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Reference</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactions.map(t => (
                          <TableRow key={t.id} className="hover:bg-muted/40 transition-colors">
                            <TableCell>
                              <Badge variant={t.transaction_type === 'deposit' ? "default" : "outline"} className={`text-[10px] ${t.transaction_type === 'deposit' ? 'bg-fi-green/15 text-fi-green border-fi-green/30' : 'bg-fi-amber/15 text-fi-amber border-fi-amber/30'}`}>
                                {t.transaction_type}
                              </Badge>
                            </TableCell>
                            <TableCell className={`font-semibold text-sm ${t.transaction_type === 'deposit' ? 'text-fi-green' : 'text-fi-amber'}`}>
                              {t.transaction_type === 'deposit' ? '+' : '-'}{Number(t.amount).toLocaleString()} XAF
                            </TableCell>
                            <TableCell className="text-sm">{Number(t.balance_after).toLocaleString()} XAF</TableCell>
                            <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">{t.description || '—'}</TableCell>
                            <TableCell className="font-mono text-[10px] text-muted-foreground">{t.reference || '—'}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{t.created_at ? format(new Date(t.created_at), 'PP p') : '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Interest */}
          <TabsContent value="interest">
            <Card className="border-border/60">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold">Interest Accruals</CardTitle>
                <Badge variant="outline" className="text-[10px]">{interestAccruals.length} records</Badge>
              </CardHeader>
              <CardContent>
                {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : interestAccruals.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground"><Percent className="h-12 w-12 mx-auto mb-3 opacity-20" /><p className="text-sm font-medium">No interest accruals</p><p className="text-xs mt-1">Interest is accrued daily for active accounts</p></div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent border-border/40">
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Date</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Rate</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Accrued</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Balance Before</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Balance After</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {interestAccruals.map(i => (
                          <TableRow key={i.id} className="hover:bg-muted/40 transition-colors">
                            <TableCell className="text-sm">{format(new Date(i.accrual_date), 'PP')}</TableCell>
                            <TableCell className="text-sm">{i.interest_rate}%</TableCell>
                            <TableCell className="font-semibold text-sm text-fi-green">+{Number(i.accrued_amount).toLocaleString()} XAF</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{Number(i.balance_before).toLocaleString()}</TableCell>
                            <TableCell className="text-sm">{Number(i.balance_after).toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* Account Detail Sheet */}
      <Sheet open={!!selectedAccount} onOpenChange={() => setSelectedAccount(null)}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-lg">Account Details</SheetTitle>
          </SheetHeader>
          {selectedAccount && (
            <div className="mt-6 space-y-4">
              <div className="rounded-xl bg-fi-green/5 border border-fi-green/20 p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Current Balance</p>
                <p className="text-3xl font-bold text-fi-green">{Number(selectedAccount.current_balance).toLocaleString()} XAF</p>
              </div>
              {[
                { label: "Account Name", value: selectedAccount.account_name || '—' },
                { label: "Type", value: selectedAccount.savings_type?.replace('_', ' ') },
                { label: "Status", value: selectedAccount.status },
                { label: "Interest Rate", value: `${selectedAccount.current_interest_rate}% p.a.` },
                { label: "Interest Earned", value: `${Number(selectedAccount.total_interest_earned).toLocaleString()} XAF` },
                { label: "Available Balance", value: `${Number(selectedAccount.available_balance).toLocaleString()} XAF` },
                { label: "Target Amount", value: selectedAccount.target_amount ? `${Number(selectedAccount.target_amount).toLocaleString()} XAF` : '—' },
                { label: "Target Date", value: selectedAccount.target_date ? format(new Date(selectedAccount.target_date), 'PP') : '—' },
                { label: "Auto-Save", value: selectedAccount.auto_save_enabled ? `${Number(selectedAccount.auto_save_amount).toLocaleString()} XAF / ${selectedAccount.auto_save_frequency}` : 'Disabled' },
                { label: "Locked", value: selectedAccount.is_locked ? 'Yes' : 'No' },
                { label: "Maturity Date", value: selectedAccount.maturity_date ? format(new Date(selectedAccount.maturity_date), 'PP') : '—' },
                { label: "Created", value: selectedAccount.created_at ? format(new Date(selectedAccount.created_at), 'PPp') : '—' },
              ].map(f => (
                <div key={f.label} className="flex items-center justify-between border-b border-border/30 pb-2">
                  <span className="text-xs text-muted-foreground">{f.label}</span>
                  <span className="text-sm font-medium capitalize">{f.value}</span>
                </div>
              ))}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Create Product Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><PiggyBank className="h-5 w-5 text-fi-green" />Create Savings Product</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Product Name *</Label>
                <Input placeholder="e.g. Smart Saver" value={newProduct.product_name} onChange={e => setNewProduct(p => ({ ...p, product_name: e.target.value }))} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Product Code *</Label>
                <Input placeholder="e.g. SAV-001" value={newProduct.product_code} onChange={e => setNewProduct(p => ({ ...p, product_code: e.target.value }))} className="h-9 text-sm font-mono" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Savings Type *</Label>
                <Select value={newProduct.savings_type} onValueChange={v => setNewProduct(p => ({ ...p, savings_type: v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="regular">Regular Savings</SelectItem>
                    <SelectItem value="fixed_deposit">Fixed Deposit</SelectItem>
                    <SelectItem value="goal_based">Goal Based</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Interest Rate (% p.a.) *</Label>
                <Input type="number" step="0.01" value={newProduct.base_interest_rate} onChange={e => setNewProduct(p => ({ ...p, base_interest_rate: e.target.value }))} className="h-9 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Interest Frequency</Label>
                <Select value={newProduct.interest_payment_frequency} onValueChange={v => setNewProduct(p => ({ ...p, interest_payment_frequency: v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="annually">Annually</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Min Opening Balance (XAF)</Label>
                <Input type="number" value={newProduct.min_opening_balance} onChange={e => setNewProduct(p => ({ ...p, min_opening_balance: e.target.value }))} className="h-9 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Min Balance (XAF)</Label>
                <Input type="number" value={newProduct.min_balance} onChange={e => setNewProduct(p => ({ ...p, min_balance: e.target.value }))} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Max Withdrawals/Month</Label>
                <Input type="number" placeholder="Unlimited" value={newProduct.max_withdrawals_per_month} onChange={e => setNewProduct(p => ({ ...p, max_withdrawals_per_month: e.target.value }))} className="h-9 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Lock-in Period (months)</Label>
                <Input type="number" placeholder="None" value={newProduct.lock_in_period_months} onChange={e => setNewProduct(p => ({ ...p, lock_in_period_months: e.target.value }))} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Early Closure Penalty (%)</Label>
                <Input type="number" step="0.1" placeholder="0" value={newProduct.early_closure_penalty} onChange={e => setNewProduct(p => ({ ...p, early_closure_penalty: e.target.value }))} className="h-9 text-sm" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Description</Label>
              <Input placeholder="Product description..." value={newProduct.description} onChange={e => setNewProduct(p => ({ ...p, description: e.target.value }))} className="h-9 text-sm" />
            </div>
            <Button onClick={handleCreateProduct} disabled={creating || !newProduct.product_name || !newProduct.product_code} className="mt-2 bg-fi-green text-white hover:bg-fi-green/90">
              {creating ? 'Creating...' : 'Create Product'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
