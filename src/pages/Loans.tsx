import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Wallet, TrendingUp, Clock, CheckCircle2 } from "lucide-react";
import LoanProductCard from "@/components/loans/LoanProductCard";
import LoanApplicationForm from "@/components/loans/LoanApplicationForm";
import LoanAccountCard from "@/components/loans/LoanAccountCard";

export default function Loans() {
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [showApplicationForm, setShowApplicationForm] = useState(false);

  // Fetch loan products
  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ['loan-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loan_products')
        .select('*')
        .eq('is_active', true)
        .order('product_name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch user's loan applications
  const { data: applications } = useQuery({
    queryKey: ['loan-applications'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from('loan_applications')
        .select('*, loan_products(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch user's loan accounts
  const { data: loanAccounts } = useQuery({
    queryKey: ['loan-accounts'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from('loan_accounts')
        .select('*, loan_products(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const activeLoans = loanAccounts?.filter(l => ['active', 'disbursed'].includes(l.status)) || [];
  const totalBorrowed = activeLoans.reduce((sum, loan) => sum + Number(loan.principal_amount), 0);
  const totalOutstanding = activeLoans.reduce((sum, loan) => sum + Number(loan.outstanding_balance), 0);
  const pendingApplications = applications?.filter(a => ['submitted', 'under_review'].includes(a.status)).length || 0;

  const handleApply = (product: any) => {
    setSelectedProduct(product);
    setShowApplicationForm(true);
  };

  if (showApplicationForm && selectedProduct) {
    return (
      <LoanApplicationForm
        product={selectedProduct}
        onBack={() => {
          setShowApplicationForm(false);
          setSelectedProduct(null);
        }}
      />
    );
  }

  const stats = [
    { label: "Active Loans", value: activeLoans.length, icon: Wallet, color: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400" },
    { label: "Total Borrowed", value: `${totalBorrowed.toLocaleString()} XAF`, icon: TrendingUp, color: "bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400" },
    { label: "Outstanding", value: `${totalOutstanding.toLocaleString()} XAF`, icon: Clock, color: "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400" },
    { label: "Pending Apps", value: pendingApplications, icon: CheckCircle2, color: "bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Loans</h1>
        <p className="text-muted-foreground mt-1">Apply for loans and manage your borrowings</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="rounded-xl border-0 shadow-sm hover:shadow-md transition-all duration-200">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${stat.color}`}>
                  <stat.icon className="h-4 w-4" />
                </div>
              </div>
              <p className="text-2xl font-bold tracking-tight">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="products" className="space-y-6">
        <TabsList className="inline-flex h-10 items-center rounded-full bg-muted p-1 text-muted-foreground">
          <TabsTrigger value="products" className="rounded-full px-4 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">Loan Products</TabsTrigger>
          <TabsTrigger value="my-loans" className="rounded-full px-4 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">My Loans</TabsTrigger>
          <TabsTrigger value="applications" className="rounded-full px-4 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">Applications</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-4">
          <Card className="rounded-xl border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Available Loan Products</CardTitle>
              <CardDescription className="text-xs">Browse and apply for loans that suit your needs</CardDescription>
            </CardHeader>
            <CardContent>
              {productsLoading ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
                </div>
              ) : products && products.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {products.map((product) => (
                    <LoanProductCard key={product.id} product={product} onApply={handleApply} />
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon"><Wallet className="h-6 w-6 text-muted-foreground" /></div>
                  <p className="text-sm text-muted-foreground">No loan products available at the moment.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="my-loans" className="space-y-4">
          {activeLoans.length > 0 ? (
            <div className="grid gap-4">
              {activeLoans.map((loan) => (
                <LoanAccountCard key={loan.id} loan={loan} />
              ))}
            </div>
          ) : (
            <Card className="rounded-xl border-0 shadow-sm">
              <CardContent className="empty-state">
                <div className="empty-state-icon"><Wallet className="h-6 w-6 text-muted-foreground" /></div>
                <p className="text-sm text-muted-foreground">You don't have any active loans.</p>
                <Button variant="outline" size="sm" className="mt-3 rounded-full" onClick={() => document.querySelector<HTMLButtonElement>('[value="products"]')?.click()}>
                  Browse Loan Products
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="applications" className="space-y-4">
          <Card className="rounded-xl border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Loan Applications</CardTitle>
              <CardDescription className="text-xs">Track the status of your loan applications</CardDescription>
            </CardHeader>
            <CardContent>
              {applications && applications.length > 0 ? (
                <div className="space-y-3">
                  {applications.map((app) => (
                    <div key={app.id} className="rounded-xl bg-muted/30 p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-sm">{app.loan_products?.product_name}</h3>
                          <p className="text-xs text-muted-foreground">#{app.application_number}</p>
                          <p className="text-lg font-bold tracking-tight mt-1">{Number(app.requested_amount).toLocaleString()} XAF</p>
                          <p className="text-xs text-muted-foreground">{app.tenure_months} months • {app.repayment_frequency}</p>
                        </div>
                        <div className="text-right">
                          <span className={`status-pill ${
                            app.status === 'approved' ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400' :
                            app.status === 'rejected' ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400' :
                            app.status === 'under_review' ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400' :
                            'bg-muted text-muted-foreground'
                          }`}>
                            {app.status.replace('_', ' ').toUpperCase()}
                          </span>
                          <p className="text-[10px] text-muted-foreground mt-2">
                            Applied: {new Date(app.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      {app.rejection_reason && (
                        <Alert className="mt-3 rounded-xl">
                          <AlertDescription className="text-xs">{app.rejection_reason}</AlertDescription>
                        </Alert>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon"><CheckCircle2 className="h-6 w-6 text-muted-foreground" /></div>
                  <p className="text-sm text-muted-foreground">You haven't submitted any loan applications yet.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
