import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { 
  Building2, 
  Users, 
  TrendingUp,
  FileText,
  ShieldCheck,
  Plus,
  Eye,
  EyeOff,
  Settings,
  Download
} from "lucide-react";
import { BusinessKYCForm } from "@/components/business/BusinessKYCForm";
import { BusinessSignatoryManager } from "@/components/business/BusinessSignatoryManager";
import { BusinessTransactionLimits } from "@/components/business/BusinessTransactionLimits";

const BusinessAccounts = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [businessKYC, setBusinessKYC] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [showBalances, setShowBalances] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [showKYCForm, setShowKYCForm] = useState(false);

  useEffect(() => {
    checkAuthAndFetchData();
  }, []);

  const checkAuthAndFetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }
    await fetchBusinessAccounts(user.id);
    setLoading(false);
  };

  const fetchBusinessAccounts = async (userId: string) => {
    // Fetch business current accounts
    const { data: accountData } = await supabase
      .from("accounts")
      .select("*")
      .eq("user_id", userId)
      .eq("account_type", "Business")
      .eq("account_subtype", "Current")
      .eq("is_active", true);
    
    if (accountData && accountData.length > 0) {
      setAccounts(accountData);
      setSelectedAccount(accountData[0].id);
      
      // Fetch balances
      const { data: balanceData } = await supabase
        .from("account_balances")
        .select("*")
        .in("account_id", accountData.map(a => a.id))
        .order("updated_at", { ascending: false });
      
      if (balanceData) setBalances(balanceData);

      // Fetch transactions
      const { data: txData } = await supabase
        .from("transactions")
        .select("*")
        .in("account_id", accountData.map(a => a.id))
        .order("booking_datetime", { ascending: false })
        .limit(20);
      
      if (txData) setTransactions(txData);
    }

    // Fetch business KYC data
    const { data: kycData } = await supabase
      .from("business_kyc")
      .select("*")
      .eq("user_id", userId);
    
    if (kycData) setBusinessKYC(kycData);
  };

  const formatCurrency = (amount: number, currency: string = "XAF") => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const getAccountBalance = (accountId: string) => {
    const balance = balances.find(b => b.account_id === accountId && b.balance_type === "InterimAvailable");
    return balance ? parseFloat(balance.amount) : 0;
  };

  const getKYCStatus = (accountId: string) => {
    const kyc = businessKYC.find(k => k.account_id === accountId);
    return kyc?.verification_status || 'pending';
  };

  const getKYCBadgeVariant = (status: string) => {
    switch (status) {
      case 'verified': return 'default';
      case 'in_review': return 'secondary';
      case 'rejected': return 'destructive';
      default: return 'outline';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>Loading your business accounts...</p>
      </div>
    );
  }

  const currentAccount = accounts.find(a => a.id === selectedAccount);
  const needsKYC = accounts.length === 0 || businessKYC.length === 0 || 
                   businessKYC.some(k => k.verification_status === 'pending' || k.verification_status === 'rejected');

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">Business Current Accounts</h1>
              <p className="text-muted-foreground">
                Manage your business banking, signatories, and operations
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowBalances(!showBalances)}>
                {showBalances ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                {showBalances ? "Hide" : "Show"} Balances
              </Button>
            </div>
          </div>
        </div>

        {needsKYC && (
          <Card className="mb-6 border-orange-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-600">
                <ShieldCheck className="h-5 w-5" />
                Business Verification Required
              </CardTitle>
              <CardDescription>
                Complete your business KYC verification to access full features
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => setShowKYCForm(true)}>
                <FileText className="mr-2 h-4 w-4" />
                Complete Business KYC
              </Button>
            </CardContent>
          </Card>
        )}

        {showKYCForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Business KYC Verification</CardTitle>
              <CardDescription>
                Provide your business details for verification
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BusinessKYCForm
                accountId={selectedAccount}
                onSuccess={() => {
                  setShowKYCForm(false);
                  checkAuthAndFetchData();
                  toast({ title: "Business KYC submitted successfully" });
                }}
                onCancel={() => setShowKYCForm(false)}
              />
            </CardContent>
          </Card>
        )}

        {accounts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Building2 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Business Accounts</h3>
              <p className="text-muted-foreground mb-6">
                Open a business current account to manage your company finances
              </p>
              <Button onClick={() => toast({ title: "Coming soon", description: "Business account opening will be available soon." })}>
                <Plus className="mr-2 h-4 w-4" />
                Open Business Account
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Account List Sidebar */}
            <div className="lg:col-span-1 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Your Business Accounts</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {accounts.map((account) => (
                    <button
                      key={account.id}
                      onClick={() => setSelectedAccount(account.id)}
                      className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                        selectedAccount === account.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold">
                          {account.business_details?.business_name || account.account_holder_name}
                        </span>
                        <Badge variant="outline" className="text-xs">{account.currency}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {account.identification_value}
                      </p>
                      <div className="flex items-center justify-between">
                        <p className="text-xl font-bold">
                          {showBalances ? formatCurrency(getAccountBalance(account.id), account.currency) : "••••••"}
                        </p>
                        <Badge variant={getKYCBadgeVariant(getKYCStatus(account.id))}>
                          {getKYCStatus(account.id)}
                        </Badge>
                      </div>
                    </button>
                  ))}
                  <Button variant="outline" className="w-full" onClick={() => toast({ title: "Coming soon" })}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Account
                  </Button>
                </CardContent>
              </Card>

              {/* Quick Stats */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Business Stats</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total Accounts</span>
                    <span className="font-bold">{accounts.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">This Month</span>
                    <span className="font-bold">{transactions.filter(t => 
                      new Date(t.booking_datetime).getMonth() === new Date().getMonth()
                    ).length} txns</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Verified</span>
                    <span className="font-bold">
                      {businessKYC.filter(k => k.verification_status === 'verified').length}/{businessKYC.length}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Main Account Details */}
            <div className="lg:col-span-2 space-y-6">
              {currentAccount && (
                <Tabs defaultValue="overview">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="signatories">Signatories</TabsTrigger>
                    <TabsTrigger value="limits">Limits</TabsTrigger>
                    <TabsTrigger value="transactions">Transactions</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview" className="space-y-4">
                    {/* Account Overview */}
                    <Card className="bg-gradient-to-br from-primary/10 to-accent/10">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle>
                              {currentAccount.business_details?.business_name || currentAccount.account_holder_name}
                            </CardTitle>
                            <CardDescription>
                              {currentAccount.business_details?.business_type || 'Business'} • {currentAccount.account_subtype} Account
                            </CardDescription>
                          </div>
                          <Badge>{currentAccount.is_active ? "Active" : "Inactive"}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Available Balance</p>
                            <p className="text-4xl font-bold">
                              {showBalances ? formatCurrency(getAccountBalance(currentAccount.id), currentAccount.currency) : "••••••"}
                            </p>
                          </div>
                          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                            <div>
                              <p className="text-sm text-muted-foreground">Account Number</p>
                              <p className="font-mono font-semibold">{currentAccount.identification_value}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Currency</p>
                              <p className="font-semibold">{currentAccount.currency}</p>
                            </div>
                            {currentAccount.business_details?.registration_number && (
                              <>
                                <div>
                                  <p className="text-sm text-muted-foreground">Registration Number</p>
                                  <p className="font-semibold">{currentAccount.business_details.registration_number}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Industry</p>
                                  <p className="font-semibold">{currentAccount.business_details.industry || 'N/A'}</p>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Quick Actions */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Quick Actions</CardTitle>
                      </CardHeader>
                      <CardContent className="grid grid-cols-2 gap-3">
                        <Button variant="outline" className="w-full" onClick={() => navigate('/payments')}>
                          <TrendingUp className="mr-2 h-4 w-4" />
                          Make Payment
                        </Button>
                        <Button variant="outline" className="w-full" onClick={() => navigate('/banking-ops')}>
                          <FileText className="mr-2 h-4 w-4" />
                          Bulk Transfer
                        </Button>
                        <Button variant="outline" className="w-full" onClick={() => toast({ title: "Coming soon" })}>
                          <Download className="mr-2 h-4 w-4" />
                          Statement
                        </Button>
                        <Button variant="outline" className="w-full" onClick={() => toast({ title: "Coming soon" })}>
                          <Settings className="mr-2 h-4 w-4" />
                          Settings
                        </Button>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="signatories">
                    <BusinessSignatoryManager accountId={currentAccount.id} />
                  </TabsContent>

                  <TabsContent value="limits">
                    <BusinessTransactionLimits
                      accountId={currentAccount.id}
                      currentLimits={currentAccount.transaction_limits}
                      onUpdate={(limits) => {
                        toast({ title: "Transaction limits updated successfully" });
                        checkAuthAndFetchData();
                      }}
                    />
                  </TabsContent>

                  <TabsContent value="transactions" className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>Recent Transactions</CardTitle>
                        <CardDescription>Latest business transactions</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {transactions
                            .filter(tx => tx.account_id === currentAccount.id)
                            .map((tx) => (
                              <div key={tx.id} className="flex items-center justify-between p-3 border rounded">
                                <div>
                                  <p className="font-medium">{tx.transaction_information || "Transaction"}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {new Date(tx.booking_datetime).toLocaleString()}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className={`font-bold ${tx.credit_debit_indicator === "Credit" ? "text-green-600" : "text-red-600"}`}>
                                    {tx.credit_debit_indicator === "Credit" ? "+" : "-"}
                                    {showBalances ? formatCurrency(Math.abs(parseFloat(tx.amount)), tx.currency) : "••••"}
                                  </p>
                                  <Badge variant="outline" className="text-xs">{tx.status}</Badge>
                                </div>
                              </div>
                            ))}
                          {transactions.filter(tx => tx.account_id === currentAccount.id).length === 0 && (
                            <p className="text-center text-muted-foreground py-8">
                              No transactions yet.
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BusinessAccounts;
