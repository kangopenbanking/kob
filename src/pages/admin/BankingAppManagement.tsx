import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Smartphone, Users, CreditCard, ArrowRightLeft, PiggyBank, Landmark,
  Search, Loader2, Building2, Wallet, Settings2
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

// ─── Types ───
interface AppConfig {
  features: {
    cards: boolean;
    savings: boolean;
    loans: boolean;
    credit_score: boolean;
    mobile_money: boolean;
    qr_payments: boolean;
    bill_payments: boolean;
  };
  home_layout: {
    show_balance_card: boolean;
    show_account_carousel: boolean;
    show_financial_services: boolean;
    show_recent_transactions: boolean;
  };
}

const defaultAppConfig: AppConfig = {
  features: { cards: true, savings: true, loans: true, credit_score: true, mobile_money: true, qr_payments: true, bill_payments: true },
  home_layout: { show_balance_card: true, show_account_carousel: true, show_financial_services: true, show_recent_transactions: true },
};

// ─── Hooks ───
function useInstitutions() {
  return useQuery({
    queryKey: ["admin-institutions-banking"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("institutions")
        .select("id, institution_name, institution_type, status, logo_url, primary_color, created_at, app_config")
        .order("institution_name");
      if (error) throw error;
      return data || [];
    },
  });
}

function useInstitutionAccounts(institutionId: string | null) {
  return useQuery({
    queryKey: ["admin-inst-accounts", institutionId],
    enabled: !!institutionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("*, account_balances(*)")
        .eq("institution_id", institutionId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

function useInstitutionTransactions(institutionId: string | null) {
  return useQuery({
    queryKey: ["admin-inst-transactions", institutionId],
    enabled: !!institutionId,
    queryFn: async () => {
      const { data: accounts } = await supabase
        .from("accounts")
        .select("id")
        .eq("institution_id", institutionId!);
      const accountIds = (accounts || []).map((a) => a.id);
      if (accountIds.length === 0) return [];
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .in("account_id", accountIds)
        .order("created_at", { ascending: false })
        .limit(100) as any;
      if (error) throw error;
      return data || [];
    },
  });
}

function useInstitutionSavings(institutionId: string | null) {
  return useQuery({
    queryKey: ["admin-inst-savings", institutionId],
    enabled: !!institutionId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("savings_accounts")
        .select("*")
        .eq("institution_id", institutionId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

function useInstitutionLoans(institutionId: string | null) {
  return useQuery({
    queryKey: ["admin-inst-loans", institutionId],
    enabled: !!institutionId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("loan_applications")
        .select("*, loan_product:loan_products(*)")
        .eq("institution_id", institutionId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

// ─── Stat Card ───
function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Feature Config Panel ───
function FeatureConfigPanel({ institutionId, appConfig }: { institutionId: string; appConfig: AppConfig }) {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<AppConfig>(appConfig);

  const mutation = useMutation({
    mutationFn: async (newConfig: AppConfig) => {
      const { error } = await (supabase as any)
        .from("institutions")
        .update({ app_config: newConfig })
        .eq("id", institutionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-institutions-banking"] });
      toast.success("Feature configuration saved");
    },
    onError: () => toast.error("Failed to save configuration"),
  });

  const toggleFeature = (key: keyof AppConfig["features"]) => {
    setConfig(prev => ({ ...prev, features: { ...prev.features, [key]: !prev.features[key] } }));
  };

  const toggleLayout = (key: keyof AppConfig["home_layout"]) => {
    setConfig(prev => ({ ...prev, home_layout: { ...prev.home_layout, [key]: !prev.home_layout[key] } }));
  };

  const featureLabels: Record<string, string> = {
    cards: "Virtual Cards",
    savings: "Savings Goals",
    loans: "Loan Applications",
    credit_score: "Credit Score (CrediQ)",
    mobile_money: "Mobile Money (MoMo)",
    qr_payments: "QR Payments",
    bill_payments: "Bill Payments",
  };

  const layoutLabels: Record<string, string> = {
    show_balance_card: "Balance Card",
    show_account_carousel: "Account Carousel",
    show_financial_services: "Financial Services Grid",
    show_recent_transactions: "Recent Transactions",
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">App Features</CardTitle>
          <CardDescription>Toggle which features are available in this bank's app</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(featureLabels).map(([key, label]) => (
            <div key={key} className="flex items-center justify-between">
              <Label htmlFor={`feat-${key}`} className="text-sm font-medium">{label}</Label>
              <Switch
                id={`feat-${key}`}
                checked={config.features[key as keyof AppConfig["features"]]}
                onCheckedChange={() => toggleFeature(key as keyof AppConfig["features"])}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Home Screen Layout</CardTitle>
          <CardDescription>Control which sections appear on the home screen</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(layoutLabels).map(([key, label]) => (
            <div key={key} className="flex items-center justify-between">
              <Label htmlFor={`layout-${key}`} className="text-sm font-medium">{label}</Label>
              <Switch
                id={`layout-${key}`}
                checked={config.home_layout[key as keyof AppConfig["home_layout"]]}
                onCheckedChange={() => toggleLayout(key as keyof AppConfig["home_layout"])}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Button onClick={() => mutation.mutate(config)} disabled={mutation.isPending} className="w-full">
        {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Save Configuration
      </Button>
    </div>
  );
}

// ─── Main Component ───
export default function BankingAppManagement() {
  const [selectedInstitution, setSelectedInstitution] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const { data: institutions = [], isLoading: loadingInstitutions } = useInstitutions();
  const { data: accounts = [], isLoading: loadingAccounts } = useInstitutionAccounts(selectedInstitution);
  const { data: transactions = [], isLoading: loadingTxns } = useInstitutionTransactions(selectedInstitution);
  const { data: savings = [], isLoading: loadingSavings } = useInstitutionSavings(selectedInstitution);
  const { data: loans = [], isLoading: loadingLoans } = useInstitutionLoans(selectedInstitution);

  const selectedInst = institutions.find((i) => i.id === selectedInstitution) as any;

  const totalBalance = accounts.reduce((sum, acc) => {
    const bal = acc.account_balances?.[0]?.amount || 0;
    return sum + bal;
  }, 0);

  const filteredInstitutions = institutions.filter((i) =>
    i.institution_name.toLowerCase().includes(search.toLowerCase())
  );

  const selectedAppConfig: AppConfig = selectedInst
    ? { ...defaultAppConfig, ...(selectedInst.app_config || {}), features: { ...defaultAppConfig.features, ...(selectedInst.app_config?.features || {}) }, home_layout: { ...defaultAppConfig.home_layout, ...(selectedInst.app_config?.home_layout || {}) } }
    : defaultAppConfig;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Smartphone className="h-6 w-6 text-primary" />
          Banking App Management
        </h1>
        <p className="text-muted-foreground">
          Manage individual banking app instances, view per-institution user accounts, transactions, and settings
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Institution List Sidebar */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Institutions</CardTitle>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              {loadingInstitutions ? (
                <div className="flex justify-center p-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : filteredInstitutions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center p-6">No institutions found</p>
              ) : (
                filteredInstitutions.map((inst) => (
                  <button
                    key={inst.id}
                    onClick={() => setSelectedInstitution(inst.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent/50 transition-colors border-b last:border-b-0 ${
                      selectedInstitution === inst.id ? "bg-primary/10 border-l-2 border-l-primary" : ""
                    }`}
                  >
                    {inst.logo_url ? (
                      <img src={inst.logo_url} alt="" className="h-8 w-8 rounded-md object-cover" />
                    ) : (
                      <div
                        className="h-8 w-8 rounded-md flex items-center justify-center text-white text-xs font-bold"
                        style={{ backgroundColor: inst.primary_color || "hsl(var(--primary))" }}
                      >
                        {inst.institution_name.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{inst.institution_name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{inst.institution_type}</p>
                    </div>
                    <Badge
                      variant={inst.status === "approved" ? "default" : "secondary"}
                      className="text-[10px] shrink-0"
                    >
                      {inst.status}
                    </Badge>
                  </button>
                ))
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-6">
          {!selectedInstitution ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Building2 className="h-12 w-12 text-muted-foreground/40 mb-4" />
                <h3 className="text-lg font-medium">Select an Institution</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Choose a banking institution from the left to view its app data
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Institution Header */}
              <Card>
                <CardContent className="flex items-center gap-4 p-4">
                  {selectedInst?.logo_url ? (
                    <img src={selectedInst.logo_url} alt="" className="h-12 w-12 rounded-lg object-cover" />
                  ) : (
                    <div
                      className="h-12 w-12 rounded-lg flex items-center justify-center text-white text-lg font-bold"
                      style={{ backgroundColor: selectedInst?.primary_color || "hsl(var(--primary))" }}
                    >
                      {selectedInst?.institution_name?.charAt(0)}
                    </div>
                  )}
                  <div className="flex-1">
                    <h2 className="text-lg font-bold">{selectedInst?.institution_name}</h2>
                    <p className="text-sm text-muted-foreground capitalize">
                      {selectedInst?.institution_type} · Created {selectedInst?.created_at ? format(new Date(selectedInst.created_at), "MMM d, yyyy") : "—"}
                    </p>
                  </div>
                  <Badge variant={selectedInst?.status === "approved" ? "default" : "secondary"}>
                    {selectedInst?.status}
                  </Badge>
                </CardContent>
              </Card>

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard icon={Users} label="Accounts" value={accounts.length} color="bg-blue-500" />
                <StatCard icon={Wallet} label="Total Balance" value={`${totalBalance.toLocaleString()} XAF`} color="bg-emerald-500" />
                <StatCard icon={ArrowRightLeft} label="Transactions" value={transactions.length} color="bg-amber-500" />
                <StatCard icon={PiggyBank} label="Savings Goals" value={savings.length} color="bg-purple-500" />
              </div>

              {/* Tabs */}
              <Tabs defaultValue="accounts">
                <TabsList className="w-full justify-start">
                  <TabsTrigger value="accounts" className="gap-1.5">
                    <CreditCard className="h-3.5 w-3.5" /> Accounts
                  </TabsTrigger>
                  <TabsTrigger value="transactions" className="gap-1.5">
                    <ArrowRightLeft className="h-3.5 w-3.5" /> Transactions
                  </TabsTrigger>
                  <TabsTrigger value="savings" className="gap-1.5">
                    <PiggyBank className="h-3.5 w-3.5" /> Savings
                  </TabsTrigger>
                  <TabsTrigger value="loans" className="gap-1.5">
                    <Landmark className="h-3.5 w-3.5" /> Loans
                  </TabsTrigger>
                  <TabsTrigger value="features" className="gap-1.5">
                    <Settings2 className="h-3.5 w-3.5" /> Features
                  </TabsTrigger>
                </TabsList>

                {/* Accounts Tab */}
                <TabsContent value="accounts">
                  <Card>
                    <CardContent className="p-0">
                      {loadingAccounts ? (
                        <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
                      ) : accounts.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center p-8">No accounts found</p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Account Holder</TableHead>
                              <TableHead>Account ID</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead>Currency</TableHead>
                              <TableHead className="text-right">Balance</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {accounts.map((acc) => (
                              <TableRow key={acc.id}>
                                <TableCell className="font-medium">{acc.account_holder_name}</TableCell>
                                <TableCell className="font-mono text-xs">{acc.account_id}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="capitalize text-xs">
                                    {acc.account_subtype}
                                  </Badge>
                                </TableCell>
                                <TableCell>{acc.currency}</TableCell>
                                <TableCell className="text-right font-medium">
                                  {(acc.account_balances?.[0]?.amount || 0).toLocaleString()}
                                </TableCell>
                                <TableCell>
                                  <Badge variant={acc.is_active ? "default" : "secondary"} className="text-xs">
                                    {acc.is_active ? "Active" : "Inactive"}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Transactions Tab */}
                <TabsContent value="transactions">
                  <Card>
                    <CardContent className="p-0">
                      {loadingTxns ? (
                        <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
                      ) : transactions.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center p-8">No transactions found</p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Reference</TableHead>
                              <TableHead>Description</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead className="text-right">Amount</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {transactions.map((txn) => (
                              <TableRow key={txn.id}>
                                <TableCell className="text-sm">
                                  {txn.booking_date ? format(new Date(txn.booking_date), "MMM d, yyyy") : "—"}
                                </TableCell>
                                <TableCell className="font-mono text-xs">{txn.transaction_id?.slice(0, 12)}...</TableCell>
                                <TableCell className="max-w-[200px] truncate text-sm">
                                  {txn.transaction_information || "—"}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant={txn.credit_debit_indicator === "Credit" ? "default" : "secondary"}
                                    className="text-xs"
                                  >
                                    {txn.credit_debit_indicator}
                                  </Badge>
                                </TableCell>
                                <TableCell className={`text-right font-medium ${txn.credit_debit_indicator === "Credit" ? "text-emerald-600" : "text-red-500"}`}>
                                  {txn.credit_debit_indicator === "Credit" ? "+" : "-"}
                                  {Number(txn.amount).toLocaleString()} {txn.currency}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-xs capitalize">{txn.status}</Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Savings Tab */}
                <TabsContent value="savings">
                  <Card>
                    <CardContent className="p-0">
                      {loadingSavings ? (
                        <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
                      ) : savings.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center p-8">No savings accounts found</p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>Target</TableHead>
                              <TableHead className="text-right">Balance</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Created</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {savings.map((s: any) => (
                              <TableRow key={s.id}>
                                <TableCell className="font-medium">{s.account_name || "Savings"}</TableCell>
                                <TableCell>{s.target_amount ? `${Number(s.target_amount).toLocaleString()} XAF` : "—"}</TableCell>
                                <TableCell className="text-right font-medium">
                                  {Number(s.current_balance || 0).toLocaleString()} XAF
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-xs capitalize">{s.status}</Badge>
                                </TableCell>
                                <TableCell className="text-sm">
                                  {s.created_at ? format(new Date(s.created_at), "MMM d, yyyy") : "—"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Loans Tab */}
                <TabsContent value="loans">
                  <Card>
                    <CardContent className="p-0">
                      {loadingLoans ? (
                        <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
                      ) : loans.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center p-8">No loan applications found</p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Product</TableHead>
                              <TableHead className="text-right">Amount</TableHead>
                              <TableHead>Tenure</TableHead>
                              <TableHead>Purpose</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Applied</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {loans.map((loan: any) => (
                              <TableRow key={loan.id}>
                                <TableCell className="font-medium">
                                  {loan.loan_product?.product_name || "—"}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  {Number(loan.requested_amount).toLocaleString()} XAF
                                </TableCell>
                                <TableCell>{loan.tenure_months} months</TableCell>
                                <TableCell className="max-w-[150px] truncate text-sm">{loan.purpose || "—"}</TableCell>
                                <TableCell>
                                  <Badge
                                    variant={loan.status === "approved" ? "default" : loan.status === "rejected" ? "destructive" : "secondary"}
                                    className="text-xs capitalize"
                                  >
                                    {loan.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm">
                                  {loan.created_at ? format(new Date(loan.created_at), "MMM d, yyyy") : "—"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Features Tab */}
                <TabsContent value="features">
                  <FeatureConfigPanel
                    key={selectedInstitution}
                    institutionId={selectedInstitution!}
                    appConfig={selectedAppConfig}
                  />
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
